import type {
  WaterlooCampaign,
  WaterlooCorps,
  WaterlooReceipt,
} from './waterloo-schema';
import type {
  ManualPlacement,
  ManualRuling,
} from './manual-adjudication-schema';
import { refreshMauriceRosters } from './simultaneous-aftermath';

export function canAdjudicate(c: WaterlooCampaign) {
  return (
    !!c.fontenoy &&
    (!c.fontenoy.historicalProfile ||
      !!c.fontenoy.historicalProfile.reviewedAt) &&
    c.status === 'active' &&
    !c.fontenoy.siege.campaign?.victory &&
    ['planning', 'checkpoint'].includes(c.phase) &&
    !c.submissions.some(
      (s) => c.phase === 'planning' && (s.locked || s.orders.length),
    ) &&
    !c.encounters.some((e) => !e.settled) &&
    !c.battles.some((b) => !b.appliedVersion) &&
    !c.fontenoy.siege.campaign?.pendingReview &&
    !(
      c.preparation &&
      !c.preparation.resolved &&
      (c.preparation.deploymentHqIds.length ||
        c.preparation.submissions.some((s) => s.locked || s.orders.length))
    )
  );
}
export function manualPlacement(f: WaterlooCorps): ManualPlacement {
  return {
    corpsId: f.id,
    hexId: f.hexId,
    status: f.status === 'reserve' ? 'blown' : f.status,
    formation: f.formation,
    reportedStrength: f.reportedStrength ?? '',
  };
}
export function newManualRuling(
  c: WaterlooCampaign,
  corpsId?: string,
): ManualRuling {
  return {
    basedOnRevision: c.revision,
    placements: corpsId
      ? [manualPlacement(c.corps.find((f) => f.id === corpsId)!)]
      : [],
    units: [],
    hqs: [],
    endAt: c.cursor,
    finishPhase: false,
    correctsId: null,
    decision: '',
  };
}
export const manualPhaseEnd = (turn: number) =>
  Math.floor((turn - 1) / 2) * 1440 + ((turn - 1) % 2 ? 720 : 360) + 360;
const snapshot = (f: WaterlooCorps) => ({
  ...manualPlacement(f),
  availableAt: f.availableAt,
  returnSlot: f.returnSlot,
});

