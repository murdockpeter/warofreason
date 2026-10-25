import type {
  WaterlooCampaign as Campaign,
  WaterlooCommand,
  WaterlooCorps as Corps,
  WaterlooSide,
  WithdrawalOrder,
} from './waterloo-schema';
import { campaignTime, hexDistance, inZone, phaseEnd } from './waterloo';

type PreparationCommand = Extract<
  WaterlooCommand,
  {
    kind:
      | 'enable-preparation'
      | 'deploy-detachment'
      | 'recall-detachment'
      | 'withdrawals'
      | 'reset-withdrawals'
      | 'resolve-withdrawals';
  }
>;
export function newPreparation(
  turn: number,
  startedAt: number,
  maurice = false,
): NonNullable<Campaign['preparation']> {
  return {
    ruleId: maurice ? 'maurice_preparation_v0.1' : 'waterloo_preparation_v0.1',
    turn,
    startedAt,
    deploymentHqIds: [],
    submissions: [
      { side: 'french', locked: false, orders: [] },
      { side: 'allied', locked: false, orders: [] },
    ],
    resolved: false,
    resolvedAt: null,
    withdrawnCorpsIds: [],
  };
}
export function preparationIsMutable(c: Campaign) {
  return (
    c.status === 'active' &&
    c.phase === 'planning' &&
    !c.submissions.some((s) => s.locked || s.orders.length) &&
    (!c.preparation ||
      (!c.preparation.resolved &&
        !c.preparation.submissions.some((s) => s.locked || s.orders.length)))
  );
}
const committed = (c: Campaign, id: string) =>
  c.battles.some(
    (b) =>
      !b.appliedVersion &&
      [...b.initial, ...b.reinforcementForces].some((f) => f.id === id),
  );
const foes = (c: Campaign, side: WaterlooSide) =>
  c.corps.filter((f) => f.side !== side && f.status === 'ready');
const zone = (c: Campaign, hex: string, forces: Corps[], influence: boolean) =>
  forces.some((f) =>
    inZone(c, hex, f, influence && f.kind !== 'detachment' ? 2 : 1),
  );
const passable = (c: Campaign, a: string, b: string) =>
  hexDistance(c, a, b) === 1 &&
  c.hexes.some((h) => h.id === b && h.terrain !== 'water') &&
  !c.edges.some(
    (e) =>
      ((e.from === a && e.to === b) || (e.from === b && e.to === a)) &&
      e.crossing === 'major',
  );
function tracedPath(
  c: Campaign,
  from: string,
  to: string,
  range: number,
  side: WaterlooSide,
  roadOnly = false,
) {
  const enemy = foes(c, side);
  if (zone(c, from, enemy, true)) return false;
  let frontier = [from];
  const seen = new Set(frontier);
  for (let distance = 0; distance <= range; distance++) {
    if (frontier.includes(to)) return true;
    const next: string[] = [];
    for (const at of frontier)
      for (const h of c.hexes) {
        if (
          seen.has(h.id) ||
          !passable(c, at, h.id) ||
          zone(c, h.id, enemy, true)
        )
          continue;
        if (
          roadOnly &&
          !c.edges.some(
            (e) =>
              e.road &&
              ((e.from === at && e.to === h.id) ||
                (e.to === at && e.from === h.id)),
          )
        )
          continue;
        seen.add(h.id);
        next.push(h.id);
      }
    frontier = next;
  }
  return false;
}
export function validateWithdrawals(
  c: Campaign,
  side: WaterlooSide,
  orders: WithdrawalOrder[],
) {
  if (!c.preparation || c.preparation.resolved || c.phase !== 'planning')
    throw new Error('Withdrawals must be planned before ordinary movement.');
  if (
    new Set(orders.map((o) => o.corpsId)).size !== orders.length ||
    new Set(orders.map((o) => o.priority)).size !== orders.length
  )
    throw new Error(
      'Use unique withdrawing corps and explicit friendly priorities.',
    );
  if (orders.length && c.cursor + 60 > phaseEnd(c.turn))
    throw new Error(
      'A three-step withdrawal needs 60 minutes remaining in this phase.',
    );
  for (const o of orders) {
    const f = c.corps.find((f) => f.id === o.corpsId),
      enemy = c.corps.find(
        (f) => f.id === o.enemyId && f.status === 'ready' && f.side !== side,
      );
    if (
      !f ||
      f.side !== side ||
      f.kind === 'detachment' ||
      f.status !== 'ready' ||
      !f.hexId ||
      committed(c, f.id) ||
      !enemy?.hexId ||
      !inZone(c, f.hexId, enemy, 1)
    )
      throw new Error(
        'Select an available friendly corps in the nominated enemy’s control.',
      );
    if (o.blocked) {
      const canRetreat = (at: string, remaining: number): boolean =>
        remaining === 0 ||
        c.hexes.some(
          (h) =>
            passable(c, at, h.id) &&
            hexDistance(c, h.id, enemy.hexId!) >
              hexDistance(c, at, enemy.hexId!) &&
            !zone(c, h.id, foes(c, side), false) &&
            !c.corps.some(
              (other) =>
                other.id !== f.id &&
                other.status === 'ready' &&
                other.hexId === h.id &&
                (other.kind !== 'detachment' || other.side !== side),
            ) &&
            canRetreat(h.id, remaining - 1),
        );
      if (o.path.length !== 1 || o.path[0] !== f.hexId)
        throw new Error('A blocked withdrawal records only its origin.');
      if (canRetreat(f.hexId, 3))
        throw new Error(
          'A legal retreat exists; choose its three-step route instead.',
        );
      continue;
    }
    if (
      o.path.length !== 4 ||
      o.path[0] !== f.hexId ||
      new Set(o.path).size !== 4
    )
      throw new Error(
        'A withdrawal needs its origin and three distinct retreat hexes.',
      );
    for (let i = 1; i < o.path.length; i++) {
      const from = o.path[i - 1]!,
        to = o.path[i]!;
      if (
        !passable(c, from, to) ||
        hexDistance(c, to, enemy.hexId) <= hexDistance(c, from, enemy.hexId) ||
        zone(c, to, foes(c, side), false)
      )
        throw new Error(
          'Each retreat step must be passable, strictly farther from the enemy and outside all enemy control.',
        );
    }
  }
}

