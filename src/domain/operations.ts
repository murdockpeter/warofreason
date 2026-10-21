import defaults from '../data/operations.v0.1.json' with { type: 'json' };
import { activeContacts, battleHoldingColumn } from './tabletop';
import { engagementSettled } from './aftermath-state';
import type { FontenoyCampaign } from './campaign';
import { movementRulesSchema } from './operations-schema';
import type {
  MapView,
  MovementOrder,
  OperationalCommand,
} from './operations-schema';

export const defaultMovementRules = movementRulesSchema.parse(defaults);
const hasReadyForce = (
  campaign: FontenoyCampaign,
  column: FontenoyCampaign['columns'][number],
) =>
  campaign.units.some(
    (u) => column.unitIds.includes(u.id) && u.currentStatus === 'ready',
  );
export const operationalCategories = {
  split: 'formation_split',
  enable: 'operations_enabled',
  configure: 'movement_rules_changed',
  issue: 'orders_issued',
  reopen: 'orders_reopened',
  resolve: 'orders_resolved',
} as const;
export function columnSide(campaign: FontenoyCampaign, factionId: string) {
  return campaign.factions.find((f) => f.id === factionId)?.side;
}
export function campaignDate(campaign: FontenoyCampaign, turn: number) {
  const date = new Date(`${campaign.settings.schedule.startDate}T00:00:00Z`);
  date.setUTCDate(
    date.getUTCDate() + (turn - 1) * campaign.settings.schedule.daysPerTurn,
  );
  return date.toISOString().slice(0, 10);
}
function hasEdge(
  edges: { from: string; to: string }[],
  from: string,
  to: string,
) {
  return edges.some(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
}
export function routeCost(campaign: FontenoyCampaign, order: MovementOrder) {
  const operations = campaign.operations;
  if (!operations) throw new Error('Enable operational play first.');
  const column = campaign.columns.find((c) => c.id === order.columnId);
  if (!column || columnSide(campaign, column.factionId) !== campaign.activeSide)
    throw new Error('Only the active faction can issue orders.');
  if (campaign.aftermath?.victory)
    throw new Error('The campaign has concluded.');
  if (
    campaign.aftermath?.pendingTurn !== null &&
    campaign.aftermath?.pendingTurn !== undefined
  )
    throw new Error('Finalize the completed campaign turn first.');
  if (
    !campaign.units.some(
      (u) => column.unitIds.includes(u.id) && u.currentStatus === 'ready',
    )
  )
    throw new Error('This column has no ready units to move.');
  if (battleHoldingColumn(campaign, column.id))
    throw new Error(
      'This column is committed to a battle or awaits post-battle review.',
    );
  if (
    operations.engagements.some(
      (e) =>
        !engagementSettled(campaign, e) &&
        (e.attackerId === column.id || e.defenderId === column.id),
    )
  )
    throw new Error('This column awaits tabletop engagement review.');
  if (
    order.path[0] !== column.squareId ||
    new Set(order.path).size !== order.path.length ||
    !order.path.length
  )
    throw new Error(
      'A route must start at the column and cannot revisit a square.',
    );
  let cost = 0;
  for (let index = 0; index < order.path.length; index++) {
    const target = campaign.squares.find((s) => s.id === order.path[index]);
    if (!target) throw new Error('Choose an existing map square.');
    if (index === 0) continue;
    const from = campaign.squares.find((s) => s.id === order.path[index - 1])!;
    if (
      Math.abs(from.row - target.row) +
        Math.abs(from.column - target.column) !==
      1
    )
      throw new Error(
        'Choose orthogonally adjacent squares; diagonal movement is unavailable.',
      );
    if (operations.rules.blockedSquareIds.includes(target.id))
      throw new Error('The route crosses a blocked square.');
    if (
      campaign.columns.some(
        (c) =>
          c.squareId === target.id &&
          c.factionId !== column.factionId &&
          hasReadyForce(campaign, c),
      ) &&
      index !== order.path.length - 1
    )
      throw new Error('A route cannot pass through an opposing column.');
    cost += hasEdge(campaign.settings.map.roadEdges, from.id, target.id)
      ? operations.rules.roadCost
      : operations.rules.offRoadCost;
    if (hasEdge(campaign.settings.map.riverEdges, from.id, target.id))
      cost += operations.rules.riverCrossingCost;
  }
  if (cost > operations.rules.movementPoints)
    throw new Error(
      `Route costs ${cost} points; allowance is ${operations.rules.movementPoints}.`,
    );
  return cost;
}
export function nextOperationalDay(campaign: FontenoyCampaign) {
  const schedule = campaign.settings.schedule;
  const secondSide = campaign.activeSide !== schedule.firstSide;
  const finished = secondSide && campaign.turn === schedule.turnCount;
  const turn = secondSide && !finished ? campaign.turn + 1 : campaign.turn;
  return {
    turn,
    date: campaignDate(campaign, turn),
    activeSide:
      campaign.activeSide === 'french'
        ? ('allied' as const)
        : ('french' as const),
    finished,
  };
}
export function applyOperationalCommand(
  campaign: FontenoyCampaign,
  command: OperationalCommand,
): FontenoyCampaign {
  if (campaign.status !== 'active')
    throw new Error('Start a reviewed campaign before operational play.');
  if (campaign.aftermath?.victory)
    throw new Error('The campaign has concluded.');
  if (
    campaign.aftermath?.pendingTurn !== null &&
    campaign.aftermath?.pendingTurn !== undefined
  )
    throw new Error('Finalize the completed campaign turn first.');
  const next = structuredClone(campaign);
  if (command.kind === 'enable') {
    if (next.operations)
      throw new Error('Operational play is already enabled.');
    next.operations = {
      rules: structuredClone(defaultMovementRules),
      phase: 'planning',
      orders: [],
      engagements: [],
    };
    const active = next.columns
      .filter((c) => columnSide(next, c.factionId) === next.activeSide)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const attacker of active) {
      if (!attacker.squareId) continue;
      for (const defender of next.columns
        .filter(
          (c) =>
            c.squareId === attacker.squareId &&
            c.factionId !== attacker.factionId &&
            hasReadyForce(next, c) &&
            hasReadyForce(next, attacker),
        )
        .sort((a, b) => a.id.localeCompare(b.id)))
        next.operations.engagements.push({
          attackerId: attacker.id,
          defenderId: defender.id,
          squareId: attacker.squareId,
          turn: next.turn,
          ruleId: next.operations.rules.ruleId,
        });
    }
    return next;
  }
  const operations = next.operations;
  if (!operations) throw new Error('Enable operational play first.');
  if (operations.phase === 'finished')
    throw new Error('The configured campaign window has ended.');
  if (command.kind === 'split') {
    if (operations.phase !== 'planning' || operations.orders.length)
      throw new Error(
        'Split formations during planning, before issuing orders.',
      );
    const source = next.columns.find((c) => c.id === command.columnId);
    if (!source || columnSide(next, source.factionId) !== next.activeSide)
      throw new Error('Only the active faction can split a formation.');
    if (
      !source.squareId ||
      battleHoldingColumn(next, source.id) ||
      operations.engagements.some(
        (e) =>
          !engagementSettled(next, e) &&
          (e.attackerId === source.id || e.defenderId === source.id),
      )
    )
      throw new Error(
        'Resolve this formation’s battle or contact before splitting.',
      );
    if (
      !command.displayName.trim() ||
      !command.unitIds.length ||
      new Set(command.unitIds).size !== command.unitIds.length ||
      command.unitIds.length >= source.unitIds.length ||
      command.unitIds.some((id) => !source.unitIds.includes(id)) ||
      new Set(command.commanderIds).size !== command.commanderIds.length ||
      command.commanderIds.some((id) => !source.commanderIds.includes(id))
    )
      throw new Error(
        'Keep at least one unit in each formation and transfer only its own units and commanders.',
      );
    const existingIds = [
      next.id,
      ...next.factions.map((f) => f.id),
      ...next.units.map((u) => u.id),
      ...next.commanders.map((c) => c.id),
      ...next.columns.map((c) => c.id),
      ...next.squares.map((s) => s.id),
      ...next.settings.objectives.map((o) => o.id),
      ...(next.tabletop?.battles ?? []).map((b) => b.id),
      ...(next.tabletop?.contacts ?? []).map((c) => c.id),
      ...(next.aftermath?.reviews ?? []).map((r) => r.id),
    ];
    if (existingIds.includes(command.newColumnId))
      throw new Error('The new formation needs a unique identity.');
    next.columns.push({
      ...structuredClone(source),
      id: command.newColumnId,
      displayName: command.displayName,
      unitIds: [...command.unitIds],
      commanderIds: [...command.commanderIds],
    });
    source.unitIds = source.unitIds.filter(
      (id) => !command.unitIds.includes(id),
    );
    source.commanderIds = source.commanderIds.filter(
      (id) => !command.commanderIds.includes(id),
    );
  } else if (command.kind === 'configure') {
    if (operations.phase !== 'planning' || operations.orders.length)
      throw new Error(
        'Change movement rules during planning, before issuing orders.',
      );
    const rules = movementRulesSchema.parse(command.rules);
    if (
      new Set(rules.blockedSquareIds).size !== rules.blockedSquareIds.length ||
      rules.blockedSquareIds.some(
        (id) => !next.squares.some((s) => s.id === id),
      )
    )
      throw new Error('Blocked squares must be unique existing map squares.');
    operations.rules = rules;
  } else if (command.kind === 'issue') {
    if (operations.phase !== 'planning')
      throw new Error('Return to planning to change issued orders.');
    if (
      new Set(command.orders.map((o) => o.columnId)).size !==
      command.orders.length
    )
      throw new Error('Issue only one order per column.');
    for (const order of command.orders) routeCost(next, order);
    operations.orders = structuredClone(command.orders).sort((a, b) =>
      a.columnId.localeCompare(b.columnId),
    );
    operations.phase = 'resolution';
  } else if (command.kind === 'reopen') {
    if (operations.phase !== 'resolution')
      throw new Error('Only issued orders can return to planning.');
    operations.phase = 'planning';
  } else {
    if (operations.phase !== 'resolution')
      throw new Error('Issue and review orders before resolving.');
    for (const order of operations.orders) routeCost(next, order);
    // Both factions move sequentially. Within one side, friendly stacking is allowed.
    // Hostile contact stops in the preceding square; no battle is auto-resolved.
    for (const order of operations.orders) {
      const column = next.columns.find((c) => c.id === order.columnId)!;
      for (let index = 1; index < order.path.length; index++) {
        const targetId = order.path[index]!;
        const enemies = next.columns
          .filter(
            (c) =>
              c.squareId === targetId &&
              c.factionId !== column.factionId &&
              hasReadyForce(next, c),
          )
          .sort((a, b) => a.id.localeCompare(b.id));
        if (enemies.length) {
          for (const enemy of enemies)
            operations.engagements.push({
              attackerId: column.id,
              defenderId: enemy.id,
              squareId: targetId,
              turn: next.turn,
              ruleId: operations.rules.ruleId,
            });
          break;
        }
        column.squareId = targetId;
      }
    }
    const completedTurn = next.turn;
    const closesTurn = next.activeSide !== next.settings.schedule.firstSide;
    const day = nextOperationalDay(next);
    next.turn = day.turn;
    next.date = day.date;
    if (!day.finished) next.activeSide = day.activeSide;
    operations.phase = day.finished ? 'finished' : 'planning';
    operations.orders = [];
    if (next.aftermath && closesTurn)
      next.aftermath.pendingTurn = completedTurn;
  }
  return next;
}
export function operationsIssues(campaign: FontenoyCampaign): string[] {
  const op = campaign.operations;
  if (!op) return [];
  const issues: string[] = [];
  if (campaign.turn === 0)
    issues.push('Operational play requires a started campaign.');
  if (
    new Set(op.rules.blockedSquareIds).size !==
      op.rules.blockedSquareIds.length ||
    op.rules.blockedSquareIds.some(
      (id) => !campaign.squares.some((s) => s.id === id),
    )
  )
    issues.push('Invalid blocked square references.');
  if (new Set(op.orders.map((o) => o.columnId)).size !== op.orders.length)
    issues.push('Duplicate column orders.');
  for (const order of op.orders) {
    try {
      routeCost(campaign, order);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'Invalid order.');
    }
  }
  for (const e of op.engagements) {
    const attacker = campaign.columns.find((c) => c.id === e.attackerId);
    const defender = campaign.columns.find((c) => c.id === e.defenderId);
    if (
      !attacker ||
      !defender ||
      attacker.factionId === defender.factionId ||
      !campaign.squares.some((s) => s.id === e.squareId) ||
      e.turn > campaign.turn
    )
      issues.push('Invalid engagement references.');
  }
  if (
    new Set(
      op.engagements.map((e) => `${e.attackerId}:${e.defenderId}:${e.turn}`),
    ).size !== op.engagements.length
  )
    issues.push('Duplicate engagement candidates.');
  if (
    op.phase === 'finished' &&
    (op.orders.length ||
      campaign.turn !== campaign.settings.schedule.turnCount ||
      campaign.activeSide === campaign.settings.schedule.firstSide)
  )
    issues.push('Invalid final campaign window state.');
  return issues;
}

