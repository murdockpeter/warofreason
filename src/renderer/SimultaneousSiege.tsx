import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import type {
  SimultaneousSiegePolicy,
  SiegeReview,
} from '../domain/simultaneous-siege-schema';
import {
  defaultSimultaneousSiegePolicy,
  defaultSiegeReview,
  previewSiegeCheckpoint,
} from '../domain/simultaneous-siege';
import { campaignTime } from '../domain/waterloo';
import { useCampaigns } from './campaign-store';

export function SimultaneousSiegePanel({
  c,
  view,
}: {
  c: WaterlooCampaign;
  view: MapView;
}) {
  const store = useCampaigns();
  if (!c.fontenoy) return null;
  const siege = c.fontenoy.siege,
    state = siege.campaign;
  const policyDraft =
    store.waterlooDraft?.kind === 'siege-policy' ? store.waterlooDraft : null;
  const reviewDraft =
    store.waterlooDraft?.kind === 'siege-review' ? store.waterlooDraft : null;
  const busy = store.pending || c.status === 'archived' || !!state?.victory;
  const canConfigure =
    c.phase === 'planning' &&
    !c.submissions.some((s) => s.locked || s.orders.length) &&
    !c.encounters.some((e) => !e.settled) &&
    !c.battles.some((b) => !b.appliedVersion);
  const editPolicy = (patch: Partial<SimultaneousSiegePolicy>) => {
    if (policyDraft)
      useCampaigns.setState({
        waterlooDraft: {
          ...policyDraft,
          policy: { ...policyDraft.policy, ...patch },
        },
      });
  };
  const editReview = (patch: Partial<SiegeReview>) => {
    if (reviewDraft)
      useCampaigns.setState({
        waterlooDraft: {
          ...reviewDraft,
          review: { ...reviewDraft.review, ...patch },
        },
      });
  };
  const preview =
    state && (reviewDraft?.review ?? state.pendingReview)
      ? previewSiegeCheckpoint(c, (reviewDraft?.review ?? state.pendingReview)!)
      : null;
  const discard = (
    <button
      type="button"
      disabled={store.pending}
      onClick={() => void store.discard()}
    >
      Discard draft
    </button>
  );
  return (
    <section
      className="panel simultaneous-siege"
      data-helper="siege"
      aria-label="Tournai siege and victory"
    >
      <div className="section-heading">
        <h2>Tournai</h2>
        <span className="badge">
          {state?.victory
            ? 'Campaign concluded'
            : state
              ? `${siege.progress} / ${state.policy.rules.siegeThreshold}`
              : 'Siege rules not enabled'}
        </span>
      </div>
      {state?.victory ? (
        <div role="status">
          <h3>Campaign outcome: {state.victory.winner}</h3>
          <p>
            {campaignTime(c, state.victory.at)} · phase {state.victory.turn}.
            Strategic play is now read-only.
          </p>
          <ul>
            {state.victory.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>
          {siege.status.replaceAll('_', ' ')} · {siege.progress} progress.
          {state && (
            <>
              {' '}
              Next:{' '}
              {c.phase === 'checkpoint'
                ? state.pendingReview
                  ? 'Finish shared phase to apply the reviewed checkpoint.'
                  : 'Umpire reviews conditions before finishing this phase.'
                : 'Complete movement and battles, then review siege conditions.'}
            </>
          )}
        </p>
      )}
      {view === 'umpire' && state && c.phase === 'checkpoint' && !busy && (
        <button
          disabled={!!store.waterlooDraft}
          data-helper="siege-review"
          onClick={() =>
            useCampaigns.setState({
              waterlooDraft: {
                kind: 'siege-review',
                review: state.pendingReview
                  ? {
                      conditions: { ...state.pendingReview.conditions },
                      exhaustion: { ...state.pendingReview.exhaustion },
                      notes: state.pendingReview.notes,
                    }
                  : defaultSiegeReview(c),
              },
              error: null,
            })
          }
        >
          {state.pendingReview
            ? 'Revise siege checkpoint'
            : 'Review siege checkpoint'}
        </button>
      )}
      {view === 'umpire' && reviewDraft && state && (
        <form
          aria-label="Siege checkpoint review"
          onSubmit={(e) => {
            e.preventDefault();
            void store.commitWaterloo({
              kind: 'maurice-siege-review',
              review: reviewDraft.review,
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Confirm the completed calendar interval</legend>
            <p>
              Attest conditions from {campaignTime(c, state.lastCheckpointAt)}{' '}
              through {campaignTime(c, c.cursor)}, including any overnight gap.
              These conditions are manually adjudicated; map occupation does not
              establish supply or relief.
            </p>
            <div className="form-grid">
              {(['invested', 'supplied', 'relieved'] as const).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={reviewDraft.review.conditions[key]}
                    onChange={(e) =>
                      editReview({
                        conditions: {
                          ...reviewDraft.review.conditions,
                          [key]: e.target.checked,
                        },
                      })
                    }
                  />
                  {key === 'invested'
                    ? 'Investment confirmed'
                    : key === 'supplied'
                      ? 'French supply confirmed'
                      : 'Allied relief confirmed'}
                </label>
              ))}
              {(['french', 'allied'] as const).map((side) => (
                <label key={side}>
                  {side === 'french' ? 'French' : 'Allied'} campaign exhaustion
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    required
                    value={reviewDraft.review.exhaustion[side]}
                    onChange={(e) =>
                      editReview({
                        exhaustion: {
                          ...reviewDraft.review.exhaustion,
                          [side]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p>
              Campaign exhaustion is a separate manual total. Battle Army Morale
              and losses never populate it automatically.
            </p>
            <label>
              Checkpoint explanation
              <textarea
                required
                maxLength={4000}
                value={reviewDraft.review.notes}
                onChange={(e) => editReview({ notes: e.target.value })}
              />
            </label>
            <div className="button-row">
              <button type="submit">Confirm siege review</button>
              {discard}
            </div>
          </fieldset>
        </form>
      )}
      {preview && view === 'umpire' && c.phase === 'checkpoint' && (
        <div className="siege-preview" aria-label="Siege checkpoint preview">
          <h3>On finishing this phase</h3>
          <p>
            Progress {preview.progressBefore} → {preview.progressAfter} ·{' '}
            {preview.increments} calendar increments ·{' '}
            {preview.eligibleMinutesAfter / 60} eligible hours carried forward.
          </p>
          {preview.victory ? (
            <>
              <p>Proposed campaign outcome: {preview.victory.winner}</p>
              <ul>
                {preview.victory.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No campaign outcome at this checkpoint.</p>
          )}
          <p>
            Reviewing saves the conditions. Only Finish shared phase applies
            these effects.
          </p>
        </div>
      )}
      <details>
        <summary>Siege rules and checkpoint history</summary>
        <p>
          Provisional campaign house rules. Investment and supplied time earn
          progress; confirmed relief prevents new progress. Earlier progress
          remains. Relief, siege success, exhaustion and the deadline are
          evaluated together at finalization using the agreed conflict outcome.
        </p>
        {state && (
          <p>
            One increment interval = {state.policy.minutesPerSiegeTurn / 60}{' '}
            eligible calendar hours, worth {state.policy.rules.siegeIncrement}{' '}
            progress. Paused intervals retain earlier eligible hours. Deadline:{' '}
            {campaignTime(c, state.policy.deadlineAt)}. No time before policy
            enablement is credited.
          </p>
        )}
        {view === 'umpire' && (
          <button
            disabled={busy || !canConfigure || !!store.waterlooDraft}
            onClick={() =>
              useCampaigns.setState({
                waterlooDraft: {
                  kind: 'siege-policy',
                  policy: structuredClone(
                    state?.policy ?? defaultSimultaneousSiegePolicy(c),
                  ),
                },
                error: null,
              })
            }
          >
            {state ? 'Review siege policy' : 'Review and enable siege rules'}
          </button>
        )}
        {view === 'umpire' && policyDraft && (
          <form
            aria-label="Siege policy"
            onSubmit={(e) => {
              e.preventDefault();
              void store.commitWaterloo({
                kind: 'maurice-siege-policy',
                policy: policyDraft.policy,
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>Agreed siege and victory policy</legend>
              <p>
                The default cadence follows the source setup’s days per turn.
                Review it explicitly for simultaneous play.
              </p>
              <div className="form-grid">
                {(
                  [
                    ['siegeThreshold', 'Siege success threshold', 1, 10000],
                    ['siegeIncrement', 'Progress per interval', 0, 1000],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      required
                      value={policyDraft.policy.rules[key]}
                      onChange={(e) =>
                        editPolicy({
                          rules: {
                            ...policyDraft.policy.rules,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Calendar hours per siege interval
                  <input
                    type="number"
                    min="1"
                    max="2400"
                    required
                    value={policyDraft.policy.minutesPerSiegeTurn / 60}
                    onChange={(e) =>
                      editPolicy({
                        minutesPerSiegeTurn: Number(e.target.value) * 60,
                      })
                    }
                  />
                </label>
                <label>
                  Deadline calendar hours from campaign midnight
                  <input
                    type="number"
                    min={Math.floor(c.cursor / 60) + 1}
                    max="1194"
                    required
                    value={policyDraft.policy.deadlineAt / 60}
                    onChange={(e) =>
                      editPolicy({ deadlineAt: Number(e.target.value) * 60 })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={
                      policyDraft.policy.rules.exhaustionThreshold !== null
                    }
                    onChange={(e) =>
                      editPolicy({
                        rules: {
                          ...policyDraft.policy.rules,
                          exhaustionThreshold: e.target.checked ? 10 : null,
                        },
                      })
                    }
                  />
                  Use campaign exhaustion threshold
                </label>
                {policyDraft.policy.rules.exhaustionThreshold !== null && (
                  <label>
                    Campaign exhaustion threshold
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      required
                      value={policyDraft.policy.rules.exhaustionThreshold}
                      onChange={(e) =>
                        editPolicy({
                          rules: {
                            ...policyDraft.policy.rules,
                            exhaustionThreshold: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                )}
                {(['deadlineOutcome', 'conflictOutcome'] as const).map(
                  (key) => (
                    <label key={key}>
                      {key === 'deadlineOutcome'
                        ? 'Deadline outcome'
                        : 'Conflicting conditions outcome'}
                      <select
                        value={policyDraft.policy.rules[key]}
                        onChange={(e) =>
                          editPolicy({
                            rules: {
                              ...policyDraft.policy.rules,
                              [key]: e.target.value as
                                'french' | 'allied' | 'draw',
                            },
                          })
                        }
                      >
                        {(['french', 'allied', 'draw'] as const).map((side) => (
                          <option key={side} value={side}>
                            {side}
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
              </div>
              <p>
                Selected deadline:{' '}
                {campaignTime(c, policyDraft.policy.deadlineAt)}. Existing
                checkpoint records stay fixed. Changing cadence requires zero
                carried eligible hours.
              </p>
              <div className="button-row">
                <button type="submit">Confirm siege policy</button>
                {discard}
              </div>
            </fieldset>
          </form>
        )}
        {state && (
          <>
            <h3>Finalized checkpoints</h3>
            {!state.checkpoints.length && (
              <p>No siege checkpoints finalized.</p>
            )}
            {[...state.checkpoints].reverse().map((cp) => (
              <details key={cp.turn}>
                <summary>
                  Phase {cp.turn} · {campaignTime(c, cp.at)} · progress{' '}
                  {cp.progressBefore} → {cp.progressAfter}
                </summary>
                <p>{cp.review.notes}</p>
                <p>
                  Investment {cp.review.conditions.invested ? 'yes' : 'no'} ·
                  supply {cp.review.conditions.supplied ? 'yes' : 'no'} · relief{' '}
                  {cp.review.conditions.relieved ? 'yes' : 'no'}. Exhaustion:
                  French {cp.review.exhaustion.french}, Allied{' '}
                  {cp.review.exhaustion.allied}.
                </p>
                <p>
                  Reviewed interval {campaignTime(c, cp.fromAt)} to{' '}
                  {campaignTime(c, cp.at)}. Policy {cp.policy.ruleId}:{' '}
                  {cp.policy.minutesPerSiegeTurn / 60} hours, +
                  {cp.policy.rules.siegeIncrement}, success{' '}
                  {cp.policy.rules.siegeThreshold}, exhaustion{' '}
                  {cp.policy.rules.exhaustionThreshold ?? 'disabled'}, deadline{' '}
                  {campaignTime(c, cp.policy.deadlineAt)}, deadline outcome{' '}
                  {cp.policy.rules.deadlineOutcome}, conflict outcome{' '}
                  {cp.policy.rules.conflictOutcome}.
                </p>
                <p>
                  {cp.increments} increments; {cp.eligibleMinutesAfter / 60}{' '}
                  hours carried forward. Saved {cp.timestamp}.
                </p>
                {cp.victory && (
                  <ul>
                    {cp.victory.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </>
        )}
      </details>
    </section>
  );
}
