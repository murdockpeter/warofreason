import { fontenoyHistoricalCatalogue as catalogue } from './fontenoy-historical';
import type { WaterlooCampaign } from './waterloo-schema';
import type { HistoricalOrganization } from './historical-oob-schema';

export const historicalGroupingVersion = 'reported_subunits_v0.2' as const;
export const historicalGroupingTargets = { foot: 12, horse: 24 } as const;
type Arm = 'foot' | 'horse' | 'artillery';
const leaf = catalogue.organizations.filter(
  (o) => !['army', 'formation'].includes(o.kind),
);
const orgs = new Map(catalogue.organizations.map((o) => [o.id, o]));
const armOf = (o: HistoricalOrganization): Arm =>
  ['cavalry', 'dragoons', 'hussars'].includes(o.arm)
    ? 'horse'
    : o.arm === 'artillery'
      ? 'artillery'
      : 'foot';
function reported(id: string, measure: 'battalions' | 'squadrons') {
  const claims = catalogue.claims.filter(
    (c) =>
      c.organizationId === id &&
      c.value.kind === 'strength' &&
      c.value.measure === measure,
  );
  return claims.length === 1 && claims[0]!.value.kind === 'strength'
    ? claims[0]!.value.count
    : null;
}
function positions(side: 'french' | 'allied') {
  const anchor = side === 'french' ? '3,2' : '9,3';
  const all: { id: string; color: number }[] = [];
  for (let r = 0; r < 8; r++)
    for (
      let q = side === 'french' ? 0 : 7;
      q <= (side === 'french' ? 4 : 11);
      q++
    ) {
      const id = `${q},${r}`;
      if (id !== anchor) all.push({ id, color: (((q - r) % 3) + 3) % 3 });
    }
  // Spread markers before filling adjacent positions; geography remains schematic.
  return [anchor, ...all.sort((a, b) => a.color - b.color).map((p) => p.id)];
}
export type HistoricalFormationGroup = {
  name: string;
  side: 'french' | 'allied';
  arm: Arm;
  hexId: string;
  organizationIds: string[];
  uncertain: boolean;
};

/** Common campaign packaging, not a reconstruction of historical brigade commands. */
function plan(): HistoricalFormationGroup[] {
  const result: HistoricalFormationGroup[] = [];
  for (const side of ['french', 'allied'] as const) {
    let slot = 0;
    const squares = positions(side),
      label = side === 'french' ? 'French' : 'Allied';
    for (const arm of ['foot', 'horse', 'artillery'] as const) {
      const pool = leaf.filter((o) => o.side === side && armOf(o) === arm);
      const packets: { ids: string[]; uncertain: boolean }[] = [];
      if (arm === 'artillery')
        packets.push({ ids: pool.map((o) => o.id), uncertain: true });
      else {
        const measure = arm === 'foot' ? 'battalions' : 'squadrons';
        const atoms = new Map<string, HistoricalOrganization[]>();
        for (const o of pool) {
          const parent = o.parentId ? orgs.get(o.parentId) : null;
          const key =
            parent && /brigade/i.test(parent.displayName) ? parent.id : o.id;
          atoms.set(key, [...(atoms.get(key) ?? []), o]);
        }
        for (const uncertain of [false, true]) {
          let ids: string[] = [],
            total = 0;
          const flush = () => {
            if (ids.length) packets.push({ ids, uncertain });
            ids = [];
            total = 0;
          };
          for (const members of atoms.values()) {
            const counts = members.map((o) => reported(o.id, measure));
            if (counts.some((n) => n === null) !== uncertain) continue;
            const weight = counts.reduce<number>((sum, n) => sum + (n ?? 0), 0);
            if (
              ids.length &&
              (uncertain
                ? ids.length + members.length > 3
                : total + weight > historicalGroupingTargets[arm])
            )
              flush();
            ids.push(...members.map((o) => o.id));
            total += weight;
          }
          flush();
        }
      }
      let known = 0,
        unknown = 0;
      for (const packet of packets) {
        const kind = arm === 'foot' ? 'infantry' : arm;
        const suffix =
          arm === 'artillery'
            ? ''
            : packet.uncertain
              ? ` U${++unknown}`
              : ` ${++known}`;
        result.push({
          name: `${label} ${kind}${suffix}`,
          side,
          arm,
          hexId: squares[slot++]!,
          organizationIds: packet.ids,
          uncertain: packet.uncertain,
        });
      }
    }
  }
  return result;
}
export const historicalFormationGroups = plan();

export function assignHistoricalGroups(
  c: WaterlooCampaign,
  corpsIds: string[],
) {
  const m = c.fontenoy!;
  c.corps = historicalFormationGroups.map((group, i) => {
    const units = m.units.filter((u) =>
      group.organizationIds.includes(u.historical!.organizationId),
    );
    return {
      id: corpsIds[i]!,
      name: group.name,
      side: group.side,
      army:
        group.side === 'french'
          ? 'french'
          : units.every((u) => u.contingent === 'dutch')
            ? 'dutch'
            : 'anglo_allied',
      kind: group.arm === 'horse' ? 'cavalry' : 'infantry',
      formation: group.arm === 'horse' ? 'fresh' : 'advance',
      hexId: group.hexId,
      status: 'ready',
      returnSlot: null,
      availableAt: c.cursor,
      roster: '',
    };
  });
  m.formations = historicalFormationGroups.map((group, i) => ({
    corpsId: corpsIds[i]!,
    openingHexId: group.hexId,
    unitIds: m.units
      .filter((u) =>
        group.organizationIds.includes(u.historical!.organizationId),
      )
      .map((u) => u.id),
    commanderIds: [],
  }));
  for (const commander of m.commanders) {
    const side = m.factions.find((f) => f.id === commander.factionId)!.side;
    m.formations
      .find((f) => c.corps.find((p) => p.id === f.corpsId)!.side === side)!
      .commanderIds.push(commander.id);
  }
  c.hqs.forEach((h) => {
    h.hexId = (c.corps.find((f) => f.army === h.army) ??
      c.corps.find(
        (f) => f.side === (h.army === 'french' ? 'french' : 'allied'),
      ))!.hexId!;
  });
  m.historicalProfile!.groupingVersion = historicalGroupingVersion;
}

export function historicalFormationSize(c: WaterlooCampaign, corpsId: string) {
  const link = c.fontenoy?.formations.find((f) => f.corpsId === corpsId);
  const units =
    c.fontenoy?.units.filter(
      (u) => link?.unitIds.includes(u.id) && u.currentStatus === 'ready',
    ) ?? [];
  const allArtillery =
    units.length > 0 && units.every((u) => u.type === 'artillery');
  const horse = c.corps.find((f) => f.id === corpsId)?.kind === 'cavalry';
  const measure = horse ? 'squadrons' : 'battalions',
    suffix = horse ? 's' : 'b';
  const counts = units.map((u) =>
    u.historical ? reported(u.historical.organizationId, measure) : null,
  );
  const known = counts.reduce<number>((sum, n) => sum + (n ?? 0), 0),
    missing = counts.some((n) => n === null);
  return {
    allArtillery,
    records: units.length,
    label: allArtillery
      ? `${units.length} rec`
      : `${known || (missing ? '?' : 0)}${suffix}${known && missing ? '+?' : ''}`,
    description: allArtillery
      ? `${units.length} ready artillery records; battalion and gun returns are not interchangeable.`
      : `Ready records report ${known} ${measure}${missing ? ', with additional unspecified complements' : ''}. Source complements are not a current headcount or combat-power score.`,
  };
}