// Explicit allowlist: no journal, aggregate snapshots, enemy unit/commander IDs,
// private names, hidden positions, or opposing orders enter a faction export.
export function projectOperationalView(
  campaign: FontenoyCampaign,
  view: MapView,
) {
  const contacts = activeContacts(campaign, view);
  const columns = campaign.columns
    .filter(
      (c) =>
        view === 'umpire' ||
        columnSide(campaign, c.factionId) === view ||
        c.concealment === 'visible' ||
        contacts.some((contact) => contact.input.targetColumnId === c.id),
    )
    .map((c) => {
      const own =
        view === 'umpire' || columnSide(campaign, c.factionId) === view;
      const contact = !own
        ? contacts.find((contact) => contact.input.targetColumnId === c.id)
        : undefined;
      const identified = contact?.input.state === 'identified';
      const knownUnits = own
        ? campaign.units.filter((u) => c.unitIds.includes(u.id))
        : identified && contact
          ? contact.snapshot.units
          : null;
      return {
        id: c.id,
        side: columnSide(campaign, c.factionId),
        squareId:
          !own && c.concealment === 'hidden'
            ? (contact?.snapshot.squareId ?? null)
            : c.squareId,
        displayName: own
          ? c.displayName
          : identified
            ? contact.snapshot.displayName
            : 'Opposing column',
        concealment: own ? c.concealment : null,
        units: knownUnits
          ? knownUnits.map((u) => ({
              displayName: u.displayName,
              type: u.type,
              quality: u.quality,
              currentStatus: u.currentStatus,
            }))
          : null,
        commanders:
          own || identified
            ? (own
                ? campaign.commanders.filter((commander) =>
                    c.commanderIds.includes(commander.id),
                  )
                : (contact?.snapshot.commanders ?? [])
              ).map((commander) => commander.displayName)
            : null,
        intelligence: contact
          ? {
              state: contact.input.state,
              observedTurn: contact.turn,
              observedDate: contact.date,
              timestamp: contact.timestamp,
              expiresAtTurn: contact.expiresAtTurn,
              estimate:
                contact.input.state === 'estimated'
                  ? contact.input.estimate
                  : '',
            }
          : null,
      };
    });
  const ownIds = new Set(
    columns
      .filter((c) => view === 'umpire' || c.side === view)
      .map((c) => c.id),
  );
  return {
    format: 'maurice-player-view' as const,
    view,
    title: campaign.title,
    turn: campaign.turn,
    date: campaign.date,
    activeSide: campaign.activeSide,
    phase: campaign.operations?.phase ?? null,
    rules: campaign.operations?.rules ?? null,
    squares: campaign.squares.map((s) => ({ ...s })),
    map: campaign.settings.map,
    objectives: campaign.settings.objectives
      .filter((o) => view === 'umpire' || o.side === view)
      .map((o) => ({ ...o })),
    columns,
    orders: (campaign.operations?.orders ?? [])
      .filter((o) => ownIds.has(o.columnId))
      .map((o) => ({ columnId: o.columnId, path: [...o.path] })),
    engagements: (campaign.operations?.engagements ?? [])
      .filter(
        (e) =>
          view === 'umpire' ||
          ownIds.has(e.attackerId) ||
          ownIds.has(e.defenderId),
      )
      .map((e) => ({ turn: e.turn, squareId: e.squareId, ruleId: e.ruleId })),
  };
}
export type OperationalView = ReturnType<typeof projectOperationalView>;
