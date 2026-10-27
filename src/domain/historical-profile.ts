import {
  fontenoyHistoricalCatalogue as catalogue,
  historicalPath,
} from './fontenoy-historical';
import type { HistoricalOrganization } from './historical-oob-schema';
import type { WaterlooCampaign, WaterlooReceipt } from './waterloo-schema';
import {
  assignHistoricalGroups,
  historicalFormationGroups,
  historicalGroupingVersion,
} from './historical-grouping';

export const historicalRoster = catalogue.organizations.filter(
  (o) => !['army', 'formation'].includes(o.kind),
);
const organizations = new Map(historicalRoster.map((o) => [o.id, o]));
export const historicalRosterSource = catalogue.sources.find(
  (s) => s.id === 'wikipedia-fontenoy-1380852910',
)!;
export const historicalOrganization = (id: string) => organizations.get(id);
export function historicalComplement(id: string) {
  return (
    catalogue.claims
      .filter((c) => c.organizationId === id && c.value.kind === 'strength')
      .map((c) =>
        c.value.kind === 'strength'
          ? `${c.value.count} ${c.value.measure}${c.review === 'disputed' ? ' (disputed)' : ''}`
          : '',
      )
      .join(' / ') || 'Complement unknown / allocation unresolved'
  );
}
export function historicalType(o: HistoricalOrganization) {
  if (o.arm === 'artillery') return 'artillery' as const;
  if (o.arm === 'hussars') return 'irregular_cavalry' as const;
  if (['cavalry', 'dragoons'].includes(o.arm))
    return 'regular_cavalry' as const;
  if (o.arm === 'mixed' || o.id.includes('freikorps'))
    return 'irregular_infantry' as const;
  return 'regular_infantry' as const;
}
export const historicalContingent = (o: HistoricalOrganization) =>
  o.service === 'french'
    ? ('french' as const)
    : o.service === 'dutch'
      ? ('dutch' as const)
      : ('anglo_allied' as const);
export function historicalRosterText(c: WaterlooCampaign, unitIds: string[]) {
  return c
    .fontenoy!.units.filter((u) => unitIds.includes(u.id))
    .map(
      (u) =>
        `${u.displayName} — ${historicalComplement(u.historical!.organizationId)}; ${u.currentStatus}`,
    )
    .join('; ')
    .slice(0, 4000);
}

export function historicalProfileIssues(c: WaterlooCampaign): string[] {
  const m = c.fontenoy,
    profile = m?.historicalProfile;
  if (!m) return [];
  if (!profile)
    return m.units.some((u) => u.historical)
      ? ['Historical identities require the historical roster profile.']
      : [];
  const fail = () => [
    'The historical roster must preserve every catalogue identity once, its service, classification and reviewed opening rating.',
  ];
  const ids = m.units.map((u) => u.historical?.organizationId);
  if (
    m.units.length !== historicalRoster.length ||
    new Set(ids).size !== historicalRoster.length ||
    profile.catalogueVersion !== catalogue.version ||
    m.units.some((u) => {
      const o = u.historical && organizations.get(u.historical.organizationId);
      return (
        !o ||
        u.provenance !== 'house_rule_v0.1' ||
        u.displayName !== o.displayName ||
        u.type !== historicalType(o) ||
        u.contingent !== historicalContingent(o) ||
        m.factions.find((f) => f.id === u.factionId)?.side !== o.side ||
        u.historical?.catalogueVersion !== profile.catalogueVersion
      );
    })
  )
    return fail();
  const regular = m.units.filter((u) =>
    ['regular_infantry', 'regular_cavalry'].includes(u.type),
  );
  if (
    profile.openingRatings.length !== regular.length ||
    new Set(profile.openingRatings.map((r) => r.unitId)).size !==
      regular.length ||
    regular.some(
      (u) =>
        profile.openingRatings.find((r) => r.unitId === u.id)?.quality !==
        (u.initialQuality ?? u.quality),
    ) ||
    !!profile.reviewedAt !== !!profile.reviewNotes.trim()
  )
    return fail();
  return [];
}

