import type { WaterlooCampaign, WaterlooReceipt } from './waterloo-schema';
import type { OfficerAction } from './simultaneous-commanders-schema';
type Officer = NonNullable<WaterlooCampaign['fontenoy']>['commanders'][number];
const sameOfficer = (
  a: Officer | null | undefined,
  b: Officer | null | undefined,
) => {
  if (!a || !b) return !a && !b;
  const ordered = (u: Officer) =>
    Object.entries(u).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
};

export function canManageOfficers(c: WaterlooCampaign, attachment = false) {
  return (
    c.status === 'active' &&
    !c.fontenoy?.siege.campaign?.victory &&
    (c.phase === 'planning' || (!attachment && c.phase === 'checkpoint')) &&
    !c.submissions.some(
      (s) => c.phase === 'planning' && (s.locked || s.orders.length),
    ) &&
    !c.encounters.some((e) => !e.settled) &&
    !c.battles.some((b) => !b.appliedVersion) &&
    !c.fontenoy?.siege.campaign?.pendingReview &&
    !(
      c.preparation &&
      (c.preparation.deploymentHqIds.length ||
        c.preparation.submissions.some((s) => s.locked || s.orders.length)) &&
      (attachment || !c.preparation.resolved)
    )
  );
}
export function applyCommanderCommand(
  c: WaterlooCampaign,
  receipt: WaterlooReceipt,
) {
  const m = c.fontenoy,
    { command, recordId, timestamp } = receipt;
  if (!m) throw new Error('Open a simultaneous Maurice Fontenoy campaign.');
  const enabling = command.kind === 'maurice-commanders-enable';
  const action = command.kind === 'maurice-commander' ? command.action : null;
  if (
    [
      c.id,
      ...c.corps.map((f) => f.id),
      ...c.hqs.map((f) => f.id),
      ...c.battles.map((f) => f.id),
      ...m.commanders.map((f) => f.id),
      ...m.units.map((f) => f.id),
      ...m.factions.map((f) => f.id),
      ...(m.officers?.records.map((r) => r.id) ?? []),
    ].includes(recordId)
  )
    throw new Error('Officer record identities must be unique.');
  if (!canManageOfficers(c, enabling || action?.kind === 'attachment'))
    throw new Error(
      'Review officers during clear planning or a settled checkpoint, before the siege review. Attachments and enablement require clear planning before orders or preparation submissions.',
    );
  if (enabling) {
    if (m.officers) throw new Error('Commander management is already enabled.');
    if (
      m.formations.some((f) =>
        f.commanderIds.some(
          (id) =>
            (m.commanders.find((u) => u.id === id)?.campaignStatus ??
              'active') !== 'active',
        ),
      )
    )
      throw new Error(
        'Reconcile unavailable attached commanders before enabling management.',
      );
    m.officers = {
      ruleId: 'maurice_commanders_v0.1',
      enabledAt: c.cursor,
      baseline: structuredClone(m.commanders),
      assignments: m.formations.flatMap((f) =>
        f.commanderIds.map((commanderId) => ({
          commanderId,
          corpsId: f.corpsId,
        })),
      ),
      records: [],
    };
    c.log.push(
      'Reviewed manual commander/Notable management. Current officers and attachments preserved as the clone baseline; no card effects or HQ ratings are automated.',
    );
  } else if (action) {
    if (!m.officers) throw new Error('Enable commander management first.');
    if (m.officers.records.length >= 500)
      throw new Error(
        'The 500-entry officer record limit is reached. Export the campaign history.',
      );
    const before =
      action.kind === 'arrival'
        ? null
        : m.commanders.find((u) => u.id === action.commanderId);
    if (action.kind !== 'arrival' && !before)
      throw new Error('Choose an existing commander.');
    const fromCorpsId = before
      ? (m.formations.find((f) => f.commanderIds.includes(before.id))
          ?.corpsId ?? null)
      : null;
    let after = before ? structuredClone(before) : null;
    let toCorpsId = fromCorpsId;
    if (action.kind === 'arrival') {
      if (m.commanders.length >= 1000)
        throw new Error('The commander roster is full.');
      after = {
        id: recordId,
        factionId: m.factions.find((f) => f.side === action.side)!.id,
        displayName: action.displayName,
        notableReference: action.notableReference,
        campaignStatus: 'active',
        provenance: 'house_rule_v0.1',
        sourceRef: action.notes.slice(0, 500),
      };
    } else if (action.kind === 'details') {
      after!.displayName = action.displayName;
      after!.notableReference = action.notableReference;
    } else if (action.kind === 'status') {
      after!.campaignStatus = action.status;
      if (action.status !== 'active') toCorpsId = null;
    } else {
      if ((after!.campaignStatus ?? 'active') !== 'active')
        throw new Error('Only active officers can be attached.');
      const target = action.corpsId
        ? m.formations.find((f) => f.corpsId === action.corpsId)
        : null;
      if (
        action.corpsId &&
        (!target ||
          !c.corps.some(
            (f) =>
              f.id === target.corpsId &&
              f.side ===
                m.factions.find((s) => s.id === after!.factionId)?.side &&
              ['ready', 'blown'].includes(f.status),
          ))
      )
        throw new Error(
          'Attach officers only to their own faction’s mapped, non-eliminated formations.',
        );
      toCorpsId = action.corpsId;
    }
    if (
      before &&
      before.displayName === after!.displayName &&
      (before.notableReference ?? '') === (after!.notableReference ?? '') &&
      (before.campaignStatus ?? 'active') ===
        (after!.campaignStatus ?? 'active') &&
      fromCorpsId === toCorpsId
    )
      throw new Error('Choose an officer change before saving.');
    m.commanders = before
      ? m.commanders.map((u) => (u.id === after!.id ? after! : u))
      : [...m.commanders, after!];
    if (fromCorpsId !== toCorpsId) {
      for (const f of m.formations)
        f.commanderIds = f.commanderIds.filter((id) => id !== after!.id);
      m.formations
        .find((f) => f.corpsId === toCorpsId)
        ?.commanderIds.push(after!.id);
    }
    m.officers.records.push({
      id: recordId,
      turn: c.turn,
      at: c.cursor,
      timestamp,
      action: structuredClone(action),
      before: before ? structuredClone(before) : null,
      after: structuredClone(after!),
      fromCorpsId,
      toCorpsId,
    });
    c.log.push(
      `Commander ${action.kind} recorded for ${after!.displayName}. Status: ${after!.campaignStatus ?? 'active'}. Manual decision; no tactical or HQ bonuses calculated.`,
    );
  }
  c.effectSerial++;
}

