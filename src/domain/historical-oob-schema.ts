import { z } from 'zod';

// Catalogue keys identify research records; campaign instances retain their own UUIDs.
const key = z.string().regex(/^[a-z0-9][a-z0-9-]{1,119}$/);
const text = z.string().trim().min(1).max(4000);
const date = z.iso.date();
export const historicalDateSchema = z
  .object({
    original: text,
    calendar: z.enum(['gregorian', 'julian', 'unspecified']),
    normalizedFrom: date.nullable(),
    normalizedThrough: date.nullable(),
    scope: z.enum([
      'campaign_opening',
      'fontenoy_battle',
      'tournai_siege',
      'campaign_year',
      'unresolved',
    ]),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      d.normalizedFrom &&
      d.normalizedThrough &&
      d.normalizedFrom > d.normalizedThrough
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Historical date intervals must run forwards.',
      });
    if (
      d.scope === 'campaign_year' &&
      (d.normalizedFrom || d.normalizedThrough)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'A campaign-year list does not establish particular arrival or departure dates.',
      });
  });
export const historicalSourceSchema = z
  .object({
    id: key,
    title: text,
    kind: z.enum([
      'contemporary_document',
      'historical_study',
      'encyclopedia',
      'game_scenario',
    ]),
    distribution: z.enum([
      'public_domain',
      'catalogue_metadata',
      'private_reference',
      'cc_by_sa_4',
    ]),
    url: z
      .string()
      .url()
      .refine((url) => /^https?:\/\//.test(url), 'Use an HTTP(S) source URL.')
      .nullable(),
    edition: text,
    notes: text,
  })
  .strict();
const claimValue = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('designation'), name: text }).strict(),
  z
    .object({
      kind: z.literal('strength'),
      count: z.number().nonnegative().max(1000000),
      measure: z.enum([
        'men',
        'battalions',
        'squadrons',
        'troops',
        'companies',
        'guns',
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal('participation'),
      role: z.enum([
        'field_army',
        'siege_force',
        'garrison',
        'reserve',
        'arrival',
        'departure',
        'unresolved',
      ]),
    })
    .strict(),
]);
export const historicalClaimSchema = z
  .object({
    id: key,
    organizationId: key,
    sourceId: key,
    locator: text,
    when: historicalDateSchema,
    value: claimValue,
    review: z.enum(['unreviewed', 'reviewed', 'disputed']),
    notes: text,
  })
  .strict();
export const historicalOrganizationSchema = z
  .object({
    id: key,
    displayName: z.string().trim().min(1).max(160),
    side: z.enum(['french', 'allied']),
    service: z.enum([
      'french',
      'british',
      'hanoverian',
      'dutch',
      'austrian',
      'mixed',
      'unresolved',
    ]),
    origin: z.string().trim().min(1).max(120).nullable(),
    kind: z.enum([
      'army',
      'formation',
      'regiment',
      'battalion',
      'squadron',
      'troop',
      'company',
      'artillery_detachment',
      'garrison',
      'aggregate',
    ]),
    arm: z.enum([
      'infantry',
      'cavalry',
      'dragoons',
      'hussars',
      'artillery',
      'engineers',
      'mixed',
      'unresolved',
    ]),
    parentId: key.nullable(),
    designationClaimId: key,
    aliases: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            validFrom: date.nullable(),
            validThrough: date.nullable(),
            sourceId: key,
            locator: text,
            notes: text,
          })
          .strict(),
      )
      .max(100),
    notes: text,
  })
  .strict();
export const historicalCatalogueSchema = z
  .object({
    id: z.literal('fontenoy-tournai-1745'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    coverage: z.literal('research_in_progress'),
    sources: z.array(historicalSourceSchema).min(1).max(100),
    organizations: z.array(historicalOrganizationSchema).min(1).max(2000),
    claims: z.array(historicalClaimSchema).min(1).max(10000),
    gaps: z.array(text).min(1).max(200),
  })
  .strict()
  .superRefine((c, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const all = [...c.sources, ...c.organizations, ...c.claims].map(
      (r) => r.id,
    );
    if (new Set(all).size !== all.length)
      fail('Research record identities must be globally unique.');
    const sources = new Map(c.sources.map((s) => [s.id, s]));
    const organizations = new Map(c.organizations.map((o) => [o.id, o]));
    const claims = new Map(c.claims.map((p) => [p.id, p]));
    for (const claim of c.claims) {
      if (
        !sources.has(claim.sourceId) ||
        !organizations.has(claim.organizationId)
      )
        fail('Every claim needs an existing source and organization.');
      if (
        claim.value.kind === 'strength' &&
        !['battalions', 'squadrons', 'troops', 'companies'].includes(
          claim.value.measure,
        ) &&
        !Number.isInteger(claim.value.count)
      )
        fail('Men and guns must be whole-number source claims.');
    }
    for (const o of c.organizations) {
      const designation = claims.get(o.designationClaimId);
      if (
        !designation ||
        designation.organizationId !== o.id ||
        designation.value.kind !== 'designation'
      )
        fail('Each display identity needs its own designation evidence.');
      const parent = o.parentId ? organizations.get(o.parentId) : null;
      if (
        o.parentId &&
        (!parent ||
          parent.side !== o.side ||
          (parent.service !== 'mixed' && parent.service !== o.service))
      )
        fail('Historical hierarchy must preserve coalition/service ownership.');
      const seen = new Set([o.id]);
      let ancestor = parent;
      while (ancestor) {
        if (seen.has(ancestor.id)) {
          fail('Historical hierarchy cannot contain a cycle.');
          break;
        }
        seen.add(ancestor.id);
        ancestor = ancestor.parentId
          ? organizations.get(ancestor.parentId)
          : null;
      }
      for (const alias of o.aliases) {
        if (!sources.has(alias.sourceId)) fail('Aliases require a source.');
        if (
          alias.validFrom &&
          alias.validThrough &&
          alias.validFrom > alias.validThrough
        )
          fail('Alias dates must run forwards.');
      }
    }
  });
export type HistoricalCatalogue = z.infer<typeof historicalCatalogueSchema>;
export type HistoricalOrganization = z.infer<
  typeof historicalOrganizationSchema
>;
export type HistoricalClaim = z.infer<typeof historicalClaimSchema>;
