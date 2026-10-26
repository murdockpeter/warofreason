import { siegeVictory } from './siege-victory';
import {
  canRebuildUnit,
  unitRecoveryStrategies,
  recoverUnit,
} from './unit-recovery';
import data from '../data/aftermath.v0.1.json' with { type: 'json' };
import type { FontenoyCampaign } from './campaign';
import type { Battle } from './tabletop-schema';
import {
  aftermathReceiptSchema,
  aftermathRulesSchema,
} from './aftermath-schema';
import type {
  AftermathReceipt,
  BattleAftermathInput,
} from './aftermath-schema';
import { battleReviewed, pendingCampaignReviews } from './aftermath-state';

export const defaultAftermathRules = aftermathRulesSchema.parse(data);
export const aftermathCategories = {
  enable: 'aftermath_enabled',
  rules: 'aftermath_rules_changed',
  'apply-battle': 'battle_aftermath_applied',
  'siege-conditions': 'siege_conditions_recorded',
  exhaustion: 'campaign_exhaustion_recorded',
  'finalize-turn': 'campaign_turn_finalized',
  'commander-arrived': 'commander_arrived',
  'commander-status': 'commander_status_changed',
  'commander-attach': 'commander_attached',
} as const;
const canRebuild = canRebuildUnit;
export const aftermathStrategies = unitRecoveryStrategies;
export function aftermathDraft(
  campaign: FontenoyCampaign,
  battle: Battle,
): BattleAftermathInput {
  const rules = campaign.aftermath?.rules ?? defaultAftermathRules;
  return {
    battleId: battle.id,
    broken: (battle.result?.units ?? [])
      .filter((r) => r.outcome === 'broken')
      .map((r) => {
        const unit = campaign.units.find((u) => u.id === r.unitId)!;
        return {
          unitId: unit.id,
          action: canRebuild(unit, rules)
            ? ('recover' as const)
            : ('lost' as const),
        };
      }),
    commanders: (battle.result?.commanders ?? []).map((r) => ({
      commanderId: r.commanderId,
      status:
        r.status === 'lost' || r.status === 'retired'
          ? r.status
          : (campaign.commanders.find((c) => c.id === r.commanderId)
              ?.campaignStatus ?? 'active'),
    })),
    positions: battle.participants.map((p) => ({
      columnId: p.columnId,
      squareId: campaign.columns.find((c) => c.id === p.columnId)!.squareId!,
    })),
    epicPoints: { french: null, allied: null },
    exhaustionDelta: { french: 0, allied: 0 },
    notes: '',
  };
}
export function epicPointSummary(
  campaign: FontenoyCampaign,
  side: 'french' | 'allied',
) {
  const reviews = campaign.aftermath?.reviews ?? [];
  return {
    entered: reviews.reduce(
      (sum, r) => sum + (r.input.epicPoints[side] ?? 0),
      0,
    ),
    unrecorded: reviews.filter((r) => r.input.epicPoints[side] === null).length,
  };
}
export function evaluateCampaignVictory(
  campaign: FontenoyCampaign,
  completedTurn: number,
  timestamp: string,
) {
  const state = campaign.aftermath!;
  const result = siegeVictory(
    campaign.settings.siege.progress,
    state.conditions,
    state.exhaustion,
    state.rules,
    completedTurn >= campaign.settings.schedule.turnCount,
  );
  return result ? { ...result, turn: completedTurn, timestamp } : null;
}
export function applyAftermathCommand(
  campaign: FontenoyCampaign,
  input: AftermathReceipt,
): FontenoyCampaign {
  const receipt = aftermathReceiptSchema.parse(input);
  const { command, recordId, timestamp } = receipt;
  if (campaign.status !== 'active' || !campaign.operations)
    throw new Error('Start a campaign and enable operational play first.');
  if (
    campaign.operations.phase === 'resolution' ||
    campaign.operations.orders.length
  )
    throw new Error('Reopen and clear issued orders before campaign changes.');
  if (campaign.aftermath?.victory)
    throw new Error(
      'The campaign has concluded; its strategic record is read-only.',
    );
  if (Date.parse(timestamp) < Date.parse(campaign.updatedAt))
    throw new Error('Campaign timestamps must be chronological.');
  const next = structuredClone(campaign);
  if (command.kind === 'enable') {
    if (next.aftermath)
      throw new Error('Post-battle and siege rules are already enabled.');
    next.aftermath = {
      rules: structuredClone(defaultAftermathRules),
      conditions: {
        invested: next.settings.siege.status === 'invested',
        supplied: false,
        relieved: next.settings.siege.status === 'relieved',
      },
      exhaustion: { french: 0, allied: 0 },
      pendingTurn: next.operations!.phase === 'finished' ? next.turn : null,
      reviews: [],
      recoveries: [],
      boundaries: [],
      victory: null,
    };
    return next;
  }
  const state = next.aftermath;
  if (!state) throw new Error('Enable post-battle and siege rules first.');
  const allIds = [
    next.id,
    ...next.factions.map((f) => f.id),
    ...next.units.map((u) => u.id),
    ...next.columns.map((c) => c.id),
    ...next.commanders.map((c) => c.id),
    ...next.squares.map((s) => s.id),
    ...next.settings.objectives.map((o) => o.id),
    ...state.reviews.map((r) => r.id),
    ...(next.tabletop?.contacts ?? []).map((c) => c.id),
    ...(next.tabletop?.battles ?? []).map((b) => b.id),
  ];
  if (allIds.includes(recordId))
    throw new Error('New record identity must be unique.');
  if (command.kind === 'rules') state.rules = structuredClone(command.rules);
  else if (command.kind === 'siege-conditions') {
    state.conditions = structuredClone(command.conditions);
    next.settings.siege.status = state.conditions.relieved
      ? 'relieved'
      : state.conditions.invested
        ? 'invested'
        : 'not_started';
  } else if (command.kind === 'exhaustion')
    state.exhaustion = structuredClone(command.values);
  else if (command.kind === 'apply-battle') {
    const battle = next.tabletop?.battles.find(
      (b) => b.id === command.input.battleId,
    );
    if (!battle || battle.stage !== 'resolved' || !battle.result)
      throw new Error(
        'Confirm the tabletop result before applying campaign effects.',
      );
    if (battleReviewed(next, battle.id))
      throw new Error('This battle aftermath has already been applied.');
    const request = command.input;
    const rules = state.rules;
    const brokenIds = battle.result.units
      .filter((u) => u.outcome === 'broken')
      .map((u) => u.unitId);
    if (
      request.broken.length !== brokenIds.length ||
      new Set(request.broken.map((u) => u.unitId)).size !== brokenIds.length ||
      request.broken.some((u) => !brokenIds.includes(u.unitId))
    )
      throw new Error(
        'Choose exactly one campaign action for each broken unit.',
      );
    const commanderIds = battle.result.commanders.map((c) => c.commanderId);
    if (
      request.commanders.length !== commanderIds.length ||
      new Set(request.commanders.map((c) => c.commanderId)).size !==
        commanderIds.length ||
      request.commanders.some((c) => !commanderIds.includes(c.commanderId))
    )
      throw new Error('Review every committed commander once.');
    const columnIds = battle.participants.map((p) => p.columnId);
    if (
      request.positions.length !== columnIds.length ||
      new Set(request.positions.map((p) => p.columnId)).size !==
        columnIds.length ||
      request.positions.some(
        (p) =>
          !columnIds.includes(p.columnId) ||
          !next.squares.some((s) => s.id === p.squareId),
      )
    )
      throw new Error(
        'Review a valid post-battle square for every participant.',
      );
    const unitChanges = [];
    for (const result of battle.result.units) {
      const unit = next.units.find((u) => u.id === result.unitId)!;
      const beforeStatus = unit.currentStatus;
      const beforeQuality = unit.quality;
      const change = recoverUnit(
        unit,
        result.outcome,
        request.broken.find((r) => r.unitId === unit.id)?.action ?? null,
        rules,
      );
      Object.assign(unit, change.unit);
      const dueTurn =
        change.delayTurns === null ? null : next.turn + change.delayTurns;
      if (dueTurn !== null)
        state.recoveries.push({
          unitId: unit.id,
          battleId: battle.id,
          dueTurn,
          recoveredAtTurn: null,
        });
      if (unit.currentStatus !== beforeStatus || unit.quality !== beforeQuality)
        unitChanges.push({
          unitId: unit.id,
          beforeStatus,
          afterStatus: unit.currentStatus,
          beforeQuality,
          afterQuality: unit.quality,
          dueTurn,
        });
    }
    for (const entry of request.commanders) {
      const commander = next.commanders.find(
        (c) => c.id === entry.commanderId,
      )!;
      commander.campaignStatus = entry.status;
      if (entry.status !== 'active')
        for (const c of next.columns)
          c.commanderIds = c.commanderIds.filter((id) => id !== commander.id);
    }
    for (const position of request.positions) {
      const column = next.columns.find((c) => c.id === position.columnId)!;
      if (
        position.squareId !== column.squareId &&
        next.operations!.rules.blockedSquareIds.includes(position.squareId)
      )
        throw new Error('Post-battle placement cannot enter a blocked square.');
      column.squareId = position.squareId;
    }
    for (const column of next.columns)
      if (
        columnIds.includes(column.id) &&
        next.columns.some(
          (other) =>
            other.id !== column.id &&
            other.factionId !== column.factionId &&
            other.squareId === column.squareId,
        )
      )
        throw new Error(
          'Separate opposing columns before releasing the battle hold.',
        );
    for (const side of ['french', 'allied'] as const) {
      state.exhaustion[side] += request.exhaustionDelta[side];
      if (state.exhaustion[side] > 10000)
        throw new Error('Campaign exhaustion exceeds the supported range.');
    }
    state.reviews.push({
      id: recordId,
      battleId: battle.id,
      turn: next.turn,
      timestamp,
      rules: structuredClone(rules),
      input: structuredClone(request),
      unitChanges,
    });
  } else if (command.kind === 'commander-arrived') {
    const faction = next.factions.find((f) => f.side === command.side)!;
    next.commanders.push({
      id: recordId,
      displayName: command.displayName,
      factionId: faction.id,
      provenance: 'house_rule_v0.1',
      sourceRef: command.notes.slice(0, 500),
      campaignStatus: 'active',
      notableReference: command.notableReference,
    });
  } else if (
    command.kind === 'commander-status' ||
    command.kind === 'commander-attach'
  ) {
    const commander = next.commanders.find((c) => c.id === command.commanderId);
    if (!commander) throw new Error('Choose an existing commander.');
    if (
      next.tabletop?.battles.some(
        (b) =>
          !battleReviewed(next, b.id) &&
          b.participants.some((p) =>
            p.commanders.some((c) => c.id === commander.id),
          ),
      )
    )
      throw new Error(
        'Resolve the committed commander through the battle aftermath first.',
      );
    if (command.kind === 'commander-status') {
      commander.campaignStatus = command.status;
      if (command.status !== 'active')
        for (const c of next.columns)
          c.commanderIds = c.commanderIds.filter((id) => id !== commander.id);
    } else {
      const target = command.columnId
        ? next.columns.find((c) => c.id === command.columnId)
        : null;
      if (
        command.columnId &&
        (!target || target.factionId !== commander.factionId)
      )
        throw new Error('Attach commanders only to their own faction.');
      if ((commander.campaignStatus ?? 'active') !== 'active')
        throw new Error('Only active commanders can be attached.');
      if (
        target &&
        next.tabletop?.battles.some(
          (b) =>
            !battleReviewed(next, b.id) &&
            b.participants.some((p) => p.columnId === target.id),
        )
      )
        throw new Error('Cannot change attachments on a committed column.');
      for (const c of next.columns)
        c.commanderIds = c.commanderIds.filter((id) => id !== commander.id);
      target?.commanderIds.push(commander.id);
    }
  } else {
    const turn = state.pendingTurn;
    if (turn === null || state.boundaries.some((b) => b.turn === turn))
      throw new Error('There is no unprocessed completed turn.');
    if (
      turn >= next.turn &&
      !(turn === next.turn && next.operations!.phase === 'finished')
    )
      throw new Error(
        'The checkpoint requires both faction phases to be completed.',
      );
    if (pendingCampaignReviews(next))
      throw new Error(
        'Declare, resolve and review all outstanding contacts and battles before finalizing the turn.',
      );
    const progressBefore = next.settings.siege.progress;
    const recoveredUnitIds: string[] = [];
    for (const recovery of state.recoveries)
      if (recovery.recoveredAtTurn === null && recovery.dueTurn <= next.turn) {
        const unit = next.units.find((u) => u.id === recovery.unitId)!;
        if (unit.currentStatus !== 'recovering')
          throw new Error('Recovery queue no longer matches the unit state.');
        unit.currentStatus = 'ready';
        recovery.recoveredAtTurn = next.turn;
        recoveredUnitIds.push(unit.id);
      }
    if (
      state.conditions.invested &&
      state.conditions.supplied &&
      !state.conditions.relieved
    )
      next.settings.siege.progress = Math.min(
        10000,
        progressBefore + state.rules.siegeIncrement,
      );
    state.victory = evaluateCampaignVictory(next, turn, timestamp);
    state.boundaries.push({
      turn,
      timestamp,
      progressBefore,
      progressAfter: next.settings.siege.progress,
      recoveredUnitIds,
      rules: structuredClone(state.rules),
      conditions: structuredClone(state.conditions),
      exhaustion: { ...state.exhaustion },
      victory: state.victory ? structuredClone(state.victory) : null,
    });
    state.pendingTurn = null;
  }
  return next;
}
export function aftermathIssues(campaign: FontenoyCampaign) {
  const state = campaign.aftermath;
  if (!state) return [];
  const issues: string[] = [];
  if (!campaign.operations || campaign.turn === 0)
    issues.push('Campaign effects require operational play.');
  const ids = new Set([
    campaign.id,
    ...campaign.factions.map((f) => f.id),
    ...campaign.units.map((u) => u.id),
    ...campaign.columns.map((c) => c.id),
    ...campaign.commanders.map((c) => c.id),
    ...campaign.squares.map((s) => s.id),
    ...campaign.settings.objectives.map((o) => o.id),
    ...(campaign.tabletop?.contacts ?? []).map((c) => c.id),
    ...(campaign.tabletop?.battles ?? []).map((b) => b.id),
  ]);
  const reviewed = new Set<string>();
  for (const review of state.reviews) {
    if (
      ids.has(review.id) ||
      reviewed.has(review.battleId) ||
      !campaign.tabletop?.battles.some(
        (b) => b.id === review.battleId && b.stage === 'resolved',
      ) ||
      review.input.battleId !== review.battleId ||
      review.turn > campaign.turn ||
      Date.parse(review.timestamp) > Date.parse(campaign.updatedAt)
    )
      issues.push('Invalid or duplicate battle aftermath.');
    ids.add(review.id);
    reviewed.add(review.battleId);
    for (const change of review.unitChanges)
      if (!campaign.units.some((u) => u.id === change.unitId))
        issues.push('Unknown unit in aftermath summary.');
  }
  const queued = new Set<string>();
  for (const recovery of state.recoveries) {
    const unit = campaign.units.find((u) => u.id === recovery.unitId);
    if (
      !unit ||
      !reviewed.has(recovery.battleId) ||
      (recovery.recoveredAtTurn !== null &&
        (recovery.recoveredAtTurn < recovery.dueTurn ||
          recovery.recoveredAtTurn > campaign.turn))
    )
      issues.push('Invalid recovery references or timing.');
    if (recovery.recoveredAtTurn === null) {
      if (queued.has(recovery.unitId) || unit?.currentStatus !== 'recovering')
        issues.push('Pending recovery must match one recovering unit.');
      queued.add(recovery.unitId);
    }
  }
  for (const unit of campaign.units)
    if (unit.currentStatus === 'recovering' && !queued.has(unit.id))
      issues.push('Recovering units need a scheduled recovery.');
  if (
    new Set(state.boundaries.map((b) => b.turn)).size !==
      state.boundaries.length ||
    state.boundaries.some(
      (b) =>
        b.turn > campaign.turn ||
        Date.parse(b.timestamp) > Date.parse(campaign.updatedAt),
    )
  )
    issues.push('Invalid completed-turn history.');
  if (
    state.pendingTurn !== null &&
    (state.pendingTurn > campaign.turn ||
      (state.pendingTurn === campaign.turn &&
        campaign.operations?.phase !== 'finished') ||
      state.boundaries.some((b) => b.turn === state.pendingTurn))
  )
    issues.push('Invalid pending turn checkpoint.');
  if (
    state.victory &&
    (!state.boundaries.some(
      (b) =>
        b.victory?.timestamp === state.victory!.timestamp &&
        b.turn === state.victory!.turn,
    ) ||
      state.pendingTurn !== null)
  )
    issues.push('Victory must come from a completed turn checkpoint.');
  for (const column of campaign.columns)
    if (
      column.commanderIds.some(
        (id) =>
          (campaign.commanders.find((c) => c.id === id)?.campaignStatus ??
            'active') !== 'active',
      )
    )
      issues.push('Unavailable commanders cannot remain attached.');
  return issues;
}
