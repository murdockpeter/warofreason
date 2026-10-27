import { applyEpicCommand } from './simultaneous-epic';
import { applyIntelligenceCommand } from './simultaneous-intelligence';
import { applyCommanderCommand } from './simultaneous-commanders';
import {
  applySiegeCommand,
  finalizeSiegeCheckpoint,
} from './simultaneous-siege';
import {
  waterlooCampaignSchema,
  waterlooReceiptSchema,
} from './waterloo-schema';
import type {
  WaterlooCampaign as Campaign,
  WaterlooCorps as Corps,
  WaterlooBattle as Battle,
  WaterlooOrder as Order,
  WaterlooReceipt,
  WaterlooMarch as March,
  ReinforcementEstimate,
} from './waterloo-schema';
import {
  applyPreparationCommand,
  newPreparation,
  preparationIsMutable,
} from './waterloo-preparation';
import {
  applyMauriceAftermath,
  previewMauriceAftermath,
  restoreMauriceBaseline,
  processMauriceRecovery,
  hasReadyMauriceUnits,
  refreshMauriceRosters,
} from './simultaneous-aftermath';

export const phaseStart = (turn: number) =>
  Math.floor((turn - 1) / 2) * 1440 + ((turn - 1) % 2 ? 720 : 360);
export const phaseEnd = (turn: number) => phaseStart(turn) + 360;
export const firstMovementAt = (c: Campaign) =>
  c.preparation?.resolved
    ? Math.max(c.cursor, c.preparation.startedAt + c.charts.preparationMinutes)
    : Math.max(c.cursor, phaseStart(c.turn)) + c.charts.preparationMinutes;
