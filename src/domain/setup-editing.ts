import type { FontenoyCampaign } from './campaign';
import type { FontenoySettings } from './fontenoy-schema';

export type SetupCommand =
  | {
      kind: 'assign';
      entity: 'unit' | 'commander';
      id: string;
      columnId: string | null;
    }
  | { kind: 'column-name'; id: string; value: string }
  | { kind: 'column-location'; id: string; value: string | null }
  | { kind: 'column-hidden'; id: string; value: boolean }
  | { kind: 'add-column'; factionId: string }
  | { kind: 'remove-column'; id: string }
  | { kind: 'commander-name'; id: string; value: string }
  | { kind: 'add-commander'; factionId: string }
  | { kind: 'remove-commander'; id: string }
  | { kind: 'schedule'; value: Partial<FontenoySettings['schedule']> }
  | { kind: 'siege'; value: Partial<FontenoySettings['siege']> }
  | { kind: 'scale'; value: number | null }
  | { kind: 'add-road'; from: string; to: string }
  | { kind: 'remove-road'; from: string; to: string }
  | { kind: 'add-river'; from: string; to: string }
  | { kind: 'remove-river'; from: string; to: string }
  | {
      kind: 'acknowledge';
      field: 'reviewedHouseRules' | 'reviewedSchematicMap';
      value: boolean;
    };

export function editSetup(
  campaign: FontenoyCampaign,
  command: SetupCommand,
  uuid: () => string,
): FontenoyCampaign {
  const draft = structuredClone(campaign);
  switch (command.kind) {
    case 'assign': {
      const records =
        command.entity === 'unit' ? draft.units : draft.commanders;
      const entity = records.find((entity) => entity.id === command.id);
      const target =
        command.columnId === null
          ? null
          : draft.columns.find((column) => column.id === command.columnId);
      if (
        !entity ||
        (command.columnId && !target) ||
        (target && entity.factionId !== target.factionId)
      )
        throw new Error('Choose a column belonging to the same faction.');
      const key = command.entity === 'unit' ? 'unitIds' : 'commanderIds';
      for (const column of draft.columns)
        column[key] = column[key].filter((id) => id !== entity.id);
      if (target) target[key].push(entity.id);
      break;
    }
    case 'column-name': {
      const column = draft.columns.find((c) => c.id === command.id);
      if (column) column.displayName = command.value;
      break;
    }
    case 'column-location': {
      const column = draft.columns.find((c) => c.id === command.id);
      if (column) column.squareId = command.value;
      break;
    }
    case 'column-hidden': {
      const column = draft.columns.find((c) => c.id === command.id);
      if (column) column.concealment = command.value ? 'hidden' : 'visible';
      break;
    }
    case 'add-column':
      if (!draft.factions.some((f) => f.id === command.factionId))
        throw new Error('Unknown faction.');
      draft.columns.push({
        id: uuid(),
        factionId: command.factionId,
        displayName: `New column ${draft.columns.length + 1}`,
        squareId: null,
        unitIds: [],
        commanderIds: [],
        concealment: 'visible',
        provenance: 'house_rule_v0.1',
      });
      break;
    case 'remove-column':
      draft.columns = draft.columns.filter((c) => c.id !== command.id);
      break;
    case 'commander-name': {
      const commander = draft.commanders.find((c) => c.id === command.id);
      if (commander) {
        commander.displayName = command.value;
        commander.provenance = 'house_rule_v0.1';
        commander.sourceRef =
          'Player-defined setup name; no official tactical effect.';
      }
      break;
    }
    case 'add-commander':
      if (!draft.factions.some((f) => f.id === command.factionId))
        throw new Error('Unknown faction.');
      draft.commanders.push({
        id: uuid(),
        factionId: command.factionId,
        displayName: 'New commander',
        provenance: 'house_rule_v0.1',
        sourceRef:
          'Player-defined setup commander; no official tactical effect.',
      });
      break;
    case 'remove-commander':
      draft.commanders = draft.commanders.filter((c) => c.id !== command.id);
      for (const c of draft.columns)
        c.commanderIds = c.commanderIds.filter((id) => id !== command.id);
      break;
    case 'schedule':
      draft.settings.schedule = {
        ...draft.settings.schedule,
        ...command.value,
      };
      break;
    case 'siege':
      draft.settings.siege = { ...draft.settings.siege, ...command.value };
      break;
    case 'scale':
      draft.settings.map.kilometresPerSquare = command.value;
      break;
    case 'add-road':
      draft.settings.map.roadEdges.push({
        from: command.from,
        to: command.to,
        provenance: 'house_rule_v0.1',
      });
      break;
    case 'remove-road':
      draft.settings.map.roadEdges = draft.settings.map.roadEdges.filter(
        (edge) =>
          !(
            (edge.from === command.from && edge.to === command.to) ||
            (edge.from === command.to && edge.to === command.from)
          ),
      );
      break;
    case 'acknowledge':
      draft.settings[command.field] = command.value;
      break;
    case 'add-river':
      draft.settings.map.riverEdges.push({
        from: command.from,
        to: command.to,
        provenance: 'house_rule_v0.1',
      });
      break;
    case 'remove-river':
      draft.settings.map.riverEdges = draft.settings.map.riverEdges.filter(
        (edge) =>
          !(
            (edge.from === command.from && edge.to === command.to) ||
            (edge.from === command.to && edge.to === command.from)
          ),
      );
      break;
  }
  return draft;
}
export function squareLabel(square: FontenoyCampaign['squares'][number]) {
  return `${String.fromCharCode(65 + square.column)}${square.row + 1}${square.locationName ? ` · ${square.locationName}` : ''}`;
}
