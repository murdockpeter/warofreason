const randomUUID = () => crypto.randomUUID();
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import { applyWaterlooCommand } from '../../src/domain/waterloo';
import {
  defaultSimultaneousRecoveryPolicy,
  mauriceResultDraft,
} from '../../src/domain/simultaneous-aftermath';
import type {
  WaterlooCampaign,
  WaterlooCommand,
  WaterlooResult,
} from '../../src/domain/waterloo-schema';
export const operationalNow = '2026-10-25T12:00:00.000Z';
export const simultaneousStep = (
  c: WaterlooCampaign,
  command: WaterlooCommand,
) =>
  applyWaterlooCommand(c, {
    command,
    recordId: randomUUID(),
    timestamp: operationalNow,
  });
export function unitBattleCampaign(enable = true, frenchIndex = 0) {
  let c = seedFontenoyOperational('Unit recovery', randomUUID, operationalNow);
  c.corps[frenchIndex]!.hexId = '5,4';
  c.corps[2]!.hexId = '7,4';
  if (enable)
    c = simultaneousStep(c, {
      kind: 'maurice-recovery-policy',
      policy: defaultSimultaneousRecoveryPolicy(c),
    });
  for (const [side, index] of [
    ['french', frenchIndex],
    ['allied', 2],
  ] as const)
    c = simultaneousStep(c, {
      kind: 'orders',
      side,
      lock: true,
      orders: [
        {
          corpsId: c.corps[index]!.id,
          priority: 0,
          segments: [
            {
              path: [c.corps[index]!.hexId!, '6,4'],
              roadOnly: false,
              startAt: 390,
              hqId: c.hqs.find((h) => h.army === c.corps[index]!.army)!.id,
            },
          ],
        },
      ],
    });
  c = simultaneousStep(c, { kind: 'resolve' });
  return simultaneousStep(c, {
    kind: 'declare-battle',
    encounterId: c.encounters[0]!.id,
    title: 'Maurice loss review',
  });
}
export function unitBattleResult(c: WaterlooCampaign): WaterlooResult {
  const b = c.battles[0]!;
  const maurice = c.fontenoy?.aftermath ? mauriceResultDraft(c, b) : undefined;
  if (maurice) {
    maurice.units.forEach((u) => {
      u.outcome = 'survived';
    });
    maurice.units[0]!.outcome = 'broken';
    maurice.units[0]!.recovery = 'recover';
    maurice.units[0]!.disruptedAtEnd = true;
    maurice.armyMorale.french = 7;
  }
  return {
    game: 'Maurice',
    outcome: 'Player-entered draw',
    endAt: b.startAt + 60,
    effects: b.initial.map((f) => ({
      corpsId: f.id,
      disposition: 'retained',
      hexId: f.hexId,
      exhausted: false,
      arrivalAt: null,
    })),
    notes: 'Both players reviewed actual outcomes.',
    ...(maurice ? { maurice } : {}),
  };
}
export function applyUnitBattle(
  c: WaterlooCampaign,
  result = unitBattleResult(c),
) {
  const battleId = c.battles[0]!.id;
  c = simultaneousStep(c, {
    kind: 'result',
    battleId,
    result,
    reason: 'Reviewed unit results.',
  });
  c = simultaneousStep(c, { kind: 'approve-result', battleId });
  return simultaneousStep(c, { kind: 'resolve' });
}
export function emptySharedPhase(c: WaterlooCampaign) {
  for (const side of ['french', 'allied'] as const)
    c = simultaneousStep(c, { kind: 'orders', side, orders: [], lock: true });
  return simultaneousStep(simultaneousStep(c, { kind: 'resolve' }), {
    kind: 'finalize',
  });
}
