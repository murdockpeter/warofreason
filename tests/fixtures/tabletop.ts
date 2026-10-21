import { seedFontenoy } from '../../src/domain/fontenoy';
import { applyOperationalCommand } from '../../src/domain/operations';
import {
  applyTabletopCommand,
  battleResultDraft,
} from '../../src/domain/tabletop';
import { battleResultSchema } from '../../src/domain/tabletop-schema';
import type {
  TabletopCommand,
  Declaration,
  Battle,
} from '../../src/domain/tabletop-schema';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import { campaignFixture } from './campaign';

export function preparedTabletop() {
  let c = seedFontenoy(campaignFixture(), () => crypto.randomUUID());
  c.settings.reviewedHouseRules = true;
  c.settings.reviewedSchematicMap = true;
  c.columns[1]!.squareId = c.columns[0]!.squareId;
  c.columns[3]!.squareId = c.squares.find(
    (s) => s.row === 2 && s.column === 4,
  )!.id;
  c.columns[3]!.concealment = 'hidden';
  c.status = 'active';
  c.turn = 1;
  c.date = c.settings.schedule.startDate;
  c.activeSide = c.settings.schedule.firstSide;
  c = applyOperationalCommand(c, { kind: 'enable' });
  return c;
}
export function tabletopStep(c: FontenoyCampaign, command: TabletopCommand) {
  const timestamp = new Date(Date.parse(c.updatedAt) + 1000).toISOString();
  return {
    ...applyTabletopCommand(c, {
      command,
      recordId: crypto.randomUUID(),
      timestamp,
    }),
    updatedAt: timestamp,
  };
}
export function contactCampaign() {
  const c = preparedTabletop();
  return applyOperationalCommand(
    applyOperationalCommand(c, {
      kind: 'issue',
      orders: [
        {
          columnId: c.columns[0]!.id,
          path: [c.columns[0]!.squareId!, c.columns[3]!.squareId!],
        },
      ],
    }),
    { kind: 'resolve' },
  );
}
export function declarationFor(c: FontenoyCampaign): Declaration {
  const candidate = c.operations!.engagements[0]!;
  return {
    candidate,
    title: 'Test tabletop battle',
    participants: [
      {
        columnId: candidate.attackerId,
        role: 'attacker',
        entryEdge: 'west',
        reinforcement: false,
        arrivalNotes: '',
      },
      {
        columnId: candidate.defenderId,
        role: 'defender',
        entryEdge: 'on_table',
        reinforcement: false,
        arrivalNotes: '',
      },
    ],
    objectives: 'Player-agreed objectives.',
    terrainNotes: 'Agree terrain at the table.',
    specialInstructions: '',
  };
}
export function completedResult(battle: Battle) {
  const draft = battleResultDraft(battle);
  return battleResultSchema.parse({
    ...draft,
    outcome: 'draw',
    units: draft.units.map((u, i) => ({
      ...u,
      outcome: i === 0 ? 'broken' : 'survived',
      disruptedAtEnd: i === 0 ? true : null,
    })),
  });
}
