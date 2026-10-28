/** Historical identity/organization facts only. No game ratings or invented locations. */
export const almaRosterId = 'alma_1854_09_20_v1' as const;
export type AlmaEntry = {
  id: string;
  name: string;
  allegiance: 'britain' | 'france' | 'russia' | 'ottoman';
  kind: 'infantry' | 'cavalry' | 'artillery' | 'other';
  path: string[];
  commandChain: string;
  strength: string;
  notes: string;
  flags: ('uncertain' | 'detached' | 'aggregate')[];
  source: string;
};
const entries: AlmaEntry[] = [];
function group(
  allegiance: AlmaEntry['allegiance'],
  path: string[],
  commandChain: string,
  source: string,
  rows: [
    string,
    string,
    AlmaEntry['kind']?,
    string?,
    string?,
    AlmaEntry['flags']?,
  ][],
) {
  for (const [
    id,
    name,
    kind = 'infantry',
    strength = 'Headcount not established by this roster.',
    notes = '',
    flags = [],
  ] of rows)
    entries.push({
      id: `${allegiance}-${id}`,
      name,
      allegiance,
      kind,
      path,
      commandChain,
      strength,
      notes,
      flags,
      source,
    });
}
const naf = 'Nafziger 854IAB, Battle of Alma, 20 September 1854';
const british = `${naf}; Russell, The British Expedition to the Crimea; British regimental cross-checks`;
const disputedFourth =
  'Fourth Division brigade composition/presence is disputed. Kept as a dated field-army roster, not a claim that every detachment fought.';
const gunClaim =
  'Source reports 8 guns; battery return and army gun totals need reconciliation.';
const frenchHorse =
  'Listed in the source compilation, but Saint-Arnaud’s contemporary dispatch regrets the absence of his African cavalry. Presence at the battle is not asserted.';
