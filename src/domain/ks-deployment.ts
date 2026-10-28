import { almaRoster, almaById } from './alma-roster';
import type { KsCampaign, KsPosition, KsStagedForce } from './crimean-ks';

export function stageAlmaRoster(c: KsCampaign, forceIds: string[]) {
  if (c.deploymentArea?.loadedRosterIds.includes(almaRoster.id))
    throw new Error(
      'This Alma roster is already loaded. Use its remaining staged forces; existing forces were not replaced.',
    );
  const used = new Set([
    c.id,
    ...c.forces.map((f) => f.id),
    ...(c.deploymentArea?.forces.map((f) => f.id) ?? []),
  ]);
  if (
    forceIds.length !== almaRoster.entries.length ||
    new Set(forceIds).size !== forceIds.length ||
    forceIds.some((id) => used.has(id))
  )
    throw new Error('Provide one fresh force identity per roster entry.');
  if (
    c.forces.length + (c.deploymentArea?.forces.length ?? 0) + forceIds.length >
    1000
  )
    throw new Error('This campaign would exceed its 1,000 force capacity.');
  const forces: KsStagedForce[] = almaRoster.entries.map((entry, i) => ({
    id: forceIds[i]!,
    name: entry.name,
    allegiance: entry.allegiance,
    kind: entry.kind,
    strength: entry.strength,
    commander: '',
    condition: 'Not adjudicated',
    composition: `${entry.path.join(' / ')}. Formation command: ${entry.commandChain}. This is a named historical record, not a fixed combat-unit scale.`,
    notes: [
      entry.notes,
      entry.flags.length ? `Source flags: ${entry.flags.join(', ')}.` : '',
      `Source: ${entry.source}. Individual subordinate identifiers are not invented.`,
    ]
      .filter(Boolean)
      .join(' '),
    historical: { rosterId: almaRoster.id, organizationId: entry.id },
  }));
  c.deploymentArea = {
    loadedRosterIds: [
      ...(c.deploymentArea?.loadedRosterIds ?? []),
      almaRoster.id,
    ],
    forces: [...(c.deploymentArea?.forces ?? []), ...forces],
  };
}

export function deployStagedForces(
  c: KsCampaign,
  mapId: 'crimea_wyld_1855' | 'sevastopol_airey_1856',
  placements: { forceId: string; position: KsPosition }[],
) {
  const area = c.deploymentArea,
    selected = new Set(placements.map((p) => p.forceId));
  if (
    !area ||
    selected.size !== placements.length ||
    placements.some((p) => !area.forces.some((f) => f.id === p.forceId))
  )
    throw new Error(
      'Select distinct forces still in the deployment area. Already deployed forces cannot be pasted twice.',
    );
  for (const placement of placements) {
    const staged = area.forces.find((f) => f.id === placement.forceId)!;
    c.forces.push({
      ...staged,
      mapId,
      position: placement.position,
      status: 'active',
      intent: null,
    });
  }
  area.forces = area.forces.filter((f) => !selected.has(f.id));
}

export function historicalKsIssues(c: KsCampaign): string[] {
  const issues: string[] = [],
    area = c.deploymentArea;
  const all = [...c.forces, ...(area?.forces ?? [])];
  if (
    new Set(all.map((f) => f.id)).size !== all.length ||
    all.some((f) => f.id === c.id)
  )
    issues.push('Deployed and staged force identities must be distinct.');
  if (all.length > 1000)
    issues.push('Keep at most 1,000 deployed and staged forces in a campaign.');
  if (
    area &&
    new Set(area.loadedRosterIds).size !== area.loadedRosterIds.length
  )
    issues.push('A historical roster may be loaded only once.');
  const identities = new Set<string>();
  for (const force of all)
    if (force.historical) {
      const h = force.historical,
        key = `${h.rosterId}:${h.organizationId}`;
      if (
        !almaById.has(h.organizationId) ||
        !area?.loadedRosterIds.includes(h.rosterId) ||
        identities.has(key)
      )
        issues.push(
          'Historical identities must refer to one distinct loaded roster record.',
        );
      identities.add(key);
    }
  if (
    area?.loadedRosterIds.includes(almaRoster.id) &&
    almaRoster.entries.some((e) => !identities.has(`${almaRoster.id}:${e.id}`))
  )
    issues.push(
      'Every loaded historical record must remain staged or deployed, including retired forces.',
    );
  return issues;
}

/** A visual layout of counters on a scan, never a geographic deployment or distance. */
export function deploymentLayout(
  forceIds: string[],
  anchor: KsPosition,
  imageAspect: number,
  spacing = 0.045,
) {
  if (!forceIds.length) return [];
  if (forceIds.length === 1)
    return [{ forceId: forceIds[0]!, position: anchor }];
  const columns = Math.ceil(Math.sqrt(forceIds.length)),
    rows = Math.ceil(forceIds.length / columns);
  const gap = Math.min(
    spacing,
    0.94 / Math.max(1, columns - 1),
    0.94 / Math.max(1, rows - 1) / imageAspect,
  );
  const width = (columns - 1) * gap,
    height = (rows - 1) * gap * imageAspect;
  const x = Math.max(0.03, Math.min(1 - width - 0.03, anchor.x - width / 2)),
    y = Math.max(0.03, Math.min(1 - height - 0.03, anchor.y - height / 2));
  return forceIds.map((forceId, i) => ({
    forceId,
    position: {
      x: x + (i % columns) * gap,
      y: y + Math.floor(i / columns) * gap * imageAspect,
    },
  }));
}
