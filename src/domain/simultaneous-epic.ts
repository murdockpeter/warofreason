import type { WaterlooCampaign, WaterlooReceipt } from './waterloo-schema';
import type { EpicRevision, EpicInput } from './simultaneous-epic-schema';

export function canRecordEpic(c: WaterlooCampaign) {
  return (
    !!c.fontenoy &&
    c.status === 'active' &&
    !c.fontenoy.siege.campaign?.victory &&
    (c.phase === 'checkpoint' ||
      (c.phase === 'planning' &&
        !c.submissions.some((s) => s.locked || s.orders.length))) &&
    !c.encounters.some((e) => !e.settled) &&
    !c.battles.some((b) => !b.appliedVersion)
  );
}
export function currentEpicEntries(c: WaterlooCampaign): EpicRevision[] {
  const entries = new Map<string, EpicRevision>();
  for (const revision of c.fontenoy?.epic?.revisions ?? [])
    entries.set(revision.entryId, revision);
  return [...entries.values()];
}
export function epicSummary(c: WaterlooCampaign, side: 'french' | 'allied') {
  const entries = currentEpicEntries(c),
    recorded = entries.filter((e) => e.input.points[side] !== null);
  const battles = c.battles.filter(
    (b) =>
      b.appliedVersion &&
      [...b.initial, ...b.reinforcementForces].some((f) => f.side === side),
  );
  return {
    total: recorded.length
      ? recorded.reduce((sum, e) => sum + e.input.points[side]!, 0)
      : null,
    recorded: recorded.length,
    missingValues: entries.length - recorded.length,
    battlesWithoutEntry: battles.filter(
      (b) =>
        !entries.some(
          (e) =>
            e.input.source.kind === 'battle' &&
            e.input.source.battleId === b.id,
        ),
    ).length,
  };
}
const sameInput = (a: EpicInput, b: EpicInput) =>
  a.source.kind === b.source.kind &&
  (a.source.kind === 'battle'
    ? a.source.battleId === (b.source as { battleId: string }).battleId
    : a.source.title === (b.source as { title: string }).title) &&
  a.points.french === b.points.french &&
  a.points.allied === b.points.allied &&
  a.notes === b.notes;