group(
  'britain',
  ['Light Division', 'Codrington’s Brigade'],
  'Raglan / George Brown / William Codrington',
  british,
  [
    ['7-foot', '7th (Royal Fusiliers) Regiment of Foot'],
    ['23-foot', '23rd (Royal Welsh Fusiliers) Regiment of Foot'],
    ['33-foot', '33rd Regiment of Foot'],
  ],
);
group(
  'britain',
  ['Light Division', 'Buller’s Brigade'],
  'Raglan / George Brown / Buller',
  british,
  [
    ['19-foot', '19th Regiment of Foot'],
    ['77-foot', '77th Regiment of Foot'],
    ['88-foot', '88th Regiment of Foot'],
    [
      'rifles-2',
      '2nd Battalion, Rifle Brigade',
      'infantry',
      '1 named battalion; headcount unverified.',
    ],
  ],
);
group(
  'britain',
  ['Light Division', 'Artillery'],
  'Raglan / George Brown',
  naf,
  [
    [
      'rha-c',
      'C Troop, Royal Horse Artillery',
      'artillery',
      'Source reports 4 guns; return needs reconciliation.',
      '',
      ['uncertain'],
    ],
  ],
);
group(
  'britain',
  ['1st Division', 'Guards Brigade'],
  'Raglan / Duke of Cambridge / Henry Bentinck',
  naf,
  [
    ['grenadiers-3', '3rd Battalion, Grenadier Guards'],
    ['coldstream-1', '1st Battalion, Coldstream Guards'],
    ['scots-fusilier-guards-1', '1st Battalion, Scots Fusilier Guards'],
  ],
);
group(
  'britain',
  ['1st Division', 'Highland Brigade'],
  'Raglan / Duke of Cambridge / Colin Campbell',
  british,
  [
    ['42-foot', '42nd (Royal Highland) Regiment of Foot'],
    ['79-foot', '79th (Cameron Highlanders) Regiment of Foot'],
    [
      '93-foot',
      '93rd (Sutherland Highlanders) Regiment of Foot',
      'infantry',
      undefined,
      'Uses the 1854 identity; the later Argyll and Sutherland title is not projected backwards.',
    ],
  ],
);
group(
  'britain',
  ['1st Division', 'Artillery'],
  'Raglan / Duke of Cambridge',
  naf,
  [
    [
      'ra-a',
      'A Battery, Royal Artillery',
      'artillery',
      gunClaim,
      '',
      ['uncertain'],
    ],
    [
      'ra-h',
      'H Battery, Royal Artillery',
      'artillery',
      gunClaim,
      '',
      ['uncertain'],
    ],
  ],
);
group(
  'britain',
  ['2nd Division', 'Adams’s Brigade'],
  'Raglan / George de Lacy Evans / Adams',
  british,
  [
    ['41-foot', '41st Regiment of Foot'],
    ['47-foot', '47th Regiment of Foot'],
    ['49-foot', '49th Regiment of Foot'],
  ],
);
group(
  'britain',
  ['2nd Division', 'Pennefather’s Brigade'],
  'Raglan / George de Lacy Evans / John Pennefather',
  british,
  [
    ['30-foot', '30th Regiment of Foot'],
    ['55-foot', '55th Regiment of Foot'],
    ['95-foot', '95th Regiment of Foot'],
  ],
);
group(
  'britain',
  ['2nd Division', 'Artillery'],
  'Raglan / George de Lacy Evans',
  naf,
  [
    [
      'ra-b',
      'B Battery, Royal Artillery',
      'artillery',
      gunClaim,
      '',
      ['uncertain'],
    ],
    [
      'ra-g',
      'G Battery, Royal Artillery',
      'artillery',
      gunClaim,
      '',
      ['uncertain'],
    ],
  ],
);
group(
  'britain',
  ['3rd Division', 'Campbell’s Brigade'],
  'Raglan / Richard England / John Campbell',
  british,
  [
    ['royal-scots-1', '1st Battalion, 1st (Royal) Regiment of Foot'],
    ['38-foot', '38th Regiment of Foot'],
    ['50-foot', '50th Regiment of Foot'],
  ],
);
group(
  'britain',
  ['3rd Division', 'Eyre’s Brigade'],
  'Raglan / Richard England / William Eyre',
  british,
  [
    ['4-foot', '4th Regiment of Foot'],
    ['28-foot', '28th Regiment of Foot'],
    ['44-foot', '44th Regiment of Foot'],
  ],
);
group(
  'britain',
  ['3rd Division', 'Artillery'],
  'Raglan / Richard England',
  naf,
  [
    [
      'ra-f',
      'F Battery, Royal Artillery',
      'artillery',
      gunClaim,
      'England’s division is corrected to 3rd Division; the compilation labels it 1st.',
      ['uncertain'],
    ],
    [
      'ra-w',
      'W Battery, Royal Artillery',
      'artillery',
      gunClaim,
      '',
      ['uncertain'],
    ],
  ],
);
group(
  'britain',
  ['4th Division', 'Horn’s Brigade'],
  'Raglan / George Cathcart / Horn',
  british,
  [
    ['20-foot', '20th Regiment of Foot', 'infantry', undefined, disputedFourth],
    ['21-foot', '21st Regiment of Foot', 'infantry', undefined, disputedFourth],
    [
      '68-foot',
      '68th (Light Infantry) Regiment of Foot',
      'infantry',
      undefined,
      `${disputedFourth} Added from the British cross-check; omitted in 854IAB.`,
    ],
    [
      'rifles-1',
      '1st Battalion, Rifle Brigade',
      'infantry',
      undefined,
      disputedFourth,
    ],
  ],
);
group(
  'britain',
  ['4th Division', 'Torrens’s detached brigade'],
  'Raglan / George Cathcart / Arthur Torrens',
  british,
  [
    [
      '46-foot-det',
      '46th Regiment of Foot — detachment',
      'infantry',
      '2 companies in the British cross-check; headcount unresolved.',
      `${disputedFourth} Reported left at Old Fort and arriving after the battle.`,
      ['detached', 'uncertain'],
    ],
    [
      '63-foot',
      '63rd Regiment of Foot',
      'infantry',
      undefined,
      'Reported with Torrens at Old Fort, arriving after the battle.',
      ['detached', 'uncertain'],
    ],
  ],
);
group(
  'britain',
  ['4th Division', 'Artillery'],
  'Raglan / George Cathcart',
  naf,
  [
    [
      'ra-e',
      'E Battery, Royal Artillery',
      'artillery',
      gunClaim,
      disputedFourth,
      ['uncertain'],
    ],
    [
      'ra-p',
      'P Battery, Royal Artillery',
      'artillery',
      gunClaim,
      disputedFourth,
      ['uncertain'],
    ],
  ],
);
group(
  'britain',
  ['Cavalry Division', 'Light Brigade'],
  'Raglan / Lord Lucan / Lord Cardigan',
  british,
  [
    [
      '4-light-dragoons',
      '4th Light Dragoons',
      'cavalry',
      '2 squadrons reported; headcount unresolved.',
      'A troop is reported detached with Torrens. It is not duplicated as another regiment counter.',
    ],
    [
      '13-light-dragoons',
      '13th Light Dragoons',
      'cavalry',
      '2 squadrons reported; headcount unresolved.',
    ],
    ['8-hussars', '8th Hussars', 'cavalry'],
    ['11-hussars', '11th Hussars', 'cavalry'],
    [
      '17-lancers',
      '17th Lancers',
      'cavalry',
      undefined,
      'Corrects the compilation’s “17th Hussar” designation using the British cross-check and period regimental list.',
    ],
  ],
);
group(
  'france',
  ['1st Division', 'Espinasse’s Brigade'],
  'Saint-Arnaud / Canrobert / Espinasse',
  naf,
  [
    [
      '1-chasseurs',
      '1er bataillon de chasseurs à pied',
      'infantry',
      '1 named battalion; headcount unverified.',
      'Russell also names the 1st and 9th Chasseurs. Some later rosters give a different first battalion number.',
    ],
    ['1-zouaves', '1er régiment de zouaves'],
    ['7-line', '7e régiment de ligne'],
  ],
);
group(
  'france',
  ['1st Division', 'Vinoy’s Brigade'],
  'Saint-Arnaud / Canrobert / Vinoy',
  naf,
  [
    ['9-chasseurs', '9e bataillon de chasseurs à pied'],
    ['20-line', '20e régiment de ligne'],
    ['27-line', '27e régiment de ligne'],
  ],
);
group(
  'france',
  ['1st Division', 'Attachments'],
  'Saint-Arnaud / Canrobert',
  naf,
  [
    [
      'elite-legion',
      'Bataillon d’élite — Légion étrangère',
      'infantry',
      '2 grenadier and 2 voltigeur companies reported.',
      'Retains the source’s aggregate identity; no individual company IDs invented.',
      ['aggregate'],
    ],
    ['art-3-8', '3e batterie / 8e régiment d’artillerie montée', 'artillery'],
    ['art-1-9', '1re batterie / 9e régiment d’artillerie montée', 'artillery'],
    [
      'engineers-7-1-2',
      'Génie — 7e compagnie, 1er bataillon, 2e régiment',
      'other',
      undefined,
      'Normalized from the source’s 7/1st Battalion, 2nd Regiment notation.',
    ],
  ],
);
group(
  'france',
  ['2nd Division', 'd’Autemarre’s Brigade'],
  'Saint-Arnaud / Bosquet / d’Autemarre',
  naf,
  [
    [
      '1-tirailleurs',
      '1er tirailleurs algériens',
      'infantry',
      undefined,
      'Source designation retained; exact establishment and subordinate numbering unresolved.',
      ['uncertain'],
    ],
    ['50-line', '50e régiment de ligne'],
    ['3-zouaves', '3e régiment de zouaves'],
  ],
);
group(
  'france',
  ['2nd Division', 'Bouat’s Brigade'],
  'Saint-Arnaud / Bosquet / Bouat',
  naf,
  [
    ['3-chasseurs', '3e bataillon de chasseurs à pied'],
    ['6-line', '6e régiment de ligne'],
    ['7-light', '7e régiment léger'],
  ],
);
group(
  'france',
  ['2nd Division', 'Attachments'],
  'Saint-Arnaud / Bosquet',
  naf,
  [
    ['art-2-12', '2e batterie / 12e régiment d’artillerie montée', 'artillery'],
    ['art-4-13', '4e batterie / 13e régiment d’artillerie montée', 'artillery'],
    [
      'engineers-7-2-1',
      'Génie — 7e compagnie, 2e bataillon, 1er régiment',
      'other',
    ],
  ],
);
group(
  'france',
  ['3rd Division', 'de Monet’s Brigade'],
  'Saint-Arnaud / Prince Napoléon / de Monet',
  naf,
  [
    [
      '19-chasseurs',
      '19e bataillon de chasseurs à pied',
      'infantry',
      undefined,
      'The source questions presence at Alma.',
      ['uncertain'],
    ],
    ['3-marines', '3e régiment d’infanterie de marine'],
    ['2-zouaves', '2e régiment de zouaves'],
  ],
);
group(
  'france',
  ['3rd Division', 'Thomas’s Brigade'],
  'Saint-Arnaud / Prince Napoléon / Thomas',
  naf,
  [
    ['20-light', '20e régiment léger'],
    [
      '22-light',
      '22e régiment léger',
      'infantry',
      undefined,
      'The source questions presence at Alma.',
      ['uncertain'],
    ],
  ],
);
group(
  'france',
  ['3rd Division', 'Attachments'],
  'Saint-Arnaud / Prince Napoléon',
  naf,
  [
    ['art-6-7', '6e batterie / 7e régiment d’artillerie montée', 'artillery'],
    ['art-6-13', '6e batterie / 13e régiment d’artillerie montée', 'artillery'],
    [
      'engineers-4-2-3',
      'Génie — 4e compagnie, 2e bataillon, 3e régiment',
      'other',
    ],
  ],
);
group(
  'france',
  ['4th Division', 'de Lourmel’s Brigade'],
  'Saint-Arnaud / Forey / de Lourmel',
  naf,
  [
    ['19-line', '19e régiment de ligne'],
    ['26-line', '26e régiment de ligne'],
    ['5-chasseurs', '5e bataillon de chasseurs à pied'],
  ],
);
group(
  'france',
  ['4th Division', 'd’Aurelle’s Brigade'],
  'Saint-Arnaud / Forey / d’Aurelle de Paladines',
  naf,
  [
    ['39-line', '39e régiment de ligne'],
    ['74-line', '74e régiment de ligne'],
  ],
);
group('france', ['4th Division', 'Attachments'], 'Saint-Arnaud / Forey', naf, [
  ['art-4-8', '4e batterie / 8e régiment d’artillerie montée', 'artillery'],
  ['art-15-8', '15e batterie / 8e régiment d’artillerie montée', 'artillery'],
  [
    'engineers-4-1-3',
    'Génie — 4e compagnie, 1er bataillon, 3e régiment',
    'other',
  ],
]);
group(
  'france',
  ['Cavalry', 'd’Allonville’s Brigade'],
  'Saint-Arnaud / d’Allonville',
  naf,
  [
    [
      '1-chasseurs-afrique',
      '1er régiment de chasseurs d’Afrique',
      'cavalry',
      undefined,
      frenchHorse,
      ['detached', 'uncertain'],
    ],
    [
      '4-chasseurs-afrique',
      '4e régiment de chasseurs d’Afrique',
      'cavalry',
      undefined,
      frenchHorse,
      ['detached', 'uncertain'],
    ],
    [
      'spahis-det',
      'Spahis — detachment',
      'cavalry',
      'Detachment; exact identity and strength unresolved.',
      frenchHorse,
      ['detached', 'aggregate'],
    ],
  ],
);
group(
  'france',
  ['Cavalry', 'Cassaignolles’s Brigade'],
  'Saint-Arnaud / Cassaignolles',
  naf,
  [
    [
      '6-dragoons',
      '6e régiment de dragons',
      'cavalry',
      undefined,
      'Listed in the compilation; no assertion of battlefield presence.',
      ['detached', 'uncertain'],
    ],
    [
      '6-cuirassiers',
      '6e régiment de cuirassiers',
      'cavalry',
      undefined,
      'Listed in the compilation; no assertion of battlefield presence.',
      ['detached', 'uncertain'],
    ],
  ],
);
group(
  'russia',
  ['6th Corps', '16th Division'],
  'Menshikov / Gorchakov / Kvetzinski',
  naf,
  [
    [
      'vladimir',
      'Vladimir Infantry Regiment',
      'infantry',
      '4 battalions reported.',
    ],
    [
      'suzdal',
      'Suzdal Infantry Regiment',
      'infantry',
      '4 battalions reported.',
    ],
    [
      'uglitz',
      'Uglitz Light Infantry Regiment',
      'infantry',
      '4 battalions reported.',
    ],
    [
      'grand-duke-michael',
      'Grand Duke Michael Jäger Infantry Regiment',
      'infantry',
      '4 battalions reported.',
    ],
  ],
);
group(
  'russia',
  ['6th Corps', '16th Division artillery'],
  'Menshikov / Gorchakov',
  naf,
  [
    [
      '16-position-1',
      '16th Artillery Brigade — Position Battery 1',
      'artillery',
      '12 guns reported.',
    ],
    [
      '16-light-1',
      '16th Artillery Brigade — Light Battery 1',
      'artillery',
      '12 guns reported.',
    ],
    [
      '16-light-2',
      '16th Artillery Brigade — Light Battery 2',
      'artillery',
      '12 guns reported.',
    ],
    [
      'horse-light-12',
      '6th Horse Artillery Brigade — 12th Light Horse Battery',
      'artillery',
      '8 guns reported.',
    ],
  ],
);
group(
  'russia',
  ['6th Corps', '17th Division'],
  'Menshikov / Gorchakov / Kiriakov',
  naf,
  [
    [
      'moscow',
      'Moscow Infantry Regiment',
      'infantry',
      '4 battalions reported.',
    ],
    [
      'taroutino',
      'Taroutino Infantry Regiment',
      'infantry',
      '4 battalions reported.',
    ],
    ['sappers-6', '6th Sapper Battalion', 'other', '1 battalion reported.'],
  ],
);
group(
  'russia',
  ['6th Corps', '17th Division artillery'],
  'Menshikov / Gorchakov / Kiriakov',
  naf,
  [
    [
      '17-position-3',
      '17th Artillery Brigade — Position Battery 3',
      'artillery',
      'Individual count unresolved; source gives 28 guns for this brigade grouping.',
      '',
      ['uncertain'],
    ],
    [
      '17-light-4',
      '17th Artillery Brigade — Light Battery 4',
      'artillery',
      '10 guns reported on the right; allocation unresolved.',
      'Repeated on both flanks in the compilation; represented once, not twice.',
      ['uncertain'],
    ],
    [
      '17-light-5',
      '17th Artillery Brigade — Light Battery 5',
      'artillery',
      '10 guns reported on the right; allocation unresolved.',
      'Repeated on both flanks in the compilation; represented once, not twice.',
      ['uncertain'],
    ],
  ],
);
group('russia', ['Reserve', '13th Division'], 'Menshikov / Aslanovitch', naf, [
  [
    'brest-reserve',
    'Brest Infantry Regiment — reserve battalions',
    'infantry',
    '5th and 6th reserve battalions listed.',
    'Also appears in the combined Brest–Białystok line under the left flank. Retained once per named regiment; assignment unresolved.',
    ['uncertain'],
  ],
  [
    'bjelostok-reserve',
    'Białystok Infantry Regiment — reserve battalions',
    'infantry',
    '5th and 6th reserve battalions listed.',
    'Also appears in the combined Brest–Białystok line under the left flank. Retained once per named regiment; assignment unresolved.',
    ['uncertain'],
  ],
]);
group('russia', ['Reserve', '14th Division'], 'Menshikov', naf, [
  [
    'volhynia',
    'Volhynia Infantry Regiment',
    'infantry',
    '4 battalions reported.',
  ],
  [
    'minsk',
    'Minsk Infantry Regiment',
    'infantry',
    '4 battalions reported; one listed at Ulukol Akles.',
    'The detached battalion is part of this regiment, not a second whole-regiment counter. Presence/allocation require review.',
    ['uncertain'],
  ],
  [
    'borodino',
    'Borodino Infantry Regiment',
    'infantry',
    '4 battalions reported.',
  ],
  [
    'rifles-6',
    '6th Jäger (Rifle) Battalion',
    'infantry',
    '1 battalion reported.',
  ],
]);
group('russia', ['Reserve', '14th Division artillery'], 'Menshikov', naf, [
  [
    '14-position-3',
    '14th Artillery Brigade — Position Battery 3',
    'artillery',
    'Individual count unresolved; source gives 16 guns for two batteries.',
    '',
    ['uncertain'],
  ],
  [
    '14-light-3',
    '14th Artillery Brigade — Light Battery 3',
    'artillery',
    'Individual count unresolved; source gives 16 guns for two batteries.',
    '',
    ['uncertain'],
  ],
]);
group(
  'russia',
  ['Cavalry', '6th Hussar Brigade'],
  'Menshikov / 6th Cavalry Division',
  naf,
  [
    [
      'kiev-hussars',
      '11th Kiev Hussar Regiment',
      'cavalry',
      '8 squadrons reported.',
    ],
    [
      'ingermannland-hussars',
      '12th Ingermannland Hussar Regiment',
      'cavalry',
      '8 squadrons reported.',
    ],
  ],
);
group('russia', ['Cavalry', 'Don Cossacks'], 'Menshikov', naf, [
  [
    'cossacks-57',
    '57th Don Cossack Regiment',
    'cavalry',
    '8 squadrons reported.',
  ],
  [
    'cossacks-60',
    '60th Don Cossack Regiment',
    'cavalry',
    '6 squadrons reported.',
  ],
  [
    'don-heavy-3',
    'Don Cossack Heavy Battery 3',
    'artillery',
    '8 guns reported.',
    'The source also lists “3rd Don Cossack Batteries” with 8 guns under the reserve. Treated as an unresolved repeated designation, not an extra battery.',
    ['uncertain'],
  ],
  [
    'don-light-reserve-4',
    'Don Cossack Light Reserve Battery 4',
    'artillery',
    '8 guns reported.',
  ],
]);
group('russia', ['Attachments', 'Unresolved support'], 'Menshikov', naf, [
  [
    'marines-aggregate',
    'Marine infantry — unnamed battalions',
    'infantry',
    '2 battalions reported.',
    'Source does not identify the subordinate battalions; possible overlap with the composite naval battalion unresolved.',
    ['aggregate', 'uncertain'],
  ],
  [
    'marine-artillery',
    'Marine artillery — unnamed detachment',
    'artillery',
    '4 guns reported.',
    '',
    ['aggregate'],
  ],
  [
    'heavy-guns',
    'Heavy guns — unnamed aggregate',
    'artillery',
    '14 guns reported.',
    'Unit identities and possible overlap with other returns unresolved.',
    ['aggregate', 'uncertain'],
  ],
  [
    'ulukol-battery',
    'Ulukol Akles battery — unnamed',
    'artillery',
    '4 guns reported.',
    '',
    ['aggregate', 'uncertain'],
  ],
  [
    'naval-composite-6',
    '6th Composite Naval Battalion',
    'infantry',
    undefined,
    'Source gives no confirmed assignment/position; possible overlap with the unnamed marine battalions unresolved.',
    ['uncertain'],
  ],
  [
    'boutirsk',
    'Boutirsk Infantry Regiment — Anapa detachment',
    'infantry',
    undefined,
    'Listed at Anapa to oppose landings, outside the Alma battlefield and the bundled peninsula map. Do not imply an Alma deployment.',
    ['detached'],
  ],
]);
group(
  'ottoman',
  ['Suleiman Pasha’s contingent', 'Subordinate identities unresolved'],
  'Suleiman Pasha / associated with Bosquet’s flank',
  'Contemporary report, The Spectator, 14 October 1854; Russell; National Army Museum context',
  [
    [
      'suleiman-contingent',
      'Ottoman contingent — Suleiman Pasha',
      'infantry',
      'Contingent aggregate; headcount and named battalion identities unresolved.',
      'Contemporary and later accounts give differing totals. No invented Ottoman regiment names or battalion ordinals are supplied.',
      ['aggregate', 'uncertain'],
    ],
  ],
);

