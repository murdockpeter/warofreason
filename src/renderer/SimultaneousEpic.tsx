import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import type {
  EpicInput,
  EpicRevision,
} from '../domain/simultaneous-epic-schema';
import {
  canRecordEpic,
  currentEpicEntries,
  epicSummary,
} from '../domain/simultaneous-epic';
import { campaignTime } from '../domain/waterloo';
import { useCampaigns } from './campaign-store';

export function SimultaneousEpic({
  c,
  view,
}: {
  c: WaterlooCampaign;
  view: MapView;
}) {
  const store = useCampaigns(),
    m = c.fontenoy;
  if (!m) return null;
  const draft =
    store.waterlooDraft?.kind === 'epic' ? store.waterlooDraft : null;
  const busy =
    store.pending || c.status === 'archived' || !!m.siege.campaign?.victory;
  const editable = view === 'umpire' && canRecordEpic(c) && !busy;
  const entries = currentEpicEntries(c);
  const availableBattles = c.battles.filter(
    (b) =>
      b.appliedVersion &&
      !entries.some(
        (e) =>
          e.input.source.kind === 'battle' && e.input.source.battleId === b.id,
      ),
  );
  const start = (input: EpicInput, entry?: EpicRevision) =>
    useCampaigns.setState({
      waterlooDraft: {
        kind: 'epic',
        entryId: entry?.entryId ?? null,
        expectedVersion: entry?.version ?? 0,
        input: structuredClone(input),
        reason: '',
      },
      error: null,
    });
  const edit = (input: EpicInput) => {
    if (draft) useCampaigns.setState({ waterlooDraft: { ...draft, input } });
  };
  const label = (e: EpicRevision) =>
    e.input.source.kind === 'campaign'
      ? e.input.source.title
      : (c.battles.find(
          (b) => b.id === (e.input.source as { battleId: string }).battleId,
        )?.title ?? 'Battle');
  const sides = view === 'umpire' ? (['french', 'allied'] as const) : [view];
  return (
    <details className="panel simultaneous-epic" data-helper="epic">
      <summary>
        Epic Points · {m.epic ? 'manual ledger' : 'not enabled'}
      </summary>
      <p>
        Enter points agreed using your own Maurice materials. The app records
        and totals entries; it does not calculate scoring, card effects, Army
        Morale, exhaustion or victory.
      </p>
      {!m.epic ? (
        <>
          <p>
            Tracking is optional. Earlier battles stay unrecorded until you
            explicitly enter points; blank is not zero.
          </p>
          {view === 'umpire' && (
            <button
              disabled={!editable || !!store.waterlooDraft}
              onClick={() =>
                void store.commitWaterloo({ kind: 'maurice-epic-enable' })
              }
            >
              Enable manual Epic Points
            </button>
          )}
        </>
      ) : (
        <>
          <div className="epic-totals">
            {sides.map((side) => {
              const summary = epicSummary(c, side);
              return (
                <div
                  key={side}
                  aria-label={`${side === 'french' ? 'French' : 'Allied'} Epic Points summary`}
                >
                  <strong>{side === 'french' ? 'French' : 'Allied'}</strong>
                  <p>
                    Recorded total:{' '}
                    <b>
                      {summary.total === null ? 'Not recorded' : summary.total}
                    </b>
                  </p>
                  <p>
                    {summary.recorded} recorded values · {summary.missingValues}{' '}
                    missing values · {summary.battlesWithoutEntry} reviewed
                    battles without an entry.
                  </p>
                </div>
              );
            })}
          </div>
          {view === 'umpire' && (
            <>
              <p>
                Record after battle effects are applied, during clear planning
                or a settled checkpoint. Enter final-phase points before
                concluding the campaign. Corrections replace the entry in totals
                and preserve every earlier version.
              </p>
              <div className="button-row">
                <button
                  disabled={
                    !editable ||
                    !!store.waterlooDraft ||
                    !availableBattles.length
                  }
                  onClick={() =>
                    start({
                      source: {
                        kind: 'battle',
                        battleId: availableBattles[0]!.id,
                      },
                      points: { french: null, allied: null },
                      notes: '',
                    })
                  }
                >
                  Record battle Epic Points
                </button>
                <button
                  disabled={!editable || !!store.waterlooDraft}
                  onClick={() =>
                    start({
                      source: { kind: 'campaign', title: '' },
                      points: { french: null, allied: null },
                      notes: '',
                    })
                  }
                >
                  Record campaign event points
                </button>
              </div>
            </>
          )}
          {view === 'umpire' && draft && (
            <form
              aria-label="Epic Points entry"
              onSubmit={(e) => {
                e.preventDefault();
                void store.commitWaterloo({
                  kind: 'maurice-epic-record',
                  entryId: draft.entryId,
                  expectedVersion: draft.expectedVersion,
                  input: draft.input,
                  reason: draft.entryId ? draft.reason : draft.input.notes,
                });
              }}
            >
              <fieldset disabled={busy}>
                <legend>
                  {draft.entryId
                    ? `Correct entry version ${draft.expectedVersion}`
                    : 'Record manually agreed points'}
                </legend>
                {draft.input.source.kind === 'battle' ? (
                  draft.entryId ? (
                    <p>
                      Battle:{' '}
                      {
                        c.battles.find(
                          (b) =>
                            b.id ===
                            (draft.input.source as { battleId: string })
                              .battleId,
                        )?.title
                      }
                      . The source remains fixed.
                    </p>
                  ) : (
                    <>
                      <label htmlFor="epic-battle">Reviewed battle</label>
                      <select
                        id="epic-battle"
                        value={draft.input.source.battleId}
                        onChange={(e) =>
                          edit({
                            ...draft.input,
                            source: {
                              kind: 'battle',
                              battleId: e.target.value,
                            },
                          })
                        }
                      >
                        {availableBattles.map((b) => (
                          <option value={b.id} key={b.id}>
                            {b.title}
                          </option>
                        ))}
                      </select>
                    </>
                  )
                ) : (
                  <label>
                    Campaign event title
                    <input
                      required
                      maxLength={160}
                      value={draft.input.source.title}
                      onChange={(e) =>
                        edit({
                          ...draft.input,
                          source: { kind: 'campaign', title: e.target.value },
                        })
                      }
                    />
                  </label>
                )}
                <div className="form-grid">
                  {(['french', 'allied'] as const).map((side) => (
                    <label key={side}>
                      {side === 'french' ? 'French' : 'Allied'} Epic Points
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={draft.input.points[side] ?? ''}
                        onChange={(e) =>
                          edit({
                            ...draft.input,
                            points: {
                              ...draft.input.points,
                              [side]:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p>
                  Leave blank for not recorded. Enter 0 for an explicitly agreed
                  zero. Values are per entry, not running campaign totals;
                  corrections replace these values.
                </p>
                <label htmlFor="epic-notes">Entry explanation</label>
                <textarea
                  id="epic-notes"
                  required
                  maxLength={4000}
                  value={draft.input.notes}
                  onChange={(e) =>
                    edit({ ...draft.input, notes: e.target.value })
                  }
                />
                {draft.entryId && (
                  <>
                    <label htmlFor="epic-reason">Correction reason</label>
                    <textarea
                      id="epic-reason"
                      required
                      maxLength={4000}
                      value={draft.reason}
                      onChange={(e) =>
                        useCampaigns.setState({
                          waterlooDraft: { ...draft, reason: e.target.value },
                        })
                      }
                    />
                  </>
                )}
                <div className="button-row">
                  <button type="submit">
                    {draft.entryId
                      ? 'Confirm Epic Points correction'
                      : 'Confirm Epic Points entry'}
                  </button>
                  <button
                    type="button"
                    disabled={store.pending}
                    onClick={() => void store.discard()}
                  >
                    Discard points draft
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          <h3>Current entries</h3>
          {!entries.length && (
            <p>No Epic Points entries recorded. Totals are not yet recorded.</p>
          )}
          <div className="epic-entries">
            {entries.map((e) => (
              <article
                key={e.entryId}
                aria-label={
                  view === 'umpire'
                    ? label(e)
                    : `${e.input.source.kind === 'battle' ? 'Battle' : 'Campaign'} points entry`
                }
              >
                <h4>
                  {view === 'umpire'
                    ? label(e)
                    : e.input.source.kind === 'battle'
                      ? 'Battle entry'
                      : 'Campaign entry'}{' '}
                  · version {e.version}
                </h4>
                <p>
                  {sides
                    .map(
                      (side) =>
                        `${side === 'french' ? 'French' : 'Allied'}: ${e.input.points[side] === null ? 'Not recorded' : e.input.points[side]}`,
                    )
                    .join(' · ')}{' '}
                  · {campaignTime(c, e.at)}
                </p>
                {view === 'umpire' && (
                  <>
                    <p className="epic-notes">{e.input.notes}</p>
                    <button
                      disabled={!editable || !!store.waterlooDraft}
                      onClick={() => start(e.input, e)}
                    >
                      Correct {label(e)}
                    </button>
                    <details>
                      <summary>Entry revision history</summary>
                      {m
                        .epic!.revisions.filter((r) => r.entryId === e.entryId)
                        .map((r) => (
                          <div key={r.id} className="epic-revision">
                            <p>
                              Version {r.version} · French{' '}
                              {r.input.points.french ?? 'Not recorded'} · Allied{' '}
                              {r.input.points.allied ?? 'Not recorded'} ·{' '}
                              {campaignTime(c, r.at)}
                            </p>
                            <p className="epic-notes">
                              Explanation: {r.input.notes}
                            </p>
                            <p className="epic-notes">Reason: {r.reason}</p>
                            <p>
                              Saved {r.timestamp}
                              {r.battleVersion !== null
                                ? ` · battle result version ${r.battleVersion}`
                                : ''}
                            </p>
                          </div>
                        ))}
                    </details>
                  </>
                )}
              </article>
            ))}
          </div>
          {view !== 'umpire' && (
            <p>
              This view shows your current points only. Other-side values, event
              titles, explanations and full correction history remain in umpire
              view.
            </p>
          )}
        </>
      )}
    </details>
  );
}
