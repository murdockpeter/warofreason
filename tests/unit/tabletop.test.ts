import { describe, expect, it } from 'vitest';
import {
  activeContacts,
  applyTabletopCommand,
  candidateAssigned,
  defaultScoutingRules,
} from '../../src/domain/tabletop';
import { battleBriefHtml } from '../../src/domain/battle-brief';
import { fontenoyCampaignSchema } from '../../src/domain/campaign';
import {
  applyOperationalCommand,
  projectOperationalView,
  routeCost,
} from '../../src/domain/operations';
import {
  preparedTabletop,
  tabletopStep,
  contactCampaign,
  declarationFor,
  completedResult,
} from '../fixtures/tabletop';
import type { ScoutInput } from '../../src/domain/tabletop-schema';

function scoutInput(c = preparedTabletop()): ScoutInput {
  return {
    scoutId: c.columns[1]!.id,
    targetColumnId: c.columns[3]!.id,
    roll: 4,
    rollSource: 'physical',
    modifier: -1,
    reason: 'Agreed visibility modifier; umpire adjudicated the report.',
    state: 'located',
    estimate: '',
  };
}
describe('scouting and intelligence house rules', () => {
  it('never releases opposing orders or raw report snapshots when a column is identified', () => {
    const c = preparedTabletop();
    const identified = tabletopStep(c, {
      kind: 'scout',
      input: { ...scoutInput(c), state: 'identified' },
    });
    const issued = applyOperationalCommand(
      { ...identified, activeSide: 'allied' },
      {
        kind: 'issue',
        orders: [
          { columnId: c.columns[3]!.id, path: [c.columns[3]!.squareId!] },
        ],
      },
    );
    const projected = projectOperationalView(issued, 'french');
    expect(
      projected.columns.find((col) => col.id === c.columns[3]!.id)?.units,
    ).toHaveLength(11);
    expect(projected.orders).toEqual([]);
    const json = JSON.stringify(projected);
    expect(json).not.toContain('"snapshot"');
    expect(json).not.toContain('"targetColumnId"');
    for (const unitId of c.columns[3]!.unitIds)
      expect(json).not.toContain(unitId);
  });
  it.each(['unknown', 'located', 'estimated', 'identified'] as const)(
    'records %s as an adjudicated, timestamped snapshot',
    (state) => {
      const c = preparedTabletop();
      const after = tabletopStep(c, {
        kind: 'scout',
        input: {
          ...scoutInput(c),
          state,
          estimate: state === 'estimated' ? 'Roughly a dozen units.' : '',
        },
      });
      const report = after.tabletop!.contacts[0]!;
      expect(report.input.roll + report.input.modifier).toBe(3);
      expect(report.input.state).toBe(state);
      expect(report.expiresAtTurn).toBe(2);
      expect(report.snapshot.units).toHaveLength(11);
      expect(fontenoyCampaignSchema.safeParse(after).success).toBe(true);
      expect(c.tabletop).toBeUndefined();
      const view = projectOperationalView(after, 'french');
      const enemy = view.columns.find((col) => col.id === c.columns[3]!.id);
      if (state === 'unknown') expect(enemy).toBeUndefined();
      else {
        expect(enemy?.squareId).toBe(c.columns[3]!.squareId);
        expect(enemy?.intelligence?.state).toBe(state);
        expect(enemy?.units?.length ?? null).toBe(
          state === 'identified' ? 11 : null,
        );
        expect(enemy?.commanders).toEqual(
          state === 'identified' ? ['Duke of Cumberland'] : null,
        );
      }
      expect(
        projectOperationalView(after, 'allied').columns.find(
          (col) => col.id === c.columns[1]!.id,
        )?.units,
      ).toBeNull();
    },
  );
  it('rejects ineligible, distant, friendly, wrong-side and held scouts; limits attempts and never mutates on rejection', () => {
    const c = preparedTabletop();
    const input = scoutInput(c);
    expect(() =>
      tabletopStep(c, {
        kind: 'scout',
        input: { ...input, scoutId: c.columns[0]!.id },
      }),
    ).toThrow('eligible');
    expect(() =>
      tabletopStep(c, {
        kind: 'scout',
        input: { ...input, targetColumnId: c.columns[0]!.id },
      }),
    ).toThrow('opposing');
    c.columns[1]!.squareId = c.squares[0]!.id;
    expect(() => tabletopStep(c, { kind: 'scout', input })).toThrow('range');
    c.columns[1]!.squareId = c.columns[0]!.squareId;
    const after = tabletopStep(c, { kind: 'scout', input });
    expect(() => tabletopStep(after, { kind: 'scout', input })).toThrow(
      'attempts',
    );
    expect(() =>
      tabletopStep(c, { kind: 'scout', input: { ...input, roll: 7 } }),
    ).toThrow();
    expect(() =>
      tabletopStep(c, {
        kind: 'scout',
        input: { ...input, state: 'estimated' },
      }),
    ).toThrow('estimate');
    const held = contactCampaign();
    expect(() =>
      tabletopStep(held, {
        kind: 'scout',
        input: {
          ...scoutInput(held),
          scoutId: held.columns[3]!.id,
          targetColumnId: held.columns[0]!.id,
        },
      }),
    ).toThrow('held');
    expect(c.tabletop).toBeUndefined();
  });
  it('does not live-track concealed targets and expires reports without resurrecting older intelligence', () => {
    let c = preparedTabletop();
    c = tabletopStep(c, {
      kind: 'scouting-rules',
      rules: {
        ...defaultScoutingRules,
        expiresAfterTurns: 5,
        attemptsPerColumnPerTurn: 2,
      },
    });
    c = tabletopStep(c, {
      kind: 'scout',
      input: { ...scoutInput(c), state: 'identified' },
    });
    const observed = c.columns[3]!.squareId;
    c.columns[3]!.squareId = c.squares.at(-1)!.id;
    expect(
      projectOperationalView(c, 'french').columns.find(
        (col) => col.id === c.columns[3]!.id,
      )?.squareId,
    ).toBe(observed);
    c.columns[3]!.squareId = observed;
    c = tabletopStep(c, {
      kind: 'scouting-rules',
      rules: { ...defaultScoutingRules, attemptsPerColumnPerTurn: 2 },
    });
    c = tabletopStep(c, {
      kind: 'scout',
      input: { ...scoutInput(c), state: 'unknown' },
    });
    expect(activeContacts(c, 'french')).toEqual([]);
    c.turn = 2;
    c.date = '1745-05-03';
    expect(activeContacts(c, 'french')).toEqual([]);
    expect(
      projectOperationalView(c, 'french').columns.find(
        (col) => col.id === c.columns[3]!.id,
      ),
    ).toBeUndefined();
  });
});
describe('manual tabletop bridge', () => {
  it('uses configurable joining range instead of inventing a fixed reinforcement rule', () => {
    let c = contactCampaign();
    c.columns[1]!.squareId = c.squares.find(
      (s) => s.row === 2 && s.column === 2,
    )!.id;
    const declaration = declarationFor(c);
    declaration.participants.push({
      columnId: c.columns[1]!.id,
      role: 'attacker',
      entryEdge: 'west',
      reinforcement: true,
      arrivalNotes: 'Players agree arrival.',
    });
    expect(() =>
      tabletopStep(c, { kind: 'declare-battle', declaration }),
    ).toThrow('joining range');
    c = tabletopStep(c, {
      kind: 'scouting-rules',
      rules: { ...defaultScoutingRules, battleJoinRange: 2 },
    });
    expect(
      tabletopStep(c, { kind: 'declare-battle', declaration }).tabletop!
        .battles[0]!.participants,
    ).toHaveLength(3);
  });
  it('freezes primary and reinforcement rosters, prevents overlapping battles and holds all participants', () => {
    const c = contactCampaign();
    const declaration = declarationFor(c);
    declaration.participants.push({
      columnId: c.columns[1]!.id,
      role: 'attacker',
      entryEdge: 'west',
      reinforcement: true,
      arrivalNotes: 'Agreed arrival at the table.',
    });
    const after = tabletopStep(c, { kind: 'declare-battle', declaration });
    const battle = after.tabletop!.battles[0]!;
    expect(battle.participants.flatMap((p) => p.units)).toHaveLength(31);
    expect(candidateAssigned(after, declaration.candidate)).toBe(true);
    expect(() =>
      tabletopStep(after, { kind: 'declare-battle', declaration }),
    ).toThrow('unassigned');
    expect(() =>
      routeCost(
        { ...after, activeSide: 'french' },
        { columnId: c.columns[1]!.id, path: [c.columns[1]!.squareId!] },
      ),
    ).toThrow('committed');
    const frozenName = battle.participants[0]!.units[0]!.displayName;
    after.units[0]!.displayName = 'Changed live name';
    expect(battle.participants[0]!.units[0]!.displayName).toBe(frozenName);
    expect(c.tabletop).toBeUndefined();
  });
  it('rejects false candidates, duplicate/wrong-side/far participants and unspecified reinforcement arrival', () => {
    const c = contactCampaign();
    const d = declarationFor(c);
    expect(() =>
      tabletopStep(c, {
        kind: 'declare-battle',
        declaration: { ...d, candidate: { ...d.candidate, turn: 2 } },
      }),
    ).toThrow('candidate');
    expect(() =>
      tabletopStep(c, {
        kind: 'declare-battle',
        declaration: {
          ...d,
          participants: [...d.participants, d.participants[0]!],
        },
      }),
    ).toThrow('once');
    expect(() =>
      tabletopStep(c, {
        kind: 'declare-battle',
        declaration: {
          ...d,
          participants: d.participants.map((p) => ({ ...p, role: 'attacker' })),
        },
      }),
    ).toThrow('faction');
    const reinforcement = {
      columnId: c.columns[1]!.id,
      role: 'attacker' as const,
      entryEdge: 'west' as const,
      reinforcement: true,
      arrivalNotes: '',
    };
    expect(() =>
      tabletopStep(c, {
        kind: 'declare-battle',
        declaration: { ...d, participants: [...d.participants, reinforcement] },
      }),
    ).toThrow('arrival');
    c.columns[1]!.squareId = c.squares[0]!.id;
    expect(() =>
      tabletopStep(c, {
        kind: 'declare-battle',
        declaration: {
          ...d,
          participants: [
            ...d.participants,
            { ...reinforcement, arrivalNotes: 'Later' },
          ],
        },
      }),
    ).toThrow('joining range');
  });
  it('records complete confirmed manual results without mutating units, morale, siege or tactical state', () => {
    let c = contactCampaign();
    c = tabletopStep(c, {
      kind: 'declare-battle',
      declaration: declarationFor(c),
    });
    const id = c.tabletop!.battles[0]!.id;
    expect(() =>
      tabletopStep(c, {
        kind: 'record-result',
        battleId: id,
        result: completedResult(c.tabletop!.battles[0]!),
      }),
    ).toThrow('Begin');
    c = tabletopStep(c, { kind: 'start-battle', battleId: id });
    const result = completedResult(c.tabletop!.battles[0]!);
    result.commanders[0]!.status = 'lost';
    result.armyMorale.french = 7;
    expect(() =>
      tabletopStep(c, {
        kind: 'record-result',
        battleId: id,
        result: { ...result, units: result.units.slice(1) },
      }),
    ).toThrow('every committed unit');
    const after = tabletopStep(c, {
      kind: 'record-result',
      battleId: id,
      result,
    });
    expect(after.units).toEqual(c.units);
    expect(after.commanders).toEqual(c.commanders);
    expect(after.settings.siege).toEqual(c.settings.siege);
    expect(after.tabletop!.battles[0]!.result).toEqual(result);
    expect(fontenoyCampaignSchema.safeParse(after).success).toBe(true);
    expect(() =>
      tabletopStep(after, { kind: 'record-result', battleId: id, result }),
    ).toThrow('read-only');
    expect(() =>
      applyOperationalCommand(
        { ...after, activeSide: 'french' },
        {
          kind: 'issue',
          orders: [
            {
              columnId: after.columns[0]!.id,
              path: [after.columns[0]!.squareId!],
            },
          ],
        },
      ),
    ).toThrow('committed');
  });
  it('exports an escaped, offline, printable brief with frozen forces, provenance and agreed setup', () => {
    const c = contactCampaign();
    const declaration = declarationFor(c);
    declaration.title = '<script>alert(1)</script>';
    declaration.specialInstructions = '<img src="https://example.com/track">';
    const after = tabletopStep(c, { kind: 'declare-battle', declaration });
    const html = battleBriefHtml(after, after.tabletop!.battles[0]!);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('default-src');
    expect(html).toContain('Saxe');
    expect(html).toContain('Cumberland');
    expect(html).toContain('regular infantry');
    expect(html).toContain('house_rule_v0.1/tabletop-1');
    expect(html).toContain('Entry: west');
    expect(html).not.toContain('"events"');
  });
  it('rejects tabletop actions on drafts, archives, issued orders or malformed record identities', () => {
    const c = preparedTabletop();
    const command = { kind: 'scout' as const, input: scoutInput(c) };
    for (const status of ['draft', 'archived'] as const)
      expect(() => tabletopStep({ ...c, status }, command)).toThrow('Start');
    expect(() =>
      tabletopStep(
        applyOperationalCommand(c, { kind: 'issue', orders: [] }),
        command,
      ),
    ).toThrow('reopen');
    expect(() =>
      applyTabletopCommand(c, {
        command,
        recordId: c.id,
        timestamp: c.updatedAt,
      }),
    ).toThrow('unique');
  });
});
