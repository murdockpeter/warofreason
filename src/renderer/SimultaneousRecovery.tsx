import type {
  WaterlooBattle,
  WaterlooCampaign,
  WaterlooResult,
} from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import {
  defaultSimultaneousRecoveryPolicy,
  previewMauriceAftermath,
} from '../domain/simultaneous-aftermath';
import { canRebuildUnit } from '../domain/unit-recovery';
import { campaignTime } from '../domain/waterloo';
import { useCampaigns } from './campaign-store';

export function MauriceResultRecord({ battle }: { battle: WaterlooBattle }) {
  const result = battle.results.at(-1)?.result.maurice;
  if (!result) return null;
  const units = (battle.maurice ?? []).flatMap((f) => f.units);
  return (
    <details className="maurice-observations">
      <summary>Recorded Maurice unit observations</summary>
      <p>
        Final Army Morale: French {result.armyMorale.french ?? 'not recorded'} ·
        Allied {result.armyMorale.allied ?? 'not recorded'}. These remain
        tactical observations.
      </p>
      <ul>
        {result.units.map((row) => (
          <li key={row.unitId}>
            {units.find((u) => u.id === row.unitId)?.displayName}:{' '}
            {row.outcome.replaceAll('_', ' ')}
            {row.recovery ? `; reviewed ${row.recovery}` : ''} · disruption{' '}
            {row.disruptedAtEnd === null
              ? 'not recorded'
              : row.disruptedAtEnd
                ? 'recorded'
                : 'none recorded'}
            {row.notes ? ` · ${row.notes}` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SimultaneousRecoveryPanel({
  c,
  view,
}: {
  c: WaterlooCampaign;
  view: MapView;
}) {
  const state = useCampaigns();
  if (!c.fontenoy) return null;
  const strategic = c.fontenoy.aftermath;
  const draft =
    state.waterlooDraft?.kind === 'recovery-policy'
      ? state.waterlooDraft
      : null;
  const busy =
    state.pending ||
    c.status === 'archived' ||
    !!c.fontenoy?.siege.campaign?.victory;
  const canConfigure =
    view === 'umpire' &&
    c.phase === 'planning' &&
    !busy &&
    !c.submissions.some((s) => s.locked || s.orders.length) &&
    !c.encounters.some((e) => !e.settled);
  const visibleUnits = c.fontenoy.units.filter(
    (u) =>
      view === 'umpire' ||
      c.fontenoy!.factions.some((f) => f.id === u.factionId && f.side === view),
  );
  const edit = (
    patch: Partial<ReturnType<typeof defaultSimultaneousRecoveryPolicy>>,
  ) => {
    if (draft)
      useCampaigns.setState({
        waterlooDraft: { ...draft, policy: { ...draft.policy, ...patch } },
      });
  };
  return (
    <details className="panel simultaneous-recovery" data-helper="recovery">
      <summary>
        Maurice unit recovery{strategic ? ' · enabled' : ' · not enabled'}
      </summary>
      {c.fontenoy?.historicalProfile && (
        <p>
          This profile tracks historical regimental/aggregate records. Applying
          rebuilding or recovery to these records is an agreed scenario
          adaptation; reported battalion/squadron complements are not
          automatically converted into Maurice units.
        </p>
      )}
      <p>
        Per-unit losses and recovery are reviewed campaign house rules. Tactical
        disruption and Army Morale are battle observations, not persistent
        exhaustion.
      </p>
      {strategic && (
        <p>
          Policy: {strategic.policy.rules.strategy}. One recovery turn ={' '}
          {strategic.policy.minutesPerRecoveryTurn / 60} calendar hours.
          Recorded recovery dates remain fixed after rule changes.
        </p>
      )}
      {view === 'umpire' && (
        <button
          disabled={!canConfigure || !!state.waterlooDraft}
          onClick={() =>
            useCampaigns.setState({
              waterlooDraft: {
                kind: 'recovery-policy',
                policy: structuredClone(
                  strategic?.policy ?? defaultSimultaneousRecoveryPolicy(c),
                ),
              },
              error: null,
            })
          }
        >
          {strategic
            ? 'Review unit recovery rules'
            : 'Review and enable unit recovery'}
        </button>
      )}
      {view === 'umpire' && draft && (
        <form
          aria-label="Maurice recovery policy"
          onSubmit={(e) => {
            e.preventDefault();
            void state.commitWaterloo({
              kind: 'maurice-recovery-policy',
              policy: draft.policy,
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Loss policy and calendar conversion</legend>
            <div className="form-grid">
              <label>
                Loss strategy
                <select
                  value={draft.policy.rules.strategy}
                  onChange={(e) =>
                    edit({
                      rules: {
                        ...draft.policy.rules,
                        strategy: e.target
                          .value as typeof draft.policy.rules.strategy,
                      },
                    })
                  }
                >
                  <option value="conscript_rebuild_v1">
                    Follow selected rebuilding policy
                  </option>
                  <option value="manual_review_v1">
                    Review each broken unit individually
                  </option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.policy.rules.allowRegularRebuild}
                  onChange={(e) =>
                    edit({
                      rules: {
                        ...draft.policy.rules,
                        allowRegularRebuild: e.target.checked,
                      },
                    })
                  }
                />
                Allow broken regular units to rebuild as conscripts
              </label>
              {(['irregularRecovery', 'artilleryRecovery'] as const).map(
                (key) => (
                  <label key={key}>
                    {key === 'irregularRecovery'
                      ? 'Broken irregular units'
                      : 'Broken artillery'}
                    <select
                      value={draft.policy.rules[key]}
                      onChange={(e) =>
                        edit({
                          rules: {
                            ...draft.policy.rules,
                            [key]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="lost">Lost</option>
                      <option value="same_quality">
                        Recover with no regular quality
                      </option>
                    </select>
                  </label>
                ),
              )}
              <label>
                Rebuilding delay (recovery turns)
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={draft.policy.rules.recoveryTurns}
                  onChange={(e) =>
                    edit({
                      rules: {
                        ...draft.policy.rules,
                        recoveryTurns: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Retired-unit rest (recovery turns)
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={draft.policy.rules.retiredRestTurns}
                  onChange={(e) =>
                    edit({
                      rules: {
                        ...draft.policy.rules,
                        retiredRestTurns: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Calendar hours per recovery turn
                <input
                  type="number"
                  min="1"
                  max="2400"
                  step="1"
                  required
                  value={draft.policy.minutesPerRecoveryTurn / 60}
                  onChange={(e) =>
                    edit({
                      minutesPerRecoveryTurn: Number(e.target.value) * 60,
                    })
                  }
                />
              </label>
            </div>
            <p>
              Proposed source conversion: one former campaign turn covered{' '}
              {c.fontenoy.sourceSchedule.daysPerTurn} days. The default is{' '}
              {c.fontenoy.sourceSchedule.daysPerTurn * 24} hours, not one AM/PM
              phase. Your chosen rebuilding delay is{' '}
              {(draft.policy.rules.recoveryTurns *
                draft.policy.minutesPerRecoveryTurn) /
                60}{' '}
              hours after the recorded battle end. Units return at the first
              explicit finalized-phase checkpoint at or after their due time.
            </p>
          </fieldset>
          <div className="button-row">
            <button disabled={busy}>Confirm unit recovery policy</button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                void state.discard();
              }}
            >
              Discard recovery policy edit
            </button>
          </div>
        </form>
      )}
      {strategic && (
        <section aria-label="Maurice recovery queue">
          <h3>Recovery queue</h3>
          <ul>
            {strategic.recoveries
              .filter((r) => visibleUnits.some((u) => u.id === r.unitId))
              .map((r, i) => (
                <li key={`${r.unitId}:${i}`}>
                  {visibleUnits.find((u) => u.id === r.unitId)!.displayName} ·{' '}
                  {r.recoveredAt === null
                    ? `due ${campaignTime(c, r.dueAt)}`
                    : `returned ${campaignTime(c, r.recoveredAt)}`}{' '}
                  · current quality{' '}
                  {visibleUnits.find((u) => u.id === r.unitId)!.quality ??
                    'not applicable'}
                </li>
              ))}
          </ul>
          {!strategic.recoveries.some((r) =>
            visibleUnits.some((u) => u.id === r.unitId),
          ) && <p>No recorded recoveries in this view.</p>}
        </section>
      )}
    </details>
  );
}

export function MauriceUnitResultFields({
  c,
  battle,
  result,
  edit,
  busy,
}: {
  c: WaterlooCampaign;
  battle: WaterlooBattle;
  result: WaterlooResult;
  edit(result: WaterlooResult): void;
  busy: boolean;
}) {
  const observations = result.maurice;
  if (!observations || !c.fontenoy?.aftermath) return null;
  const policy = c.fontenoy.aftermath.policy;
  const units = (battle.maurice ?? []).flatMap((f) => f.units);
  let preview: ReturnType<typeof previewMauriceAftermath> = [];
  let issue = '';
  try {
    preview = previewMauriceAftermath(c, battle, result);
  } catch (error) {
    issue = error instanceof Error ? error.message : 'Review unit effects.';
  }
  return (
    <fieldset disabled={busy} className="maurice-unit-results">
      <legend>Maurice unit observations and campaign consequences</legend>
      <p>
        Enter actual tabletop outcomes. Final disruption and Army Morale are
        recorded only; they never become automatic campaign exhaustion. Frozen
        rosters contain only units ready when committed. Abstract screens have
        no allocated Maurice units and never duplicate their parent roster.
      </p>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          edit({
            ...result,
            maurice: {
              ...observations,
              units: observations.units.map((row) => {
                const force = battle.maurice!.find((f) =>
                  f.units.some((u) => u.id === row.unitId),
                )!;
                return row.outcome === 'not_engaged' &&
                  result.effects.find((e) => e.corpsId === force.corpsId)
                    ?.disposition !== 'not_engaged'
                  ? { ...row, outcome: 'survived' }
                  : row;
              }),
            },
          })
        }
      >
        Mark participating units survived
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Tabletop outcome</th>
              <th>Broken-unit decision</th>
              <th>Final disruption</th>
              <th>Unit notes</th>
            </tr>
          </thead>
          <tbody>
            {observations.units.map((row, index) => {
              const unit = units.find((u) => u.id === row.unitId)!;
              const change = (patch: Partial<typeof row>) =>
                edit({
                  ...result,
                  maurice: {
                    ...observations,
                    units: observations.units.map((u, i) =>
                      i === index ? { ...u, ...patch } : u,
                    ),
                  },
                });
              return (
                <tr key={row.unitId}>
                  <th scope="row">
                    {unit.displayName}
                    <small>{unit.quality ?? 'no regular quality'}</small>
                  </th>
                  <td>
                    <select
                      aria-label={`Outcome for ${unit.displayName}`}
                      value={row.outcome}
                      onChange={(e) => {
                        const outcome = e.target.value as typeof row.outcome;
                        change({
                          outcome,
                          recovery:
                            outcome === 'broken'
                              ? canRebuildUnit(unit, policy.rules)
                                ? 'recover'
                                : 'lost'
                              : null,
                        });
                      }}
                    >
                      {['not_engaged', 'survived', 'retired', 'broken'].map(
                        (value) => (
                          <option key={value} value={value}>
                            {value.replaceAll('_', ' ')}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td>
                    {row.outcome === 'broken' ? (
                      <select
                        aria-label={`Recovery for ${unit.displayName}`}
                        disabled={policy.rules.strategy !== 'manual_review_v1'}
                        value={row.recovery ?? ''}
                        onChange={(e) =>
                          change({
                            recovery: e.target.value as 'recover' | 'lost',
                          })
                        }
                      >
                        <option value="recover">Rebuild / recover</option>
                        <option value="lost">Lost</option>
                      </select>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={`Disruption for ${unit.displayName}`}
                      value={
                        row.disruptedAtEnd === null
                          ? ''
                          : String(row.disruptedAtEnd)
                      }
                      onChange={(e) =>
                        change({
                          disruptedAtEnd:
                            e.target.value === ''
                              ? null
                              : e.target.value === 'true',
                        })
                      }
                    >
                      <option value="">Not recorded</option>
                      <option value="true">Disrupted</option>
                      <option value="false">Not disrupted</option>
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Notes for ${unit.displayName}`}
                      maxLength={4000}
                      value={row.notes}
                      onChange={(e) => change({ notes: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="form-grid">
        {(['french', 'allied'] as const).map((side) => (
          <label key={side}>
            {side} final Army Morale (optional)
            <input
              type="number"
              min="0"
              max="1000"
              value={observations.armyMorale[side] ?? ''}
              onChange={(e) =>
                edit({
                  ...result,
                  maurice: {
                    ...observations,
                    armyMorale: {
                      ...observations.armyMorale,
                      [side]:
                        e.target.value === '' ? null : Number(e.target.value),
                    },
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <section aria-label="Maurice campaign effects preview">
        <h4>Unit effects to review</h4>
        {issue ? (
          <p className="campaign-error">{issue}</p>
        ) : (
          <>
            <p>
              Apply at the recorded battle end, after approval and simultaneous
              resolution. One recovery turn ={' '}
              {policy.minutesPerRecoveryTurn / 60} hours.
            </p>
            <ul>
              {preview
                .filter(
                  (r) =>
                    r.before.quality !== r.after.quality ||
                    r.before.currentStatus !== r.after.currentStatus,
                )
                .map((r) => (
                  <li key={r.unitId}>
                    {r.before.displayName}:{' '}
                    {r.before.quality ?? 'no regular quality'} /{' '}
                    {r.before.currentStatus} →{' '}
                    {r.after.quality ?? 'no regular quality'} /{' '}
                    {r.after.currentStatus}
                    {r.dueAt === null
                      ? ''
                      : `; due ${campaignTime(c, r.dueAt)}`}
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </fieldset>
  );
}
