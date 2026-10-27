import { beginAdjudication } from './manual-adjudication-session';
import { applyWaterlooCommand, campaignTime } from '../domain/waterloo';
import type { WaterlooCampaign } from '../domain/waterloo-schema';
import {
  canAdjudicate,
  manualPhaseEnd,
  manualPlacement,
} from '../domain/manual-adjudication';
import type { ManualRuling } from '../domain/manual-adjudication-schema';
import { useCampaigns } from './campaign-store';

export function ManualAdjudication({ c }: { c: WaterlooCampaign }) {
  const store = useCampaigns(),
    draft =
      store.waterlooDraft?.kind === 'adjudication' ? store.waterlooDraft : null;
  const ruling = draft?.input;
  const edit = (input: ManualRuling) =>
    useCampaigns.setState({ waterlooDraft: { ...draft!, input }, error: null });
  const enabled = canAdjudicate(c) && !store.pending;
  let error = '';
  if (ruling) {
    try {
      applyWaterlooCommand(c, {
        command: { kind: 'manual-adjudication', ruling },
        recordId: crypto.randomUUID(),
        timestamp: c.updatedAt,
      });
    } catch (e) {
      error = ruling.decision.trim()
        ? e instanceof Error
          ? e.message
          : 'Review the ruling.'
        : 'Explain the agreed outcome before confirming.';
    }
  }
  const name = (id: string) => c.corps.find((f) => f.id === id)?.name ?? id;
  return (
    <section
      data-helper="adjudication"
      className="manual-adjudication"
      aria-label="Manual adjudication"
    >
      <p>
        Umpire rulings bypass route costs, road limits and automatic contact
        detection. Review every outcome before saving. Reported strength is
        descriptive; it does not create or remove game units.
      </p>
      {!enabled && (
        <p>
          {c.fontenoy?.historicalProfile &&
          !c.fontenoy.historicalProfile.reviewedAt
            ? 'Complete the historical setup review in Historical OOB before adjudicating. '
            : ''}
          Use clear planning or a settled checkpoint before siege review. Reset
          saved orders and resolve outstanding contacts, battles or preparation
          submissions first.
        </p>
      )}
      {!draft && (
        <button
          disabled={!enabled || !!store.waterlooDraft}
          onClick={() => beginAdjudication(c)}
        >
          New manual ruling
        </button>
      )}
      {ruling && (
        <form
          aria-label="Manual ruling editor"
          onSubmit={(e) => {
            e.preventDefault();
            void store.commitWaterloo({ kind: 'manual-adjudication', ruling });
          }}
        >
          <fieldset disabled={store.pending}>
            <legend>
              {ruling.correctsId
                ? 'Correct an earlier ruling with a new decision'
                : 'Record an agreed outcome'}
            </legend>
            <label>
              Formation to adjudicate
              <select
                value={draft.targetCorpsId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  const input = ruling.placements.some((p) => p.corpsId === id)
                    ? ruling
                    : {
                        ...ruling,
                        placements: [
                          ...ruling.placements,
                          manualPlacement(c.corps.find((f) => f.id === id)!),
                        ],
                      };
                  useCampaigns.setState({
                    waterlooDraft: { ...draft, targetCorpsId: id, input },
                  });
                }}
              >
                <option value="" disabled>
                  Choose a formation
                </option>
                {c.corps
                  .filter((f) => f.kind !== 'detachment')
                  .map((f) => (
                    <option value={f.id} key={f.id}>
                      {f.name} · {f.side} · {f.status}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              Select a formation above, then click its destination on the map.
              Add further formations to resolve swaps or several moves in one
              ruling.
            </p>
            {ruling.placements.map((p) => {
              const f = c.corps.find((f) => f.id === p.corpsId)!;
              const update = (patch: Partial<typeof p>) =>
                edit({
                  ...ruling,
                  placements: ruling.placements.map((row) =>
                    row.corpsId === p.corpsId ? { ...row, ...patch } : row,
                  ),
                });
              const link = c.fontenoy!.formations.find(
                (link) => link.corpsId === f.id,
              )!;
              return (
                <fieldset key={f.id}>
                  <legend>{f.name}</legend>
                  <div className="form-grid">
                    <label>
                      Position for {f.name}
                      <select
                        value={p.hexId ?? ''}
                        onChange={(e) =>
                          update({
                            hexId: e.target.value || null,
                            status: e.target.value ? 'ready' : 'blown',
                          })
                        }
                      >
                        <option value="">Off map</option>
                        {c.hexes.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.id}
                            {h.name && ` · ${h.name}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status for {f.name}
                      <select
                        value={p.status}
                        onChange={(e) =>
                          update({
                            status: e.target.value as typeof p.status,
                            hexId:
                              e.target.value === 'ready'
                                ? (p.hexId ?? f.hexId ?? c.hexes[0]!.id)
                                : null,
                          })
                        }
                      >
                        <option value="ready">On map / ready</option>
                        <option value="blown">Off map / unavailable</option>
                        <option value="eliminated">
                          Eliminated (all units lost)
                        </option>
                      </select>
                    </label>
                    <label>
                      Posture for {f.name}
                      <select
                        value={p.formation}
                        onChange={(e) =>
                          update({
                            formation: e.target.value as typeof p.formation,
                          })
                        }
                      >
                        {(f.kind === 'cavalry'
                          ? ['fresh', 'exhausted']
                          : ['advance', 'battle']
                        ).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reported strength for {f.name}
                      <input
                        value={p.reportedStrength}
                        maxLength={200}
                        placeholder="e.g. approximately 2,000 men"
                        onChange={(e) =>
                          update({ reportedStrength: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <details>
                    <summary>Unit availability · {f.name}</summary>
                    <p>
                      Record individual units ready or lost. Scheduled
                      recoveries use their existing return workflow. Qualities
                      and historical identities are preserved.
                    </p>
                    {c
                      .fontenoy!.units.filter((u) =>
                        link.unitIds.includes(u.id),
                      )
                      .map((u) => (
                        <label key={u.id}>
                          Availability for {u.displayName}
                          <select
                            disabled={u.currentStatus === 'recovering'}
                            value={
                              ruling.units.find((row) => row.unitId === u.id)
                                ?.status ?? u.currentStatus
                            }
                            onChange={(e) =>
                              edit({
                                ...ruling,
                                units: [
                                  ...ruling.units.filter(
                                    (row) => row.unitId !== u.id,
                                  ),
                                  ...(e.target.value === u.currentStatus
                                    ? []
                                    : [
                                        {
                                          unitId: u.id,
                                          status: e.target.value as
                                            'ready' | 'lost',
                                        },
                                      ]),
                                ],
                              })
                            }
                          >
                            <option value="ready">Ready</option>
                            <option value="lost">Lost / unavailable</option>
                            {u.currentStatus === 'recovering' && (
                              <option value="recovering">
                                Scheduled recovery
                              </option>
                            )}
                          </select>
                        </label>
                      ))}
                  </details>
                </fieldset>
              );
            })}
            <details>
              <summary>Headquarters positions</summary>
              {c.hqs.map((hq) => (
                <label key={hq.id}>
                  Position for {hq.name}
                  <select
                    value={
                      ruling.hqs.find((h) => h.hqId === hq.id)?.hexId ??
                      hq.hexId
                    }
                    onChange={(e) =>
                      edit({
                        ...ruling,
                        hqs: [
                          ...ruling.hqs.filter((h) => h.hqId !== hq.id),
                          ...(e.target.value === hq.hexId
                            ? []
                            : [{ hqId: hq.id, hexId: e.target.value }]),
                        ],
                      })
                    }
                  >
                    {c.hexes.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.id}
                        {h.name && ` · ${h.name}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </details>
            <div className="form-grid">
              <label>
                Elapsed minutes
                <input
                  type="number"
                  step={5}
                  min={0}
                  max={Math.max(0, manualPhaseEnd(c.turn) - c.cursor)}
                  disabled={c.phase !== 'planning' || ruling.finishPhase}
                  value={ruling.endAt - c.cursor}
                  onChange={(e) =>
                    edit({
                      ...ruling,
                      endAt: c.cursor + Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={ruling.finishPhase}
                  disabled={c.phase !== 'planning'}
                  onChange={(e) =>
                    edit({
                      ...ruling,
                      finishPhase: e.target.checked,
                      endAt: e.target.checked
                        ? manualPhaseEnd(c.turn)
                        : c.cursor,
                    })
                  }
                />
                Finish movement manually at phase end
              </label>
            </div>
            <label>
              Umpire ruling and rationale
              <textarea
                required
                maxLength={4000}
                value={ruling.decision}
                onChange={(e) => edit({ ...ruling, decision: e.target.value })}
              />
            </label>
            <section className="panel" aria-label="Manual ruling preview">
              <h3>Review changes</h3>
              <ul>
                {ruling.placements.map((p) => {
                  const f = c.corps.find((f) => f.id === p.corpsId)!;
                  return (
                    <li key={p.corpsId}>
                      {f.name}: {f.hexId ?? 'off map'} → {p.hexId ?? 'off map'};{' '}
                      {f.status} → {p.status}; {f.formation} → {p.formation};
                      reported strength {f.reportedStrength || 'unspecified'} →{' '}
                      {p.reportedStrength || 'unspecified'}. A changed
                      position/status cancels the formation’s scheduled return.
                    </li>
                  );
                })}
                {ruling.units.map((u) => (
                  <li key={u.unitId}>
                    {
                      c.fontenoy!.units.find((unit) => unit.id === u.unitId)!
                        .displayName
                    }
                    :{' '}
                    {
                      c.fontenoy!.units.find((unit) => unit.id === u.unitId)!
                        .currentStatus
                    }{' '}
                    → {u.status}
                  </li>
                ))}
                {ruling.hqs.map((h) => (
                  <li key={h.hqId}>
                    {c.hqs.find((hq) => hq.id === h.hqId)!.name}:{' '}
                    {c.hqs.find((hq) => hq.id === h.hqId)!.hexId} → {h.hexId}
                  </li>
                ))}
              </ul>
              <p>
                {campaignTime(c, c.cursor)} → {campaignTime(c, ruling.endAt)} ·{' '}
                {ruling.finishPhase
                  ? 'Checkpoint review follows.'
                  : 'Current phase retained.'}
              </p>
              <p>
                No combat, recovery, siege progress or victory is calculated by
                this ruling. Finish shared phase still applies any enabled
                recovery/siege policies and resets the next phase’s postures. An
                empty preparation is waived; submitted preparation must be
                resolved first.
              </p>
              {error && <p role="status">{error}</p>}
            </section>
            <div className="button-row">
              <button type="submit" disabled={!enabled || !!error}>
                Confirm manual ruling
              </button>
              <button type="button" onClick={() => void store.discard()}>
                Discard ruling draft
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <details>
        <summary>
          Manual ruling history · {c.adjudications?.length ?? 0}
        </summary>
        {[...(c.adjudications ?? [])].reverse().map((r) => (
          <details key={r.id}>
            <summary>
              Phase {r.turn} · {campaignTime(c, r.ruling.endAt)}
              {r.ruling.correctsId && ' · correction'}
            </summary>
            <p>{r.ruling.decision}</p>
            <p>
              Saved {r.timestamp} · {r.fromPhase} · {campaignTime(c, r.fromAt)}{' '}
              → {campaignTime(c, r.ruling.endAt)}
            </p>
            <ul>
              {r.after.map((p, i) => (
                <li key={p.corpsId}>
                  {name(p.corpsId)}: {r.before[i]!.hexId ?? 'off map'} /{' '}
                  {r.before[i]!.status} / {r.before[i]!.formation} /{' '}
                  {r.before[i]!.reportedStrength || 'unspecified strength'} →{' '}
                  {p.hexId ?? 'off map'} / {p.status} / {p.formation} /{' '}
                  {p.reportedStrength || 'unspecified strength'}
                </li>
              ))}
              {r.ruling.units.map((u, i) => (
                <li key={u.unitId}>
                  {
                    c.fontenoy!.units.find((unit) => unit.id === u.unitId)
                      ?.displayName
                  }
                  : {r.unitsBefore[i]!.status} → {u.status}
                </li>
              ))}
              {r.ruling.hqs.map((h, i) => (
                <li key={h.hqId}>
                  {c.hqs.find((hq) => hq.id === h.hqId)?.name}:{' '}
                  {r.hqsBefore[i]!.hexId} → {h.hexId}
                </li>
              ))}
            </ul>
            <button
              disabled={!enabled || !!store.waterlooDraft}
              onClick={() =>
                beginAdjudication(c, r.ruling.placements[0]?.corpsId, r.id)
              }
            >
              Record correction to this ruling
            </button>
          </details>
        ))}
      </details>
    </section>
  );
}