export function commanderRecordIssues(c: WaterlooCampaign): string[] {
  const m = c.fontenoy,
    state = m?.officers;
  if (!m || !state) return [];
  const issues: string[] = [];
  const fail = () =>
    issues.push(
      'Commander history, ownership, status and attachments must agree with the reviewed baseline and changes.',
    );
  const officers = new Map(
    state.baseline.map((u) => [u.id, structuredClone(u)]),
  );
  const attachments = new Map(
    state.assignments.map((a) => [a.commanderId, a.corpsId]),
  );
  const validAttachment = (
    u: (typeof m.commanders)[number],
    corpsId: string | null,
  ) =>
    !corpsId ||
    ((u.campaignStatus ?? 'active') === 'active' &&
      m.formations.some((f) => f.corpsId === corpsId) &&
      c.corps.some(
        (f) =>
          f.id === corpsId &&
          f.side === m.factions.find((s) => s.id === u.factionId)?.side,
      ));
  if (
    officers.size !== state.baseline.length ||
    attachments.size !== state.assignments.length ||
    state.enabledAt > c.cursor
  )
    fail();
  for (const [id, corpsId] of attachments)
    if (!officers.has(id) || !validAttachment(officers.get(id)!, corpsId))
      fail();
  let at = state.enabledAt,
    turn = 0,
    stamp = '';
  const recordIds = new Set<string>();
  for (const r of state.records) {
    const before = officers.get(r.after.id) ?? null,
      from = attachments.get(r.after.id) ?? null;
    if (
      recordIds.has(r.id) ||
      r.at < at ||
      r.at > c.cursor ||
      r.turn < turn ||
      r.turn > c.turn ||
      r.timestamp < stamp ||
      !sameOfficer(before, r.before) ||
      from !== r.fromCorpsId ||
      !validAttachment(r.after, r.toCorpsId)
    )
      fail();
    const action: OfficerAction = r.action;
    const expected = before ? structuredClone(before) : null;
    let to = from;
    if (action.kind === 'arrival') {
      if (
        before ||
        r.after.id !== r.id ||
        r.after.displayName !== action.displayName ||
        r.after.notableReference !== action.notableReference ||
        r.after.factionId !==
          m.factions.find((f) => f.side === action.side)?.id ||
        r.after.campaignStatus !== 'active' ||
        r.after.provenance !== 'house_rule_v0.1' ||
        r.after.sourceRef !== action.notes.slice(0, 500) ||
        r.toCorpsId !== null
      )
        fail();
    } else {
      if (!expected || expected.id !== action.commanderId) {
        fail();
        continue;
      }
      if (action.kind === 'details') {
        expected.displayName = action.displayName;
        expected.notableReference = action.notableReference;
      } else if (action.kind === 'status') {
        expected.campaignStatus = action.status;
        if (action.status !== 'active') to = null;
      } else {
        to = action.corpsId;
        if ((expected.campaignStatus ?? 'active') !== 'active') fail();
      }
      if (!sameOfficer(expected, r.after) || to !== r.toCorpsId) fail();
    }
    officers.set(r.after.id, r.after);
    attachments.delete(r.after.id);
    if (r.toCorpsId) attachments.set(r.after.id, r.toCorpsId);
    recordIds.add(r.id);
    at = r.at;
    turn = r.turn;
    stamp = r.timestamp;
  }
  if (
    officers.size !== m.commanders.length ||
    m.commanders.some((u) => !sameOfficer(officers.get(u.id), u))
  )
    fail();
  const actual = m.formations.flatMap((f) =>
    f.commanderIds.map((id) => [id, f.corpsId] as const),
  );
  if (
    attachments.size !== actual.length ||
    actual.some(([id, corpsId]) => attachments.get(id) !== corpsId)
  )
    fail();
  for (const u of m.commanders)
    if (!m.factions.some((f) => f.id === u.factionId)) fail();
  return issues;
}
