// @vitest-environment node
import { expect, it } from 'vitest';
import {
  fontenoyHistoricalCatalogue as c,
  fontenoyApproachSourceId,
  historicalPath,
  searchHistoricalRoster,
} from '../../src/domain/fontenoy-historical';

it('loads the pinned battle baseline with all five service contingents and source locators', () => {
  expect(c.organizations).toHaveLength(181);
  expect(new Set(c.organizations.map((o) => o.service))).toEqual(
    new Set(['french', 'british', 'hanoverian', 'dutch', 'austrian']),
  );
  expect(c.sources.some((s) => s.id === fontenoyApproachSourceId)).toBe(true);
  expect(
    c.claims.every(
      (claim) =>
        claim.when.scope === 'fontenoy_battle' && claim.locator.length > 10,
    ),
  ).toBe(true);
  expect(c.sources.every((s) => s.distribution === 'cc_by_sa_4')).toBe(true);
});

it('searches names, source aliases and hierarchy with accents ignored', () => {
  expect(searchHistoricalRoster('umpire', '25th Foot')[0]?.displayName).toBe(
    "Rothe's/Sempill's",
  );
  const rows = searchHistoricalRoster('umpire', 'irish dillon');
  expect(rows).toHaveLength(1);
  expect(historicalPath(rows[0]!)).toContain('Irish Brigade');
  expect(searchHistoricalRoster('umpire', 'francaises')[0]?.displayName).toBe(
    'Gardes Françaises',
  );
});

it('filters the public reference by view and service without inventing deployment or game ratings', () => {
  expect(
    searchHistoricalRoster('french', '').every((o) => o.side === 'french'),
  ).toBe(true);
  expect(
    searchHistoricalRoster('allied', '', 'dutch').every(
      (o) => o.service === 'dutch',
    ),
  ).toBe(true);
  expect(searchHistoricalRoster('french', '', 'british')).toEqual([]);
  for (const o of c.organizations) {
    expect(o).not.toHaveProperty('quality');
    expect(o).not.toHaveProperty('hexId');
    expect(o).not.toHaveProperty('availableAt');
  }
});

it('retains unknown and conflicting complements without duplicating artillery or unnamed troops', () => {
  const eu = c.organizations.find((o) => o.displayName === "d'Eu")!;
  expect(
    c.claims.filter(
      (claim) =>
        claim.organizationId === eu.id && claim.value.kind === 'strength',
    ),
  ).toEqual([]);
  const artillery = c.organizations.find(
    (o) => o.displayName === 'British artillery',
  )!;
  expect(
    c.claims
      .filter(
        (claim) =>
          claim.organizationId === artillery.id &&
          claim.value.kind === 'strength',
      )
      .map((claim) => claim.value),
  ).toEqual([
    { kind: 'strength', count: 47, measure: 'guns' },
    { kind: 'strength', count: 21, measure: 'guns' },
  ]);
  expect(
    c.organizations.filter((o) => o.displayName === 'Royal Artillerie'),
  ).toHaveLength(0);
  expect(
    c.organizations.filter((o) => o.displayName === 'Unnamed Grenadier units'),
  ).toHaveLength(1);
});