/** A reviewed outcome bypasses movement costs, never identity/conservation checks. */
export function applyManualAdjudication(
  c: WaterlooCampaign,
  receipt: WaterlooReceipt,
) {
  if (receipt.command.kind !== 'manual-adjudication') return;
  if (!canAdjudicate(c))
    throw new Error(
      'Manual adjudication requires clear planning or a settled checkpoint, before siege review. Reset saved orders and resolve contacts, battles and preparation submissions first.',
    );
  const r = receipt.command.ruling,
    m = c.fontenoy!;
  if (r.basedOnRevision !== c.revision)
    throw new Error(
      'The campaign changed while this ruling was drafted. Discard it and review the current situation.',
    );
  const records = c.adjudications ?? [];
  if (records.length >= 500)
    throw new Error(
      'Export the journal; the 500-ruling limit has been reached.',
    );
  if (records.some((p) => p.id === receipt.recordId))
    throw new Error('Manual ruling identities must be unique.');
  if (r.correctsId && !records.some((p) => p.id === r.correctsId))
    throw new Error('Choose an existing ruling to correct.');
  for (const ids of [
    r.placements.map((p) => p.corpsId),
    r.units.map((u) => u.unitId),
    r.hqs.map((h) => h.hqId),
  ])
    if (new Set(ids).size !== ids.length)
      throw new Error('Review each formation, unit and HQ only once.');
  if (
    r.endAt < c.cursor ||
    (c.phase === 'checkpoint' && (r.endAt !== c.cursor || r.finishPhase)) ||
    (c.phase === 'planning' &&
      (r.endAt > manualPhaseEnd(c.turn) ||
        (r.finishPhase && r.endAt !== manualPhaseEnd(c.turn))))
  )
    throw new Error(
      'Keep time within this phase, moving forwards. Finish a manual phase at its displayed end; checkpoint time is fixed.',
    );
  const before: ReturnType<typeof snapshot>[] = [],
    unitsBefore: { unitId: string; status: 'ready' | 'lost' }[] = [],
    hqsBefore: { hqId: string; hexId: string }[] = [];
  for (const p of r.placements) {
    const f = c.corps.find((f) => f.id === p.corpsId);
    if (!f || f.kind === 'detachment')
      throw new Error(
        'Choose a mapped formation; manage screens through preparation.',
      );
    if (
      (p.status === 'ready') !== (p.hexId !== null) ||
      (p.hexId && !c.hexes.some((h) => h.id === p.hexId))
    )
      throw new Error(
        'A ready formation needs a known map hex; removed formations must be off map.',
      );
    before.push(snapshot(f));
    const moved = f.hexId !== p.hexId || f.status !== p.status;
    f.hexId = p.hexId;
    f.status = p.status;
    f.formation = p.formation;
    if (p.reportedStrength) f.reportedStrength = p.reportedStrength;
    else delete f.reportedStrength;
    if (moved) {
      f.availableAt = r.endAt;
      f.returnSlot = null;
    }
  }
  for (const edit of r.units) {
    const unit = m.units.find((u) => u.id === edit.unitId);
    if (!unit) throw new Error('Choose an existing Maurice unit.');
    if (
      unit.currentStatus === 'recovering' ||
      m.aftermath?.recoveries.some(
        (p) => p.unitId === unit.id && p.recoveredAt === null,
      )
    )
      throw new Error(
        'Scheduled unit recoveries retain their existing return workflow.',
      );
    unitsBefore.push({ unitId: unit.id, status: unit.currentStatus });
    unit.currentStatus = edit.status;
  }
  for (const edit of r.hqs) {
    const hq = c.hqs.find((h) => h.id === edit.hqId);
    if (!hq || !c.hexes.some((h) => h.id === edit.hexId))
      throw new Error('Choose an existing HQ and map hex.');
    hqsBefore.push({ hqId: hq.id, hexId: hq.hexId });
    hq.hexId = edit.hexId;
  }
  for (const link of m.formations) {
    if (
      !r.placements.some((p) => p.corpsId === link.corpsId) &&
      !r.units.some((u) => link.unitIds.includes(u.unitId))
    )
      continue;
    const f = c.corps.find((f) => f.id === link.corpsId)!;
    const units = m.units.filter((u) => link.unitIds.includes(u.id));
    const allLost = units.every((u) => u.currentStatus === 'lost');
    if (
      (f.status === 'eliminated') !== allLost ||
      (f.status === 'ready' && !units.some((u) => u.currentStatus === 'ready'))
    )
      throw new Error(
        'A ready formation needs a ready unit; a formation with every unit lost must be eliminated. Review formation and unit status together.',
      );
  }
  const after = r.placements.map((p) =>
    snapshot(c.corps.find((f) => f.id === p.corpsId)!),
  );
  const changed =
    JSON.stringify(before) !== JSON.stringify(after) ||
    r.units.some((u, i) => u.status !== unitsBefore[i]!.status) ||
    r.hqs.some((h, i) => h.hexId !== hqsBefore[i]!.hexId) ||
    r.endAt !== c.cursor ||
    r.finishPhase;
  if (!changed)
    throw new Error(
      'Choose a map, roster or time change before recording a ruling.',
    );
  const fromAt = c.cursor,
    fromPhase = c.phase as 'planning' | 'checkpoint';
  // An empty preparation can be waived by the umpire, never a submitted withdrawal.
  if (c.preparation && !c.preparation.resolved) {
    c.preparation.resolved = true;
    c.preparation.resolvedAt = fromAt;
    c.preparation.submissions.forEach((s) => {
      s.locked = true;
    });
  }
  c.cursor = r.endAt;
  const date = new Date(`${c.startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.floor(c.cursor / 1440));
  c.date = date.toISOString().slice(0, 10);
  if (r.finishPhase) c.phase = 'checkpoint';
  c.effectSerial++;
  c.adjudications = [
    ...records,
    {
      id: receipt.recordId,
      turn: c.turn,
      timestamp: receipt.timestamp,
      effectSerial: c.effectSerial,
      ruling: structuredClone(r),
      fromAt,
      fromPhase,
      before,
      after,
      unitsBefore,
      hqsBefore,
    },
  ];
  refreshMauriceRosters(c);
  c.log.push(
    `Manual adjudication recorded: ${r.placements.length} formation(s), ${r.units.length} unit(s), ${r.hqs.length} HQ(s). No movement, combat, recovery or siege effects calculated by this ruling.`,
  );
}

export function manualRecordIssues(c: WaterlooCampaign): string[] {
  const issues: string[] = [],
    seen = new Set<string>();
  let serial = 0,
    at = 0,
    stamp = c.createdAt;
  for (const record of c.adjudications ?? []) {
    const r = record.ruling;
    const sameIds = (a: string[], b: string[]) =>
      a.length === b.length &&
      new Set(a).size === a.length &&
      a.every((id, i) => id === b[i]);
    if (
      !c.fontenoy ||
      seen.has(record.id) ||
      (r.correctsId && !seen.has(r.correctsId)) ||
      record.turn > c.turn ||
      record.fromAt < at ||
      r.endAt < record.fromAt ||
      r.endAt > c.cursor ||
      record.effectSerial <= serial ||
      record.effectSerial > c.effectSerial ||
      record.timestamp < stamp ||
      (record.fromPhase === 'checkpoint' &&
        (r.endAt !== record.fromAt || r.finishPhase)) ||
      (record.fromPhase === 'planning' &&
        (r.endAt > manualPhaseEnd(record.turn) ||
          (r.finishPhase && r.endAt !== manualPhaseEnd(record.turn)))) ||
      !sameIds(
        r.placements.map((p) => p.corpsId),
        record.before.map((p) => p.corpsId),
      ) ||
      !sameIds(
        r.placements.map((p) => p.corpsId),
        record.after.map((p) => p.corpsId),
      ) ||
      !sameIds(
        r.units.map((u) => u.unitId),
        record.unitsBefore.map((u) => u.unitId),
      ) ||
      !sameIds(
        r.hqs.map((h) => h.hqId),
        record.hqsBefore.map((h) => h.hqId),
      ) ||
      record.after.some((p, i) =>
        Object.entries(r.placements[i]!).some(
          ([key, value]) => p[key as keyof typeof p] !== value,
        ),
      ) ||
      [...record.before, ...record.after].some(
        (p) =>
          !c.corps.some((f) => f.id === p.corpsId && f.kind !== 'detachment') ||
          (p.status === 'ready') !== (p.hexId !== null) ||
          (p.hexId !== null && !c.hexes.some((h) => h.id === p.hexId)),
      ) ||
      r.units.some(
        (u) => !c.fontenoy?.units.some((unit) => unit.id === u.unitId),
      ) ||
      [...r.hqs, ...record.hqsBefore].some(
        (h) =>
          !c.hqs.some((hq) => hq.id === h.hqId) ||
          !c.hexes.some((hex) => hex.id === h.hexId),
      )
    )
      issues.push(
        'Manual ruling history must retain valid identities, before/after changes, chronological time and correction references.',
      );
    seen.add(record.id);
    serial = record.effectSerial;
    at = r.endAt;
    stamp = record.timestamp;
  }
  return issues;
}
