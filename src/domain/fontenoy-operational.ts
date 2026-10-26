import { seedFontenoy } from './fontenoy';
import { seedWaterloo } from './waterloo';
import { waterlooCampaignSchema } from './waterloo-schema';
import type { WaterlooCampaign } from './waterloo-schema';
import type { Campaign, FontenoyCampaign } from './campaign';

export function seedFontenoyOperational(
  title: string,
  uuid: () => string,
  now: string,
  source?: FontenoyCampaign,
): WaterlooCampaign {
  const base: Campaign = {
    id: uuid(),
    schemaVersion: 1,
    moduleId: 'fontenoy',
    moduleVersion: 'unconfigured',
    rulesetVersion: 'unconfigured',
    title,
    status: 'draft',
    revision: 1,
    turn: 0,
    date: null,
    activeSide: null,
    settings: {},
    seed: uuid(),
    createdAt: now,
    updatedAt: now,
    factions: [],
    units: [],
    commanders: [],
    columns: [],
    squares: [],
  };
  const setup = source ?? seedFontenoy(base, uuid);
  const assigned = setup.columns.flatMap((c) => c.unitIds);
  if (
    assigned.length !== 38 ||
    new Set(assigned).size !== 38 ||
    setup.columns.some((c) => !c.unitIds.length || !c.squareId) ||
    new Set(setup.columns.map((c) => c.squareId)).size !== setup.columns.length
  )
    throw new Error(
      'Assign all 38 Maurice units to nonempty, positioned columns without stacking before creating the simultaneous copy.',
    );
  const c = seedWaterloo(title, uuid, now);
  const factionIds = new Map(setup.factions.map((f) => [f.id, uuid()]));
  const unitIds = new Map(setup.units.map((f) => [f.id, uuid()]));
  const commanderIds = new Map(setup.commanders.map((f) => [f.id, uuid()]));
  const square = (id: string) => {
    const s = setup.squares.find((s) => s.id === id);
    if (!s) throw new Error('A Fontenoy map reference is missing.');
    return `${s.column},${s.row}`;
  };
  const units = setup.units.map((u) => {
    const copy = {
      ...u,
      id: unitIds.get(u.id)!,
      factionId: factionIds.get(u.factionId)!,
      currentStatus: 'ready' as const,
      quality: u.initialQuality ?? u.quality,
    };
    delete copy.initialQuality;
    return copy;
  });
  const commanders = setup.commanders.map((u) => ({
    ...u,
    id: commanderIds.get(u.id)!,
    factionId: factionIds.get(u.factionId)!,
    ...(u.campaignStatus ? { campaignStatus: 'active' as const } : {}),
  }));
  c.moduleId = 'fontenoy-operational';
  c.rulesetVersion = 'maurice_operational_v0.1';
  c.date = setup.settings.schedule.startDate;
  c.startDate = c.date;
  c.charts.version = 'maurice_operational_charts_v0.1';
  c.hexes = setup.squares.map((s) => ({
    id: `${s.column},${s.row}`,
    q: s.column,
    r: s.row,
    terrain: 'clear',
    name: s.locationName ?? '',
  }));
  c.edges = [];
  for (const a of c.hexes)
    for (const b of c.hexes)
      if (
        a.id < b.id &&
        Math.max(
          Math.abs(a.q - b.q),
          Math.abs(a.r - b.r),
          Math.abs(a.q + a.r - b.q - b.r),
        ) === 1
      ) {
        const road = setup.settings.map.roadEdges.some(
          (e) =>
            (square(e.from) === a.id && square(e.to) === b.id) ||
            (square(e.to) === a.id && square(e.from) === b.id),
        );
        const river = setup.settings.map.riverEdges.some(
          (e) =>
            (square(e.from) === a.id && square(e.to) === b.id) ||
            (square(e.to) === a.id && square(e.from) === b.id),
        );
        c.edges.push({
          from: a.id,
          to: b.id,
          road,
          crossing: river ? (road ? 'bridge' : 'minor') : 'none',
        });
      }
  c.corps = setup.columns.map((column) => {
    const roster = column.unitIds.map((id) =>
      units.find((u) => u.id === unitIds.get(id))!,
    );
    const side = setup.factions.find((f) => f.id === column.factionId)!.side;
    const army =
      side === 'french'
        ? 'french'
        : roster.every((u) => u.contingent === 'dutch')
          ? 'dutch'
          : 'anglo_allied';
    const cavalry = roster.every(
      (u) => u.type === 'regular_cavalry' || u.type === 'irregular_cavalry',
    );
    return {
      id: uuid(),
      name: column.displayName,
      side,
      army,
      kind: cavalry ? 'cavalry' : 'infantry',
      formation: cavalry ? 'fresh' : 'advance',
      hexId: square(column.squareId!),
      status: 'ready',
      returnSlot: null,
      availableAt: 360,
      roster:
        `${roster.length} Maurice units. ${roster.map((u) => `${u.displayName} (${u.quality ?? u.type})`).join('; ')}`.slice(
          0,
          4000,
        ),
    };
  });
  c.hqs = [...new Set(c.corps.map((f) => f.army))].map((army) => {
    const force = c.corps.find((f) => f.army === army)!;
    return {
      id: uuid(),
      name:
        army === 'french'
          ? 'Maurice de Saxe'
          : army === 'dutch'
            ? 'Dutch command'
            : 'Duke of Cumberland',
      army,
      hexId: force.hexId!,
      mode: 'normal',
      normalRange: 8,
      battleRange: 3,
    };
  });
  c.fontenoy = {
    title: 'The Road to Fontenoy, 1745',
    tacticalGame: 'Maurice',
    factions: setup.factions.map((f) => ({ ...f, id: factionIds.get(f.id)! })),
    units,
    commanders,
    formations: setup.columns.map((column, i) => ({
      corpsId: c.corps[i]!.id,
      unitIds: column.unitIds.map((id) => unitIds.get(id)!),
      commanderIds: column.commanderIds.map((id) => commanderIds.get(id)!),
      openingHexId: square(column.squareId!),
    })),
    objectives: setup.settings.objectives.map((o) => ({
      side: o.side,
      hexId: square(o.squareId),
      title: o.title,
    })),
    siege: {
      hexId: square(setup.settings.siege.targetSquareId),
      status: setup.settings.siege.status,
      progress: setup.settings.siege.progress,
    },
    kilometresPerHex: setup.settings.map.kilometresPerSquare,
    sourceSchedule: structuredClone(setup.settings.schedule),
  };
  c.log = [
    'Maurice — Fontenoy, 1745. French 20 / Allied 18 (Dutch 7 / Anglo-Allied 11).',
    'Simultaneous operational rules adapt the C3i framework; tactical battles default to Maurice and remain manually adjudicated.',
    'Named locations and opening columns come from the saved Fontenoy setup. Hex topology and six-hour timing are provisional campaign adaptations.',
  ];
  return waterlooCampaignSchema.parse(c);
}