export function applyEpicCommand(
  c: WaterlooCampaign,
  receipt: WaterlooReceipt,
) {
  if (!canRecordEpic(c))
    throw new Error(
      'Review Epic Points during clear planning or a fully settled checkpoint, before campaign conclusion. Finish outstanding contacts and battles first.',
    );
  const m = c.fontenoy!,
    { command, recordId, timestamp } = receipt;
  if (command.kind === 'maurice-epic-enable') {
    if (m.epic)
      throw new Error('Manual Epic Points tracking is already enabled.');
    m.epic = {
      ruleId: 'maurice_manual_epic_v0.1',
      enabledAt: c.cursor,
      revisions: [],
    };
    c.log.push(
      'Manual Epic Points tracking enabled. Missing values remain unrecorded; no Maurice scoring or card effects are calculated.',
    );
  } else if (command.kind === 'maurice-epic-record') {
    const ledger = m.epic;
    if (!ledger) throw new Error('Enable manual Epic Points tracking first.');
    if (ledger.revisions.length >= 500)
      throw new Error(
        'The 500-revision Epic Points ledger is full. Export the campaign history.',
      );
    const entries = currentEpicEntries(c),
      prior = entries.find((e) => e.entryId === command.entryId);
    if (
      command.entryId
        ? !prior || prior.version !== command.expectedVersion
        : command.expectedVersion !== 0
    )
      throw new Error(
        'This Epic Points entry changed or no longer exists. Reopen its latest version before correcting it.',
      );
    if (
      prior &&
      (prior.input.source.kind !== command.input.source.kind ||
        (prior.input.source.kind === 'battle' &&
          command.input.source.kind === 'battle' &&
          prior.input.source.battleId !== command.input.source.battleId))
    )
      throw new Error(
        'Corrections must keep the original battle or campaign-event source.',
      );
    if (prior && sameInput(prior.input, command.input))
      throw new Error(
        'Change the recorded values or explanation before saving a correction.',
      );
    const source = command.input.source;
    const battle =
      source.kind === 'battle'
        ? c.battles.find((b) => b.id === source.battleId)
        : null;
    if (
      command.input.source.kind === 'battle' &&
      (!battle || !battle.appliedVersion)
    )
      throw new Error(
        'Choose an applied, reviewed battle for its Epic Points entry.',
      );
    if (
      !prior &&
      battle &&
      entries.some(
        (e) =>
          e.input.source.kind === 'battle' &&
          e.input.source.battleId === battle.id,
      )
    )
      throw new Error(
        'This battle already has an Epic Points entry. Correct that entry instead of counting it twice.',
      );
    const ids = [
      c.id,
      ...c.corps.map((f) => f.id),
      ...c.hqs.map((f) => f.id),
      ...c.battles.map((b) => b.id),
      ...m.units.map((u) => u.id),
      ...m.commanders.map((u) => u.id),
      ...m.factions.map((f) => f.id),
      ...(m.officers?.records.map((r) => r.id) ?? []),
      ...ledger.revisions.map((r) => r.id),
    ];
    if (ids.includes(recordId))
      throw new Error('Epic Points revision identities must be unique.');
    ledger.revisions.push({
      id: recordId,
      entryId: prior?.entryId ?? recordId,
      version: (prior?.version ?? 0) + 1,
      supersedesId: prior?.id ?? null,
      turn: c.turn,
      at: c.cursor,
      timestamp,
      battleVersion: prior?.battleVersion ?? battle?.appliedVersion ?? null,
      input: structuredClone(command.input),
      reason: command.reason,
    });
    c.log.push(
      `Manual Epic Points ${prior ? 'correction' : 'entry'} recorded (version ${(prior?.version ?? 0) + 1}). Totals use current versions only; no strategic effects applied.`,
    );
  }
  c.effectSerial++;
}
export function epicLedgerIssues(c: WaterlooCampaign): string[] {
  const ledger = c.fontenoy?.epic;
  if (!ledger) return [];
  const issues: string[] = [],
    seen = new Set<string>(),
    battles = new Set<string>(),
    latest = new Map<string, EpicRevision>();
  const fail = () =>
    issues.push(
      'Epic Points history must retain valid sources, sequential revisions and reviewed battle versions.',
    );
  let at = ledger.enabledAt,
    turn = 0,
    timestamp = '';
  if (at > c.cursor) fail();
  for (const r of ledger.revisions) {
    const prior = latest.get(r.entryId),
      source = r.input.source;
    if (
      seen.has(r.id) ||
      r.at < at ||
      r.at > c.cursor ||
      r.turn < turn ||
      r.turn > c.turn ||
      r.timestamp < timestamp ||
      r.version !== (prior?.version ?? 0) + 1 ||
      r.supersedesId !== (prior?.id ?? null) ||
      (!prior && r.entryId !== r.id)
    )
      fail();
    if (source.kind === 'battle') {
      const battle = c.battles.find((b) => b.id === source.battleId);
      if (
        !battle ||
        !battle.appliedVersion ||
        r.battleVersion !== battle.appliedVersion ||
        (!prior && battles.has(source.battleId))
      )
        fail();
      battles.add(source.battleId);
    } else if (r.battleVersion !== null) fail();
    if (
      prior &&
      (prior.battleVersion !== r.battleVersion ||
        prior.input.source.kind !== source.kind ||
        (source.kind === 'battle' &&
          prior.input.source.kind === 'battle' &&
          source.battleId !== prior.input.source.battleId) ||
        sameInput(prior.input, r.input))
    )
      fail();
    latest.set(r.entryId, r);
    seen.add(r.id);
    at = r.at;
    turn = r.turn;
    timestamp = r.timestamp;
  }
  return issues;
}
