import { aftermathRulesSchema } from './aftermath-schema';
import type { z } from 'zod';
import type { fontenoyUnitSchema } from './fontenoy-schema';

export const unitRecoveryRulesSchema = aftermathRulesSchema.pick({
  strategy: true,
  allowRegularRebuild: true,
  irregularRecovery: true,
  artilleryRecovery: true,
  recoveryTurns: true,
  retiredRestTurns: true,
});
export type UnitRecoveryRules = z.infer<typeof unitRecoveryRulesSchema>;
type Unit = z.infer<typeof fontenoyUnitSchema>;
const regular = (unit: Unit) =>
  unit.type === 'regular_infantry' || unit.type === 'regular_cavalry';
export function canRebuildUnit(unit: Unit, rules: UnitRecoveryRules) {
  return regular(unit)
    ? rules.allowRegularRebuild
    : unit.type === 'artillery'
      ? rules.artilleryRecovery === 'same_quality'
      : rules.irregularRecovery === 'same_quality';
}
export const unitRecoveryStrategies = {
  conscript_rebuild_v1: (
    unit: Unit,
    rules: UnitRecoveryRules,
    choice: 'recover' | 'lost',
  ) => {
    void choice;
    return canRebuildUnit(unit, rules)
      ? ('recover' as const)
      : ('lost' as const);
  },
  manual_review_v1: (
    _unit: Unit,
    _rules: UnitRecoveryRules,
    choice: 'recover' | 'lost',
  ) => choice,
};
export function recoverUnit(
  original: Unit,
  outcome: 'broken' | 'retired' | 'survived' | 'not_engaged',
  choice: 'recover' | 'lost' | null,
  rules: UnitRecoveryRules,
) {
  const unit = structuredClone(original);
  let delayTurns: number | null = null;
  if (outcome === 'broken') {
    if (!choice)
      throw new Error('Review every broken unit’s recovery or loss.');
    const action = unitRecoveryStrategies[rules.strategy](unit, rules, choice);
    if (action !== choice)
      throw new Error(
        'Broken-unit actions must match the selected strategy; use manual review for individual choices.',
      );
    if (action === 'recover') {
      if (!canRebuildUnit(unit, rules))
        throw new Error('This unit cannot recover under the selected variant.');
      unit.currentStatus = 'recovering';
      delayTurns = rules.recoveryTurns;
      if (regular(unit)) {
        unit.initialQuality ??= unit.quality === 'elite' ? 'elite' : 'trained';
        unit.quality = 'conscript';
      }
    } else unit.currentStatus = 'lost';
  } else if (outcome === 'retired' && rules.retiredRestTurns > 0) {
    unit.currentStatus = 'recovering';
    delayTurns = rules.retiredRestTurns;
  }
  return { unit, delayTurns };
}
