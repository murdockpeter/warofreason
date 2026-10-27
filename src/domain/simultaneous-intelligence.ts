import type {
  WaterlooCampaign,
  WaterlooCorps,
  WaterlooReceipt,
} from './waterloo-schema';
import type { IntelligenceLedger } from './simultaneous-intelligence-schema';

function reservedIdentities(c: WaterlooCampaign) {
  return [
    c.id,
    ...c.corps.map((f) => f.id),
    ...c.hqs.map((h) => h.id),
    ...c.battles.map((b) => b.id),
    ...c.encounters.map((e) => e.id),
    ...(c.fontenoy?.units.map((u) => u.id) ?? []),
    ...(c.fontenoy?.commanders.map((o) => o.id) ?? []),
    ...(c.fontenoy?.factions.map((f) => f.id) ?? []),
    ...(c.fontenoy?.officers?.records.map((r) => r.id) ?? []),
    ...(c.fontenoy?.epic?.revisions.map((r) => r.id) ?? []),
  ];
}

export function canRequestScouting(c: WaterlooCampaign, f: WaterlooCorps) {
  return (
    !!c.fontenoy &&
    c.status === 'active' &&
    !c.fontenoy.siege.campaign?.victory &&
    ['planning', 'locked'].includes(c.phase) &&
    (!c.preparation || c.preparation.resolved) &&
    !c.submissions.find((s) => s.side === f.side)?.locked &&
    f.status === 'ready' &&
    !!f.hexId &&
    f.kind !== 'detachment' &&
    !c.preparation?.withdrawnCorpsIds.includes(f.id) &&
    !c.battles.some((b) => !b.appliedVersion) &&
    !c.encounters.some((e) => !e.settled)
  );
}
export function canReleaseIntelligence(c: WaterlooCampaign) {
  return (
    !!c.fontenoy &&
    c.status === 'active' &&
    !c.fontenoy.siege.campaign?.victory &&
    (['planning', 'locked'].includes(c.phase) || c.phase === 'checkpoint') &&
    (!c.preparation || c.preparation.resolved) &&
    !c.battles.some((b) => !b.appliedVersion) &&
    !c.encounters.some((e) => !e.settled)
  );
}
export function latestIntelligence(c: WaterlooCampaign) {
  const latest = new Map<string, IntelligenceLedger['reports'][number]>();
  for (const report of c.fontenoy?.intelligence?.reports ?? [])
    latest.set(report.requestId, report);
  return [...latest.values()];
}
// This DTO is the only input for faction report cards and map markers. Never join it to live enemy data.
export function intelligenceView(
  c: WaterlooCampaign,
  side: 'french' | 'allied',
) {
  const latest = latestIntelligence(c);
  return (c.fontenoy?.intelligence?.requests ?? [])
    .filter((r) => r.side === side)
    .map((r) => {
      const report = latest.find((p) => p.requestId === r.id);
      const expired =
        !!report &&
        report.input.level !== 'none' &&
        report.input.expiresAfterTurn < c.turn;
      return {
        requestId: r.id,
        corpsId: r.input.corpsId,
        requestedTurn: r.turn,
        areaHexId: r.input.hexId,
        question: r.input.question,
        version: report?.version ?? 0,
        observedTurn: report?.observedTurn ?? null,
        observedAt: report?.observedAt ?? null,
        status: expired
          ? ('expired' as const)
          : report
            ? ('reported' as const)
            : r.turn < c.turn
              ? ('unanswered' as const)
              : ('pending' as const),
        // Expired observations and all internal revision explanations stay out of faction-facing DTOs.
        observation: expired ? null : (report?.input ?? null),
      };
    });
}
export function applyIntelligenceCommand(
  c: WaterlooCampaign,
  receipt: WaterlooReceipt,
) {
  const { command, recordId, timestamp } = receipt;
  if (!c.fontenoy) throw new Error('Open a simultaneous Fontenoy campaign.');
  const ledger = c.fontenoy.intelligence ?? {
    ruleId: 'manual_reconnaissance_v0.1' as const,
    requests: [],
    reports: [],
  };
  if (
    [...ledger.requests, ...ledger.reports].some((r) => r.id === recordId) ||
    reservedIdentities(c).includes(recordId)
  )
    throw new Error('Scouting record identities must be unique.');
  if (command.kind === 'maurice-scout-request') {
    const f = c.corps.find((f) => f.id === command.input.corpsId);
    if (!f || !canRequestScouting(c, f))
      throw new Error(
        'Request scouting from a ready formation during its unlocked movement planning, after preparation.',
      );
    if (!c.hexes.some((h) => h.id === command.input.hexId))
      throw new Error('Choose a map hex to scout.');
    if (ledger.requests.length >= 500)
      throw new Error(
        'The scouting request history is full. Export the campaign history.',
      );
    if (
      ledger.requests.some(
        (r) =>
          r.turn === c.turn &&
          r.input.corpsId === f.id &&
          !ledger.reports.some((p) => p.requestId === r.id),
      )
    )
      throw new Error(
        'This formation already has an unanswered request this phase.',
      );
    ledger.requests.push({
      id: recordId,
      side: f.side,
      turn: c.turn,
      at: c.cursor,
      timestamp,
      input: structuredClone(command.input),
    });
  } else if (command.kind === 'maurice-intelligence-report') {
    if (!canReleaseIntelligence(c))
      throw new Error(
        'Release intelligence during settled planning or a settled checkpoint, before campaign conclusion.',
      );
    const request = ledger.requests.find((r) => r.id === command.requestId);
    const prior = latestIntelligence(c).find(
      (r) => r.requestId === command.requestId,
    );
    if (!request || (!prior && request.turn !== c.turn))
      throw new Error(
        'Only unanswered requests from the current phase can receive a new report.',
      );
    if ((prior?.version ?? 0) !== command.expectedVersion)
      throw new Error(
        'This intelligence report changed. Reopen its latest version.',
      );
    if (ledger.reports.length >= 500)
      throw new Error(
        'The intelligence revision history is full. Export the campaign history.',
      );
    const observation = command.input;
    if (
      observation.level !== 'none' &&
      (!c.hexes.some((h) => h.id === observation.hexId) ||
        observation.expiresAfterTurn < (prior?.observedTurn ?? c.turn))
    )
      throw new Error(
        'Choose a map position and an expiry at or after the observation phase.',
      );
    if (prior && JSON.stringify(prior.input) === JSON.stringify(command.input))
      throw new Error('Change the report before saving a correction.');
    ledger.reports.push({
      id: recordId,
      requestId: request.id,
      version: (prior?.version ?? 0) + 1,
      supersedesId: prior?.id ?? null,
      observedAt: prior?.observedAt ?? c.cursor,
      observedTurn: prior?.observedTurn ?? c.turn,
      turn: c.turn,
      at: c.cursor,
      timestamp,
      input: structuredClone(command.input),
      reason: command.reason,
    });
  } else throw new Error('Invalid intelligence command.');
  c.fontenoy.intelligence = ledger;
  // Generic log text deliberately omits either side's request, position or released information.
  c.log.push(
    'Manual reconnaissance record saved. No movement, dice threshold or card effects were applied.',
  );
  c.effectSerial++;
}
export function intelligenceIssues(c: WaterlooCampaign): string[] {
  const ledger = c.fontenoy?.intelligence;
  if (!ledger) return [];
  const issues: string[] = [],
    ids = new Set(reservedIdentities(c));
  const fail = () =>
    issues.push(
      'Intelligence must preserve valid ownership, map references, chronology and sequential report revisions.',
    );
  let requestAt = 0,
    requestTurn = 0,
    requestTimestamp = '';
  for (const r of ledger.requests) {
    const f = c.corps.find((f) => f.id === r.input.corpsId);
    if (
      ids.has(r.id) ||
      !f ||
      f.side !== r.side ||
      !c.hexes.some((h) => h.id === r.input.hexId) ||
      r.turn > c.turn ||
      r.turn < requestTurn ||
      r.at > c.cursor ||
      r.at < requestAt ||
      r.timestamp < requestTimestamp
    )
      fail();
    ids.add(r.id);
    requestAt = r.at;
    requestTurn = r.turn;
    requestTimestamp = r.timestamp;
  }
  const latest = new Map<string, IntelligenceLedger['reports'][number]>();
  let at = 0,
    turn = 0,
    timestamp = '';
  for (const p of ledger.reports) {
    const r = ledger.requests.find((r) => r.id === p.requestId),
      prior = latest.get(p.requestId);
    if (
      ids.has(p.id) ||
      !r ||
      p.turn < r.turn ||
      (!prior && p.turn !== r.turn) ||
      p.observedTurn !== r.turn ||
      p.at < r.at ||
      p.observedAt < r.at ||
      p.observedAt > p.at ||
      (prior && p.observedAt !== prior.observedAt) ||
      p.timestamp < r.timestamp ||
      p.turn > c.turn ||
      p.turn < turn ||
      p.at > c.cursor ||
      p.at < at ||
      p.timestamp < timestamp ||
      p.version !== (prior?.version ?? 0) + 1 ||
      p.supersedesId !== (prior?.id ?? null) ||
      (prior && JSON.stringify(prior.input) === JSON.stringify(p.input))
    )
      fail();
    const observation = p.input;
    if (
      observation.level !== 'none' &&
      (!c.hexes.some((h) => h.id === observation.hexId) ||
        observation.expiresAfterTurn < p.observedTurn)
    )
      fail();
    ids.add(p.id);
    latest.set(p.requestId, p);
    at = p.at;
    turn = p.turn;
    timestamp = p.timestamp;
  }
  return issues;
}
