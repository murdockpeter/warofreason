import data from './fontenoy-historical-catalogue.json' with { type: 'json' };
import { historicalCatalogueSchema } from './historical-oob-schema';
import type { HistoricalOrganization } from './historical-oob-schema';

/** Research reference only. This catalogue never mutates a playable campaign. */
export const fontenoyHistoricalCatalogue =
  historicalCatalogueSchema.parse(data);
const organizations = new Map(
  fontenoyHistoricalCatalogue.organizations.map((o) => [o.id, o]),
);

/** Historical context, never scheduled orders or scenario starting coordinates. */
export const fontenoyApproach = [
  {
    date: '1745-04-21',
    locator: '1745 campaign plans',
    summary:
      'D’Estrées’s cavalry diversion toward Mons initially drew Allied attention away from Tournai.',
  },
  {
    date: '1745-04-28',
    locator: '1745 campaign plans',
    summary:
      'The siege of Tournai began; substantial Allied garrisons remained at Namur and Charleroi.',
  },
  {
    date: '1745-05-07',
    locator: '1745 campaign plans',
    summary:
      'Saxe separated the siege force from the field army near Fontenoy and Antoing. The article estimates 22,000 besiegers; their regimental allocation is unresolved here.',
  },
  {
    date: '1745-05-09',
    locator: 'Battle, opening paragraphs',
    summary: 'Allied troops reached the French outposts.',
  },
  {
    date: '1745-05-10',
    locator: 'Battle, opening paragraphs',
    summary:
      'British and Hanoverian cavalry displaced French troops from Vezon and Bourgeon; reconnaissance toward Bois de Barry encountered resistance.',
  },
] as const;
export const fontenoyApproachSourceId = 'wikipedia-battle-1382120601';

export function historicalPath(o: HistoricalOrganization): string {
  const names: string[] = [];
  let parent = o.parentId ? organizations.get(o.parentId) : undefined;
  while (parent) {
    names.unshift(parent.displayName);
    parent = parent.parentId ? organizations.get(parent.parentId) : undefined;
  }
  return names.join(' / ');
}

export function searchHistoricalRoster(
  side: 'french' | 'allied' | 'umpire',
  query: string,
  service = '',
) {
  const normalize = (text: string) =>
    text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return fontenoyHistoricalCatalogue.organizations.filter((o) => {
    if (side !== 'umpire' && o.side !== side) return false;
    if (service && o.service !== service) return false;
    if (o.kind === 'army' || o.kind === 'formation') return false;
    const haystack = normalize(
      [
        o.displayName,
        o.id,
        o.service,
        o.arm,
        o.origin ?? '',
        historicalPath(o),
        ...o.aliases.map((a) => a.name),
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
