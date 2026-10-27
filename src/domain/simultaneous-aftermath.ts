import type {
  WaterlooBattle,
  WaterlooCampaign,
  WaterlooResult,
} from './waterloo-schema';
import type { SimultaneousRecoveryPolicy } from './simultaneous-aftermath-schema';
import { recoverUnit } from './unit-recovery';
import defaults from '../data/aftermath.v0.1.json' with { type: 'json' };
import { historicalRosterText } from './historical-profile';
import { unitRecoveryRulesSchema } from './unit-recovery';

export function defaultSimultaneousRecoveryPolicy(
  c: WaterlooCampaign,
): SimultaneousRecoveryPolicy {
  const {
    strategy,
    allowRegularRebuild,
    irregularRecovery,
    artilleryRecovery,
    recoveryTurns,
    retiredRestTurns,
  } = defaults;
  return {
    ruleId: 'maurice_aftermath_v0.1',
    rules: unitRecoveryRulesSchema.parse({
      strategy,
      allowRegularRebuild,
      irregularRecovery,
      artilleryRecovery,
      recoveryTurns,
      retiredRestTurns,
    }),
    minutesPerRecoveryTurn:
      (c.fontenoy?.sourceSchedule.daysPerTurn ?? 2) * 1440,
  };
}
export function mauriceResultDraft(
  c: WaterlooCampaign,
  b: WaterlooBattle,
): NonNullable<WaterlooResult['maurice']> {
  if (!c.fontenoy?.aftermath)
    throw new Error('Enable reviewed recovery rules first.');
  return {
    units: (b.maurice ?? []).flatMap((f) =>
      f.units.map((unit) => ({
        unitId: unit.id,
        outcome: 'not_engaged' as const,
        disruptedAtEnd: null,
        notes: '',
        recovery: null,
      })),
    ),
    armyMorale: { french: null, allied: null },
  };
}
export function previewMauriceAftermath(
  c: WaterlooCampaign,
  b: WaterlooBattle,
  result: WaterlooResult,
) {
  const state = c.fontenoy?.aftermath;
  if (!state) {
    if (result.maurice)
      throw new Error(
        'Enable reviewed Maurice recovery rules before recording per-unit observations.',
      );
    return [];
  }
  if (!result.maurice)
    throw new Error(
      'Record every frozen Maurice unit outcome before approving this result.',
    );
  const units = (b.maurice ?? []).flatMap((f) => f.units);
  const rows = result.maurice.units;
  if (
    new Set(rows.map((u) => u.unitId)).size !== units.length ||
    rows.length !== units.length ||
    rows.some((r) => !units.some((u) => u.id === r.unitId))
  )
    throw new Error(
      'Review each frozen Maurice unit exactly once, without foreign or duplicate units.',
    );
  const changes = rows.map((row) => {
    const unit =
      b.aftermath?.baseline.find((u) => u.id === row.unitId) ??
      c.fontenoy!.units.find((u) => u.id === row.unitId)!;
    const frozen = units.find((u) => u.id === row.unitId)!;
    if (unit.currentStatus !== 'ready' || unit.quality !== frozen.quality)
      throw new Error(
        'The committed unit state has changed; reconcile the battle before applying losses.',
      );
    if ((row.outcome === 'broken') !== (row.recovery !== null))
      throw new Error('Choose recovery or loss only for broken units.');
    const formation = b.maurice!.find((f) =>
      f.units.some((u) => u.id === row.unitId),
    )!;
    if (
      result.effects.find((e) => e.corpsId === formation.corpsId)
        ?.disposition === 'not_engaged' &&
      row.outcome !== 'not_engaged'
    )
      throw new Error(
        'Units in a non-engaged formation must be recorded as not engaged.',
      );
    const change = recoverUnit(
      unit,
      row.outcome,
      row.recovery,
      state.policy.rules,
    );
    const dueAt =
      change.delayTurns === null
        ? null
        : result.endAt +
          change.delayTurns * state.policy.minutesPerRecoveryTurn;
    if (dueAt !== null && dueAt > 1000000)
      throw new Error(
        'Recovery exceeds the supported campaign clock; reduce the configured delay.',
      );
    return {
      unitId: unit.id,
      before: structuredClone(unit),
      after: change.unit,
      dueAt,
    };
  });
  for (const force of b.maurice ?? []) {
    const link = c.fontenoy!.formations.find(
      (f) => f.corpsId === force.corpsId,
    )!;
    const roster = c
      .fontenoy!.units.filter((u) => link.unitIds.includes(u.id))
      .map((u) => changes.find((r) => r.unitId === u.id)?.after ?? u);
    const effect = result.effects.find((e) => e.corpsId === force.corpsId)!;
    const allLost = roster.every((u) => u.currentStatus === 'lost');
    if (effect.disposition === 'eliminated' && !allLost)
      throw new Error(
        'An eliminated formation must have all units explicitly lost; use blown for a formation with recovering survivors.',
      );
    if (allLost && effect.disposition !== 'eliminated')
      throw new Error('Mark a formation with all units lost as eliminated.');
    if (
      ['retained', 'retreated', 'not_engaged'].includes(effect.disposition) &&
      !roster.some((u) => u.currentStatus === 'ready')
    )
      throw new Error(
        'A formation without ready units must leave the map as blown or eliminated.',
      );
  }
  return changes;
}
export function refreshMauriceRosters(c: WaterlooCampaign, force = false) {
  if (
    !c.fontenoy ||
    (!c.fontenoy.aftermath &&
      !c.adjudications?.length &&
      !c.fontenoy.historicalProfile &&
      !force)
  )
    return;
  for (const link of c.fontenoy.formations) {
    const f = c.corps.find((f) => f.id === link.corpsId)!;
    if (c.fontenoy.historicalProfile) {
      f.roster = historicalRosterText(c, link.unitIds);
      continue;
    }
    const units = c.fontenoy.units.filter((u) => link.unitIds.includes(u.id));
    f.roster =
      `${units.filter((u) => u.currentStatus === 'ready').length}/${units.length} Maurice units ready. ${units.map((u) => `${u.displayName}: ${u.quality ?? u.type}, ${u.currentStatus}`).join('; ')}`.slice(
        0,
        4000,
      );
  }
}
export function applyMauriceAftermath(c: WaterlooCampaign, b: WaterlooBattle) {
  if (!c.fontenoy?.aftermath) return;
  const changes = previewMauriceAftermath(c, b, b.results.at(-1)!.result);
  b.aftermath = {
    policy: structuredClone(c.fontenoy.aftermath.policy),
    appliedVersion: b.results.length,
    baseline: changes.map((r) => structuredClone(r.before)),
    changes: changes.filter(
      (r) =>
        r.before.quality !== r.after.quality ||
        r.before.currentStatus !== r.after.currentStatus,
    ),
  };
  for (const change of changes) {
    const index = c.fontenoy.units.findIndex((u) => u.id === change.unitId);
    c.fontenoy.units[index] = structuredClone(change.after);
    if (change.dueAt !== null)
      c.fontenoy.aftermath.recoveries.push({
        unitId: change.unitId,
        battleId: b.id,
        dueAt: change.dueAt,
        recoveredAt: null,
      });
  }
  refreshMauriceRosters(c);
  c.log.push(
    `Maurice unit aftermath applied for ${b.title}; ${b.aftermath.changes.length} classification/readiness changes, using ${b.aftermath.policy.minutesPerRecoveryTurn} minutes per recovery turn.`,
  );
}
export function restoreMauriceBaseline(c: WaterlooCampaign, b: WaterlooBattle) {
  if (!b.aftermath || !c.fontenoy?.aftermath) return;
  c.fontenoy.units = c.fontenoy.units.map((u) =>
    structuredClone(b.aftermath!.baseline.find((p) => p.id === u.id) ?? u),
  );
  c.fontenoy.aftermath.recoveries = c.fontenoy.aftermath.recoveries.filter(
    (r) => r.battleId !== b.id,
  );
  delete b.aftermath;
}
export function processMauriceRecovery(c: WaterlooCampaign) {
  for (const r of c.fontenoy?.aftermath?.recoveries ?? [])
    if (r.recoveredAt === null && r.dueAt <= c.cursor) {
      const u = c.fontenoy!.units.find((u) => u.id === r.unitId)!;
      if (u.currentStatus !== 'recovering')
        throw new Error('Recovery queue no longer matches the unit.');
      u.currentStatus = 'ready';
      r.recoveredAt = c.cursor;
      c.log.push(
        `${u.displayName} returned ready at the phase checkpoint; current quality ${u.quality ?? 'not applicable'}.`,
      );
    }
  refreshMauriceRosters(c);
}
export function hasReadyMauriceUnits(c: WaterlooCampaign, corpsId: string) {
  if (
    !c.fontenoy?.aftermath ||
    c.corps.find((f) => f.id === corpsId)?.kind === 'detachment'
  )
    return true;
  const link = c.fontenoy.formations.find((f) => f.corpsId === corpsId);
  return (
    !!link &&
    c.fontenoy.units.some(
      (u) => link.unitIds.includes(u.id) && u.currentStatus === 'ready',
    )
  );
}
