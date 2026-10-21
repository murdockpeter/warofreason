import {
  contactCampaign,
  declarationFor,
  tabletopStep,
  completedResult,
} from './tabletop';
import { applyAftermathCommand } from '../../src/domain/aftermath';
import type { AftermathCommand } from '../../src/domain/aftermath-schema';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import { applyOperationalCommand } from '../../src/domain/operations';

export function resolvedCampaign(includeReinforcement = false) {
  let c = contactCampaign();
  const declaration = declarationFor(c);
  if (includeReinforcement)
    declaration.participants.push({
      columnId: c.columns[1]!.id,
      role: 'attacker',
      entryEdge: 'west',
      reinforcement: true,
      arrivalNotes: 'Player-agreed arrival.',
    });
  c = tabletopStep(c, { kind: 'declare-battle', declaration });
  const id = c.tabletop!.battles[0]!.id;
  c = tabletopStep(c, { kind: 'start-battle', battleId: id });
  return tabletopStep(c, {
    kind: 'record-result',
    battleId: id,
    result: completedResult(c.tabletop!.battles[0]!),
  });
}
export function aftermathStep(c: FontenoyCampaign, command: AftermathCommand) {
  const timestamp = new Date(Date.parse(c.updatedAt) + 1000).toISOString();
  return {
    ...applyAftermathCommand(c, {
      command,
      recordId: crypto.randomUUID(),
      timestamp,
    }),
    updatedAt: timestamp,
  };
}
export function passPhase(c: FontenoyCampaign) {
  return applyOperationalCommand(
    applyOperationalCommand(c, { kind: 'issue', orders: [] }),
    { kind: 'resolve' },
  );
}