export function applyHistoricalReview(
  c: WaterlooCampaign,
  receipt: WaterlooReceipt,
) {
  if (receipt.command.kind !== 'historical-roster-review') return;
  const m = c.fontenoy,
    profile = m?.historicalProfile;
  if (
    !m ||
    !profile ||
    profile.reviewedAt ||
    c.turn !== 1 ||
    c.phase !== 'planning' ||
    c.submissions.some((s) => s.locked || s.orders.length) ||
    c.battles.length ||
    c.adjudications?.length
  )
    throw new Error(
      'Review a fresh historical roster before orders or campaign actions.',
    );
  const review = receipt.command.review;
  const regular = m.units.filter((u) =>
    ['regular_infantry', 'regular_cavalry'].includes(u.type),
  );
  if (
    review.ratings.length !== regular.length ||
    new Set(review.ratings.map((r) => r.unitId)).size !== regular.length ||
    regular.some((u) => !review.ratings.some((r) => r.unitId === u.id))
  )
    throw new Error('Review every regular regimental record exactly once.');
  for (const r of review.ratings)
    m.units.find((u) => u.id === r.unitId)!.quality = r.quality;
  profile.openingRatings = structuredClone(review.ratings);
  profile.reviewedAt = receipt.timestamp;
  profile.reviewNotes = review.notes;
  c.effectSerial++;
  for (const f of m.formations)
    c.corps.find((p) => p.id === f.corpsId)!.roster = historicalRosterText(
      c,
      f.unitIds,
    );
  c.log.push(
    'Reviewed historical regimental records: each record represents its named regiment/aggregate and reported complement, not a fixed Maurice unit scale. Ratings and opening deployment are an agreed scenario adaptation.',
  );
}

export function canRegroupHistorical(c: WaterlooCampaign) {
  const m = c.fontenoy;
  return (
    c.status === 'active' &&
    !!m?.historicalProfile &&
    !m.historicalProfile.reviewedAt &&
    m.historicalProfile.groupingVersion !== historicalGroupingVersion &&
    c.turn === 1 &&
    c.phase === 'planning' &&
    !c.submissions.some((s) => s.locked || s.orders.length) &&
    !c.battles.length &&
    !c.encounters.length &&
    !c.adjudications?.length &&
    !c.preparation &&
    !m.officers &&
    !m.intelligence &&
    !m.epic &&
    !m.aftermath &&
    !m.siege.campaign
  );
}
export function applyHistoricalRegroup(
  c: WaterlooCampaign,
  receipt: WaterlooReceipt,
) {
  if (receipt.command.kind !== 'historical-regroup') return;
  if (!canRegroupHistorical(c))
    throw new Error(
      'Regroup an untouched, unreviewed historical setup. Keep ongoing games intact or create a new historical campaign.',
    );
  const ids = receipt.command.regroup.corpsIds;
  const existing = new Set([
    c.id,
    c.seed,
    ...c.corps.map((f) => f.id),
    ...c.hqs.map((h) => h.id),
    ...c.fontenoy!.units.map((u) => u.id),
    ...c.fontenoy!.commanders.map((u) => u.id),
    ...c.fontenoy!.factions.map((f) => f.id),
  ]);
  if (
    ids.length !== historicalFormationGroups.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => existing.has(id))
  )
    throw new Error(
      'Provide one fresh unique formation identity per proposed group.',
    );
  assignHistoricalGroups(c, ids);
  for (const f of c.fontenoy!.formations)
    c.corps.find((p) => p.id === f.corpsId)!.roster = historicalRosterText(
      c,
      f.unitIds,
    );
  c.effectSerial++;
  c.log.push(
    'Regrouped the unreviewed historical setup on a common reported-subunit basis; original regiment identities, complements and proposed ratings preserved. Deployment reset provisionally; review required before play.',
  );
}

export function historicalDetail(id: string) {
  const o = organizations.get(id);
  return o
    ? {
        organization: o,
        path: historicalPath(o),
        complement: historicalComplement(id),
        locator: catalogue.claims.find((c) => c.id === o.designationClaimId)!
          .locator,
      }
    : null;
}