export function applyPreparationCommand(
  c: Campaign,
  command: PreparationCommand,
  recordId: string,
) {
  if (command.kind === 'enable-preparation') {
    if (c.preparation)
      throw new Error('Preparation rules are already enabled.');
    if (
      !preparationIsMutable(c) ||
      c.encounters.some((e) => !e.settled) ||
      c.battles.some((b) => !b.appliedVersion)
    )
      throw new Error(
        'Enable preparation at the start of a planning phase, before orders or pending battles.',
      );
    const parents = c.corps.filter((f) => f.kind !== 'detachment');
    if (c.corps.length + parents.length > 100)
      throw new Error(
        'There is no roster capacity for one screening detachment per corps.',
      );
    c.preparation = newPreparation(c.turn, c.cursor, !!c.fontenoy);
    for (const [index, parent] of parents.entries())
      c.corps.push({
        id: `${recordId.slice(0, 24)}${(index + 1).toString(16).padStart(12, '0')}`,
        name: `${parent.name} screen`.slice(0, 120),
        side: parent.side,
        army: parent.army,
        kind: 'detachment',
        formation: 'advance',
        hexId: null,
        status: 'reserve',
        returnSlot: null,
        roster: `Screening element allocated from ${parent.name}; agree its tactical roster from the parent force without duplicating troops.`,
        availableAt: c.cursor,
        detachment: {
          parentCorpsId: parent.id,
          availableFromTurn: c.turn,
          deployedByHqId: null,
        },
      });
    c.effectSerial++;
    c.log.push(
      'Enabled ordinary detachment deployment/recall and simultaneous pre-movement withdrawals.',
    );
    return;
  }
  const p = c.preparation;
  if (!p) throw new Error('Enable preparation rules first.');
  switch (command.kind) {
    case 'deploy-detachment': {
      if (!preparationIsMutable(c))
        throw new Error(
          'Deploy detachments before withdrawal submissions or movement orders.',
        );
      const f = c.corps.find(
          (f) =>
            f.id === command.corpsId && f.kind === 'detachment' && f.detachment,
        ),
        hq = c.hqs.find((h) => h.id === command.hqId);
      if (
        !f?.detachment ||
        f.status !== 'reserve' ||
        f.detachment.availableFromTurn > c.turn ||
        !hq ||
        hq.army !== f.army
      )
        throw new Error(
          'Select an available reserve detachment and associated army HQ.',
        );
      if (p.deploymentHqIds.includes(hq.id))
        throw new Error(
          'This HQ has already placed its detachment this phase.',
        );
      if (
        !c.hexes.some((h) => h.id === command.hexId && h.terrain !== 'water') ||
        zone(
          c,
          command.hexId,
          c.corps.filter((f) => f.status === 'ready'),
          true,
        )
      )
        throw new Error(
          'The placement hex must be outside all friendly and enemy control/influence.',
        );
      if (
        c.corps.some(
          (other) => other.status === 'ready' && other.hexId === command.hexId,
        )
      )
        throw new Error('The destination is occupied.');
      const parent = c.corps.find(
        (parent) => parent.id === f.detachment!.parentCorpsId,
      )!;
      const range = hq.mode === 'normal' ? hq.normalRange : hq.battleRange;
      const legal =
        command.source === 'parent'
          ? parent.status === 'ready' &&
            parent.hexId !== null &&
            tracedPath(c, parent.hexId, command.hexId, 4, f.side)
          : tracedPath(c, hq.hexId, command.hexId, range, f.side) ||
            (hq.mode === 'normal' &&
              tracedPath(c, hq.hexId, command.hexId, range * 2, f.side, true));
      if (!legal)
        throw new Error(
          'No legal placement trace from that source; avoid enemy control/influence and obey range.',
        );
      f.status = 'ready';
      f.hexId = command.hexId;
      f.detachment.deployedByHqId = hq.id;
      f.availableAt = c.cursor;
      p.deploymentHqIds.push(hq.id);
      c.effectSerial++;
      c.log.push(`${f.name} deployed at ${command.hexId} by ${hq.name}.`);
      break;
    }
    case 'recall-detachment': {
      if (!preparationIsMutable(c))
        throw new Error(
          'Recall detachments before withdrawal submissions or movement orders.',
        );
      const f = c.corps.find(
        (f) =>
          f.id === command.corpsId &&
          f.kind === 'detachment' &&
          f.detachment &&
          f.status === 'ready',
      );
      if (!f?.detachment || committed(c, f.id))
        throw new Error('Select a deployed, uncommitted detachment.');
      f.status = 'reserve';
      f.hexId = null;
      f.returnSlot = null;
      f.detachment.availableFromTurn = c.turn + 1;
      f.detachment.deployedByHqId = null;
      c.effectSerial++;
      c.log.push(`${f.name} recalled; available from phase ${c.turn + 1}.`);
      break;
    }
    case 'withdrawals': {
      const submission = p.submissions.find((s) => s.side === command.side)!;
      if (submission.locked)
        throw new Error(
          'This withdrawal submission is locked; reopen both before editing.',
        );
      validateWithdrawals(c, command.side, command.orders);
      submission.orders = command.orders;
      submission.locked = command.lock;
      break;
    }
    case 'reset-withdrawals':
      if (p.resolved || c.phase !== 'planning')
        throw new Error('Resolved withdrawals cannot be reopened.');
      p.submissions.forEach((s) => (s.locked = false));
      break;
    case 'resolve-withdrawals': {
      if (p.resolved || c.phase !== 'planning')
        throw new Error('Withdrawals have already resolved.');
      if (!p.submissions.every((s) => s.locked))
        throw new Error(
          'Both sides must lock withdrawals, including empty holds.',
        );
      for (const s of p.submissions) validateWithdrawals(c, s.side, s.orders);
      const orders = p.submissions.flatMap((s) => s.orders);
      const enemyOrigins = new Map(
        orders.map((o) => [
          o.corpsId,
          c.corps.find((f) => f.id === o.enemyId)!.hexId!,
        ]),
      );
      const failed = new Set<string>();
      // Organization precedes withdrawal: an enemy retreat does not grant a
      // second organization step to an infantry corps that holds position.
      for (const f of c.corps.filter(
        (f) => f.status === 'ready' && f.kind === 'infantry' && f.hexId,
      ))
        f.formation = zone(c, f.hexId!, foes(c, f.side), false)
          ? 'battle'
          : 'advance';
      for (let step = 1; step <= 3 && orders.length; step++) {
        const requests = orders
          .filter((o) => !failed.has(o.corpsId))
          .map((o) => ({
            o,
            f: c.corps.find((f) => f.id === o.corpsId)!,
            to: o.path[step]!,
          }));
        const blocked = new Set<string>();
        for (const r of requests) {
          if (
            r.o.blocked ||
            !passable(c, r.f.hexId!, r.to) ||
            hexDistance(c, r.to, enemyOrigins.get(r.f.id)!) <=
              hexDistance(c, r.f.hexId!, enemyOrigins.get(r.f.id)!) ||
            zone(c, r.to, foes(c, r.f.side), false) ||
            c.corps.some(
              (f) =>
                f.id !== r.f.id &&
                f.status === 'ready' &&
                f.hexId === r.to &&
                (f.kind !== 'detachment' || f.side !== r.f.side),
            )
          )
            blocked.add(r.f.id);
          const competitors = requests.filter(
            (other) => other.f.id !== r.f.id && other.to === r.to,
          );
          if (
            competitors.some(
              (other) =>
                other.f.side !== r.f.side || other.o.priority < r.o.priority,
            )
          )
            blocked.add(r.f.id);
        }
        // Apply one shared snapshot's decisions together; no vacating chains or swaps.
        for (const r of requests) {
          if (blocked.has(r.f.id)) {
            failed.add(r.f.id);
            r.f.status = 'blown';
            r.f.hexId = null;
            r.f.returnSlot = c.turn + 2;
            c.log.push(
              `${r.f.name}: withdrawal blocked at step ${step}; blown until phase ${c.turn + 2}.`,
            );
          } else r.f.hexId = r.to;
          r.f.availableAt = p.startedAt + 60;
        }
      }
      if (orders.length) c.cursor = p.startedAt + 60;
      p.withdrawnCorpsIds = orders.map((o) => o.corpsId);
      p.resolved = true;
      p.resolvedAt = c.cursor;
      c.effectSerial++;
      c.log.push(
        `${campaignTime(c, c.cursor)}: simultaneous withdrawals resolved; ${orders.length - failed.size} completed, ${failed.size} blown. Withdrawn corps hold for the phase.`,
      );
      break;
    }
  }
}
