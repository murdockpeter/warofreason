import data from '../data/fontenoy.v0.1.json' with { type: 'json' };
import { fontenoyModuleSchema } from './fontenoy-schema';
import type { Campaign, FontenoyCampaign } from './campaign';

export const fontenoyModule = fontenoyModuleSchema.parse(data);
export const contingentLabel = {
  french: 'French',
  dutch: 'Dutch',
  anglo_allied: 'Anglo-Allied',
} as const;
export function seedFontenoy(
  campaign: Campaign,
  uuid: () => string,
): FontenoyCampaign {
  const module = fontenoyModule;
  const factions = (['french', 'allied'] as const).map((side) => ({
    id: uuid(),
    side,
    displayName: side === 'french' ? 'French' : 'Allied',
  }));
  const factionId = (side: 'french' | 'allied') =>
    factions.find((f) => f.side === side)!.id;
  const squares = Array.from(
    { length: module.map.columns * module.map.rows },
    (_, index) => {
      const row = Math.floor(index / module.map.columns);
      const column = index % module.map.columns;
      return {
        id: uuid(),
        row,
        column,
        locationName:
          module.locations.find((l) => l.row === row && l.column === column)
            ?.name ?? null,
      };
    },
  );
  const squareId = (name: string) =>
    squares.find((s) => s.locationName === name)!.id;
  const units = module.unitGroups.flatMap((group) =>
    Array.from({ length: group.count }, (_, index) => ({
      id: uuid(),
      factionId: factionId(group.side),
      displayName: `${contingentLabel[group.contingent]} ${group.quality ? `${group.quality} ` : ''}${group.type.replaceAll('_', ' ')} ${index + 1}`,
      type: group.type,
      quality: group.quality,
      currentStatus: 'ready' as const,
      provenance: 'official_maurice' as const,
      contingent: group.contingent,
      sourceRef: module.unitSource,
    })),
  );
  const commanders = module.openingColumns.flatMap((column) =>
    column.commander
      ? [
          {
            id: uuid(),
            displayName: column.commander,
            factionId: factionId(column.side),
            provenance: 'historical_scenario' as const,
            sourceRef: module.historySource,
          },
        ]
      : [],
  );
  const columns = module.openingColumns.map((column) => ({
    id: uuid(),
    displayName: column.name,
    factionId: factionId(column.side),
    squareId: squareId(column.location),
    unitIds: units
      .filter((u) => u.contingent === column.contingent)
      .slice(column.unitOffset, column.unitOffset + column.unitCount)
      .map((u) => u.id),
    commanderIds: commanders
      .filter((c) => c.displayName === column.commander)
      .map((c) => c.id),
    concealment: column.concealment,
    provenance: 'house_rule_v0.1' as const,
  }));
  return {
    ...campaign,
    schemaVersion: 2,
    moduleVersion: module.version,
    rulesetVersion: module.rulesetVersion,
    status: 'draft',
    turn: 0,
    date: null,
    activeSide: null,
    factions,
    units,
    columns,
    commanders,
    squares,
    settings: {
      provenance: 'house_rule_v0.1',
      map: structuredClone({ ...module.map, geography: 'schematic' as const }),
      schedule: { ...module.schedule },
      siege: {
        status: module.siege.status,
        progress: module.siege.progress,
        targetSquareId: squareId(module.siege.targetLocation),
      },
      objectives: module.objectiveDefinitions.map((objective) => ({
        id: uuid(),
        side: objective.side,
        squareId: squareId(objective.location),
        title: objective.title,
        provenance: 'house_rule_v0.1',
      })),
      reviewedHouseRules: false,
      reviewedSchematicMap: false,
    },
  };
}

export function forceIssues(campaign: FontenoyCampaign): string[] {
  const issues: string[] = [];
  for (const group of fontenoyModule.unitGroups) {
    const actual = campaign.units.filter(
      (u) =>
        u.contingent === group.contingent &&
        u.type === group.type &&
        u.quality === group.quality,
    ).length;
    if (actual !== group.count)
      issues.push(
        `${contingentLabel[group.contingent]} ${group.quality ?? ''} ${group.type}: expected ${group.count}, found ${actual}.`,
      );
  }
  if (campaign.units.length !== 38)
    issues.push(
      'The module requires exactly 38 scenario-scale units (French 20, Allied 18).',
    );
  return issues;
}
export function setupIssues(campaign: FontenoyCampaign): string[] {
  const issues = forceIssues(campaign);
  for (const faction of campaign.factions)
    if (
      !campaign.columns.some(
        (c) => c.factionId === faction.id && c.unitIds.length,
      )
    )
      issues.push(`${faction.displayName} needs at least one nonempty column.`);
  const assigned = new Set(campaign.columns.flatMap((c) => c.unitIds));
  const missing = campaign.units.filter((u) => !assigned.has(u.id)).length;
  if (missing) issues.push(`${missing} unit(s) need a column assignment.`);
  for (const column of campaign.columns) {
    if (!column.unitIds.length)
      issues.push(`${column.displayName} is empty; assign units or remove it.`);
    if (!column.squareId)
      issues.push(`${column.displayName} needs an opening square.`);
  }
  if (!campaign.settings.reviewedHouseRules)
    issues.push(
      'Acknowledge that the operational setup and schedule are provisional house rules.',
    );
  if (!campaign.settings.reviewedSchematicMap)
    issues.push(
      'Acknowledge that the map is schematic and routes are unverified.',
    );
  return issues;
}
export function scheduleEndDate(
  schedule: FontenoyCampaign['settings']['schedule'],
) {
  const date = new Date(`${schedule.startDate}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    schedule.daysPerTurn < 1 ||
    schedule.turnCount < 1
  )
    return 'Not configured';
  date.setUTCDate(
    date.getUTCDate() + schedule.daysPerTurn * schedule.turnCount - 1,
  );
  return date.toISOString().slice(0, 10);
}