export function campaignTime(c: Campaign, minute: number) {
  const d = new Date(`${c.startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.floor(minute / 1440));
  return `${d.toISOString().slice(0, 10)} ${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
export function hexDistance(c: Campaign, a: string, b: string) {
  const x = c.hexes.find((h) => h.id === a),
    y = c.hexes.find((h) => h.id === b);
  if (!x || !y) return Infinity;
  return Math.max(
    Math.abs(x.q - y.q),
    Math.abs(x.r - y.r),
    Math.abs(x.q + x.r - y.q - y.r),
  );
}
const edge = (c: Campaign, a: string, b: string) =>
  c.edges.find(
    (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a),
  );
const landEdge = (c: Campaign, a: string, b: string) =>
  hexDistance(c, a, b) === 1 &&
  edge(c, a, b)?.crossing !== 'major' &&
  c.hexes.find((h) => h.id === b)?.terrain !== 'water';
export function inZone(
  c: Campaign,
  hexId: string,
  opponent: Corps,
  radius: number,
) {
  if (opponent.status !== 'ready' || !opponent.hexId) return false;
  if (hexId === opponent.hexId) return true;
  let frontier = [opponent.hexId];
  const seen = new Set(frontier);
  for (let i = 0; i < radius; i++) {
    const next: string[] = [];
    for (const from of frontier)
      for (const h of c.hexes)
        if (!seen.has(h.id) && landEdge(c, from, h.id)) {
          if (h.id === hexId) return true;
          seen.add(h.id);
          next.push(h.id);
        }
    frontier = next;
  }
  return false;
}
const allowance = (f: Corps) =>
  f.kind === 'infantry'
    ? f.formation === 'battle'
      ? 1
      : 4
    : f.formation === 'exhausted'
      ? 4
      : 6;
const roadEligible = (f: Corps) =>
  !(f.kind === 'infantry' && f.formation === 'battle');
export function travelMinutes(
  c: Campaign,
  force: Corps,
  from: string,
  to: string,
  roadOnly: boolean,
) {
  if (!landEdge(c, from, to))
    throw new Error(
      'Choose adjacent passable hexes; major rivers need bridges.',
    );
  const e = edge(c, from, to);
  const h = c.hexes.find((h) => h.id === to)!;
  if (roadOnly && !e?.road)
    throw new Error('A road segment must remain on connected roads.');
  const f = { ...force };
  if (c.charts.weather === 'rain' && !roadOnly)
    f.formation = f.kind === 'infantry' ? 'battle' : 'exhausted';
  let cost = 120 / allowance(f) / (roadOnly && roadEligible(f) ? 2 : 1);
  if (!roadOnly)
    cost *= h.terrain === 'woods' ? 2 : h.terrain === 'rough' ? 1.5 : 1;
  if (c.charts.weather === 'rain' && roadOnly) cost *= 1.5;
  if (c.charts.weather === 'soft_ground' && !roadOnly) cost *= 1.25;
  cost += e?.crossing === 'bridge' ? 15 : e?.crossing === 'minor' ? 30 : 0;
  return Math.ceil(cost / 5) * 5;
}
function legalCommand(
  c: Campaign,
  f: Corps,
  hqId: string,
  from: string,
  to: string,
) {
  const hq = c.hqs.find((h) => h.id === hqId && h.army === f.army);
  if (!hq) throw new Error('Choose an HQ belonging to this army.');
  const range = hq.mode === 'normal' ? hq.normalRange : hq.battleRange;
  const before = hexDistance(c, from, hq.hexId),
    after = hexDistance(c, to, hq.hexId);
  if (before > range ? after >= before : after > range)
    throw new Error(
      'Movement must stay in command or move strictly closer to its HQ.',
    );
}
const enemies = (c: Campaign, f: Corps) =>
  c.corps.filter((e) => e.side !== f.side && e.status === 'ready');
function held(c: Campaign, id: string) {
  return c.battles.some(
    (b) =>
      b.appliedVersion === 0 &&
      [...b.initial, ...b.reinforcementForces].some((f) => f.id === id),
  );
}
export function validateOrders(
  c: Campaign,
  side: 'french' | 'allied',
  orders: Order[],
) {
  if (c.preparation && !c.preparation.resolved)
    throw new Error(
      'Resolve both sides’ withdrawals before ordinary movement orders.',
    );
  if (
    new Set(orders.map((o) => o.corpsId)).size !== orders.length ||
    new Set(orders.map((o) => o.priority)).size !== orders.length
  )
    throw new Error('Use one order per corps and unique friendly priorities.');
  for (const o of orders) {
    const f = c.corps.find((f) => f.id === o.corpsId);
    if (
      !f ||
      f.side !== side ||
      f.status !== 'ready' ||
      f.kind === 'detachment' ||
      !hasReadyMauriceUnits(c, f.id) ||
      c.preparation?.withdrawnCorpsIds.includes(f.id) ||
      held(c, f.id)
    )
      throw new Error('Only available friendly corps may march.');
    let from = f.hexId;
    let earliest = firstMovementAt(c);
    for (const segment of o.segments) {
      if (
        segment.path[0] !== from ||
        segment.startAt < phaseStart(c.turn) ||
        segment.startAt >= phaseEnd(c.turn) ||
        segment.startAt % 5 !== 0
      )
        throw new Error(
          'Segments need continuous origins and a five-minute departure inside this phase.',
        );
      const maxSteps =
        allowance(f) * (segment.roadOnly && roadEligible(f) ? 2 : 1);
      if (segment.path.length - 1 > maxSteps)
        throw new Error(
          'The segment exceeds this formation’s movement allowance.',
        );
      let duration = 0;
      for (let i = 1; i < segment.path.length; i++) {
        const a = segment.path[i - 1]!,
          b = segment.path[i]!;
        legalCommand(c, f, segment.hqId, a, b);
        duration += travelMinutes(c, f, a, b, segment.roadOnly);
      }
      const start = Math.max(earliest, segment.startAt, f.availableAt);
      if (duration > 120 || start + duration > phaseEnd(c.turn))
        throw new Error(
          'This segment cannot finish within its 120-minute window and this phase.',
        );
      earliest = start + duration;
      from = segment.path.at(-1)!;
    }
  }
}

export function seedWaterloo(
  title: string,
  uuid: () => string,
  now: string,
): Campaign {
  const hexes: Campaign['hexes'] = [];
  for (let r = 0; r < 9; r++)
    for (let q = 0; q < 13; q++)
      hexes.push({
        id: `${q},${r}`,
        q,
        r,
        terrain:
          r === 2 && q > 4 && q < 8
            ? 'woods'
            : r === 6 && q > 4 && q < 8
              ? 'rough'
              : 'clear',
        name: q === 6 && r === 4 ? 'Crossroads' : '',
      });
  const edges: Campaign['edges'] = [];
  for (const a of hexes)
    for (const b of hexes)
      if (
        a.id < b.id &&
        Math.max(
          Math.abs(a.q - b.q),
          Math.abs(a.r - b.r),
          Math.abs(a.q + a.r - b.q - b.r),
        ) === 1
      )
        edges.push({
          from: a.id,
          to: b.id,
          road: a.r === 4 && b.r === 4,
          crossing:
            a.q === 5 && b.q === 6 && a.r === 4 && b.r === 4
              ? 'bridge'
              : 'none',
        });
  const corps: Corps[] = [
    {
      id: uuid(),
      name: 'French I Corps',
      side: 'french',
      army: 'french',
      kind: 'infantry',
      formation: 'advance',
      hexId: '3,4',
      status: 'ready',
      returnSlot: null,
      roster: 'Enter the units or miniatures used by your tactical game.',
      availableAt: 360,
    },
    {
      id: uuid(),
      name: 'French Reserve Cavalry',
      side: 'french',
      army: 'french',
      kind: 'cavalry',
      formation: 'fresh',
      hexId: '1,6',
      status: 'ready',
      returnSlot: null,
      roster: 'Reserve cavalry — map scale corps.',
      availableAt: 360,
    },
    {
      id: uuid(),
      name: 'Anglo-Allied I Corps',
      side: 'allied',
      army: 'anglo_allied',
      kind: 'infantry',
      formation: 'advance',
      hexId: '9,4',
      status: 'ready',
      returnSlot: null,
      roster: 'Enter the units or miniatures used by your tactical game.',
      availableAt: 360,
    },
    {
      id: uuid(),
      name: 'Prussian Reserve',
      side: 'allied',
      army: 'prussian',
      kind: 'infantry',
      formation: 'advance',
      hexId: '11,2',
      status: 'ready',
      returnSlot: null,
      roster: 'Prussian reserve — map scale corps.',
      availableAt: 360,
    },
  ];
  return waterlooCampaignSchema.parse({
    id: uuid(),
    schemaVersion: 3,
    moduleId: 'waterloo-sandbox',
    moduleVersion: '0.1.0',
    rulesetVersion: 'waterloo_simultaneous_v0.1',
    title,
    status: 'active',
    revision: 1,
    seed: uuid(),
    createdAt: now,
    updatedAt: now,
    date: '1815-06-16',
    startDate: '1815-06-16',
    turn: 1,
    activeSide: null,
    cursor: 360,
    phase: 'planning',
    charts: {
      version: 'waterloo_original_charts_v0.1',
      preparationMinutes: 30,
      battleMinutes: 240,
      tacticalTurnMinutes: null,
      weather: 'dry',
    },
    hexes,
    edges,
    corps,
    hqs: [
      {
        id: uuid(),
        name: 'Napoleon',
        army: 'french',
        hexId: '2,4',
        mode: 'normal',
        normalRange: 8,
        battleRange: 3,
      },
      {
        id: uuid(),
        name: 'Wellington',
        army: 'anglo_allied',
        hexId: '11,4',
        mode: 'normal',
        normalRange: 10,
        battleRange: 3,
      },
      {
        id: uuid(),
        name: 'Blücher',
        army: 'prussian',
        hexId: '11,0',
        mode: 'normal',
        normalRange: 8,
        battleRange: 3,
      },
    ],
    submissions: [
      { side: 'french', locked: false, orders: [] },
      { side: 'allied', locked: false, orders: [] },
    ],
    marches: [],
    encounters: [],
    battles: [],
    log: [
      'Original Crossroads scenario: simultaneous movement and external tactical battles.',
    ],
    effectSerial: 0,
  });
}

function stop(c: Campaign, ids: string[]) {
  for (const m of c.marches.filter((m) => ids.includes(m.corpsId))) {
    m.stopped = true;
    m.transit = null;
  }
}
function contact(c: Campaign, ids: string[], hexId: string, reason: string) {
  let unique = [...new Set(ids)].sort();
  let connected: Campaign['encounters'] = [];
  for (;;) {
    const matches = c.encounters.filter(
      (e) =>
        e.at === c.cursor &&
        !e.settled &&
        !e.battleId &&
        e.corpsIds.some((id) => unique.includes(id)),
    );
    if (matches.length === connected.length) break;
    connected = matches;
    unique = [
      ...new Set([...unique, ...matches.flatMap((e) => e.corpsIds)]),
    ].sort();
  }
  const existing = connected[0];
  if (existing) {
    existing.corpsIds = unique;
    for (const merged of connected.slice(1)) {
      merged.settled = true;
      merged.reason = `Merged into ${existing.id}.`;
    }
  } else
    c.encounters.push({
      id: `contact-${c.turn}-${c.cursor}-${c.encounters.length}`,
      at: c.cursor,
      hexId,
      corpsIds: unique,
      reason,
      settled: false,
      battleId: null,
    });
  stop(c, unique);
  c.log.push(`${campaignTime(c, c.cursor)}: ${reason}`);
}
function applyEffects(c: Campaign, b: Battle) {
  const result = b.results.at(-1)!.result;
  b.baseline = c.corps
    .filter((f) =>
      [...b.initial, ...b.reinforcementForces].some((p) => p.id === f.id),
    )
    .map((f) => structuredClone(f));
  for (const effect of result.effects) {
    const f = c.corps.find((f) => f.id === effect.corpsId)!;
    f.status =
      effect.disposition === 'eliminated'
        ? 'eliminated'
        : effect.disposition === 'blown'
          ? 'blown'
          : effect.disposition === 'recalled'
            ? 'reserve'
            : 'ready';
    f.hexId = f.status === 'ready' ? effect.hexId : null;
    f.returnSlot = f.status === 'blown' ? c.turn + 2 : null;
    if (effect.disposition === 'recalled' && f.detachment) {
      f.detachment.availableFromTurn = c.turn + 1;
      f.detachment.deployedByHqId = null;
    }
    if (f.kind === 'cavalry' && effect.exhausted) f.formation = 'exhausted';
    if (f.kind === 'infantry' && f.status === 'ready')
      f.formation = enemies(c, f).some((e) => inZone(c, f.hexId!, e, 1))
        ? 'battle'
        : 'advance';
    f.availableAt = Math.max(c.cursor, result.endAt);
  }
  applyMauriceAftermath(c, b);
  c.effectSerial++;
  b.appliedSerial = c.effectSerial;
  b.appliedVersion = b.results.length;
  const encounter = c.encounters.find((e) => e.id === b.encounterId)!;
  encounter.settled = true;
  c.log.push(
    `${campaignTime(c, c.cursor)}: campaign effects applied for ${b.title} (${result.outcome}).`,
  );
}
function checkResult(
  c: Campaign,
  b: Battle,
  result: Battle['results'][number]['result'],
) {
  previewMauriceAftermath(c, b, result);
  const ids = [...b.initial, ...b.reinforcementForces].map((f) => f.id);
  if (
    result.effects.length !== ids.length ||
    new Set(result.effects.map((e) => e.corpsId)).size !== ids.length ||
    result.effects.some((e) => !ids.includes(e.corpsId))
  )
    throw new Error('Review every committed corps exactly once.');
  if (
    result.endAt < b.startAt ||
    result.endAt % 5 !== 0 ||
    result.endAt > phaseEnd(c.turn) + 720
  )
    throw new Error(
      'Use a five-minute battle end time at or after its start (at most 12 hours beyond this phase).',
    );
  const prospective = new Map(
    c.corps
      .filter(
        (f) =>
          !ids.includes(f.id) && f.hexId !== null && f.kind !== 'detachment',
      )
      .map((f) => [f.hexId!, f.id]),
  );
  for (const e of result.effects) {
    const f = c.corps.find((f) => f.id === e.corpsId)!;
    if (
      e.disposition === 'recalled' &&
      (!f.detachment || f.kind !== 'detachment')
    )
      throw new Error('Only a managed detachment can be recalled.');
    if (f.detachment && ['blown', 'retreated'].includes(e.disposition))
      throw new Error(
        'Review a detachment as retained, recalled, eliminated or not engaged.',
      );
    if (['retained', 'retreated', 'not_engaged'].includes(e.disposition)) {
      if (
        !e.hexId ||
        !c.hexes.some((h) => h.id === e.hexId && h.terrain !== 'water')
      )
        throw new Error(
          'Surviving corps need a valid passable post-battle hex.',
        );
      if (f.kind !== 'detachment' && prospective.has(e.hexId))
        throw new Error('Post-battle corps cannot stack.');
      if (f.kind !== 'detachment') prospective.set(e.hexId, e.corpsId);
    } else if (e.hexId !== null)
      throw new Error('Removed or recalled forces must leave the map.');
    const reinforcement = b.reinforcements.find((r) => r.corpsId === e.corpsId);
    if (
      reinforcement &&
      e.disposition !== 'not_engaged' &&
      (e.arrivalAt === null ||
        e.arrivalAt < reinforcement.earliest ||
        e.arrivalAt > result.endAt)
    )
      throw new Error(
        'A participating reinforcement must arrive within its feasible battle window.',
      );
  }
  if (c.preparation) {
    const after = c.corps.map((f) => {
      const effect = result.effects.find((e) => e.corpsId === f.id);
      return effect
        ? {
            ...f,
            hexId: ['retained', 'retreated', 'not_engaged'].includes(
              effect.disposition,
            )
              ? effect.hexId
              : null,
          }
        : f;
    });
    const detachments = after.filter(
      (f) => f.kind === 'detachment' && f.hexId !== null,
    );
    if (
      new Set(detachments.map((f) => f.hexId)).size !== detachments.length ||
      detachments.some((f) =>
        after.some(
          (other) =>
            other.id !== f.id &&
            other.hexId === f.hexId &&
            other.side !== f.side,
        ),
      )
    )
      throw new Error(
        'Detachments cannot stack with another detachment or opposing force.',
      );
  }
}

function resolve(c: Campaign) {
  if (c.preparation && !c.preparation.resolved)
    throw new Error('Resolve withdrawals before ordinary movement.');
  if (!c.submissions.every((s) => s.locked))
    throw new Error(
      'Both sides must lock orders before simultaneous resolution.',
    );
  if (c.encounters.some((e) => !e.settled && !e.battleId))
    throw new Error('Adjudicate outstanding contacts first.');
  if (c.battles.some((b) => b.appliedVersion === 0 && !b.approved))
    throw new Error('Record and approve the pending battle result first.');
  if (c.phase === 'checkpoint') throw new Error('Finalize this phase first.');
  if (!c.marches.length && c.phase === 'locked') {
    c.marches = c.submissions.flatMap((s) =>
      s.orders.map((o) => ({
        corpsId: o.corpsId,
        segment: 0,
        step: 0,
        readyAt: Math.max(
          firstMovementAt(c),
          c.corps.find((f) => f.id === o.corpsId)!.availableAt,
        ),
        windowStart: null,
        movedSteps: 0,
        stopped: false,
        transit: null,
      })),
    );
    for (const m of c.marches) {
      const f = c.corps.find((f) => f.id === m.corpsId)!;
      if (
        enemies(c, f).some(
          (e) =>
            inZone(c, f.hexId!, e, 1) &&
            (f.kind === 'infantry' || e.kind === 'cavalry'),
        )
      )
        m.stopped = true;
    }
  }
  c.phase = 'resolving';
  const resolutionEnd = Math.max(
    phaseEnd(c.turn),
    ...c.battles
      .filter((b) => b.approved && !b.appliedVersion)
      .map((b) => b.results.at(-1)!.result.endAt),
  );
  for (; c.cursor <= resolutionEnd; c.cursor += 5) {
    const justVacated = new Set<string>();
    for (const b of c.battles)
      if (
        b.approved &&
        b.appliedVersion === 0 &&
        b.results.at(-1)!.result.endAt <= c.cursor
      ) {
        checkResult(c, b, b.results.at(-1)!.result);
        applyEffects(c, b);
      }
    const completed = c.marches.filter(
      (m) => m.transit && m.transit.arrivesAt <= c.cursor,
    );
    for (const m of completed) {
      const f = c.corps.find((f) => f.id === m.corpsId)!;
      justVacated.add(m.transit!.from);
      f.hexId = m.transit!.to;
      c.effectSerial++;
      m.step++;
      m.movedSteps++;
      m.readyAt = c.cursor;
      m.transit = null;
    }
    for (const m of completed) {
      const f = c.corps.find((f) => f.id === m.corpsId)!;
      const foes = enemies(c, f).filter((e) => inZone(c, f.hexId!, e, 1));
      if (foes.length) {
        if (f.kind === 'infantry') f.formation = 'battle';
        contact(
          c,
          [f.id, ...foes.map((e) => e.id)],
          f.hexId!,
          'Opposing forces have made contact.',
        );
      } else if (
        enemies(c, f).some(
          (e) =>
            e.kind !== 'detachment' &&
            (f.kind === 'infantry' || e.kind === 'cavalry') &&
            inZone(c, f.hexId!, e, 2) &&
            !inZone(c, movementOrigin(c, m)!, e, 2),
        )
      )
        m.stopped = true;
    }
    // New control or influence cancels in-flight movement back to its reserved origin.
    for (const m of c.marches.filter((m) => m.transit)) {
      const f = c.corps.find((f) => f.id === m.corpsId)!;
      const foes = enemies(c, f).filter(
        (e) =>
          completed.some((moved) => moved.corpsId === e.id) &&
          inZone(c, m.transit!.to, e, 1),
      );
      if (foes.length)
        contact(
          c,
          [f.id, ...foes.map((e) => e.id)],
          f.hexId!,
          'An approaching route is blocked by new enemy control.',
        );
      else if (
        enemies(c, f).some(
          (e) =>
            completed.some((moved) => moved.corpsId === e.id) &&
            e.kind !== 'detachment' &&
            (f.kind === 'infantry' || e.kind === 'cavalry') &&
            inZone(c, m.transit!.to, e, 2),
        )
      ) {
        m.stopped = true;
        m.transit = null;
      }
    }
    if (c.encounters.some((e) => !e.settled && !e.battleId)) {
      c.phase = 'adjudication';
      return;
    }
    if (c.cursor === resolutionEnd) break;
    if (c.cursor >= phaseEnd(c.turn)) continue;
    const requests: {
      m: March;
      f: Corps;
      to: string;
      cost: number;
      priority: number;
    }[] = [];
    for (const m of c.marches) {
      if (m.stopped || m.transit || m.readyAt > c.cursor || held(c, m.corpsId))
        continue;
      const f = c.corps.find((f) => f.id === m.corpsId)!;
      const o = c.submissions
        .flatMap((s) => s.orders)
        .find((o) => o.corpsId === m.corpsId)!;
      let s = o.segments[m.segment];
      if (!s) {
        m.stopped = true;
        continue;
      }
      if (
        m.step >= s.path.length - 1 ||
        (m.windowStart !== null && c.cursor >= m.windowStart + 120)
      ) {
        m.segment++;
        m.step = 0;
        m.movedSteps = 0;
        m.windowStart = null;
        s = o.segments[m.segment];
      }
      if (!s) {
        m.stopped = true;
        continue;
      }
      if (m.step === 0 && s.path[0] !== f.hexId) {
        m.stopped = true;
        c.log.push(
          `${f.name}: later segment cancelled because its origin was not reached.`,
        );
        continue;
      }
      if (c.cursor < s.startAt) continue;
      m.windowStart ??= c.cursor;
      const to = s.path[m.step + 1];
      if (!to) continue;
      if (
        f.kind === 'cavalry' &&
        m.movedSteps === 0 &&
        enemies(c, f).some((e) => inZone(c, f.hexId!, e, 1)) &&
        enemies(c, f).some((e) => inZone(c, to, e, 1))
      ) {
        m.stopped = true;
        c.log.push(
          `${f.name}: cavalry escape must first reach an empty hex outside enemy control.`,
        );
        continue;
      }
      try {
        legalCommand(c, f, s.hqId, f.hexId!, to);
      } catch {
        m.stopped = true;
        continue;
      }
      const cost = travelMinutes(c, f, f.hexId!, to, s.roadOnly);
      if (
        c.cursor + cost > Math.min(m.windowStart + 120, phaseEnd(c.turn)) ||
        m.movedSteps >= allowance(f) * (s.roadOnly && roadEligible(f) ? 2 : 1)
      ) {
        m.readyAt = m.windowStart + 120;
        continue;
      }
      if (justVacated.has(to)) continue;
      requests.push({ m, f, to, cost, priority: o.priority });
    }
    const rejected = new Set<string>();
    // Equal-time opposing requests are handled before friendly priorities.
    for (let i = 0; i < requests.length; i++)
      for (let j = i + 1; j < requests.length; j++) {
        const a = requests[i]!,
          b = requests[j]!;
        if (
          a.f.side !== b.f.side &&
          (a.to === b.to || (a.to === b.f.hexId && b.to === a.f.hexId))
        ) {
          rejected.add(a.f.id);
          rejected.add(b.f.id);
          contact(
            c,
            [a.f.id, b.f.id],
            a.to,
            'Opposing routes meet; neither side gains movement priority.',
          );
        }
      }
    for (const r of requests
      .filter((r) => !rejected.has(r.f.id))
      .sort((a, b) => a.priority - b.priority)) {
      if (r.m.stopped) continue;
      const occupying = c.corps.filter(
        (f) =>
          f.status === 'ready' && f.hexId === r.to && f.kind !== 'detachment',
      );
      const hostile = c.corps.filter(
        (f) => f.status === 'ready' && f.hexId === r.to && f.side !== r.f.side,
      );
      const reservation = c.marches.find(
        (m) =>
          m.transit &&
          (m.transit.to === r.to ||
            (m.transit.from === r.to && m.transit.to === r.f.hexId)),
      );
      const reserveForce = reservation
        ? c.corps.find((f) => f.id === reservation.corpsId)
        : undefined;
      if (hostile.length || (reserveForce && reserveForce.side !== r.f.side)) {
        contact(
          c,
          [
            r.f.id,
            ...hostile.map((f) => f.id),
            ...(reserveForce ? [reserveForce.id] : []),
          ],
          r.to,
          'Enemy occupancy or a crossing route blocks movement.',
        );
        continue;
      }
      if (occupying.length || reservation) continue;
      if (
        c.charts.weather === 'rain' &&
        !c.submissions
          .flatMap((s) => s.orders)
          .find((o) => o.corpsId === r.f.id)!.segments[r.m.segment]!.roadOnly
      )
        r.f.formation = r.f.kind === 'infantry' ? 'battle' : 'exhausted';
      r.m.transit = {
        from: r.f.hexId!,
        to: r.to,
        departedAt: c.cursor,
        arrivesAt: c.cursor + r.cost,
      };
    }
    if (c.encounters.some((e) => !e.settled && !e.battleId)) {
      c.phase = 'adjudication';
      return;
    }
  }
  c.cursor = resolutionEnd;
  c.phase = c.battles.some((b) => b.appliedVersion === 0)
    ? 'adjudication'
    : 'checkpoint';
}
function movementOrigin(c: Campaign, m: March) {
  return c.submissions
    .flatMap((s) => s.orders)
    .find((o) => o.corpsId === m.corpsId)?.segments[m.segment]?.path[
    Math.max(0, m.step - 1)
  ];
}

export function estimateReinforcement(
  c: Campaign,
  b: Battle,
  f: Corps,
): ReinforcementEstimate | null {
  if (
    f.status !== 'ready' ||
    f.kind === 'detachment' ||
    !f.hexId ||
    held(c, f.id) ||
    c.preparation?.withdrawnCorpsIds.includes(f.id) ||
    enemies(c, f).some((e) => inZone(c, f.hexId!, e, 1))
  )
    return null;
  const initialIds = new Set(b.initial.map((f) => f.id));
  const blocked = (hex: string) =>
    c.corps.some(
      (p) =>
        p.id !== f.id &&
        p.hexId === hex &&
        p.status === 'ready' &&
        p.kind !== 'detachment',
    ) ||
    enemies(c, f).some((e) => !initialIds.has(e.id) && inZone(c, hex, e, 1));
  const distances = new Map([[f.hexId, 0]]),
    paths = new Map([[f.hexId, [f.hexId]]]);
  const pending = [f.hexId];
  let dest: string | null = null;
  while (pending.length) {
    pending.sort(
      (a, d) => distances.get(a)! - distances.get(d)! || a.localeCompare(d),
    );
    const at = pending.shift()!;
    if (hexDistance(c, at, b.hexId) === 1 && !blocked(at)) {
      dest = at;
      break;
    }
    for (const h of c.hexes) {
      if (!landEdge(c, at, h.id) || blocked(h.id)) continue;
      const hq = c.hqs.find((h) => h.army === f.army);
      if (!hq) continue;
      try {
        legalCommand(c, f, hq.id, at, h.id);
      } catch {
        continue;
      }
      const cost = travelMinutes(c, f, at, h.id, !!edge(c, at, h.id)?.road);
      const value = distances.get(at)! + cost;
      if (value < (distances.get(h.id) ?? Infinity)) {
        distances.set(h.id, value);
        paths.set(h.id, [...paths.get(at)!, h.id]);
        if (!pending.includes(h.id)) pending.push(h.id);
      }
    }
  }
  if (!dest) return null;
  const path = paths.get(dest)!;
  // Estimate each 120-minute activation consistently: mixed paths use off-road throughout.
  let travel = 0,
    segmentTime = 0,
    segmentSteps = 0,
    segments = 1;
  const roadOnly = path
    .slice(1)
    .every((hex, i) => edge(c, path[i]!, hex)?.road);
  for (let i = 1; i < path.length; i++) {
    const cost = travelMinutes(c, f, path[i - 1]!, path[i]!, roadOnly);
    const limit = allowance(f) * (roadOnly && roadEligible(f) ? 2 : 1);
    if (segmentTime + cost > 120 || segmentSteps >= limit) {
      segments++;
      segmentTime = 0;
      segmentSteps = 0;
    }
    if (cost > 120) return null;
    travel += cost;
    segmentTime += cost;
    segmentSteps++;
  }
  const march = c.marches.find((m) => m.corpsId === f.id);
  const originalOrder = c.submissions
    .flatMap((s) => s.orders)
    .find((o) => o.corpsId === f.id);
  const spentSegments = march
    ? Math.min(
        originalOrder?.segments.length ?? 0,
        march.segment + (march.windowStart === null ? 0 : 1),
      )
    : 0;
  if (segments + spentSegments > 3) return null;
  const earliest =
    Math.max(c.cursor, f.availableAt) + c.charts.preparationMinutes + travel;
  if (earliest > phaseEnd(c.turn) || earliest > b.expectedEndAt) return null;
  return {
    corpsId: f.id,
    originHexId: f.hexId,
    entryHexId: dest,
    entryEdge: `Approach from ${dest}`,
    path,
    earliest,
    likely: earliest + 15,
    latest:
      Math.max(c.cursor, f.availableAt) +
      c.charts.preparationMinutes +
      15 +
      Math.ceil((travel * 1.25) / 5) * 5 +
      30,
    notes:
      'Conditional on the approach remaining clear. New order assembly included; no tactical combat is calculated.',
  };
}

export function applyWaterlooCommand(
  input: Campaign,
  raw: WaterlooReceipt,
): Campaign {
  const { command, recordId, timestamp } = waterlooReceiptSchema.parse(raw);
  if (input.status === 'archived')
    throw new Error('Archived campaigns are read-only.');
  if (input.fontenoy?.siege.campaign?.victory)
    throw new Error(
      'The campaign has concluded; its strategic record is read-only.',
    );
  const c = structuredClone(input);
  switch (command.kind) {
    case 'maurice-scout-request':
    case 'maurice-intelligence-report':
      applyIntelligenceCommand(c, { command, recordId, timestamp });
      break;
    case 'maurice-epic-enable':
    case 'maurice-epic-record':
      applyEpicCommand(c, { command, recordId, timestamp });
      break;
    case 'maurice-commanders-enable':
    case 'maurice-commander':
      applyCommanderCommand(c, { command, recordId, timestamp });
      break;
    case 'maurice-siege-policy':
    case 'maurice-siege-review':
      applySiegeCommand(c, command);
      break;
    case 'maurice-recovery-policy': {
      if (!c.fontenoy)
        throw new Error('Open a simultaneous Maurice Fontenoy campaign.');
      if (
        c.phase !== 'planning' ||
        c.submissions.some((s) => s.locked || s.orders.length) ||
        c.battles.some((b) => !b.appliedVersion) ||
        c.encounters.some((e) => !e.settled)
      )
        throw new Error(
          'Review recovery policies during clear planning, before orders or unresolved battles.',
        );
      if (
        !c.fontenoy.aftermath &&
        c.fontenoy.units.some((u) => u.currentStatus !== 'ready')
      )
        throw new Error(
          'Reconcile existing unit readiness before enabling recovery rules.',
        );
      c.fontenoy.aftermath = c.fontenoy.aftermath
        ? { ...c.fontenoy.aftermath, policy: command.policy }
        : { policy: command.policy, recoveries: [] };
      c.effectSerial++;
      c.log.push(
        `Reviewed Maurice loss/recovery policy: ${command.policy.minutesPerRecoveryTurn} minutes per recovery turn. Existing recovery dates stay fixed.`,
      );
      refreshMauriceRosters(c);
      break;
    }
    case 'enable-preparation':
    case 'deploy-detachment':
    case 'recall-detachment':
    case 'withdrawals':
    case 'reset-withdrawals':
    case 'resolve-withdrawals':
      applyPreparationCommand(c, command, recordId);
      break;
    case 'place-hqs': {
      if (c.preparation?.deploymentHqIds.length)
        throw new Error('Place HQs before detachment placement.');
      if (c.preparation && !preparationIsMutable(c))
        throw new Error('Place HQs before withdrawal submissions.');
      if (
        c.phase !== 'planning' ||
        c.submissions.some((s) => s.locked || s.orders.length)
      )
        throw new Error('Place HQs before movement orders are saved.');
      if (
        new Set(command.placements.map((p) => p.hqId)).size !==
        command.placements.length
      )
        throw new Error('Place each HQ at most once.');
      for (const p of command.placements) {
        const hq = c.hqs.find((h) => h.id === p.hqId);
        const side = hq?.army === 'french' ? 'french' : 'allied';
        const associated = c.corps.filter(
          (f) => f.army === hq?.army && f.status === 'ready' && f.hexId,
        );
        const fallback =
          !!c.preparation &&
          associated.length === 0 &&
          !c.corps.some((f) => f.status === 'ready' && f.hexId === p.hexId) &&
          !c.hqs.some((h) => h.id !== p.hqId && h.hexId === p.hexId) &&
          c.edges.some(
            (e) =>
              e.road &&
              (hexDistance(c, p.hexId, e.from) <= 3 ||
                hexDistance(c, p.hexId, e.to) <= 3),
          );
        if (
          !hq ||
          !c.hexes.some((h) => h.id === p.hexId && h.terrain !== 'water') ||
          (!fallback &&
            (!associated.some((f) => hexDistance(c, p.hexId, f.hexId!) <= 3) ||
              c.corps.some(
                (f) =>
                  f.side !== side &&
                  inZone(c, p.hexId, f, f.kind === 'detachment' ? 1 : 2),
              )))
        )
          throw new Error(
            'HQ placement needs a nearby army unit outside enemy zones; without on-map units, preparation allows an empty hex within three of a recorded road.',
          );
        hq.hexId = p.hexId;
        hq.mode = p.mode;
      }
      if (new Set(c.hqs.map((h) => h.hexId)).size !== c.hqs.length)
        throw new Error('HQ markers cannot stack.');
      break;
    }
    case 'return-corps': {
      if (c.preparation?.deploymentHqIds.length)
        throw new Error('Review returns before detachment placement.');
      if (c.preparation && !preparationIsMutable(c))
        throw new Error('Review returns before withdrawal submissions.');
      if (
        c.phase !== 'planning' ||
        c.submissions.some((s) => s.locked || s.orders.length)
      )
        throw new Error('Review returns before saving movement orders.');
      if (
        command.corpsIds.length !== command.hexIds.length ||
        new Set(command.corpsIds).size !== command.corpsIds.length
      )
        throw new Error('Each returning corps needs one distinct placement.');
      const due = c.corps.filter(
        (f) =>
          f.status === 'blown' &&
          f.returnSlot !== null &&
          f.returnSlot <= c.turn,
      );
      const selected = command.corpsIds.map((id) =>
        due.find((f) => f.id === id),
      );
      if (selected.some((f) => !f))
        throw new Error('Only due blown corps can return.');
      if (selected.some((f) => !hasReadyMauriceUnits(c, f!.id)))
        throw new Error(
          'A returning formation needs at least one ready Maurice unit; complete due recovery checkpoints first.',
        );
      if (new Set(selected.map((f) => f!.side)).size > 1)
        throw new Error('Review one side’s returns at a time.');
      const side = selected[0]?.side;
      if (!side) throw new Error('Select at least one due corps.');
      if (
        due.filter((f) => f.side === side).length > 2 &&
        selected.length !== 2
      )
        throw new Error(
          'Choose exactly two survivors when more than two are due.',
        );
      for (let i = 0; i < selected.length; i++) {
        const f = selected[i]!,
          to = command.hexIds[i]!;
        if (
          !c.hexes.some((h) => h.id === to && h.terrain !== 'water') ||
          c.corps.some((f) => f.hexId === to) ||
          c.hqs.some((h) => h.hexId === to) ||
          !c.hqs.some(
            (h) => h.army === f.army && hexDistance(c, h.hexId, to) === 1,
          ) ||
          enemies(c, f).some((e) =>
            inZone(c, to, e, e.kind === 'detachment' ? 1 : 2),
          )
        )
          throw new Error(
            'Returns need an empty hex adjacent to their army HQ, outside enemy control/influence.',
          );
        f.hexId = to;
        f.status = 'ready';
        f.returnSlot = null;
        f.availableAt = c.cursor;
      }
      if (due.filter((f) => f.side === side).length > 2)
        for (const f of due.filter(
          (f) => f.side === side && !command.corpsIds.includes(f.id),
        )) {
          f.status = 'eliminated';
          f.returnSlot = null;
        }
      c.effectSerial++;
      break;
    }
    case 'orders': {
      if (c.phase !== 'planning' && c.phase !== 'locked')
        throw new Error('Movement planning is closed.');
      const s = c.submissions.find((s) => s.side === command.side)!;
      if (s.locked)
        throw new Error(
          'This side is already locked; reset both submissions to revise it.',
        );
      validateOrders(c, command.side, command.orders);
      s.orders = command.orders;
      s.locked = command.lock;
      c.phase = c.submissions.every((s) => s.locked) ? 'locked' : 'planning';
      break;
    }
    case 'reset-orders':
      if (!['planning', 'locked'].includes(c.phase))
        throw new Error('Resolved orders cannot be reopened.');
      c.submissions.forEach((s) => (s.locked = false));
      c.phase = 'planning';
      break;
    case 'configure':
      if (c.preparation?.deploymentHqIds.length)
        throw new Error('Configure charts before detachment placement.');
      if (c.preparation && !preparationIsMutable(c))
        throw new Error('Configure charts before withdrawal submissions.');
      if (
        c.phase !== 'planning' ||
        c.submissions.some((s) => s.locked || s.orders.length)
      )
        throw new Error('Clear orders before changing phase charts.');
      c.charts = command.charts;
      break;
    case 'resolve':
      resolve(c);
      break;
    case 'stand-off': {
      const e = c.encounters.find(
        (e) => e.id === command.encounterId && !e.settled && !e.battleId,
      );
      if (!e) throw new Error('Choose an unresolved contact.');
      e.settled = true;
      stop(c, e.corpsIds);
      c.log.push('Contact settled as a stand-off; forces hold for this phase.');
      break;
    }
    case 'declare-battle': {
      const e = c.encounters.find(
        (e) => e.id === command.encounterId && !e.settled && !e.battleId,
      );
      if (!e) throw new Error('Choose an unresolved contact.');
      if (e.corpsIds.some((id) => held(c, id)))
        throw new Error('A force is already committed to another battle.');
      const forces = c.corps.filter((f) => e.corpsIds.includes(f.id));
      if (!forces.some((f) => f.kind !== 'detachment'))
        throw new Error('Detachments cannot initiate a battle.');
      const b: Battle = {
        id: recordId,
        encounterId: e.id,
        title: command.title,
        startAt: e.at,
        expectedEndAt: e.at + c.charts.battleMinutes,
        hexId: e.hexId,
        charts: structuredClone(c.charts),
        initial: structuredClone(forces),
        reinforcements: [],
        reinforcementForces: [],
        results: [],
        approved: false,
        appliedVersion: 0,
        baseline: [],
        appliedSerial: null,
      };
      if (c.fontenoy)
        b.maurice = forces
          .filter((f) => f.kind !== 'detachment')
          .map((f) => {
            const link = c.fontenoy!.formations.find(
              (link) => link.corpsId === f.id,
            )!;
            return {
              corpsId: f.id,
              units: structuredClone(
                c.fontenoy!.units.filter(
                  (u) =>
                    link.unitIds.includes(u.id) && u.currentStatus === 'ready',
                ),
              ),
              commanders: structuredClone(
                c.fontenoy!.commanders.filter((u) =>
                  link.commanderIds.includes(u.id),
                ),
              ),
            };
          });
      c.battles.push(b);
      e.battleId = b.id;
      break;
    }
    case 'reinforce': {
      const b = c.battles.find(
        (b) => b.id === command.battleId && !b.results.length,
      );
      const f = c.corps.find((f) => f.id === command.corpsId);
      if (!b || !f)
        throw new Error('Choose an open battle and available corps.');
      const estimate = estimateReinforcement(c, b, f);
      if (!estimate)
        throw new Error('No feasible uncommitted approach in this phase.');
      if (command.arrivalOverride) {
        const { at, reason } = command.arrivalOverride;
        if (
          at % 5 !== 0 ||
          at < b.startAt ||
          at > Math.min(b.expectedEndAt, phaseEnd(c.turn))
        )
          throw new Error(
            'The agreed arrival must be a five-minute time inside this battle and phase.',
          );
        estimate.earliest = at;
        estimate.likely = at;
        estimate.latest = at;
        estimate.notes = `Umpire-fixed arrival: ${reason}`;
      }
      b.reinforcements.push({
        ...estimate,
        entryEdge: command.entryEdge,
        notes: command.arrivalOverride
          ? `${estimate.notes}${command.notes ? ` · ${command.notes}` : ''}`
          : command.notes || estimate.notes,
      });
      b.reinforcementForces.push(structuredClone(f));
      if (c.fontenoy) {
        const link = c.fontenoy.formations.find(
          (link) => link.corpsId === f.id,
        )!;
        b.maurice ??= [];
        b.maurice.push({
          corpsId: f.id,
          units: structuredClone(
            c.fontenoy.units.filter(
              (u) => link.unitIds.includes(u.id) && u.currentStatus === 'ready',
            ),
          ),
          commanders: structuredClone(
            c.fontenoy.commanders.filter((u) =>
              link.commanderIds.includes(u.id),
            ),
          ),
        });
      }
      stop(c, [f.id]);
      break;
    }
    case 'result': {
      const b = c.battles.find((b) => b.id === command.battleId);
      if (!b) throw new Error('Battle not found.');
      checkResult(c, b, command.result);
      if (b.appliedVersion > 0) {
        if (
          b.appliedSerial !== c.effectSerial ||
          command.result.endAt !== b.results.at(-1)!.result.endAt
        )
          throw new Error(
            'Later movement or time changes depend on this result. Reconcile those events before correcting campaign effects.',
          );
        const baseline = structuredClone(b.baseline);
        b.results.push({ result: command.result, reason: command.reason });
        c.corps = c.corps.map((f) => baseline.find((p) => p.id === f.id) ?? f);
        restoreMauriceBaseline(c, b);
        applyEffects(c, b);
      } else {
        b.results.push({ result: command.result, reason: command.reason });
        b.approved = false;
      }
      break;
    }
    case 'approve-result': {
      const b = c.battles.find(
        (b) =>
          b.id === command.battleId &&
          b.results.length &&
          !b.appliedVersion &&
          !b.approved,
      );
      if (!b) throw new Error('Choose an unapproved recorded result.');
      checkResult(c, b, b.results.at(-1)!.result);
      b.approved = true;
      break;
    }
    case 'finalize': {
      if (
        c.phase !== 'checkpoint' ||
        c.encounters.some((e) => !e.settled) ||
        c.battles.some((b) => !b.appliedVersion)
      )
        throw new Error(
          'Finish all movement, contact and battle reviews first.',
        );
      finalizeSiegeCheckpoint(c, timestamp);
      if (c.fontenoy?.siege.campaign?.victory) {
        c.effectSerial++;
        processMauriceRecovery(c);
        break;
      }
      if (c.turn >= 100)
        throw new Error('The 100-phase sandbox window is complete.');
      c.turn++;
      while (c.turn < 100 && phaseEnd(c.turn) <= c.cursor) c.turn++;
      c.cursor = Math.max(c.cursor, phaseStart(c.turn));
      c.date = campaignTime(c, c.cursor).slice(0, 10);
      c.phase = 'planning';
      if (c.preparation)
        c.preparation = newPreparation(c.turn, c.cursor, !!c.fontenoy);
      c.marches = [];
      c.submissions.forEach((s) => {
        s.locked = false;
        s.orders = [];
      });
      c.effectSerial++;
      processMauriceRecovery(c);
      for (const f of c.corps)
        if (f.status === 'ready' && f.hexId) {
          if (f.kind === 'infantry')
            f.formation = enemies(c, f).some((e) => inZone(c, f.hexId!, e, 1))
              ? 'battle'
              : 'advance';
          if (
            f.kind === 'cavalry' &&
            !enemies(c, f).some((e) =>
              inZone(c, f.hexId!, e, e.kind === 'detachment' ? 1 : 2),
            )
          )
            f.formation = 'fresh';
        }
      // Returns need explicit legal empty placement; never silently stack returning corps.
      const due = c.corps.filter(
        (f) =>
          f.status === 'blown' &&
          f.returnSlot !== null &&
          f.returnSlot <= c.turn,
      );
      if (due.length)
        c.log.push(
          `${due.length} blown corps await reviewed return placement.`,
        );
      break;
    }
  }
  if (c.log.length > 3000) c.log = c.log.slice(-3000);
  return waterlooCampaignSchema.parse(c);
}
