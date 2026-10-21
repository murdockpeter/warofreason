import { describe, expect, it } from 'vitest';
import {
  aftermathDraft,
  aftermathStrategies,
  defaultAftermathRules,
  epicPointSummary,
} from '../../src/domain/aftermath';
import { fontenoyCampaignSchema } from '../../src/domain/campaign';
import {
  applyOperationalCommand,
  routeCost,
} from '../../src/domain/operations';
import { battleHoldingColumn } from '../../src/domain/tabletop';
import {
  contactCampaign,
  declarationFor,
  preparedTabletop,
  tabletopStep,
} from '../fixtures/tabletop';
import {
  aftermathStep,
  passPhase,
  resolvedCampaign,
} from '../fixtures/aftermath';

function review(c = resolvedCampaign()) {
  const enabled = aftermathStep(c, { kind: 'enable' });
  const input = aftermathDraft(enabled, enabled.tabletop!.battles[0]!);
  input.notes = 'Both players reviewed campaign effects.';
  return { c: enabled, input };
}
describe('explicit campaign aftermath', () => {
  it('applies reviewed regular rebuilding once, preserves original quality/provenance and freezes tabletop facts', () => {
    const { c, input } = review();
    input.epicPoints = { french: 3, allied: null };
    input.exhaustionDelta.french = 2;
    const result = aftermathStep(c, { kind: 'apply-battle', input });
    expect(result.units[0]!.currentStatus).toBe('recovering');
    expect(result.units[0]!.quality).toBe('conscript');
    expect(result.units[0]!.initialQuality).toBe('elite');
    expect(result.aftermath!.recoveries[0]!.dueTurn).toBe(2);
    expect(result.tabletop).toEqual(c.tabletop);
    expect(result.units).toHaveLength(38);
    expect(epicPointSummary(result, 'french')).toEqual({
      entered: 3,
      unrecorded: 0,
    });
    expect(epicPointSummary(result, 'allied')).toEqual({
      entered: 0,
      unrecorded: 1,
    });
    expect(result.aftermath!.exhaustion).toEqual({ french: 2, allied: 0 });
    expect(fontenoyCampaignSchema.safeParse(result).success).toBe(true);
    expect(() =>
      aftermathStep(result, { kind: 'apply-battle', input }),
    ).toThrow('already');
    expect(c.units[0]!.quality).toBe('elite');
  });
  it('runs due recoveries only at finalized turn checkpoints, without persisting tactical disruption', () => {
    const { c, input } = review();
    const applied = aftermathStep(c, { kind: 'apply-battle', input });
    expect(
      battleHoldingColumn(applied, applied.columns[0]!.id),
    ).toBeUndefined();
    const boundary = passPhase(applied);
    expect(boundary.turn).toBe(2);
    expect(boundary.aftermath!.pendingTurn).toBe(1);
    expect(boundary.units[0]!.currentStatus).toBe('recovering');
    expect(() =>
      applyOperationalCommand(boundary, { kind: 'issue', orders: [] }),
    ).toThrow('Finalize');
    const finalized = aftermathStep(boundary, { kind: 'finalize-turn' });
    expect(finalized.units[0]!.currentStatus).toBe('ready');
    expect(finalized.units[0]!.quality).toBe('conscript');
    expect(finalized.aftermath!.recoveries[0]!.recoveredAtTurn).toBe(2);
    expect(finalized.units[0]).not.toHaveProperty('disrupted');
    expect(() => aftermathStep(finalized, { kind: 'finalize-turn' })).toThrow(
      'unprocessed',
    );
    expect(fontenoyCampaignSchema.safeParse(finalized).success).toBe(true);
  });
  it('supports manual loss decisions and refuses rebuilding when the campaign variant disallows it', () => {
    const prepared = review();
    const input = prepared.input;
    let c = prepared.c;
    c = aftermathStep(c, {
      kind: 'rules',
      rules: { ...defaultAftermathRules, strategy: 'manual_review_v1' },
    });
    input.broken[0]!.action = 'lost';
    expect(
      aftermathStep(c, { kind: 'apply-battle', input }).units[0]!.currentStatus,
    ).toBe('lost');
    c = aftermathStep(c, {
      kind: 'rules',
      rules: { ...c.aftermath!.rules, allowRegularRebuild: false },
    });
    input.broken[0]!.action = 'recover';
    expect(() => aftermathStep(c, { kind: 'apply-battle', input })).toThrow(
      'cannot recover',
    );
    const fixed = review();
    fixed.input.broken[0]!.action = 'lost';
    expect(() =>
      aftermathStep(fixed.c, { kind: 'apply-battle', input: fixed.input }),
    ).toThrow('strategy');
  });
  it('handles artillery/irregular recovery variants without assigning regular quality', () => {
    let c = resolvedCampaign(true);
    const battle = c.tabletop!.battles[0]!;
    for (const r of battle.result!.units)
      r.outcome =
        c.units.find((u) => u.id === r.unitId)!.type === 'artillery'
          ? 'broken'
          : 'survived';
    c = aftermathStep(c, { kind: 'enable' });
    const input = aftermathDraft(c, battle);
    input.notes = 'Review artillery variant.';
    const lost = aftermathStep(c, { kind: 'apply-battle', input });
    expect(
      lost.units
        .filter((u) => input.broken.some((r) => r.unitId === u.id))
        .every((u) => u.currentStatus === 'lost' && u.quality === null),
    ).toBe(true);
    c = aftermathStep(c, {
      kind: 'rules',
      rules: { ...c.aftermath!.rules, artilleryRecovery: 'same_quality' },
    });
    const rebuilt = aftermathDraft(c, battle);
    rebuilt.notes = input.notes;
    const recovered = aftermathStep(c, {
      kind: 'apply-battle',
      input: rebuilt,
    });
    expect(
      recovered.units
        .filter((u) => rebuilt.broken.some((r) => r.unitId === u.id))
        .every((u) => u.currentStatus === 'recovering' && u.quality === null),
    ).toBe(true);
    const irregular = {
      ...c.units[0]!,
      type: 'irregular_infantry' as const,
      quality: null,
    };
    expect(
      aftermathStrategies.conscript_rebuild_v1(
        irregular,
        defaultAftermathRules,
        'recover',
      ),
    ).toBe('lost');
    expect(
      aftermathStrategies.conscript_rebuild_v1(
        irregular,
        { ...defaultAftermathRules, irregularRecovery: 'same_quality' },
        'recover',
      ),
    ).toBe('recover');
    expect(fontenoyCampaignSchema.safeParse(recovered).success).toBe(true);
  });
  it('rests retired units only under the selected delay and retains quality', () => {
    let c = resolvedCampaign();
    c.tabletop!.battles[0]!.result!.units[0]!.outcome = 'retired';
    c = aftermathStep(c, { kind: 'enable' });
    c = aftermathStep(c, {
      kind: 'rules',
      rules: { ...c.aftermath!.rules, retiredRestTurns: 2 },
    });
    const input = aftermathDraft(c, c.tabletop!.battles[0]!);
    input.notes = 'Agreed rest period.';
    const result = aftermathStep(c, { kind: 'apply-battle', input });
    expect(result.units[0]!.quality).toBe('elite');
    expect(result.aftermath!.recoveries[0]!.dueTurn).toBe(3);
  });
  it('applies explicit commander decisions, arrival and friendly attachments without card effects', () => {
    const prepared = review();
    prepared.input.commanders[0]!.status = 'lost';
    let c = aftermathStep(prepared.c, {
      kind: 'apply-battle',
      input: prepared.input,
    });
    const original = c.commanders[0]!;
    expect(original.campaignStatus).toBe('lost');
    expect(c.columns.flatMap((col) => col.commanderIds)).not.toContain(
      original.id,
    );
    c = aftermathStep(c, {
      kind: 'commander-arrived',
      side: 'french',
      displayName: 'Player Notable',
      notableReference: 'Private card title only.',
      notes: 'Players agreed arrival.',
    });
    const arrived = c.commanders.at(-1)!;
    expect(() =>
      aftermathStep(c, {
        kind: 'commander-attach',
        commanderId: arrived.id,
        columnId: c.columns[3]!.id,
        notes: 'Wrong side.',
      }),
    ).toThrow('own faction');
    c = aftermathStep(c, {
      kind: 'commander-attach',
      commanderId: arrived.id,
      columnId: c.columns[0]!.id,
      notes: 'Players assigned the commander.',
    });
    expect(c.columns[0]!.commanderIds).toContain(arrived.id);
    c = aftermathStep(c, {
      kind: 'commander-status',
      commanderId: arrived.id,
      status: 'retired',
      notes: 'Explicit retirement.',
    });
    expect(c.columns[0]!.commanderIds).not.toContain(arrived.id);
    expect(fontenoyCampaignSchema.safeParse(c).success).toBe(true);
  });
  it('releases reviewed columns for later battles while retaining earlier frozen history', () => {
    const { c, input } = review();
    const applied = aftermathStep(c, { kind: 'apply-battle', input });
    const ready = aftermathStep(passPhase(applied), { kind: 'finalize-turn' });
    expect(
      routeCost(ready, {
        columnId: ready.columns[0]!.id,
        path: [ready.columns[0]!.squareId!],
      }),
    ).toBe(0);
    let contact = applyOperationalCommand(
      applyOperationalCommand(ready, {
        kind: 'issue',
        orders: [
          {
            columnId: ready.columns[0]!.id,
            path: [ready.columns[0]!.squareId!, ready.columns[3]!.squareId!],
          },
        ],
      }),
      { kind: 'resolve' },
    );
    const declaration = declarationFor(contact);
    declaration.candidate = contact.operations!.engagements.at(-1)!;
    contact = tabletopStep(contact, { kind: 'declare-battle', declaration });
    expect(contact.tabletop!.battles).toHaveLength(2);
    expect(fontenoyCampaignSchema.safeParse(contact).success).toBe(true);
  });
});
describe('siege and victory checkpoints', () => {
  it('rejects an injected checkpoint before both faction phases complete', () => {
    const c = aftermathStep(preparedTabletop(), { kind: 'enable' });
    c.aftermath!.pendingTurn = c.turn;
    expect(fontenoyCampaignSchema.safeParse(c).success).toBe(false);
    expect(() => aftermathStep(c, { kind: 'finalize-turn' })).toThrow(
      'both faction phases',
    );
  });
  it('does not create impossible contacts with a column containing only lost units', () => {
    let c = preparedTabletop();
    const target = c.columns[3]!;
    for (const unit of c.units)
      if (target.unitIds.includes(unit.id)) unit.currentStatus = 'lost';
    const order = {
      columnId: c.columns[0]!.id,
      path: [c.columns[0]!.squareId!, target.squareId!],
    };
    c = applyOperationalCommand(
      applyOperationalCommand(c, { kind: 'issue', orders: [order] }),
      { kind: 'resolve' },
    );
    expect(c.columns[0]!.squareId).toBe(target.squareId);
    expect(c.operations!.engagements).toHaveLength(0);
  });
  it('requires both investment and supply, never wins early, and increments once per finalized turn', () => {
    let c = aftermathStep(preparedTabletop(), { kind: 'enable' });
    c = aftermathStep(c, {
      kind: 'rules',
      rules: { ...c.aftermath!.rules, siegeThreshold: 1 },
    });
    c = aftermathStep(c, {
      kind: 'siege-conditions',
      conditions: { invested: true, supplied: false, relieved: false },
      notes: 'No supply confirmed.',
    });
    expect(() => aftermathStep(c, { kind: 'finalize-turn' })).toThrow(
      'unprocessed',
    );
    c = aftermathStep(passPhase(passPhase(c)), { kind: 'finalize-turn' });
    expect(c.settings.siege.progress).toBe(0);
    expect(c.aftermath!.victory).toBeNull();
    c = aftermathStep(c, {
      kind: 'siege-conditions',
      conditions: { invested: true, supplied: true, relieved: false },
      notes: 'Supply route verified.',
    });
    expect(c.settings.siege.progress).toBe(0);
    expect(c.aftermath!.victory).toBeNull();
    c = aftermathStep(passPhase(passPhase(c)), { kind: 'finalize-turn' });
    expect(c.settings.siege.progress).toBe(1);
    expect(c.aftermath!.victory!.winner).toBe('french');
    expect(() =>
      applyOperationalCommand(c, { kind: 'issue', orders: [] }),
    ).toThrow('concluded');
    expect(fontenoyCampaignSchema.safeParse(c).success).toBe(true);
  });
  it.each(['draw', 'french', 'allied'] as const)(
    'uses the configured %s result for conflicting final-turn conditions',
    (outcome) => {
      let c = preparedTabletop();
      c.settings.schedule.turnCount = 1;
      c.settings.siege.progress = 6;
      c = aftermathStep(c, { kind: 'enable' });
      c = aftermathStep(c, {
        kind: 'rules',
        rules: { ...c.aftermath!.rules, conflictOutcome: outcome },
      });
      c = aftermathStep(c, {
        kind: 'siege-conditions',
        conditions: { invested: true, supplied: true, relieved: true },
        notes: 'Both claims reviewed at final checkpoint.',
      });
      c = passPhase(passPhase(c));
      expect(c.aftermath!.victory).toBeNull();
      c = aftermathStep(c, { kind: 'finalize-turn' });
      expect(c.aftermath!.victory!.winner).toBe(outcome);
      expect(c.aftermath!.victory!.reasons.join(' ')).toContain('Conflicting');
    },
  );
  it('gives a substantive final-turn siege success precedence over the deadline fallback', () => {
    let c = preparedTabletop();
    c.settings.schedule.turnCount = 1;
    c.settings.siege.progress = 5;
    c = aftermathStep(c, { kind: 'enable' });
    c = aftermathStep(c, {
      kind: 'siege-conditions',
      conditions: { invested: true, supplied: true, relieved: false },
      notes: 'Final supplied investment.',
    });
    c = aftermathStep(passPhase(passPhase(c)), { kind: 'finalize-turn' });
    expect(c.aftermath!.victory!.winner).toBe('french');
    let noSupply = preparedTabletop();
    noSupply.settings.schedule.turnCount = 1;
    noSupply.settings.siege.progress = 5;
    noSupply = aftermathStep(noSupply, { kind: 'enable' });
    noSupply = aftermathStep(noSupply, {
      kind: 'siege-conditions',
      conditions: { invested: true, supplied: false, relieved: false },
      notes: 'Supply unverified.',
    });
    noSupply = aftermathStep(passPhase(passPhase(noSupply)), {
      kind: 'finalize-turn',
    });
    expect(noSupply.aftermath!.victory!.winner).toBe('allied');
    expect(noSupply.settings.siege.progress).toBe(5);
  });
  it('keeps campaign exhaustion manual and handles simultaneous exhaustion at a checkpoint', () => {
    let c = aftermathStep(preparedTabletop(), { kind: 'enable' });
    c = aftermathStep(c, {
      kind: 'exhaustion',
      values: { french: 10, allied: 10 },
      notes: 'Both operational totals independently verified.',
    });
    expect(c.aftermath!.victory).toBeNull();
    c = aftermathStep(passPhase(passPhase(c)), { kind: 'finalize-turn' });
    expect(c.aftermath!.victory!.winner).toBe('draw');
  });
  it('defers final-turn victory while a late tabletop contact still needs its result and aftermath', () => {
    let c = contactCampaign();
    c.settings.schedule.turnCount = 1;
    c = aftermathStep(c, { kind: 'enable' });
    c = passPhase(c);
    expect(() => aftermathStep(c, { kind: 'finalize-turn' })).toThrow(
      'outstanding',
    );
    expect(c.aftermath!.victory).toBeNull();
    expect(c.aftermath!.pendingTurn).toBe(1);
    expect(c.operations!.phase).toBe('finished');
  });
});
