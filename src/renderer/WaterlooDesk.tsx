import { DeskDrawer } from './DeskDrawer';
import { SavedMovementRoutes } from './SavedMovementRoutes';
import {
  HistoricalProfileReview,
  HistoricalUnitIdentity,
} from './HistoricalProfileReview';
import {
  historicalComplement,
  historicalOrganization,
} from '../domain/historical-profile';
import { ManualAdjudication } from './ManualAdjudication';
import {
  beginAdjudication,
  chooseAdjudicationHex,
} from './manual-adjudication-session';
import { canAdjudicate } from '../domain/manual-adjudication';
import { HistoricalOob } from './HistoricalOob';
import { historicalFormationSize } from '../domain/historical-grouping';
import { SimultaneousEpic } from './SimultaneousEpic';
import { SimultaneousIntelligence } from './SimultaneousIntelligence';
import { beginScouting } from './intelligence-session';
import {
  canRequestScouting,
  intelligenceView,
} from '../domain/simultaneous-intelligence';
import { ReaderDialog } from './ReaderDialog';
import { SimultaneousCommanders } from './SimultaneousCommanders';
import { SimultaneousSiegePanel } from './SimultaneousSiege';
import { useCallback, useEffect, useState } from 'react';
import type {
  WaterlooBattle,
  WaterlooCampaign,
  WaterlooCorps,
  WaterlooOrder,
  WaterlooResult,
} from '../domain/waterloo-schema';
import {
  campaignTime,
  estimateReinforcement,
  hexDistance,
  phaseEnd,
  phaseStart,
  travelMinutes,
  validateOrders,
  firstMovementAt,
  inZone,
} from '../domain/waterloo';
import { preparationIsMutable } from '../domain/waterloo-preparation';
import { WaterlooPreparation } from './WaterlooPreparation';
import { useCampaigns } from './campaign-store';
import { useOperationalSession } from './operational-session';
import fontenoyBackdrop from '../../assets/maps/fontenoy-1745-operational-backdrop-v1.png';
import {
  SimultaneousRecoveryPanel,
  MauriceUnitResultFields,
  MauriceResultRecord,
} from './SimultaneousRecovery';
import { mauriceResultDraft } from '../domain/simultaneous-aftermath';