export const almaRoster = {
  id: almaRosterId,
  version: '0.1.0' as const,
  title: 'Alma field-army roster',
  date: '1854-09-20',
  entries,
};
export const almaById = new Map(entries.map((e) => [e.id, e]));
export const almaSources = [
  {
    title:
      'Nafziger 854IAB — Battle of Alma (regimental, artillery and support listings)',
    url: 'https://www.generalstaff.org/NAF/Pt_I_1816-1900/854iab.pdf',
  },
  {
    title:
      'William Howard Russell — The British Expedition to the Crimea (public-domain eyewitness history)',
    url: 'https://www.gutenberg.org/files/46242/46242-h/46242-h.htm',
  },
  {
    title:
      'British brigade cross-check, including disputed Fourth Division and detached troops',
    url: 'https://www.roll-of-honour.org/Regiments/CrimeanOrderofBattle.html',
  },
  {
    title:
      'War Medals and Their History — period regimental names and Alma list (public domain)',
    url: 'https://www.gutenberg.org/files/49986/old/49986-h/49986-h.htm',
  },
  {
    title: 'Contemporary official dispatches, including absent French cavalry',
    url: 'https://archive.spectator.co.uk/article/14th-october-1854/5/english-official-documents',
  },
  {
    title:
      'Contemporary account identifying Suleiman Pasha’s Ottoman contingent',
    url: 'https://archive.spectator.co.uk/article/14th-october-1854/4/furtign-nut-tannin',
  },
];
