import { useState } from 'react';
import { ReaderDialog } from './ReaderDialog';
import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import { historicalReviewSchema } from '../domain/historical-profile-schema';
import { historicalDetail } from '../domain/historical-profile';
import { useCampaigns } from './campaign-store';
import { HistoricalForceOverview } from './HistoricalForceOverview';

export function HistoricalUnitIdentity({
  organizationId,
}: {
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const detail = historicalDetail(organizationId);
  if (!detail) return null;
  return (
    <>
      <button
        type="button"
        className="historical-unit-name"
        onClick={() => setOpen(true)}
      >
        {detail.organization.displayName}
      </button>
      {open && (
        <ReaderDialog
          title={`${detail.organization.displayName} · historical record`}
          className="historical-record-dialog"
          onDismiss={() => setOpen(false)}
        >
          <p className="historical-record-complement">{detail.complement}</p>
          <p>
            {detail.path} · service: {detail.organization.service}
            {detail.organization.origin &&
              ` · origin: ${detail.organization.origin}`}
          </p>
          <p>{detail.organization.notes}</p>
          {detail.organization.aliases.length > 0 && (
            <p>
              Source lookup labels (dates unverified):{' '}
              {detail.organization.aliases.map((a) => a.name).join('; ')}
            </p>
          )}
          <p>
            Reported battalion/squadron counts are retained; individual
            subordinate identifiers are not invented.
          </p>
          <small>{detail.locator} · catalogue 0.1.0</small>
        </ReaderDialog>
      )}
    </>
  );
}

export function HistoricalProfileReview({
  c,
  view,
}: {
  c: WaterlooCampaign;
  view: MapView;
}) {
  const state = useCampaigns(),
    m = c.fontenoy,
    profile = m?.historicalProfile;
  const draft =
    state.waterlooDraft?.kind === 'historical-review'
      ? state.waterlooDraft.review
      : null;
  if (!m) return null;
  if (!profile)
    return (
      <section className="panel" aria-label="Historical campaign available">
        <h3>Use the historical regimental roster</h3>
        <p>
          This campaign uses the original 38 abstract Maurice units. Create a
          separate historical campaign with 143 regimental/aggregate records
          linked to campaign formations. Your current save and history remain
          available.
        </p>
        <button
          disabled={state.pending || !!state.waterlooDraft}
          onClick={() => void state.createHistoricalFontenoy()}
        >
          Create historical campaign
        </button>
      </section>
    );
  const edit = (review: NonNullable<typeof draft>) =>
    useCampaigns.setState({
      waterlooDraft: { kind: 'historical-review', review },
    });
  return (
    <section
      className="panel historical-review"
      data-helper="historical-roster"
      aria-label="Historical roster setup"
    >
      <h3>
        {m.units.length} historical roster records · {m.formations.length}{' '}
        campaign formations
      </h3>
      <HistoricalForceOverview c={c} view={view} />
      <p>
        Opening date: {c.startDate}. Each record represents a named regiment,
        battalion, troop or unresolved aggregate with its reported complement.
        This is not a one-battalion-to-one-Maurice-unit conversion. Regular
        ratings are proposed scenario choices; none is inferred from regimental
        reputation.
      </p>
      <p>
        Formations and map deployment are provisional campaign groupings. The 11
        May battle roster does not establish earlier campaign dispositions, the
        siege army or the Tournai garrison. Conflicting strengths and unknown
        subordinate IDs remain unresolved.
      </p>
      {profile.reviewedAt ? (
        <p>
          Scenario adaptation reviewed: {profile.reviewedAt}. Ratings remain
          house choices, not independently established historical or official
          Maurice ratings.
        </p>
      ) : view !== 'umpire' ? (
        <p>The umpire must review this setup before play.</p>
      ) : (
        <>
          {!draft && (
            <button
              disabled={state.pending || !!state.waterlooDraft}
              onClick={() =>
                edit({
                  ratings: structuredClone(profile.openingRatings),
                  acknowledgedScale: false,
                  acknowledgedDeployment: false,
                  acknowledgedSourceGaps: false,
                  notes: '',
                })
              }
            >
              Review historical setup
            </button>
          )}
          {draft && (
            <form
              aria-label="Historical roster review"
              onSubmit={(e) => {
                e.preventDefault();
                void state.commitWaterloo({
                  kind: 'historical-roster-review',
                  review: draft,
                });
              }}
            >
              <fieldset disabled={state.pending}>
                <legend>Review the playable historical adaptation</legend>
                <details>
                  <summary>Review proposed tabletop ratings</summary>
                  <p>
                    Regular records initially use trained as a placeholder. You
                    may change these house ratings. Historical
                    battalion/squadron complements remain separate from tabletop
                    scale; agree tactical representation at the table.
                  </p>
                  {m.formations.map((f) => (
                    <details key={f.corpsId}>
                      <summary>
                        {c.corps.find((p) => p.id === f.corpsId)!.name}
                      </summary>
                      {draft.ratings
                        .filter((r) => f.unitIds.includes(r.unitId))
                        .map((r) => (
                          <label key={r.unitId}>
                            Scenario quality for{' '}
                            {
                              m.units.find((u) => u.id === r.unitId)!
                                .displayName
                            }
                            <select
                              value={r.quality}
                              onChange={(e) =>
                                edit({
                                  ...draft,
                                  ratings: draft.ratings.map((p) =>
                                    p.unitId === r.unitId
                                      ? {
                                          ...p,
                                          quality: e.target
                                            .value as typeof p.quality,
                                        }
                                      : p,
                                  ),
                                })
                              }
                            >
                              <option value="trained">
                                Trained (house choice)
                              </option>
                              <option value="elite">
                                Elite (house choice)
                              </option>
                            </select>
                          </label>
                        ))}
                    </details>
                  ))}
                </details>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.acknowledgedScale}
                    onChange={(e) =>
                      edit({ ...draft, acknowledgedScale: e.target.checked })
                    }
                  />
                  I reviewed the regimental record scale and scenario ratings
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.acknowledgedDeployment}
                    onChange={(e) =>
                      edit({
                        ...draft,
                        acknowledgedDeployment: e.target.checked,
                      })
                    }
                  />
                  I reviewed the provisional formations and deployment
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.acknowledgedSourceGaps}
                    onChange={(e) =>
                      edit({
                        ...draft,
                        acknowledgedSourceGaps: e.target.checked,
                      })
                    }
                  />
                  I reviewed the battle-date coverage and source gaps
                </label>
                <label>
                  Historical setup review notes
                  <textarea
                    required
                    maxLength={4000}
                    value={draft.notes}
                    onChange={(e) => edit({ ...draft, notes: e.target.value })}
                  />
                </label>
                <div className="button-row">
                  <button
                    disabled={!historicalReviewSchema.safeParse(draft).success}
                  >
                    Confirm historical setup
                  </button>
                  <button type="button" onClick={() => void state.discard()}>
                    Discard historical review
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