export function WaterlooDesk({ campaign: c }: { campaign: WaterlooCampaign }) {
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [formationSearch, setFormationSearch] = useState('');
  const [formationMenu, setFormationMenu] = useState<string | null>(null);
  const [reportSelection, setReportSelection] = useState<string | null>(null);
  const [inspectionRequest, setInspectionRequest] = useState(0);
  const [turnRequest, setTurnRequest] = useState(0);
  const state = useCampaigns();
  const { view, setView } = useOperationalSession();
  const [planningSide, setPlanningSide] = useState<'french' | 'allied'>(() => {
    const draft = useCampaigns.getState().waterlooDraft;
    const id =
      draft &&
      ('corpsId' in draft
        ? draft.corpsId
        : draft.kind === 'scout-request'
          ? draft.input.corpsId
          : null);
    return c.corps.find((f) => f.id === id)?.side ?? 'french';
  });
  // Mirror the visible choice for guidance; opening a desk keeps its original defaults.
  useEffect(
    () => useOperationalSession.getState().setPlanningSide(planningSide),
    [planningSide],
  );
  const [selected, setSelected] = useState(() => {
    const draft = useCampaigns.getState().waterlooDraft;
    return (
      (draft &&
        ('corpsId' in draft
          ? draft.corpsId
          : draft.kind === 'scout-request'
            ? draft.input.corpsId
            : c.corps[0]!.id)) ||
      c.corps[0]!.id
    );
  });
  const inspectHistorical = useCallback((corpsId: string, name: string) => {
    setSelected(corpsId);
    setFormationSearch(name);
    setInspectionRequest((n) => n + 1);
  }, []);
  const [overlay, setOverlay] = useState<
    'none' | 'control' | 'influence' | 'command'
  >('none');
  const [overlayHqId, setOverlayHqId] = useState(c.hqs[0]!.id);
  const side = view === 'umpire' ? planningSide : view;
  const alliedLabel = c.fontenoy ? 'Allied' : 'Coalition';
  const submission = c.submissions.find((s) => s.side === side)!;
  const draft =
    state.waterlooDraft?.kind === 'route' ? state.waterlooDraft : null;
  const visibleDraft =
    draft &&
    (view === 'umpire' ||
      c.corps.find((f) => f.id === draft.corpsId)?.side === view)
      ? draft
      : null;
  const busy =
    state.pending ||
    (!!c.fontenoy?.historicalProfile &&
      !c.fontenoy.historicalProfile.reviewedAt) ||
    c.status === 'archived' ||
    !!c.fontenoy?.siege.campaign?.victory;
  const editing =
    ['planning', 'locked'].includes(c.phase) &&
    !submission.locked &&
    !busy &&
    (!c.preparation || c.preparation.resolved);
  const setDraft = (value: typeof state.waterlooDraft) =>
    useCampaigns.setState({ waterlooDraft: value, error: null });
  const force = c.corps.find(
    (f) =>
      f.id === selected &&
      (!c.fontenoy || view === 'umpire' || f.side === view),
  );
  const menuForce = c.corps.find(
    (f) => f.id === formationMenu && (view === 'umpire' || f.side === view),
  );
  const reportMarkers =
    view === 'umpire'
      ? []
      : intelligenceView(c, view).filter(
          (r) => r.observation && r.observation.level !== 'none',
        );
  const selectedReport = reportMarkers.find(
    (r) => r.requestId === reportSelection,
  );
  const visible = (f: WaterlooCorps) => view === 'umpire' || f.side === view;
  const at = (id: string) => {
    const h = c.hexes.find((h) => h.id === id)!;
    return { x: 45 + h.q * 52 + h.r * 26, y: 40 + h.r * 45 };
  };
  const commit = (command: Parameters<typeof state.commitWaterloo>[0]) => {
    void state.commitWaterloo(command);
  };
  const selectScoutArea = (hexId: string) => {
    if (state.waterlooDraft?.kind !== 'scout-request') return false;
    setDraft({
      ...state.waterlooDraft,
      input: { ...state.waterlooDraft.input, hexId },
    });
    return true;
  };
  function beginRoute(f: WaterlooCorps) {
    if (f.hexId && view === 'umpire' && chooseAdjudicationHex(f.hexId)) return;
    if (f.hexId && selectScoutArea(f.hexId)) return;
    setSelected(f.id);
    setFormationSearch('');
    if (
      !editing ||
      f.side !== side ||
      f.status !== 'ready' ||
      f.kind === 'detachment' ||
      c.preparation?.withdrawnCorpsIds.includes(f.id) ||
      state.waterlooDraft
    )
      return;
    const prior = submission.orders.find((o) => o.corpsId === f.id);
    const last = prior?.segments.at(-1);
    let startAt = firstMovementAt(c);
    if (last) {
      startAt = Math.max(startAt, last.startAt);
      for (let i = 1; i < last.path.length; i++)
        startAt += travelMinutes(
          c,
          f,
          last.path[i - 1]!,
          last.path[i]!,
          last.roadOnly,
        );
    }
    setDraft({
      kind: 'route',
      corpsId: f.id,
      path: [last?.path.at(-1) ?? f.hexId!],
      roadOnly: !c.fontenoy,
      startAt,
      hqId: c.hqs.find((h) => h.army === f.army)!.id,
    });
  }
  function saveSegment() {
    if (!draft) return;
    const prior = submission.orders.find((o) => o.corpsId === draft.corpsId);
    const orders: WaterlooOrder[] = [
      ...submission.orders.filter((o) => o.corpsId !== draft.corpsId),
      {
        corpsId: draft.corpsId,
        priority:
          prior?.priority ?? c.corps.findIndex((f) => f.id === draft.corpsId),
        segments: [
          ...(prior?.segments ?? []),
          {
            path: draft.path,
            roadOnly: draft.roadOnly,
            startAt: draft.startAt,
            hqId: draft.hqId,
          },
        ],
      },
    ];
    try {
      validateOrders(c, side, orders);
      commit({ kind: 'orders', side, orders, lock: false });
    } catch (error) {
      useCampaigns.setState({
        error: error instanceof Error ? error.message : 'Invalid route.',
      });
    }
  }
  return (
    <div className="waterloo-desk">
      <section
        className="panel desk-turnbar"
        aria-label="Simultaneous campaign controls"
      >
        <div className="section-heading">
          <h2>{c.title}</h2>
          <span className="badge">
            {c.phase} · phase {c.turn} · {c.turn % 2 ? 'AM' : 'PM'}
          </span>
        </div>
        {state.error && (
          <p role="alert" className="campaign-error">
            {state.error}
          </p>
        )}
        {state.message && <p role="status">{state.message}</p>}
        <div className="form-grid">
          <label>
            Map view
            <select
              data-helper="view"
              value={view}
              disabled={!!state.waterlooDraft || state.pending}
              onChange={(e) => setView(e.target.value as typeof view)}
            >
              <option value="umpire">Umpire</option>
              <option value="french">French</option>
              <option value="allied">{alliedLabel}</option>
            </select>
          </label>
          {view === 'umpire' && (
            <label>
              Planning side
              <select
                data-helper="planning-side"
                value={planningSide}
                disabled={!!state.waterlooDraft || state.pending}
                onChange={(e) =>
                  setPlanningSide(e.target.value as typeof planningSide)
                }
              >
                <option value="french">French</option>
                <option value="allied">{alliedLabel}</option>
              </select>
            </label>
          )}
        </div>
        <p aria-label="Submission readiness">
          French:{' '}
          {c.submissions.find((s) => s.side === 'french')!.locked
            ? 'locked'
            : 'planning'}{' '}
          · {alliedLabel}:{' '}
          {c.submissions.find((s) => s.side === 'allied')!.locked
            ? 'locked'
            : 'planning'}
        </p>
        <div className="button-row">
          {((c.preparation && !c.preparation.resolved) ||
            c.phase === 'adjudication') && (
            <button onClick={() => setTurnRequest((n) => n + 1)}>
              Review{' '}
              {c.preparation && !c.preparation.resolved
                ? 'preparation'
                : 'contacts & battles'}
            </button>
          )}
          <button
            data-helper="lock"
            hidden={
              !['planning', 'locked'].includes(c.phase) ||
              (!!c.preparation && !c.preparation.resolved)
            }
            disabled={!editing || !!state.waterlooDraft}
            onClick={() =>
              commit({
                kind: 'orders',
                side,
                orders: submission.orders,
                lock: true,
              })
            }
          >
            Lock {side === 'french' ? 'French' : alliedLabel} orders
          </button>
          {view === 'umpire' && (
            <>
              <button
                disabled={
                  busy ||
                  !!state.waterlooDraft ||
                  !c.submissions.every((s) => s.locked) ||
                  c.phase === 'checkpoint'
                }
                data-helper="resolve"
                hidden={
                  !['locked', 'resolving', 'adjudication'].includes(c.phase)
                }
                onClick={() => commit({ kind: 'resolve' })}
              >
                Resolve simultaneous movement
              </button>
              <button
                disabled={
                  busy ||
                  !!state.waterlooDraft ||
                  c.phase !== 'checkpoint' ||
                  (!!c.fontenoy?.siege.campaign &&
                    !c.fontenoy.siege.campaign.pendingReview)
                }
                data-helper="finalize"
                hidden={c.phase !== 'checkpoint'}
                onClick={() => commit({ kind: 'finalize' })}
              >
                Finish shared phase
              </button>
            </>
          )}
        </div>
      </section>
      {menuForce && (
        <ReaderDialog
          title={`Formation actions · ${menuForce.name}`}
          onDismiss={() => setFormationMenu(null)}
        >
          <div role="menu" aria-label="Formation actions">
            <button
              role="menuitem"
              onClick={() => {
                setSelected(menuForce.id);
                setFormationSearch('');
                setFormationMenu(null);
                setInspectionRequest((n) => n + 1);
              }}
            >
              Inspect formation
            </button>
            {view === 'umpire' &&
              c.fontenoy &&
              menuForce.kind !== 'detachment' && (
                <button
                  role="menuitem"
                  disabled={!!state.waterlooDraft || busy || !canAdjudicate(c)}
                  onClick={() => {
                    setFormationMenu(null);
                    beginAdjudication(c, menuForce.id);
                  }}
                >
                  Adjudicate manually…
                </button>
              )}
            <button
              role="menuitem"
              disabled={
                !editing ||
                !!state.waterlooDraft ||
                menuForce.side !== side ||
                menuForce.status !== 'ready' ||
                menuForce.kind === 'detachment' ||
                c.preparation?.withdrawnCorpsIds.includes(menuForce.id)
              }
              onClick={() => {
                setFormationMenu(null);
                beginRoute(menuForce);
              }}
            >
              Move on map
            </button>
            <button
              role="menuitem"
              disabled={
                busy ||
                !!state.waterlooDraft ||
                menuForce.side !== side ||
                !canRequestScouting(c, menuForce)
              }
              onClick={() => {
                setFormationMenu(null);
                beginScouting(c, menuForce.id);
              }}
            >
              Scout an area…
            </button>
          </div>
        </ReaderDialog>
      )}
      {selectedReport?.observation && (
        <ReaderDialog
          title="Dated intelligence"
          onDismiss={() => setReportSelection(null)}
        >
          <p>
            Observed phase {selectedReport.observedTurn} ·{' '}
            {campaignTime(c, selectedReport.observedAt!)}. This is a snapshot,
            not live tracking.
          </p>
          {selectedReport.observation.level !== 'none' && (
            <>
              <p>
                Last observed {selectedReport.observation.hexId} · valid through
                phase {selectedReport.observation.expiresAfterTurn} ·{' '}
                {selectedReport.observation.level}
              </p>
              {selectedReport.observation.level !== 'located' && (
                <>
                  <h3>{selectedReport.observation.label}</h3>
                  <p>{selectedReport.observation.details}</p>
                </>
              )}
            </>
          )}
          <p>{selectedReport.observation.notes}</p>
        </ReaderDialog>
      )}
      <div className="desk-tools" aria-label="Campaign drawers">
        <DeskDrawer title="Orders" edge="bottom" openWhen={!!draft}>
          {draft && (
            <div
              className="campaign-editor"
              data-helper="route"
              aria-label="Hex route draft"
            >
              <h3>
                Route for {c.corps.find((f) => f.id === draft.corpsId)!.name}
              </h3>
              <p>{draft.path.join(' → ')}</p>
              <details className="route-options">
                <summary>Route options</summary>{' '}
                <div className="form-grid">
                  <label>
                    Travel mode
                    <select
                      value={draft.roadOnly ? 'road' : 'mixed'}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          roadOnly: e.target.value === 'road',
                        })
                      }
                    >
                      <option value="road">Connected roads only</option>
                      <option value="mixed">Off-road / mixed</option>
                    </select>
                  </label>
                  <label>
                    Departure (minutes after phase opening)
                    <input
                      type="number"
                      min={0}
                      max={355}
                      step={5}
                      value={draft.startAt - phaseStart(c.turn)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          startAt: phaseStart(c.turn) + Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Command HQ
                    <select
                      value={draft.hqId}
                      onChange={(e) =>
                        setDraft({ ...draft, hqId: e.target.value })
                      }
                    >
                      {c.hqs
                        .filter(
                          (h) =>
                            h.army ===
                            c.corps.find((f) => f.id === draft.corpsId)!.army,
                        )
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} · {h.mode}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </details>
              <div className="button-row">
                <button
                  disabled={busy || draft.path.length < 2}
                  onClick={saveSegment}
                >
                  Save movement segment
                </button>
                <button
                  className="secondary"
                  disabled={busy || draft.path.length < 2}
                  onClick={() =>
                    setDraft({ ...draft, path: draft.path.slice(0, -1) })
                  }
                >
                  Undo route step
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Cancel route
                </button>
              </div>
            </div>
          )}
          {!draft && (
            <>
              {' '}
              <h3 data-helper="orders" tabIndex={-1}>
                {side === 'french' ? 'French' : alliedLabel} saved orders
              </h3>
              {!submission.orders.length && (
                <p>No movement orders. Unordered corps hold.</p>
              )}
              <ul>
                {submission.orders.map((o) => (
                  <li key={o.corpsId}>
                    <strong>
                      {c.corps.find((f) => f.id === o.corpsId)!.name}
                    </strong>
                    {c.fontenoy?.historicalProfile && (
                      <details>
                        <summary>
                          Historical roster assigned to this order
                        </summary>
                        <ul>
                          {c.fontenoy.units
                            .filter((u) =>
                              c
                                .fontenoy!.formations.find(
                                  (f) => f.corpsId === o.corpsId,
                                )!
                                .unitIds.includes(u.id),
                            )
                            .map((u) => (
                              <li key={u.id}>
                                {u.displayName} ·{' '}
                                {historicalComplement(
                                  u.historical!.organizationId,
                                )}{' '}
                                · {u.currentStatus}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                    :{' '}
                    {o.segments
                      .map(
                        (s) =>
                          `${s.path.join(' → ')} (${s.roadOnly ? 'road' : 'off-road'}, ${campaignTime(c, s.startAt).slice(-5)})`,
                      )
                      .join('; ')}{' '}
                    <form
                      key={`${o.corpsId}-${o.priority}`}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const priority = Number(
                          new FormData(e.currentTarget).get('priority'),
                        );
                        commit({
                          kind: 'orders',
                          side,
                          orders: submission.orders.map((p) =>
                            p.corpsId === o.corpsId ? { ...p, priority } : p,
                          ),
                          lock: false,
                        });
                      }}
                    >
                      <label>
                        Friendly route priority (lower first)
                        <input
                          name="priority"
                          type="number"
                          min={0}
                          max={1000}
                          required
                          defaultValue={o.priority}
                          disabled={!editing || !!state.waterlooDraft}
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={!editing || !!state.waterlooDraft}
                      >
                        Save priority
                      </button>
                    </form>
                    <button
                      className="secondary"
                      disabled={!editing || !!state.waterlooDraft}
                      onClick={() =>
                        commit({
                          kind: 'orders',
                          side,
                          orders: submission.orders.filter(
                            (p) => p.corpsId !== o.corpsId,
                          ),
                          lock: false,
                        })
                      }
                    >
                      Remove order
                    </button>
                  </li>
                ))}
              </ul>
              {view === 'umpire' && (
                <>
                  {' '}
                  <button
                    disabled={
                      busy ||
                      !!state.waterlooDraft ||
                      !['planning', 'locked'].includes(c.phase) ||
                      (!!c.preparation && !c.preparation.resolved)
                    }
                    data-helper="reopen"
                    onClick={() => commit({ kind: 'reset-orders' })}
                  >
                    Reopen both submissions
                  </button>
                </>
              )}
            </>
          )}
        </DeskDrawer>
        <DeskDrawer title="Formation" openWhen={inspectionRequest}>
          {' '}
          {force && (
            <div className="waterloo-inspection">
              <h3>{visible(force) ? force.name : 'Opposing corps'}</h3>
              {c.fontenoy && visible(force) && (
                <button
                  disabled={!!state.waterlooDraft}
                  onClick={() => setFormationMenu(force.id)}
                >
                  Formation actions
                </button>
              )}
              <p>
                {visible(force)
                  ? `${force.army.replaceAll('_', ' ')} · ${force.kind === 'detachment' ? 'stationary' : force.formation} · ${force.status} · ${force.hexId ?? 'off map'}`
                  : 'Composition and readiness withheld.'}
              </p>
              {visible(force) && (
                <p>
                  {c.fontenoy?.historicalProfile
                    ? 'Named historical organizations with reported complements. Select a regiment for its source hierarchy and evidence; tabletop ratings are scenario choices.'
                    : force.roster}
                </p>
              )}
              {c.fontenoy && !c.fontenoy.historicalProfile && (
                <details>
                  <summary>Where are the historical unit names?</summary>
                  <HistoricalProfileReview c={c} view={view} />
                </details>
              )}
              {visible(force) && force.reportedStrength && (
                <p>
                  Reported strength: {force.reportedStrength} · umpire-entered
                  estimate
                </p>
              )}
              {visible(force) && c.fontenoy && (
                <>
                  <p>
                    Commanders:{' '}
                    {c.fontenoy.commanders
                      .filter((commander) =>
                        c
                          .fontenoy!.formations.find(
                            (link) => link.corpsId === force.id,
                          )
                          ?.commanderIds.includes(commander.id),
                      )
                      .map((commander) => commander.displayName)
                      .join(', ') || 'None assigned'}
                  </p>
                  {c.fontenoy.historicalProfile && (
                    <label>
                      Find regiment in formation
                      <input
                        type="search"
                        value={formationSearch}
                        onChange={(e) => setFormationSearch(e.target.value)}
                      />
                    </label>
                  )}
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {c.fontenoy.historicalProfile
                            ? 'Historical organization'
                            : 'Maurice unit'}
                        </th>
                        <th>Type</th>
                        <th>Quality</th>
                        <th>
                          {c.fontenoy.historicalProfile
                            ? 'Service'
                            : 'Contingent'}
                        </th>
                        <th>Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.fontenoy.units
                        .filter((unit) =>
                          c
                            .fontenoy!.formations.find(
                              (link) => link.corpsId === force.id,
                            )
                            ?.unitIds.includes(unit.id),
                        )
                        .filter(
                          (unit) =>
                            !c.fontenoy?.historicalProfile ||
                            unit.displayName
                              .toLowerCase()
                              .includes(formationSearch.trim().toLowerCase()),
                        )
                        .map((unit) => (
                          <tr key={unit.id}>
                            <td>
                              {unit.historical ? (
                                <>
                                  <HistoricalUnitIdentity
                                    organizationId={
                                      unit.historical.organizationId
                                    }
                                  />
                                  <small>
                                    {historicalComplement(
                                      unit.historical.organizationId,
                                    )}
                                  </small>
                                </>
                              ) : (
                                unit.displayName
                              )}
                            </td>
                            <td>{unit.type.replaceAll('_', ' ')}</td>
                            <td>
                              {unit.quality ?? '—'}
                              {unit.historical && unit.quality && (
                                <small>
                                  {c.fontenoy?.historicalProfile?.reviewedAt
                                    ? ' · scenario rating'
                                    : ' · proposed rating'}
                                </small>
                              )}
                            </td>
                            <td>
                              {unit.historical
                                ? historicalOrganization(
                                    unit.historical.organizationId,
                                  )?.service
                                : unit.contingent.replaceAll('_', ' ')}
                            </td>
                            <td>{unit.currentStatus}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              )}
              {visible(force) &&
                c.preparation?.withdrawnCorpsIds.includes(force.id) && (
                  <p>Withdrawn this phase; holds until the next phase.</p>
                )}
              {visible(force) && force.detachment && (
                <p>
                  Stationary screen of{' '}
                  {
                    c.corps.find(
                      (f) => f.id === force.detachment!.parentCorpsId,
                    )?.name
                  }
                  . Use preparation to recall or deploy it; allocate its
                  tactical troops from the parent roster.
                </p>
              )}
            </div>
          )}
          {!force && (
            <p>Select a friendly formation on the map to inspect it.</p>
          )}
        </DeskDrawer>
        <DeskDrawer
          title="Intelligence"
          openWhen={
            state.waterlooDraft?.kind === 'scout-request' ||
            state.waterlooDraft?.kind === 'intelligence-report'
          }
        >
          {' '}
          {c.fontenoy && (
            <SimultaneousIntelligence c={c} view={view} side={side} />
          )}
        </DeskDrawer>
        <DeskDrawer
          title="Turn desk"
          openWhen={
            state.waterlooDraft?.kind === 'withdrawal' ||
            state.waterlooDraft?.kind === 'result' ||
            turnRequest
          }
        >
          {' '}
          <WaterlooPreparation campaign={c} side={side} view={view} />
          {view === 'umpire' ? (
            <>
              {' '}
              <section
                className="panel"
                data-helper="battles"
                aria-label="Pending encounters"
              >
                <h2>Contacts and battles</h2>
                {!c.encounters.some((e) => !e.settled) && (
                  <p>No outstanding contacts.</p>
                )}
                {c.encounters
                  .filter((e) => !e.settled && !e.battleId)
                  .map((e) => (
                    <article key={e.id}>
                      <h3>
                        Contact at {e.hexId} · {campaignTime(c, e.at)}
                      </h3>
                      <p>
                        {e.corpsIds
                          .map((id) => c.corps.find((f) => f.id === id)!.name)
                          .join(' / ')}
                      </p>
                      <p>{e.reason}</p>
                      <div className="button-row">
                        <button
                          disabled={busy || !!state.waterlooDraft}
                          onClick={() =>
                            commit({
                              kind: 'declare-battle',
                              encounterId: e.id,
                              title: `Battle at ${e.hexId}`,
                            })
                          }
                        >
                          Declare tactical battle
                        </button>
                        <button
                          disabled={busy || !!state.waterlooDraft}
                          className="secondary"
                          onClick={() =>
                            commit({ kind: 'stand-off', encounterId: e.id })
                          }
                        >
                          Record stand-off
                        </button>
                      </div>
                    </article>
                  ))}
                {c.battles.map((b) => (
                  <BattleCard key={b.id} campaign={c} battle={b} />
                ))}
              </section>
            </>
          ) : (
            <p>The umpire reviews contacts and tactical results.</p>
          )}
        </DeskDrawer>
        <DeskDrawer
          title="Campaign tools"
          openWhen={
            !!state.waterlooDraft &&
            [
              'officer',
              'epic',
              'recovery-policy',
              'siege-policy',
              'siege-review',
            ].includes(state.waterlooDraft.kind)
          }
        >
          {' '}
          {c.fontenoy && (
            <section className="panel" aria-label="Maurice Fontenoy campaign">
              <h2>Maurice · Fontenoy, 1745</h2>
              <p>
                {c.fontenoy.historicalProfile
                  ? `${c.fontenoy.units.length} historical roster records in ${c.fontenoy.formations.length} campaign formations. Regimental complements and scenario ratings remain distinct.`
                  : 'French 20 / Allied 18 · Dutch 7 / Anglo-Allied 11.'}{' '}
                Tactical play defaults to Maurice; results remain manual and may
                come from another agreed game.
              </p>
              <ul>
                {c.fontenoy.objectives.map((o) => (
                  <li key={o.side}>
                    {o.side === 'french' ? 'French' : 'Allied'}: {o.title} ·{' '}
                    {c.hexes.find((h) => h.id === o.hexId)?.name || o.hexId}
                  </li>
                ))}
              </ul>
              <p>
                Tournai siege: {c.fontenoy.siege.status.replaceAll('_', ' ')} ·
                recorded progress {c.fontenoy.siege.progress}. Review optional
                recovery and siege policies below. Tactical adjudication remains
                external.
              </p>
            </section>
          )}
          {c.fontenoy && <SimultaneousSiegePanel c={c} view={view} />}
          {c.fontenoy && <SimultaneousRecoveryPanel c={c} view={view} />}
          {c.fontenoy && <SimultaneousCommanders c={c} view={view} />}
          {c.fontenoy && <SimultaneousEpic c={c} view={view} />}
          {view === 'umpire' && (
            <>
              {' '}
              <details className="panel">
                <summary>Headquarters and due returns</summary>
                <p>
                  HQ markers express command intent. Place them before saving
                  orders, within three hexes of their army and outside enemy
                  control/influence. Normal mode has greater range; Battle mode
                  supplies briefing context.
                </p>
                {c.hqs.map((h) => (
                  <form
                    key={`${h.id}-${h.hexId}-${h.mode}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      commit({
                        kind: 'place-hqs',
                        placements: [
                          {
                            hqId: h.id,
                            hexId: String(form.get('hex')),
                            mode: form.get('mode') as 'normal' | 'battle',
                          },
                        ],
                      });
                    }}
                  >
                    <fieldset
                      disabled={
                        busy ||
                        !!state.waterlooDraft ||
                        c.phase !== 'planning' ||
                        !preparationIsMutable(c) ||
                        !!c.preparation?.deploymentHqIds.length ||
                        c.submissions.some((s) => s.locked || s.orders.length)
                      }
                    >
                      <legend>{h.name}</legend>
                      <div className="form-grid">
                        <label>
                          HQ hex
                          <select name="hex" defaultValue={h.hexId}>
                            {c.hexes
                              .filter((h) => h.terrain !== 'water')
                              .map((h) => (
                                <option key={h.id}>{h.id}</option>
                              ))}
                          </select>
                        </label>
                        <label>
                          HQ mode
                          <select name="mode" defaultValue={h.mode}>
                            <option value="normal">Normal</option>
                            <option value="battle">Battle</option>
                          </select>
                        </label>
                      </div>
                      <button>Place {h.name}</button>
                    </fieldset>
                  </form>
                ))}
                {(['french', 'allied'] as const).map((side) => {
                  const due = c.corps.filter(
                    (f) =>
                      f.side === side &&
                      f.status === 'blown' &&
                      f.returnSlot !== null &&
                      f.returnSlot <= c.turn,
                  );
                  return due.length ? (
                    <form
                      key={side}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const selected = due.filter(
                          (f) => form.get(`return-${f.id}`) === 'on',
                        );
                        commit({
                          kind: 'return-corps',
                          corpsIds: selected.map((f) => f.id),
                          hexIds: selected.map((f) =>
                            String(form.get(`hex-${f.id}`)),
                          ),
                        });
                      }}
                    >
                      <fieldset
                        disabled={
                          busy ||
                          !!state.waterlooDraft ||
                          c.phase !== 'planning' ||
                          !preparationIsMutable(c) ||
                          !!c.preparation?.deploymentHqIds.length ||
                          c.submissions.some((s) => s.locked || s.orders.length)
                        }
                      >
                        <legend>{side} due returns</legend>
                        <p>
                          The opponent selects up to two returning corps. If
                          more than two are due, choose two; the others are
                          eliminated. Leave a corps off-map when it has no legal
                          placement.
                        </p>
                        {due.map((f) => (
                          <div className="form-grid" key={f.id}>
                            <label>
                              <input name={`return-${f.id}`} type="checkbox" />
                              Return {f.name}
                            </label>
                            <label>
                              Return hex
                              <select name={`hex-${f.id}`}>
                                {c.hexes
                                  .filter((h) => h.terrain !== 'water')
                                  .map((h) => (
                                    <option key={h.id}>{h.id}</option>
                                  ))}
                              </select>
                            </label>
                          </div>
                        ))}
                        <button>Confirm reviewed returns</button>
                      </fieldset>
                    </form>
                  ) : null;
                })}
              </details>
              <details className="panel">
                <summary>Movement charts and phase settings</summary>
                <p>
                  Original adaptation: 120-minute segments, at most three per
                  corps. Advance infantry 30 minutes/hex off-road or 15 on
                  roads; fresh cavalry 20/10. Battle infantry 120; exhausted
                  cavalry 30/15. Woods ×2, rough ×1.5 off-road; bridge +15,
                  minor river +30. Major unbridged rivers are impassable.
                  Configure before saving orders
                  {c.preparation
                    ? ' and before detachment placement or withdrawal submissions'
                    : ''}
                  .
                </p>
                <form
                  key={`${c.id}-${c.charts.weather}-${c.charts.preparationMinutes}-${c.charts.tacticalTurnMinutes}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    commit({
                      kind: 'configure',
                      charts: {
                        ...c.charts,
                        weather: form.get('weather') as typeof c.charts.weather,
                        preparationMinutes: Number(form.get('preparation')),
                        battleMinutes: Number(form.get('duration')),
                        tacticalTurnMinutes: form.get('turn')
                          ? Number(form.get('turn'))
                          : null,
                      },
                    });
                  }}
                >
                  <fieldset
                    disabled={
                      busy ||
                      !!state.waterlooDraft ||
                      c.phase !== 'planning' ||
                      !preparationIsMutable(c) ||
                      !!c.preparation?.deploymentHqIds.length ||
                      c.submissions.some((s) => s.locked || s.orders.length)
                    }
                  >
                    <div className="form-grid">
                      <label>
                        Weather
                        <select name="weather" defaultValue={c.charts.weather}>
                          <option value="dry">Dry</option>
                          <option value="rain">Rain</option>
                          <option value="soft_ground">Soft ground</option>
                        </select>
                      </label>
                      <label>
                        Preparation minutes
                        <input
                          name="preparation"
                          type="number"
                          min={0}
                          max={120}
                          step={5}
                          defaultValue={c.charts.preparationMinutes}
                        />
                      </label>
                      <label>
                        Expected battle minutes
                        <input
                          name="duration"
                          type="number"
                          min={30}
                          max={720}
                          step={5}
                          defaultValue={c.charts.battleMinutes}
                        />
                      </label>
                      <label>
                        Minutes per tactical turn (optional)
                        <input
                          name="turn"
                          type="number"
                          min={1}
                          max={120}
                          defaultValue={c.charts.tacticalTurnMinutes ?? ''}
                        />
                      </label>
                    </div>
                    <button>Save phase charts</button>
                  </fieldset>
                </form>
              </details>
              <details className="panel">
                <summary>Resolution record</summary>
                <ol>
                  {c.log.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </DeskDrawer>
        {c.fontenoy && view === 'umpire' && (
          <DeskDrawer
            title="Adjudication"
            edge="bottom"
            openWhen={state.waterlooDraft?.kind === 'adjudication'}
          >
            <ManualAdjudication c={c} />
          </DeskDrawer>
        )}
        {c.fontenoy && (
          <DeskDrawer
            title="Historical OOB"
            openWhen={
              !!c.fontenoy.historicalProfile &&
              !c.fontenoy.historicalProfile.reviewedAt
            }
          >
            <HistoricalProfileReview c={c} view={view} />
            <HistoricalOob
              view={view}
              campaign={c}
              onInspect={inspectHistorical}
            />
          </DeskDrawer>
        )}
        <DeskDrawer title="Map options">
          {' '}
          <p>
            {campaignTime(c, c.cursor)} · weather:{' '}
            {c.charts.weather.replaceAll('_', ' ')} · phase closes{' '}
            {campaignTime(c, phaseEnd(c.turn))}
          </p>
          <div className="section-heading">
            <h2>{c.fontenoy?.title ?? 'Operational reference map'}</h2>
            <span>
              {c.fontenoy
                ? `Schematic Fontenoy geography · ${c.fontenoy.kilometresPerHex === null ? 'scale not yet agreed' : `${c.fontenoy.kilometresPerHex} km per hex`}`
                : 'Original reference scenario · 1 mile per hex'}
            </span>
          </div>
          <p>
            Select a friendly corps, then adjacent hexes to prepare its route.
            Road travel requires connected road edges. Opposing rosters and
            orders are withheld in side views.
          </p>
          {c.fontenoy && view !== 'umpire' && (
            <p>
              Friendly counters show current positions. Dashed ? diamonds are
              dated observations; open one to inspect it. Undiscovered and
              expired enemy positions are withheld.
            </p>
          )}
          {c.fontenoy && showBackdrop && (
            <p className="fontenoy-map-art-note">
              Decorative evocation of Flanders, 1745. Illustrated terrain and
              lanes do not define movement; hex data and configured roads do.
            </p>
          )}{' '}
          <div className="form-grid">
            {c.fontenoy && (
              <label className="fontenoy-backdrop-toggle">
                <input
                  type="checkbox"
                  checked={showBackdrop}
                  onChange={(e) => setShowBackdrop(e.target.checked)}
                />
                Show period backdrop
              </label>
            )}
            <label>
              Map overlay
              <select
                value={overlay}
                onChange={(e) => setOverlay(e.target.value as typeof overlay)}
              >
                <option value="none">None</option>
                <option value="control">Own control zones</option>
                <option value="influence">Own corps influence</option>
                <option value="command">Own HQ command range</option>
              </select>
            </label>
            {overlay === 'command' && (
              <label>
                Overlay HQ
                <select
                  value={
                    c.hqs.find(
                      (h) =>
                        h.id === overlayHqId &&
                        (h.army === 'french') === (side === 'french'),
                    )?.id ??
                    c.hqs.find(
                      (h) => (h.army === 'french') === (side === 'french'),
                    )!.id
                  }
                  onChange={(e) => setOverlayHqId(e.target.value)}
                >
                  {c.hqs
                    .filter(
                      (h) => (h.army === 'french') === (side === 'french'),
                    )
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} · {h.mode}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          {overlay !== 'none' && (
            <p>
              Highlights {side === 'french' ? 'French' : alliedLabel}{' '}
              {overlay === 'command' ? 'command range' : 'zones'}. Terrain and
              bridges govern zones; ordinary HQ command uses hex distance.
              Opposing private ratings are not exposed.
            </p>
          )}
        </DeskDrawer>
      </div>
      <section
        className="panel desk-map"
        data-helper="map"
        aria-label="Hex campaign map"
      >
        <div className="map-scroll">
          <svg
            viewBox="0 0 940 465"
            className={`waterloo-map${c.fontenoy && showBackdrop ? ' fontenoy-period-map' : ''}`}
            aria-label={
              c.fontenoy
                ? 'Fontenoy operational map'
                : 'Operational reference map'
            }
          >
            {c.fontenoy && showBackdrop && (
              <g aria-hidden="true" className="fontenoy-map-art">
                <image
                  href={fontenoyBackdrop}
                  x="0"
                  y="0"
                  width="940"
                  height="465"
                  preserveAspectRatio="xMidYMid slice"
                />
                <rect width="940" height="465" fill="#f3e6c9" opacity="0.2" />
              </g>
            )}
            {c.hexes.map((h) => {
              const p = at(h.id);
              const own = c.corps.filter(
                (f) => f.side === side && f.status === 'ready',
              );
              const hq =
                c.hqs.find(
                  (h) =>
                    h.id === overlayHqId &&
                    (h.army === 'french') === (side === 'french'),
                ) ??
                c.hqs.find(
                  (h) => (h.army === 'french') === (side === 'french'),
                )!;
              const highlighted =
                overlay === 'control'
                  ? own.some((f) => inZone(c, h.id, f, 1))
                  : overlay === 'influence'
                    ? own.some(
                        (f) => f.kind !== 'detachment' && inZone(c, h.id, f, 2),
                      )
                    : overlay === 'command'
                      ? hexDistance(c, h.id, hq.hexId) <=
                        (hq.mode === 'normal' ? hq.normalRange : hq.battleRange)
                      : false;
              return (
                <g
                  key={h.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Hex ${h.id}${h.name ? ' ' + h.name : ''}`}
                  onClick={() => {
                    if (view === 'umpire' && chooseAdjudicationHex(h.id))
                      return;
                    if (state.waterlooDraft?.kind === 'scout-request') {
                      setDraft({
                        ...state.waterlooDraft,
                        input: { ...state.waterlooDraft.input, hexId: h.id },
                      });
                      return;
                    }
                    if (draft && hexDistance(c, draft.path.at(-1)!, h.id) === 1)
                      setDraft({ ...draft, path: [...draft.path, h.id] });
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      view === 'umpire' &&
                      chooseAdjudicationHex(h.id)
                    ) {
                      e.preventDefault();
                      return;
                    }
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      state.waterlooDraft?.kind === 'scout-request'
                    ) {
                      e.preventDefault();
                      setDraft({
                        ...state.waterlooDraft,
                        input: { ...state.waterlooDraft.input, hexId: h.id },
                      });
                      return;
                    }
                    if ((e.key === 'Enter' || e.key === ' ') && draft) {
                      e.preventDefault();
                      if (hexDistance(c, draft.path.at(-1)!, h.id) === 1)
                        setDraft({ ...draft, path: [...draft.path, h.id] });
                    }
                  }}
                >
                  <polygon
                    points={Array.from({ length: 6 }, (_, i) => {
                      const a = ((60 * i - 30) * Math.PI) / 180;
                      return `${p.x + 30 * Math.cos(a)},${p.y + 30 * Math.sin(a)}`;
                    }).join(' ')}
                    className={`hex-terrain hex-${h.terrain} ${visibleDraft?.path.includes(h.id) ? 'hex-route' : ''} ${highlighted ? `hex-overlay-${overlay}` : ''}`}
                  />
                  <text
                    x={p.x}
                    y={p.y + 20}
                    className="hex-label"
                    textAnchor="middle"
                  >
                    {h.name || h.id}
                  </text>
                </g>
              );
            })}
            {c.edges
              .filter((e) => e.road)
              .map((e) => {
                const a = at(e.from),
                  b = at(e.to);
                return (
                  <line
                    key={`${e.from}:${e.to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={
                      e.crossing === 'bridge' ? 'hex-bridge' : 'hex-road'
                    }
                  />
                );
              })}
            <SavedMovementRoutes campaign={c} view={view} at={at} />
            {visibleDraft && (
              <polyline
                points={visibleDraft.path
                  .map((id) => {
                    const p = at(id);
                    return `${p.x},${p.y}`;
                  })
                  .join(' ')}
                className="hex-path"
                role="img"
                aria-label="Unsaved movement route"
              />
            )}
            {c.hqs
              .filter(
                (h) =>
                  view === 'umpire' ||
                  (h.army === 'french') === (view === 'french'),
              )
              .map((h) => {
                const p = at(h.hexId);
                return (
                  <g
                    key={h.id}
                    role="img"
                    aria-label={`${h.name} HQ · ${h.mode}`}
                    className="hex-hq"
                  >
                    <path
                      d={`M ${p.x - 8} ${p.y - 19} L ${p.x} ${p.y - 30} L ${p.x + 8} ${p.y - 19} Z`}
                    />
                    <text x={p.x} y={p.y - 32} textAnchor="middle">
                      {h.name}
                    </text>
                  </g>
                );
              })}
            {view === 'umpire' &&
              state.waterlooDraft?.kind === 'adjudication' &&
              state.waterlooDraft.input.placements
                .filter((p) => p.hexId && c.hexes.some((h) => h.id === p.hexId))
                .map((placement) => {
                  const p = at(placement.hexId!);
                  return (
                    <g
                      key={placement.corpsId}
                      className="manual-placement-preview"
                      pointerEvents="none"
                      aria-hidden="true"
                    >
                      <circle cx={p.x} cy={p.y} r={25} />
                      <text x={p.x} y={p.y + 36} textAnchor="middle">
                        Proposed
                      </text>
                    </g>
                  );
                })}
            {c.corps
              .filter(
                (f) =>
                  f.hexId &&
                  f.status === 'ready' &&
                  (!c.fontenoy || visible(f)),
              )
              .map((f) => {
                const p = at(f.hexId!);
                const size =
                  c.fontenoy?.historicalProfile &&
                  visible(f) &&
                  f.kind !== 'detachment'
                    ? historicalFormationSize(c, f.id)
                    : null;
                const stacked =
                  f.kind === 'detachment' &&
                  c.corps.some(
                    (other) =>
                      other.kind !== 'detachment' &&
                      (!c.fontenoy || visible(other)) &&
                      other.hexId === f.hexId &&
                      other.status === 'ready',
                  );
                if (stacked) {
                  p.x += 14;
                  p.y += 12;
                }
                return (
                  <g
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    data-helper-focus={
                      f.side === side && f.kind !== 'detachment'
                        ? 'formation'
                        : undefined
                    }
                    aria-label={`Select ${visible(f) ? f.name : 'opposing corps'}`}
                    onClick={() => beginRoute(f)}
                    onContextMenu={(e) => {
                      if (!c.fontenoy || !visible(f)) return;
                      e.preventDefault();
                      setSelected(f.id);
                      setFormationMenu(f.id);
                    }}
                    onKeyDown={(e) => {
                      if (
                        c.fontenoy &&
                        visible(f) &&
                        (e.key === 'ContextMenu' ||
                          (e.shiftKey && e.key === 'F10'))
                      ) {
                        e.preventDefault();
                        setSelected(f.id);
                        setFormationMenu(f.id);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        beginRoute(f);
                      }
                    }}
                    className={
                      selected === f.id ? 'hex-force selected' : 'hex-force'
                    }
                  >
                    <rect
                      x={p.x - (stacked ? 13 : 20)}
                      y={p.y - (stacked ? 9 : 13)}
                      width={stacked ? 26 : 40}
                      height={stacked ? 18 : 25}
                      rx={3}
                      className={`hex-counter hex-${f.side}`}
                    />
                    {size && (
                      <title>
                        {f.name}. {size.description}
                      </title>
                    )}
                    <text
                      className={size ? 'historical-counter-kind' : undefined}
                      x={p.x}
                      y={p.y + (size ? -2 : 3)}
                      textAnchor="middle"
                    >
                      {visible(f)
                        ? size?.allArtillery
                          ? 'ART'
                          : f.kind === 'cavalry'
                            ? 'CAV'
                            : f.kind === 'detachment'
                              ? 'DET'
                              : 'INF'
                        : '?'}
                    </text>
                    {size && (
                      <text
                        className="historical-counter-size"
                        x={p.x}
                        y={p.y + 8}
                        textAnchor="middle"
                      >
                        {size.label}
                      </text>
                    )}
                  </g>
                );
              })}
            {reportMarkers.map((r) => {
              const observation = r.observation!;
              if (observation.level === 'none') return null;
              const p = at(observation.hexId);
              return (
                <g
                  key={r.requestId}
                  role="button"
                  tabIndex={0}
                  className={`hex-intelligence${r.observedTurn! < c.turn ? ' aged-report' : ''}`}
                  aria-label={`Intelligence report at ${observation.hexId} · observed phase ${r.observedTurn}`}
                  onClick={() => {
                    if (!selectScoutArea(observation.hexId))
                      setReportSelection(r.requestId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!selectScoutArea(observation.hexId))
                        setReportSelection(r.requestId);
                    }
                  }}
                >
                  <path
                    d={`M ${p.x} ${p.y - 18} l 18 18 l -18 18 l -18 -18 Z`}
                  />
                  <title>
                    Last observed phase {r.observedTurn}; valid through phase{' '}
                    {observation.expiresAfterTurn}. Snapshot only.
                  </title>
                  <text x={p.x} y={p.y + 5} textAnchor="middle">
                    ?
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>
    </div>
  );
}

function BattleCard({
  campaign: c,
  battle: b,
}: {
  campaign: WaterlooCampaign;
  battle: WaterlooBattle;
}) {
  const state = useCampaigns();
  const busy =
    state.pending ||
    c.status === 'archived' ||
    !!c.fontenoy?.siege.campaign?.victory;
  const draft =
    state.waterlooDraft?.kind === 'result' &&
    state.waterlooDraft.battleId === b.id
      ? state.waterlooDraft
      : null;
  const latest = b.results.at(-1)?.result;
  const commit = (command: Parameters<typeof state.commitWaterloo>[0]) => {
    void state.commitWaterloo(command);
  };
  const estimateRows = !b.results.length
    ? c.corps
        .map((f) => ({ f, estimate: estimateReinforcement(c, b, f) }))
        .filter((x) => x.estimate)
    : [];
  function editResult() {
    const result: WaterlooResult = latest
      ? structuredClone(latest)
      : {
          game: c.fontenoy ? 'Maurice' : '',
          outcome: '',
          endAt: b.expectedEndAt,
          notes: '',
          effects: [...b.initial, ...b.reinforcementForces].map((f) => ({
            corpsId: f.id,
            disposition: b.reinforcements.some((r) => r.corpsId === f.id)
              ? 'not_engaged'
              : 'retained',
            hexId: f.hexId,
            exhausted: false,
            arrivalAt: null,
          })),
        };
    if (c.fontenoy?.aftermath && !result.maurice)
      result.maurice = mauriceResultDraft(c, b);
    useCampaigns.setState({
      waterlooDraft: {
        kind: 'result',
        battleId: b.id,
        result,
        reason: latest
          ? 'Corrected the manually entered tactical result.'
          : 'Recorded the external tactical battle result.',
      },
    });
  }
  function edit(value: WaterlooResult) {
    if (draft)
      useCampaigns.setState({ waterlooDraft: { ...draft, result: value } });
  }
  async function exportBrief(format: 'html' | 'pdf') {
    try {
      const result = await window.desktop.exportBattleBrief({
        id: c.id,
        expectedRevision: c.revision,
        battleId: b.id,
        format,
      });
      if (!result.ok) useCampaigns.setState({ error: result.error.message });
    } catch {
      useCampaigns.setState({
        error:
          'The brief could not be exported; the saved campaign is unchanged.',
      });
    }
  }
  const timing = (time: number) => {
    const delay = Math.max(0, time - b.startAt);
    return `${campaignTime(c, time).slice(-5)} (+${delay} min${b.charts.tacticalTurnMinutes ? `, turn ${1 + Math.ceil(delay / b.charts.tacticalTurnMinutes)}` : ''})`;
  };
  return (
    <article className="waterloo-battle" aria-label={b.title}>
      <h3>{b.title}</h3>
      <p>
        Begins {campaignTime(c, b.startAt)} · estimated end{' '}
        {campaignTime(c, b.expectedEndAt)} ·{' '}
        {b.appliedVersion
          ? `campaign effects applied, result revision ${b.appliedVersion}`
          : b.approved
            ? 'result approved; resolve to apply at battle end'
            : latest
              ? 'result recorded; campaign review required'
              : 'awaiting external tactical result'}
      </p>
      <p>Initial forces: {b.initial.map((f) => f.name).join(' / ')}.</p>
      {!!b.reinforcements.length && (
        <>
          <h4>Committed reinforcements</h4>
          <ul>
            {b.reinforcements.map((r) => (
              <li key={r.corpsId}>
                {b.reinforcementForces.find((f) => f.id === r.corpsId)!.name} ·{' '}
                {r.entryEdge}: earliest {timing(r.earliest)}, likely{' '}
                {timing(r.likely)}, latest planning bound {timing(r.latest)}.{' '}
                {r.notes}
              </li>
            ))}
          </ul>
        </>
      )}
      {!!estimateRows.length && (
        <details>
          <summary>Nearby potential reinforcements</summary>
          <p>
            Advisory windows, conditional on a clear legal approach. Commitment
            reserves the entire corps and records a new order with assembly
            delay.
          </p>
          <ul>
            {estimateRows.map(({ f, estimate: r }) => (
              <li key={f.id}>
                <strong>{f.name}</strong>: earliest {timing(r!.earliest)},
                likely {timing(r!.likely)}, latest {timing(r!.latest)} ·{' '}
                {r!.entryEdge}{' '}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const arrival = form.get('arrival');
                    commit({
                      kind: 'reinforce',
                      battleId: b.id,
                      corpsId: f.id,
                      entryEdge: String(form.get('edge')),
                      notes: r!.notes,
                      ...(arrival !== ''
                        ? {
                            arrivalOverride: {
                              at: b.startAt + Number(arrival),
                              reason: String(form.get('reason')).trim(),
                            },
                          }
                        : {}),
                    });
                  }}
                >
                  <fieldset disabled={busy || !!state.waterlooDraft}>
                    <div className="form-grid">
                      <label>
                        Entry edge
                        <input
                          name="edge"
                          required
                          maxLength={120}
                          defaultValue={r!.entryEdge}
                        />
                      </label>
                      <label>
                        Agreed arrival override (+minutes, optional)
                        <input name="arrival" type="number" min={0} step={5} />
                      </label>
                      <label>
                        Arrival override reason
                        <input name="reason" maxLength={4000} />
                      </label>
                    </div>
                    <button>Commit {f.name}</button>
                  </fieldset>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="button-row">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            void exportBrief('pdf');
          }}
        >
          Save battle PDF
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            void exportBrief('html');
          }}
        >
          Save battle HTML
        </button>
        <button disabled={busy || !!state.waterlooDraft} onClick={editResult}>
          {latest ? 'Edit manual result' : 'Enter manual result'}
        </button>
        {latest && !b.approved && !b.appliedVersion && (
          <button
            disabled={busy || !!state.waterlooDraft}
            onClick={() => commit({ kind: 'approve-result', battleId: b.id })}
          >
            Approve campaign effects
          </button>
        )}
      </div>
      {latest && (
        <p>
          Recorded result: {latest.outcome} ·{' '}
          {latest.game || 'Unspecified tactical game'} · {latest.notes}
        </p>
      )}
      {b.aftermath && (
        <section
          className="simultaneous-after-action"
          aria-label="Maurice unit after-action record"
        >
          <h4>
            Applied unit aftermath · result revision{' '}
            {b.aftermath.appliedVersion}
          </h4>
          <p>
            Policy {b.aftermath.policy.ruleId} ·{' '}
            {b.aftermath.policy.minutesPerRecoveryTurn / 60} hours per recovery
            turn. Earlier brief and result snapshots are retained.
          </p>
          <ul>
            {b.aftermath.changes.map((r) => (
              <li key={r.unitId}>
                {r.before.displayName}:{' '}
                {r.before.quality ?? 'no regular quality'} /{' '}
                {r.before.currentStatus} →{' '}
                {r.after.quality ?? 'no regular quality'} /{' '}
                {r.after.currentStatus}
                {r.dueAt === null
                  ? ''
                  : `; scheduled ${campaignTime(c, r.dueAt)}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      <MauriceResultRecord battle={b} />
      {draft && (
        <form
          data-helper="result"
          aria-label="Manual tactical result"
          onSubmit={(e) => {
            e.preventDefault();
            commit({
              kind: 'result',
              battleId: b.id,
              result: draft.result,
              reason: draft.reason,
            });
          }}
        >
          <h4>Manual tactical result</h4>
          <p>
            Enter the actual effects from any tactical game. Review positions
            and readiness explicitly. Retained/retreated effects can use an
            agreed legal map hex; the application does not infer casualties from
            the winner.
          </p>
          <div className="form-grid">
            <label>
              Tactical game
              <input
                maxLength={160}
                value={draft.result.game}
                onChange={(e) =>
                  edit({ ...draft.result, game: e.target.value })
                }
              />
            </label>
            <label>
              Outcome
              <input
                required
                maxLength={160}
                value={draft.result.outcome}
                onChange={(e) =>
                  edit({ ...draft.result, outcome: e.target.value })
                }
              />
            </label>
            <label>
              Battle duration in minutes
              <input
                type="number"
                min={0}
                max={1080}
                step={5}
                required
                value={draft.result.endAt - b.startAt}
                onChange={(e) =>
                  edit({
                    ...draft.result,
                    endAt: b.startAt + Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          {draft.result.effects.map((effect, i) => {
            const f = [...b.initial, ...b.reinforcementForces].find(
              (f) => f.id === effect.corpsId,
            )!;
            const update = (patch: Partial<typeof effect>) =>
              edit({
                ...draft.result,
                effects: draft.result.effects.map((p, j) =>
                  j === i ? { ...p, ...patch } : p,
                ),
              });
            const r = b.reinforcements.find((r) => r.corpsId === f.id);
            return (
              <fieldset key={f.id} disabled={busy}>
                <legend>{f.name}</legend>
                <div className="form-grid">
                  <label>
                    Campaign disposition
                    <select
                      value={effect.disposition}
                      onChange={(e) => {
                        const disposition = e.target
                          .value as typeof effect.disposition;
                        update({
                          disposition,
                          hexId: ['blown', 'eliminated', 'recalled'].includes(
                            disposition,
                          )
                            ? null
                            : f.hexId,
                          arrivalAt:
                            r && disposition !== 'not_engaged'
                              ? r.earliest
                              : null,
                        });
                      }}
                    >
                      {(f.detachment
                        ? ['retained', 'recalled', 'eliminated', 'not_engaged']
                        : [
                            'retained',
                            'retreated',
                            'blown',
                            'eliminated',
                            'not_engaged',
                          ]
                      ).map((v) => (
                        <option key={v} value={v}>
                          {v.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Post-battle hex
                    <select
                      disabled={['blown', 'eliminated', 'recalled'].includes(
                        effect.disposition,
                      )}
                      value={effect.hexId ?? ''}
                      onChange={(e) =>
                        update({ hexId: e.target.value || null })
                      }
                    >
                      <option value="">Off map</option>
                      {c.hexes
                        .filter((h) => h.terrain !== 'water')
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.id}
                            {h.name ? ' ' + h.name : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                  {r && (
                    <label>
                      Actual arrival (minutes after battle start)
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={
                          effect.arrivalAt === null
                            ? ''
                            : effect.arrivalAt - b.startAt
                        }
                        onChange={(e) =>
                          update({
                            arrivalAt:
                              e.target.value === ''
                                ? null
                                : b.startAt + Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                  {f.kind === 'cavalry' && (
                    <label>
                      <input
                        type="checkbox"
                        checked={effect.exhausted}
                        onChange={(e) =>
                          update({ exhausted: e.target.checked })
                        }
                      />
                      Exhausted after actual participation
                    </label>
                  )}
                </div>
              </fieldset>
            );
          })}
          <MauriceUnitResultFields
            c={c}
            battle={b}
            result={draft.result}
            edit={edit}
            busy={busy}
          />
          <label>
            Battle notes
            <textarea
              maxLength={4000}
              value={draft.result.notes}
              onChange={(e) => edit({ ...draft.result, notes: e.target.value })}
            />
          </label>
          <label>
            Reason for this result or correction
            <textarea
              required
              maxLength={4000}
              value={draft.reason}
              onChange={(e) =>
                useCampaigns.setState({
                  waterlooDraft: { ...draft, reason: e.target.value },
                })
              }
            />
          </label>
          <div className="button-row">
            <button disabled={busy}>Review and confirm manual result</button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => useCampaigns.setState({ waterlooDraft: null })}
            >
              Cancel result edit
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
