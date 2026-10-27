// @vitest-environment node
import { expect, it } from 'vitest';
import {
  historicalCatalogueSchema,
  historicalDateSchema,
} from '../../src/domain/historical-oob-schema';
import type { HistoricalCatalogue } from '../../src/domain/historical-oob-schema';

// Synthetic evidence tests the catalogue contract without claiming a researched roster.
function sample(): HistoricalCatalogue {
  return {
    id: 'fontenoy-tournai-1745',
    version: '0.1.0',
    coverage: 'research_in_progress',
    sources: [
      {
        id: 'source-a',
        title: 'Synthetic source',
        kind: 'historical_study',
        distribution: 'public_domain',
        url: 'https://example.org/source',
        edition: 'Test edition',
        notes: 'Test fixture, not historical evidence.',
      },
    ],
    organizations: [
      {
        id: 'regiment-a',
        displayName: 'Test regiment',
        side: 'allied',
        service: 'british',
        origin: null,
        kind: 'regiment',
        arm: 'infantry',
        parentId: null,
        designationClaimId: 'name-a',
        aliases: [],
        notes: 'Test identity.',
      },
    ],
    claims: [
      {
        id: 'name-a',
        organizationId: 'regiment-a',
        sourceId: 'source-a',
        locator: 'Test page 1',
        when: {
          original: '1745 campaign list',
          calendar: 'unspecified',
          normalizedFrom: null,
          normalizedThrough: null,
          scope: 'campaign_year',
        },
        value: { kind: 'designation', name: 'Test regiment' },
        review: 'unreviewed',
        notes: 'A source claim is not an independently verified game rating.',
      },
    ],
    gaps: ['Complete roster transcription is pending.'],
  };
}
it('keeps unknown dates, origins and incomplete coverage explicit without assigning game ratings', () => {
  const c = historicalCatalogueSchema.parse(sample());
  expect(c.organizations[0]!.origin).toBeNull();
  expect(c.claims[0]!.when.normalizedFrom).toBeNull();
  expect(c.organizations[0]).not.toHaveProperty('quality');
  expect(c.organizations[0]).not.toHaveProperty('gameUnitId');
  c.claims.push({
    ...c.claims[0]!,
    id: 'explicit-zero',
    value: { kind: 'strength', count: 0, measure: 'men' },
  });
  expect(historicalCatalogueSchema.parse(c).claims.at(-1)!.value).toEqual({
    kind: 'strength',
    count: 0,
    measure: 'men',
  });
});
it('retains contradictory strengths as separately sourced claims instead of synthesizing a total', () => {
  const c = sample(),
    base = c.claims[0]!;
  c.claims.push(
    {
      ...base,
      id: 'strength-a',
      value: { kind: 'strength', count: 27.5, measure: 'battalions' },
      review: 'disputed',
    },
    {
      ...base,
      id: 'strength-b',
      locator: 'Different test page',
      value: { kind: 'strength', count: 24, measure: 'battalions' },
      review: 'disputed',
    },
  );
  expect(historicalCatalogueSchema.parse(c).claims).toHaveLength(3);
});
it('rejects dangling source/organization/designation references and reused identities', () => {
  for (const change of [
    (c: HistoricalCatalogue) => {
      c.claims[0]!.sourceId = 'missing-source';
    },
    (c: HistoricalCatalogue) => {
      c.claims[0]!.organizationId = 'missing-unit';
    },
    (c: HistoricalCatalogue) => {
      c.organizations[0]!.designationClaimId = 'missing-claim';
    },
    (c: HistoricalCatalogue) => {
      c.sources[0]!.id = c.organizations[0]!.id;
    },
  ]) {
    const c = sample();
    change(c);
    expect(historicalCatalogueSchema.safeParse(c).success).toBe(false);
  }
});
it('rejects cyclic, foreign-side and foreign-service hierarchies', () => {
  const base = sample().organizations[0]!;
  for (const parent of [
    { ...base, id: 'regiment-b', side: 'french' as const },
    { ...base, id: 'regiment-b', service: 'dutch' as const },
    { ...base, id: 'regiment-b', parentId: 'regiment-a' },
  ]) {
    const c = sample();
    c.organizations[0]!.parentId = parent.id;
    c.organizations.push({ ...parent, designationClaimId: 'name-b' });
    c.claims.push({ ...c.claims[0]!, id: 'name-b', organizationId: parent.id });
    expect(historicalCatalogueSchema.safeParse(c).success).toBe(false);
  }
});
it('permits a mixed-service Allied parent without merging contingent identity', () => {
  const c = sample();
  c.organizations.push({
    ...c.organizations[0]!,
    id: 'allied-army',
    displayName: 'Test allied army',
    service: 'mixed',
    kind: 'army',
    arm: 'mixed',
    designationClaimId: 'army-name',
  });
  c.claims.push({
    ...c.claims[0]!,
    id: 'army-name',
    organizationId: 'allied-army',
  });
  c.organizations[0]!.parentId = 'allied-army';
  expect(historicalCatalogueSchema.parse(c).organizations[0]!.service).toBe(
    'british',
  );
});
it('preserves aliases with separate dates and permits historically ambiguous shared names', () => {
  const c = sample();
  c.organizations[0]!.aliases.push({
    name: 'Later successor name',
    validFrom: '1900-01-01',
    validThrough: null,
    sourceId: 'source-a',
    locator: 'Test page 2',
    notes: 'Later name, not the 1745 display identity.',
  });
  expect(historicalCatalogueSchema.parse(c).organizations[0]!.displayName).toBe(
    'Test regiment',
  );
  c.organizations[0]!.aliases[0]!.sourceId = 'missing-source';
  expect(historicalCatalogueSchema.safeParse(c).success).toBe(false);
});
it('does not convert an annual roster into an exact opening-day presence', () => {
  const when = sample().claims[0]!.when;
  expect(
    historicalDateSchema.safeParse({ ...when, normalizedFrom: '1745-05-01' })
      .success,
  ).toBe(false);
  expect(
    historicalDateSchema.safeParse({
      ...when,
      scope: 'unresolved',
      normalizedFrom: '1745-05-11',
      normalizedThrough: '1745-05-01',
    }).success,
  ).toBe(false);
});
it('allows private scenario references without bundling images and rejects unsafe URLs or fractional men/guns', () => {
  const c = sample();
  c.sources[0] = {
    ...c.sources[0]!,
    kind: 'game_scenario',
    distribution: 'private_reference',
    url: null,
  };
  expect(historicalCatalogueSchema.safeParse(c).success).toBe(true);
  c.sources[0]!.url = 'javascript:alert(1)';
  expect(historicalCatalogueSchema.safeParse(c).success).toBe(false);
  c.sources[0]!.url = null;
  c.claims.push({
    ...c.claims[0]!,
    id: 'invalid-strength',
    value: { kind: 'strength', count: 3.5, measure: 'men' },
  });
  expect(historicalCatalogueSchema.safeParse(c).success).toBe(false);
});