export function cloneFontenoyOperational(
  source: WaterlooCampaign,
  title: string,
  uuid: () => string,
  now: string,
): WaterlooCampaign {
  if (!source.fontenoy)
    throw new Error('Open a Fontenoy operational campaign.');
  const fresh = seedFontenoyOperational(title, uuid, now);
  // Restart this Fontenoy setup, including custom mapped columns, rather than
  // replacing a campaign with the former Crossroads reference scenario.
  const ids = new Map(
    source.corps
      .filter((f) => f.kind !== 'detachment')
      .map((f) => [f.id, uuid()]),
  );
  const unitIds = new Map(source.fontenoy.units.map((u) => [u.id, uuid()]));
  const openingCommanders =
    source.fontenoy.officers?.baseline ?? source.fontenoy.commanders;
  const commanderIds = new Map(openingCommanders.map((u) => [u.id, uuid()]));
  const factionIds = new Map(
    source.fontenoy.factions.map((u) => [u.id, uuid()]),
  );
  fresh.hexes = structuredClone(source.hexes);
  fresh.edges = structuredClone(source.edges);
  fresh.startDate = source.startDate;
  fresh.date = source.startDate;
  fresh.charts = structuredClone(source.charts);
  fresh.corps = source.corps
    .filter((f) => f.kind !== 'detachment')
    .map((f) => ({
      ...structuredClone(f),
      id: ids.get(f.id)!,
      hexId: source.fontenoy!.formations.find((link) => link.corpsId === f.id)!
        .openingHexId,
      status: 'ready',
      returnSlot: null,
      availableAt: 360,
      formation: f.kind === 'cavalry' ? 'fresh' : 'advance',
    }));
  fresh.hqs = source.hqs.map((h) => ({
    ...h,
    id: uuid(),
    mode: 'normal',
    hexId: fresh.corps.find((f) => f.army === h.army)!.hexId!,
  }));
  fresh.fontenoy = {
    ...structuredClone(source.fontenoy),
    factions: source.fontenoy.factions.map((f) => ({
      ...f,
      id: factionIds.get(f.id)!,
    })),
    units: source.fontenoy.units.map((u) => {
      const copy = {
        ...u,
        id: unitIds.get(u.id)!,
        factionId: factionIds.get(u.factionId)!,
        currentStatus: 'ready',
        quality: u.initialQuality ?? u.quality,
      } as typeof u;
      delete copy.initialQuality;
      return copy;
    }),
    commanders: openingCommanders.map((u) => ({
      ...u,
      id: commanderIds.get(u.id)!,
      factionId: factionIds.get(u.factionId)!,
    })),
    formations: source.fontenoy.formations.map((f) => ({
      ...f,
      corpsId: ids.get(f.corpsId)!,
      unitIds: f.unitIds.map((id) => unitIds.get(id)!),
      commanderIds: (source.fontenoy!.officers
        ? source
            .fontenoy!.officers.assignments.filter(
              (a) => a.corpsId === f.corpsId,
            )
            .map((a) => a.commanderId)
        : f.commanderIds
      ).map((id) => commanderIds.get(id)!),
    })),
  };
  delete fresh.fontenoy.epic;
  delete fresh.fontenoy.officers;
  delete fresh.fontenoy.aftermath;
  delete fresh.fontenoy.siege.campaign;
  if (source.fontenoy.siege.campaign) {
    fresh.fontenoy.siege.progress = 0;
    fresh.fontenoy.siege.status = 'not_started';
  }
  return waterlooCampaignSchema.parse(fresh);
}
