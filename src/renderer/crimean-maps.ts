import crimea from '../../assets/maps/crimea/wyld-crimea-1855.jpg';
import sevastopol from '../../assets/maps/crimea/airey-sevastopol-1856.jpg';
import type { KsMapId } from '../domain/crimean-ks';
export const crimeanMaps: Record<
  KsMapId,
  {
    title: string;
    date: string;
    image: string;
    width: number;
    height: number;
    credit: string;
    source: string;
    rights: string;
    note: string;
  }
> = {
  crimea_wyld_1855: {
    title: 'Crimean peninsula',
    date: '1 May 1855',
    image: crimea,
    width: 8102,
    height: 5814,
    credit: 'James Wyld; Library of Congress, Geography and Map Division.',
    source: 'https://www.loc.gov/item/2015591080/',
    rights:
      'Public-domain historical map. LOC collection: free to use and reuse unless an item-specific advisory states otherwise. Digital copy via Wikimedia Commons.',
    note: 'Includes smaller inset maps with different scales. Use the main peninsula panel for campaign placements; inset positions are not automatically linked to the main map. This 1855 edition may show information later than your chosen campaign date.',
  },
  sevastopol_airey_1856: {
    title: 'Sevastopol / Balaklava',
    date: '1856 publication; recent siege depicted',
    image: sevastopol,
    width: 5888,
    height: 4284,
    credit:
      'Military sketch of the fortress of Sevastopol and adjacent country. British Library HMNTS 9077.e.15, from Richard Airey’s Opening address (1856).',
    source:
      'https://commons.wikimedia.org/wiki/File:Fortress_of_SEVASTOPOL_and_adjacent_country.jpg',
    rights:
      'Public domain; British Library Mechanical Curator collection, via Wikimedia Commons. The source notes that the scan was enhanced for machine interpretation.',
    note: 'Covers Sevastopol, Balaklava and surrounding country. Printed coloured troop positions depict the historical siege: they are part of the scan, not your live counters. Published in 1856, not a blank pre-war survey. Sheet coordinates are independent of the peninsula map; transfer forces explicitly.',
  },
};
export const ksAllegiances = {
  russia: 'Russian',
  britain: 'British',
  france: 'French',
  ottoman: 'Ottoman',
  sardinia: 'Sardinian',
  neutral: 'Neutral / other',
} as const;
export const ksColors = {
  russia: '#375a40',
  britain: '#a43f3c',
  france: '#315d93',
  ottoman: '#86652e',
  sardinia: '#735284',
  neutral: '#535c62',
} as const;
