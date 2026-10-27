import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import type { IntelligenceInput } from '../domain/simultaneous-intelligence-schema';
import {
  canRequestScouting,
  canReleaseIntelligence,
  intelligenceView,
  latestIntelligence,
} from '../domain/simultaneous-intelligence';
import { campaignTime } from '../domain/waterloo';
import { useCampaigns } from './campaign-store';
import { beginScouting } from './intelligence-session';

export function SimultaneousIntelligence({
  c,
  view,
  side,
}: {
  c: WaterlooCampaign;
  view: MapView;
  side: 'french' | 'allied';
}) {
  const store = useCampaigns();
  const requestDraft =
    store.waterlooDraft?.kind === 'scout-request' ? store.waterlooDraft : null;
  const reportDraft =
    store.waterlooDraft?.kind === 'intelligence-report'
      ? store.waterlooDraft
      : null;
  const busy =
    store.pending ||
    c.status === 'archived' ||
    !!c.fontenoy?.siege.campaign?.victory;
  const allowed = view === 'umpire' && canReleaseIntelligence(c) && !busy;
  const reports = latestIntelligence(c);
  const requests = (c.fontenoy?.intelligence?.requests ?? []).filter(
    (r) => view === 'umpire' || r.side === view,
  );
  const friendly = c.corps.filter(
    (f) => f.side === side && canRequestScouting(c, f),
  );
  const startReport = (requestId: string) => {
    const prior = reports.find((p) => p.requestId === requestId);
    useCampaigns.setState({
      waterlooDraft: {
        kind: 'intelligence-report',
        requestId,
        expectedVersion: prior?.version ?? 0,
        input: prior
          ? structuredClone(prior.input)
          : { level: 'none', notes: '' },
        reason: '',
      },
      error: null,
    });
  };
  const update = (input: IntelligenceInput) => {
    if (reportDraft)
      useCampaigns.setState({ waterlooDraft: { ...reportDraft, input } });
  };
  const hexOptions = c.hexes.map((h) => (
    <option key={h.id} value={h.id}>
      {h.id}
      {h.name ? ` · ${h.name}` : ''}
    </option>
  ));
  return (
    <details
      className="panel simultaneous-intelligence"
      data-helper="intelligence"
      open={requestDraft || reportDraft ? true : undefined}
    >
      <summary>Scouting & intelligence</summary>
      <p>
        Request reconnaissance around a hex, then ask the umpire to release a
        dated report. Eligibility, range, dice and card effects are agreed at
        the table: this is a provisional campaign worksheet, not an official
        Maurice scouting rule.
      </p>
      <p>
        Reports are observations, not live tracking. Unanswered requests do not
        prevent locking orders or finishing the phase.
      </p>
      <button
        disabled={busy || !!store.waterlooDraft || !friendly.length}
        onClick={() => beginScouting(c, friendly[0]!.id)}
      >
        Request scouting
      </button>
      {requestDraft && (
        <form
          aria-label="Scouting request"
          onSubmit={(e) => {
            e.preventDefault();
            void store.commitWaterloo({
              kind: 'maurice-scout-request',
              input: requestDraft.input,
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Request reconnaissance</legend>
            <label>
              Scouting formation
              <select
                value={requestDraft.input.corpsId}
                onChange={(e) =>
                  useCampaigns.setState({
                    waterlooDraft: {
                      ...requestDraft,
                      input: { ...requestDraft.input, corpsId: e.target.value },
                    },
                  })
                }
              >
                {friendly.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Area to scout
              <select
                value={requestDraft.input.hexId}
                onChange={(e) =>
                  useCampaigns.setState({
                    waterlooDraft: {
                      ...requestDraft,
                      input: { ...requestDraft.input, hexId: e.target.value },
                    },
                  })
                }
              >
                {hexOptions}
              </select>
            </label>
            <p>
              Or click a hex on the map. Hidden enemy forces are never offered
              as targets.
            </p>
            <label>
              Scouting question
              <textarea
                required
                maxLength={4000}
                value={requestDraft.input.question}
                onChange={(e) =>
                  useCampaigns.setState({
                    waterlooDraft: {
                      ...requestDraft,
                      input: {
                        ...requestDraft.input,
                        question: e.target.value,
                      },
                    },
                  })
                }
              />
            </label>
            <div className="button-row">
              <button type="submit">Confirm scouting request</button>
              <button type="button" onClick={() => void store.discard()}>
                Discard scouting draft
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {view === 'umpire' && reportDraft && (
        <form
          aria-label="Intelligence report"
          onSubmit={(e) => {
            e.preventDefault();
            void store.commitWaterloo({
              kind: 'maurice-intelligence-report',
              requestId: reportDraft.requestId,
              expectedVersion: reportDraft.expectedVersion,
              input: reportDraft.input,
              reason: reportDraft.reason,
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>
              {reportDraft.expectedVersion
                ? 'Correct or withdraw report'
                : 'Release intelligence'}
            </legend>
            <p>
              Enter only information approved for the requesting player. Labels
              and details are frozen as entered; no live enemy roster is copied.
              “No information” also withdraws an earlier map marker.
            </p>
            <label>
              Released intelligence
              <select
                value={reportDraft.input.level}
                onChange={(e) => {
                  const level = e.target.value as IntelligenceInput['level'];
                  const prior = reportDraft.input,
                    request = requests.find(
                      (r) => r.id === reportDraft.requestId,
                    )!;
                  update(
                    level === 'none'
                      ? { level, notes: prior.notes }
                      : ({
                          level,
                          hexId:
                            prior.level === 'none'
                              ? request.input.hexId
                              : prior.hexId,
                          expiresAfterTurn:
                            prior.level === 'none'
                              ? c.turn
                              : prior.expiresAfterTurn,
                          notes: prior.notes,
                          ...(level === 'located'
                            ? {}
                            : { label: 'Enemy report', details: '' }),
                        } as IntelligenceInput),
                  );
                }}
              >
                <option value="none">No information / withdraw report</option>
                <option value="located">Located · position only</option>
                <option value="estimated">Estimated · agreed estimate</option>
                <option value="identified">Identified · agreed details</option>
              </select>
            </label>
            {reportDraft.input.level !== 'none' && (
              <>
                <label>
                  Observed hex
                  <select
                    value={reportDraft.input.hexId}
                    onChange={(e) =>
                      update({
                        ...reportDraft.input,
                        hexId: e.target.value,
                      } as IntelligenceInput)
                    }
                  >
                    {hexOptions}
                  </select>
                </label>
                <label>
                  Valid through phase
                  <input
                    type="number"
                    required
                    min={
                      reports.find((p) => p.requestId === reportDraft.requestId)
                        ?.observedTurn ?? c.turn
                    }
                    max={100}
                    value={reportDraft.input.expiresAfterTurn}
                    onChange={(e) =>
                      update({
                        ...reportDraft.input,
                        expiresAfterTurn: Number(e.target.value),
                      } as IntelligenceInput)
                    }
                  />
                </label>
                {reportDraft.input.level !== 'located' && (
                  <>
                    <label>
                      Released label
                      <input
                        required
                        maxLength={160}
                        value={reportDraft.input.label}
                        onChange={(e) =>
                          update({
                            ...reportDraft.input,
                            label: e.target.value,
                          } as IntelligenceInput)
                        }
                      />
                    </label>
                    <label>
                      Released details
                      <textarea
                        required
                        maxLength={4000}
                        value={reportDraft.input.details}
                        onChange={(e) =>
                          update({
                            ...reportDraft.input,
                            details: e.target.value,
                          } as IntelligenceInput)
                        }
                      />
                    </label>
                  </>
                )}
              </>
            )}
            <label>
              Message to player
              <textarea
                required
                maxLength={4000}
                value={reportDraft.input.notes}
                onChange={(e) =>
                  update({ ...reportDraft.input, notes: e.target.value })
                }
              />
            </label>
            <label>
              Private umpire rationale
              <textarea
                required
                maxLength={4000}
                value={reportDraft.reason}
                onChange={(e) =>
                  useCampaigns.setState({
                    waterlooDraft: { ...reportDraft, reason: e.target.value },
                  })
                }
              />
            </label>
            <div className="button-row">
              <button type="submit">Confirm intelligence report</button>
              <button type="button" onClick={() => void store.discard()}>
                Discard report draft
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!requests.length && <p>No scouting requests in this view.</p>}
      {(view === 'umpire' ? (['french', 'allied'] as const) : [view]).flatMap(
        (s) =>
          intelligenceView(c, s)
            .slice()
            .reverse()
            .map((item) => {
              const r = requests.find((r) => r.id === item.requestId)!,
                observation = item.observation;
              return (
                <article
                  className="intelligence-card"
                  key={item.requestId}
                  aria-label={`${s === 'french' ? 'French' : 'Allied'} scouting request`}
                >
                  <h3>
                    {c.corps.find((f) => f.id === item.corpsId)?.name} · phase{' '}
                    {item.requestedTurn}
                  </h3>
                  <p>
                    Requested area: {item.areaHexId} · {item.question}
                  </p>
                  <p>
                    Status: {item.status}
                    {item.version ? ` · report version ${item.version}` : ''}
                  </p>
                  {item.observedAt !== null && (
                    <p>
                      Observed {campaignTime(c, item.observedAt)} · phase{' '}
                      {item.observedTurn}. Snapshot only.
                    </p>
                  )}
                  {observation && (
                    <>
                      <p>{observation.notes}</p>
                      {observation.level !== 'none' && (
                        <>
                          <p>
                            Last observed: {observation.hexId} · valid through
                            phase {observation.expiresAfterTurn} ·{' '}
                            {observation.level}
                          </p>
                          {observation.level !== 'located' && (
                            <>
                              <h4>{observation.label}</h4>
                              <p>{observation.details}</p>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {item.status === 'expired' && (
                    <p>
                      Expired observation withheld from the map and player
                      report.
                    </p>
                  )}
                  {item.status === 'unanswered' && (
                    <p>Closed without a report when the phase ended.</p>
                  )}
                  {view === 'umpire' && (
                    <>
                      <button
                        disabled={
                          !allowed ||
                          !!store.waterlooDraft ||
                          (r.turn !== c.turn && !item.version)
                        }
                        onClick={() => startReport(item.requestId)}
                      >
                        {item.version
                          ? 'Correct / withdraw report'
                          : 'Review scouting request'}
                      </button>
                      {!!item.version && (
                        <details>
                          <summary>Private report history</summary>
                          {c
                            .fontenoy!.intelligence!.reports.filter(
                              (p) => p.requestId === item.requestId,
                            )
                            .map((p) => (
                              <div key={p.id}>
                                <p>
                                  Version {p.version} · {p.input.level} ·{' '}
                                  {campaignTime(c, p.at)}
                                </p>
                                <p>
                                  {p.input.level !== 'none'
                                    ? `Observed ${p.input.hexId} · valid through phase ${p.input.expiresAfterTurn}`
                                    : 'No information released'}
                                </p>
                                {(p.input.level === 'estimated' ||
                                  p.input.level === 'identified') && (
                                  <p>
                                    {p.input.label} · {p.input.details}
                                  </p>
                                )}
                                <p>{p.input.notes}</p>
                                <p>Rationale: {p.reason}</p>
                              </div>
                            ))}
                        </details>
                      )}
                    </>
                  )}
                </article>
              );
            }),
      )}
      <p>
        Faction views contain only their own requests and current released
        observations. Campaign JSON backups and the full journal are umpire
        documents.
      </p>
    </details>
  );
}
