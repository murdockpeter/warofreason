import type { WaterlooCampaign } from './waterloo-schema';

export const regionalMapVersion = 'fontenoy_region_3x_v0.1' as const;
export const regionalBounds = {
  minQ: -12,
  maxQ: 23,
  minR: -8,
  maxR: 15,
} as const;
export const regionalViewBox = { x: -940, y: -465, width: 2820, height: 1395 };
export const originalViewBox = { x: 0, y: 0, width: 940, height: 465 };
export const hexPoint = (h: { q: number; r: number }) => ({
  x: 45 + h.q * 52 + h.r * 26,
  y: 40 + h.r * 45,
});
export const axialNeighbors = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
] as const;

export function hasOriginalFontenoyMap(c: WaterlooCampaign) {
  return (
    !!c.fontenoy &&
    !c.fontenoy.regionalMap &&
    c.hexes.length === 96 &&
    c.hexes.every(
      (h) =>
        h.q >= 0 && h.q < 12 && h.r >= 0 && h.r < 8 && h.id === `${h.q},${h.r}`,
    )
  );
}
export function canExpandRegionalMap(c: WaterlooCampaign) {
  return (
    hasOriginalFontenoyMap(c) &&
    c.status === 'active' &&
    c.phase === 'planning' &&
    !c.fontenoy!.siege.campaign?.victory &&
    !c.submissions.some((s) => s.locked) &&
    (!c.preparation || c.preparation.resolved)
  );
}

/** Add topology around the original board; never reinterpret art as movement data. */
export function expandRegionalTopology(c: WaterlooCampaign) {
  if (!hasOriginalFontenoyMap(c))
    throw new Error('Expand an original 12 by 8 Fontenoy map only.');
  const present = new Set(c.hexes.map((h) => h.id));
  for (let r = regionalBounds.minR; r <= regionalBounds.maxR; r++)
    for (let q = regionalBounds.minQ; q <= regionalBounds.maxQ; q++) {
      const id = `${q},${r}`;
      if (!present.has(id)) {
        c.hexes.push({ id, q, r, terrain: 'clear', name: '' });
        present.add(id);
      }
    }
  const key = (a: string, b: string) => [a, b].sort().join(':');
  const edges = new Set(c.edges.map((e) => key(e.from, e.to)));
  for (const h of c.hexes)
    for (const [dq, dr] of axialNeighbors) {
      const to = `${h.q + dq},${h.r + dr}`,
        id = key(h.id, to);
      if (present.has(to) && !edges.has(id)) {
        c.edges.push({ from: h.id, to, road: false, crossing: 'none' });
        edges.add(id);
      }
    }
  c.fontenoy!.regionalMap = regionalMapVersion;
}

export function applyRegionalExpansion(c: WaterlooCampaign) {
  if (!canExpandRegionalMap(c))
    throw new Error(
      'Expand during unlocked planning, after any preparation is completed. The map must still be the original Fontenoy board.',
    );
  expandRegionalTopology(c);
  c.effectSerial++;
  c.log.push(
    'Expanded the schematic campaign map from 12 by 8 to 36 by 24 hexes. Original coordinates, positions, routes, terrain, roads and scale preserved. Added hexes are provisional clear ground, not terrain inferred from the decorative artwork.',
  );
}
