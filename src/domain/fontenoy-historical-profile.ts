import { seedFontenoyOperational } from './fontenoy-operational';
import {
  historicalRoster,
  historicalType,
  historicalContingent,
  historicalComplement,
} from './historical-profile';
import type { HistoricalOrganization } from './historical-oob-schema';
import type { WaterlooCampaign } from './waterloo-schema';
import { waterlooCampaignSchema } from './waterloo-schema';
import {
  assignHistoricalGroups,
  historicalFormationGroups,
  historicalGroupingVersion,
} from './historical-grouping';
import { historicalRosterText } from './historical-profile';
import { expandRegionalTopology } from './regional-map';

const grouping = (o: HistoricalOrganization) =>
  `${o.service}-${['cavalry', 'dragoons', 'hussars'].includes(o.arm) ? 'horse' : o.arm === 'artillery' ? 'artillery' : 'foot'}`;
const groups = [
  ['french-foot', 'French infantry', '3,2'],
  ['french-horse', 'French horse', '2,3'],
  ['french-artillery', 'French artillery', '3,3'],
  ['british-foot', 'British foot', '9,3'],
  ['british-horse', 'British horse', '9,4'],
  ['british-artillery', 'British artillery', '10,3'],
  ['hanoverian-foot', 'Hanoverian foot', '8,3'],
  ['hanoverian-horse', 'Hanoverian horse', '8,4'],
  ['hanoverian-artillery', 'Hanoverian artillery', '9,2'],
  ['austrian-foot', 'Austrian foot', '10,4'],
  ['austrian-horse', 'Austrian horse', '10,5'],
  ['dutch-foot', 'Dutch foot', '8,1'],
  ['dutch-horse', 'Dutch horse', '9,1'],
  ['dutch-artillery', 'Dutch artillery', '7,2'],
] as const;

/** Battle-date roster and provisional operational deployment; no siege troops invented. */
export function seedHistoricalFontenoy(
  title: string,
  uuid: () => string,
  now: string,
  groupingVersion:
    'service_arm_v0.1' | 'reported_subunits_v0.2' = historicalGroupingVersion,
): WaterlooCampaign {
  const c = seedFontenoyOperational(title, uuid, now),
    m = c.fontenoy!;
  c.startDate = c.date = m.sourceSchedule.startDate = '1745-05-11';
  m.units = historicalRoster.map(
    (o): NonNullable<WaterlooCampaign['fontenoy']>['units'][number] => {
      const type = historicalType(o);
      return {
        id: uuid(),
        displayName: o.displayName,
        factionId: m.factions.find((f) => f.side === o.side)!.id,
        type,
        quality: type.startsWith('regular_') ? 'trained' : null,
        currentStatus: 'ready',
        contingent: historicalContingent(o),
        provenance: 'house_rule_v0.1',
        sourceRef:
          'Wikipedia Fontenoy OOB revision 1380852910; catalogue 0.1.0. Regimental record adaptation; quality/deployment require scenario review.',
        historical: {
          catalogueId: 'fontenoy-tournai-1745',
          catalogueVersion: '0.1.0',
          organizationId: o.id,
        },
      };
    },
  );
  c.corps = groups.map(
    ([key, name, hexId]): WaterlooCampaign['corps'][number] => {
      const roster = m.units.filter(
        (u) =>
          grouping(
            historicalRoster.find(
              (o) => o.id === u.historical!.organizationId,
            )!,
          ) === key,
      );
      const side = key.startsWith('french-') ? 'french' : 'allied';
      const army =
        side === 'french'
          ? 'french'
          : key.startsWith('dutch-')
            ? 'dutch'
            : 'anglo_allied';
      const cavalry = key.endsWith('-horse');
      return {
        id: uuid(),
        name,
        hexId,
        side,
        army,
        kind: cavalry ? 'cavalry' : 'infantry',
        formation: cavalry ? 'fresh' : 'advance',
        status: 'ready',
        returnSlot: null,
        availableAt: 360,
        roster:
          `${roster.length} historical roster records. ${roster.map((u) => `${u.displayName}: ${historicalComplement(u.historical!.organizationId)}`).join('; ')}`.slice(
            0,
            4000,
          ),
      };
    },
  );
  m.formations = groups.map(([key, , openingHexId], index) => ({
    corpsId: c.corps[index]!.id,
    openingHexId,
    unitIds: m.units
      .filter(
        (u) =>
          grouping(
            historicalRoster.find(
              (o) => o.id === u.historical!.organizationId,
            )!,
          ) === key,
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
  c.hqs.forEach((hq) => {
    hq.hexId = c.corps.find((f) => f.army === hq.army)!.hexId!;
  });
  m.historicalProfile = {
    groupingVersion,
    id: 'fontenoy_regimental_records_v0.1',
    catalogueVersion: '0.1.0',
    reviewedAt: null,
    reviewNotes: '',
    openingRatings: m.units
      .filter((u) => u.type.startsWith('regular_'))
      .map((u) => ({ unitId: u.id, quality: 'trained' })),
  };
  if (groupingVersion === historicalGroupingVersion) {
    expandRegionalTopology(c);
    assignHistoricalGroups(
      c,
      historicalFormationGroups.map(() => uuid()),
    );
    for (const f of m.formations)
      c.corps.find((p) => p.id === f.corpsId)!.roster = historicalRosterText(
        c,
        f.unitIds,
      );
  }
  c.log = [
    ...(m.regionalMap
      ? [
          'Regional schematic map: 36 by 24 hexes, with the original operating area at its centre. Added hexes are provisional clear ground; decorative terrain does not define movement.',
        ]
      : []),
    `Historical Fontenoy battle-date roster: 143 named regimental/aggregate records in ${c.corps.length} provisional campaign groupings. Opening date 11 May 1745.`,
    'Names, source hierarchy and reported complements are linked to catalogue 0.1.0. Individual subordinate identifiers are not invented when the source gives only battalion/squadron counts.',
    'One roster record represents its historical organization, not a fixed number of Maurice units. All regular ratings start as trained placeholders, pending explicit review. Map deployment is provisional.',
    'Siege forces, the Tournai garrison and pre-battle arrivals remain separate research gaps; this is not a certified complete campaign return.',
    groupingVersion === historicalGroupingVersion
      ? 'Common provisional grouping basis: target 12 reported battalions or 24 reported squadrons. Source-listed brigades remain intact; uncertain complements are separate. Artillery is grouped per coalition without equating battalions and gun returns.'
      : 'Legacy service/arm grouping: counter sizes differ substantially between the two coalitions.',
  ];
  return waterlooCampaignSchema.parse(c);
}
