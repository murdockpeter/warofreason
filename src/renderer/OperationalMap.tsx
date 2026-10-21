import { useCallback, useRef, useState } from 'react';
import type { FontenoyCampaign } from '../domain/campaign';
import {
  defaultMovementRules,
  nextOperationalDay,
  projectOperationalView,
  routeCost,
} from '../domain/operations';
import type { OperationalView } from '../domain/operations';
import type { MapView, MovementRules } from '../domain/operations-schema';
import { squareLabel } from '../domain/setup-editing';
import mapBackdrop from '../../assets/maps/age-of-reason-backdrop-concept-v1.png';
import { useCampaigns } from './campaign-store';
import { useOperationalSession } from './operational-session';
import { useSession } from './session';
import { ColumnMarker } from './ColumnMarker';
import { markerTransform } from './map-markers';
import { FormationMenu } from './FormationMenu';
import { battleHoldingColumn } from '../domain/tabletop';
import { engagementSettled } from '../domain/aftermath-state';
import { FormationDossier } from './FormationDossier';

export function OperationalMap({
  campaign,
  ordersOnly = false,
}: {
  campaign: FontenoyCampaign;
  ordersOnly?: boolean;
}) {
  const state = useCampaigns();
  const { view, setView } = useOperationalSession();
  const navigate = useSession((s) => s.navigate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [squareId, setSquareId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const dismissMenu = useCallback(() => setMenu(null), []);
  const visible = projectOperationalView(campaign, view);
  const selected = visible.columns.find((c) => c.id === selectedId);
  const op = campaign.operations;
  const canCommand =
    (view === 'umpire' || view === campaign.activeSide) &&
    !campaign.aftermath?.victory &&
    campaign.aftermath?.pendingTurn == null;
  const planning =
    campaign.status === 'active' &&
    op?.phase === 'planning' &&
    canCommand &&
    !state.pending &&
    !campaign.aftermath?.victory &&
    campaign.aftermath?.pendingTurn == null;
  const canPlan =
    planning && !!selected?.units && selected.side === campaign.activeSide;
  const orders = state.planningDraft ?? op?.orders ?? [];
  const safeOrders = orders.filter((o) =>
    visible.columns.some(
      (c) => c.id === o.columnId && (view === 'umpire' || c.side === view),
    ),
  );
  const square = visible.squares.find((s) => s.id === squareId);
  const previewPath = selected && path[0] === selected.squareId ? path : [];
  let previewCost: number | null = null;
  let previewError = '';
  if (selected && previewPath.length && canPlan) {
    try {
      previewCost = routeCost(campaign, {
        columnId: selected.id,
        path: previewPath,
      });
    } catch (error) {
      previewError = error instanceof Error ? error.message : 'Invalid route.';
    }
  }
  function chooseColumn(id: string) {
    const column = visible.columns.find((c) => c.id === id);
    setSelectedId(id);
    setSquareId(column?.squareId ?? null);
    const order = orders.find((o) => o.columnId === id);
    setPath(order?.path ?? (column?.squareId ? [column.squareId] : []));
  }
  function chooseSquare(id: string) {
    setSquareId(id);
    if (canPlan && selected)
      setPath(
        id === selected.squareId
          ? [id]
          : [...(previewPath.length ? previewPath : [selected.squareId!]), id],
      );
  }
  async function exportView() {
    if (view === 'umpire' || exporting) return;
    setExporting(true);
    try {
      const result = await window.desktop.exportPlayerView({
        id: campaign.id,
        expectedRevision: campaign.revision,
        view,
      });
      setExportMessage(
        result.ok
          ? result.value.cancelled
            ? 'Export cancelled.'
            : 'Saved faction view. This is not a campaign backup.'
          : result.error.message,
      );
    } catch {
      setExportMessage(
        'The faction view could not be exported. Retry after reloading the campaign.',
      );
    } finally {
      setExporting(false);
    }
  }
  const day = nextOperationalDay(campaign);
  const menuColumn = visible.columns.find((c) => c.id === menu?.id);
  const inspected = visible.columns.find((c) => c.id === inspectedId);
  const menuOwn =
    !!menuColumn?.units && menuColumn.side === campaign.activeSide && planning;
  const canSplit =
    menuOwn &&
    !state.planningDraft &&
    !state.tabletopDraft &&
    !op?.orders.length &&
    (menuColumn?.units?.length ?? 0) > 1 &&
    !battleHoldingColumn(campaign, menuColumn!.id) &&
    !op?.engagements.some(
      (e) =>
        !engagementSettled(campaign, e) &&
        (e.attackerId === menuColumn!.id || e.defenderId === menuColumn!.id),
    );
  return (
    <div className="operational-layout">
      {!ordersOnly && (
        <div className="play-turnbar">
          <div>
            <strong>{campaign.title}</strong>
            <span>
              {campaign.activeSide ?? 'Setup'} · {op?.phase ?? 'review setup'} ·
              turn {campaign.turn}
            </span>
          </div>
          <div className="button-row">
            {planning && (
              <button
                disabled={state.pending || !!state.tabletopDraft}
                onClick={() => {
                  void state.operate({ kind: 'issue', orders });
                }}
              >
                Review & end phase
              </button>
            )}
            {op?.phase === 'resolution' && canCommand && (
              <button
                disabled={state.pending}
                onClick={() => {
                  void state.operate({ kind: 'resolve' });
                }}
              >
                Confirm phase resolution
              </button>
            )}
            {campaign.aftermath?.pendingTurn != null && (
              <button onClick={() => navigate('Siege & Victory')}>
                Finish turn review
              </button>
            )}
            {!op && campaign.status === 'active' && view === 'umpire' && (
              <button
                onClick={() => {
                  void state.operate({ kind: 'enable' });
                }}
              >
                Enable operational play
              </button>
            )}
            {campaign.status === 'draft' && (
              <button onClick={() => navigate('Armies/Columns')}>
                Review campaign setup
              </button>
            )}
            <button
              className="secondary"
              onClick={() => navigate('Battle Log')}
            >
              Battles & scouting
            </button>
          </div>
        </div>
      )}
      {state.error && !ordersOnly && (
        <p role="alert" className="campaign-error">
          {state.error}
        </p>
      )}
      <details className="map-options" open={ordersOnly ? true : undefined}>
        <summary>Map options & campaign setup</summary>
        <section
          className="panel operational-toolbar"
          aria-label="Operational controls"
        >
          <div className="section-heading">
            <div>
              <h2>{ordersOnly ? 'Turn orders' : 'Fontenoy campaign map'}</h2>
              <p>
                {op
                  ? ordersOnly
                    ? `${campaign.activeSide} · ${op.phase} · turn ${campaign.turn}`
                    : `${op.phase} phase · ${view} view`
                  : 'Operational play is not enabled yet.'}
              </p>
            </div>
            <label>
              Map view
              <select
                aria-label="Map view"
                value={view}
                onChange={(e) => {
                  setView(e.target.value as MapView);
                  setSelectedId(null);
                  setPath([]);
                  setExportMessage('');
                }}
              >
                <option value="umpire">Umpire · all forces</option>
                <option value="french">French</option>
                <option value="allied">Allied</option>
              </select>
            </label>
          </div>
          <p className="save-caption">
            Local pass-and-play views mask opposing composition and hide
            concealed columns. Umpire mode and full backups contain all
            information; this is a shared desktop, without player
            authentication.
          </p>
          {view !== 'umpire' && (
            <button
              className="secondary"
              disabled={exporting || state.pending}
              onClick={() => {
                void exportView();
              }}
            >
              Export faction view
            </button>
          )}
          {exportMessage && <p role="status">{exportMessage}</p>}
          {!op && campaign.status === 'active' && view === 'umpire' && (
            <>
              <p>
                Enable provisional movement rules:{' '}
                {defaultMovementRules.movementPoints} points per faction phase,
                road cost {defaultMovementRules.roadCost}, off-road cost{' '}
                {defaultMovementRules.offRoadCost} and river crossing +
                {defaultMovementRules.riverCrossingCost}. All values are
                adjustable. Neither the illustrated roads nor rivers count as
                configured edges.
              </p>
              <button
                disabled={state.pending}
                onClick={() => {
                  void state.operate({ kind: 'enable' });
                }}
              >
                Enable operational play
              </button>
            </>
          )}
          {campaign.status === 'draft' && (
            <>
              <p>Review and start this campaign before issuing orders.</p>
              <button onClick={() => navigate('Armies/Columns')}>
                Review campaign setup
              </button>
            </>
          )}
          {campaign.status === 'archived' && (
            <p>Archived campaign · read-only.</p>
          )}
          {state.error && (
            <p role="alert" className="campaign-error">
              {state.error}
            </p>
          )}
          {state.message && <p role="status">{state.message}</p>}
          {campaign.aftermath?.pendingTurn != null && (
            <p>
              Turn {campaign.aftermath.pendingTurn} needs its recovery, siege
              and victory checkpoint.{' '}
              <button
                className="secondary"
                onClick={() => navigate('Siege & Victory')}
              >
                Review completed turn
              </button>
            </p>
          )}
          {campaign.aftermath?.victory && (
            <p>
              Campaign concluded: {campaign.aftermath.victory.winner}. See Siege
              & Victory for the recorded conditions.
            </p>
          )}
        </section>
      </details>
      {!ordersOnly && selected && (
        <div className="map-routebar" aria-label="Selected formation actions">
          <strong>{selected.displayName}</strong>
          <button
            className="secondary"
            onClick={() => setInspectedId(selected.id)}
            aria-label="Inspect selected formation"
          >
            <span aria-hidden="true">ⓘ</span> Inspect
          </button>
          <button
            className="secondary"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setMenu({ id: selected.id, x: box.left, y: box.bottom });
            }}
          >
            Formation actions
          </button>
          {canPlan && (
            <>
              <span aria-live="polite">
                {previewError ||
                  (previewCost !== null
                    ? `Route preview: ${previewCost} / ${op!.rules.movementPoints} movement points.`
                    : 'Click adjacent map squares.')}
              </span>
              <button
                disabled={previewCost === null || !!previewError}
                onClick={() =>
                  state.planOrder(
                    { columnId: selected.id, path: previewPath },
                    selected.id,
                  )
                }
              >
                Add order
              </button>
              <button
                className="secondary"
                disabled={previewPath.length <= 1}
                onClick={() => setPath((p) => p.slice(0, -1))}
              >
                Undo route step
              </button>
              <button
                className="secondary"
                onClick={() => state.planOrder(null, selected.id)}
              >
                Remove order
              </button>
            </>
          )}
          <button
            className="secondary"
            onClick={() => {
              setSelectedId(null);
              setSquareId(null);
              setPath([]);
            }}
          >
            Deselect
          </button>
        </div>
      )}
      {!ordersOnly && (
        <InteractiveMap
          view={visible}
          selectedId={selectedId}
          selectedSquareId={squareId}
          path={previewPath}
          onColumn={chooseColumn}
          onSquare={chooseSquare}
          onContextColumn={(id, x, y) => {
            chooseColumn(id);
            setMenu({ id, x, y });
          }}
        />
      )}
      {ordersOnly && (
        <button className="secondary" onClick={() => navigate('Campaign Map')}>
          Plan routes on Campaign Map
        </button>
      )}
      {!ordersOnly && (selected || square) && (
        <details className="formation-inspection">
          <summary>Formation & square details</summary>
          <section
            className="panel operational-inspector"
            aria-label="Map inspector"
          >
            <h2>{selected?.displayName ?? 'Select a column or square'}</h2>
            {selected && (
              <button
                className="secondary"
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  setMenu({ id: selected.id, x: box.left, y: box.bottom });
                }}
              >
                Formation actions
              </button>
            )}
            {selected?.intelligence && (
              <p className="provenance-note">
                Intelligence: {selected.intelligence.state} · observed turn{' '}
                {selected.intelligence.observedTurn},{' '}
                {selected.intelligence.observedDate} · expires at turn{' '}
                {selected.intelligence.expiresAtTurn}. This is a report
                snapshot, not live tracking. {selected.intelligence.estimate}
              </p>
            )}
            {square && (
              <p>
                Square {squareLabel(square)} ·{' '}
                {visible.rules?.blockedSquareIds.includes(square.id)
                  ? 'Blocked'
                  : 'Not blocked'}
              </p>
            )}
            {square &&
              visible.objectives
                .filter((o) => o.squareId === square.id)
                .map((o) => <p key={o.id}>◇ {o.title} · proposed objective</p>)}
            <div className="button-row">
              {visible.columns
                .filter((c) => c.squareId === squareId)
                .map((c) => (
                  <button
                    key={c.id}
                    className="secondary"
                    onClick={() => chooseColumn(c.id)}
                  >
                    {c.displayName}
                  </button>
                ))}
            </div>
            {selected &&
              (selected.units === null ? (
                <p>Opposing composition and commanders are not disclosed.</p>
              ) : (
                <>
                  <p>
                    {selected.side} · {selected.units.length} units ·{' '}
                    {selected.concealment}. Commanders:{' '}
                    {selected.commanders?.join(', ') || 'None'}.
                  </p>
                  <details>
                    <summary>Unit composition</summary>
                    <ul>
                      {selected.units.map((u, i) => (
                        <li key={i}>
                          {u.displayName} · current quality{' '}
                          {u.quality ?? 'none'} · {u.currentStatus}
                        </li>
                      ))}
                    </ul>
                  </details>
                  {op && (
                    <p>
                      Movement allowance: {op.rules.movementPoints} points per
                      faction phase.{' '}
                      {selected.side !== campaign.activeSide
                        ? 'This faction is not active.'
                        : 'Select adjacent squares to build a route; select the starting square to reset.'}
                    </p>
                  )}
                </>
              ))}
          </section>
        </details>
      )}
      <details
        className="map-orders"
        open={ordersOnly || op?.phase === 'resolution' ? true : undefined}
      >
        <summary>
          Orders
          {safeOrders.length
            ? ` · ${safeOrders.length} planned`
            : ' · holding position'}
        </summary>
        <section
          className="panel operational-orders"
          aria-label="Operational orders"
        >
          <h2>
            {op?.phase === 'resolution'
              ? 'Issued orders · awaiting resolution'
              : 'Planned orders'}
          </h2>
          <p>
            Unordered columns hold position. Both factions get one phase before
            the day advances. Routes must be orthogonally connected. Friendly
            stacking is allowed; opposing columns cannot be passed through.
          </p>
          {safeOrders.length ? (
            <ol>
              {safeOrders.map((order) => (
                <li key={order.columnId}>
                  {
                    visible.columns.find((c) => c.id === order.columnId)
                      ?.displayName
                  }
                  :{' '}
                  {order.path
                    .map((id) =>
                      squareLabel({
                        ...visible.squares.find((s) => s.id === id)!,
                        locationName: null,
                      }),
                    )
                    .join(' → ')}
                </li>
              ))}
            </ol>
          ) : (
            <p>No orders visible in this view.</p>
          )}
          {op && (
            <p className="provenance-note">
              House rule: {op.rules.ruleId}. Road {op.rules.roadCost} / off-road{' '}
              {op.rules.offRoadCost} / river crossing +
              {op.rules.riverCrossingCost}; allowance {op.rules.movementPoints}.
              Contact stops movement before the occupied square and records an
              engagement candidate. No battle is automatically resolved.
            </p>
          )}
          {op && campaign.status === 'active' && canCommand && (
            <div className="button-row">
              {op.phase === 'planning' && (
                <>
                  <button
                    disabled={state.pending}
                    onClick={() => {
                      void state.operate({ kind: 'issue', orders });
                    }}
                  >
                    Issue orders
                  </button>
                  <button
                    className="secondary"
                    disabled={state.pending || !state.planningHistory.length}
                    onClick={state.undoOrder}
                  >
                    Undo order edit
                  </button>
                  <button
                    className="secondary"
                    disabled={state.pending || state.planningDraft === null}
                    onClick={() => {
                      void state.discard();
                    }}
                  >
                    Discard order edits
                  </button>
                </>
              )}
              {op.phase === 'resolution' && (
                <>
                  <button
                    disabled={state.pending}
                    onClick={() => {
                      void state.operate({ kind: 'resolve' });
                    }}
                  >
                    Resolve orders
                  </button>
                  <button
                    className="secondary"
                    disabled={state.pending}
                    onClick={() => {
                      void state.operate({ kind: 'reopen' });
                    }}
                  >
                    Return to planning
                  </button>
                </>
              )}
            </div>
          )}
          {op?.phase === 'resolution' && (
            <p>
              After resolution:{' '}
              {day.finished
                ? 'campaign window ends (no automatic victory)'
                : `${day.activeSide}, turn ${day.turn}, ${day.date}`}
              . You can return to planning before committing.
            </p>
          )}
          {op?.phase === 'finished' && (
            <p>
              The configured campaign window has ended. No victory or siege
              result has been calculated.
            </p>
          )}
        </section>
      </details>
      {!!visible.engagements.length && (
        <section
          className="panel operational-orders"
          aria-label="Engagement candidates"
        >
          <h2>Engagement candidates</h2>
          <p>
            Participants are held for tabletop review. Prepare a battle brief in
            Battle Log; no combat result is assumed.
          </p>
          <ul>
            {visible.engagements.map((e, index) => (
              <li key={index}>
                Turn {e.turn} ·{' '}
                {squareLabel(visible.squares.find((s) => s.id === e.squareId)!)}{' '}
                · {e.ruleId}
              </li>
            ))}
          </ul>
        </section>
      )}
      {op && view === 'umpire' && (
        <MovementConfiguration
          key={`${campaign.id}:${campaign.revision}`}
          rules={op.rules}
          campaign={campaign}
        />
      )}
      {menu && menuColumn && (
        <FormationMenu
          x={menu.x}
          y={menu.y}
          title={menuColumn.displayName}
          dismiss={dismissMenu}
          actions={[
            {
              label: 'Move on map',
              disabled: !menuOwn,
              run: () => {
                chooseColumn(menuColumn.id);
              },
            },
            {
              label: 'Hold position',
              disabled: !menuOwn,
              run: () => {
                state.planOrder(
                  { columnId: menuColumn.id, path: [menuColumn.squareId!] },
                  menuColumn.id,
                );
                setPath([menuColumn.squareId!]);
              },
            },
            {
              label: 'Split formation…',
              disabled: !canSplit,
              run: () => {
                void state.beginTabletop({
                  kind: 'formation',
                  command: {
                    kind: 'split',
                    columnId: menuColumn.id,
                    newColumnId: crypto.randomUUID(),
                    displayName: `${menuColumn.displayName.slice(0, 100)} detachment`,
                    unitIds: [],
                    commanderIds: [],
                  },
                });
              },
            },
            {
              label: 'Inspect formation',
              run: () => {
                chooseColumn(menuColumn.id);
                setInspectedId(menuColumn.id);
              },
            },
            {
              label: 'Scout…',
              disabled: !menuOwn || view !== 'umpire',
              run: () => {
                void state.beginTabletop({
                  kind: 'scout',
                  input: {
                    scoutId: menuColumn.id,
                    targetColumnId: '',
                    roll: null,
                    rollSource: 'physical',
                    modifier: 0,
                    reason: '',
                    state: 'unknown',
                    estimate: '',
                  },
                });
                navigate('Battle Log');
              },
            },
          ]}
        />
      )}
      {inspected && (
        <FormationDossier
          view={visible}
          column={inspected}
          onDismiss={() => setInspectedId(null)}
        />
      )}
    </div>
  );
}

function MovementConfiguration({
  rules,
  campaign,
}: {
  rules: MovementRules;
  campaign: FontenoyCampaign;
}) {
  const state = useCampaigns();
  const [draft, setDraft] = useState(rules);
  const editable =
    campaign.status === 'active' &&
    campaign.operations?.phase === 'planning' &&
    !campaign.operations.orders.length &&
    state.planningDraft === null &&
    !state.pending;
  const names = {
    movementPoints: 'Movement allowance',
    roadCost: 'Road cost',
    offRoadCost: 'Off-road cost',
    riverCrossingCost: 'River crossing extra cost',
  };
  return (
    <details className="panel movement-configuration">
      <summary>Movement house rules and roadblocks</summary>
      <p>
        Player-defined values, not official Maurice mechanics. Change these
        before issuing orders.
      </p>
      <div className="form-grid">
        {(Object.keys(names) as (keyof typeof names)[]).map((key) => (
          <label key={key}>
            {names[key]}
            <input
              type="number"
              min={key === 'riverCrossingCost' ? 0 : 1}
              max="30"
              disabled={!editable}
              value={draft[key]}
              onChange={(e) =>
                setDraft({ ...draft, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <label>
        Blocked squares
        <select
          multiple
          aria-label="Blocked squares"
          disabled={!editable}
          value={draft.blockedSquareIds}
          onChange={(e) =>
            setDraft({
              ...draft,
              blockedSquareIds: [...e.target.selectedOptions].map(
                (o) => o.value,
              ),
            })
          }
        >
          {campaign.squares.map((s) => (
            <option key={s.id} value={s.id}>
              {squareLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <p>
        Use Ctrl+click to select or clear multiple blocks. Columns can leave
        their blocked starting square, but cannot enter a blocked square.
      </p>
      <button
        disabled={!editable}
        onClick={() => {
          void state.operate({ kind: 'configure', rules: draft });
        }}
      >
        Save movement rules
      </button>
      <p className="save-caption">
        Default allowance {defaultMovementRules.movementPoints}. Roads and river
        crossings are configured in the campaign setup, independently of the
        artwork.
      </p>
    </details>
  );
}

function InteractiveMap({
  view,
  selectedId,
  selectedSquareId,
  path,
  onColumn,
  onSquare,
  onContextColumn,
}: {
  view: OperationalView;
  selectedId: string | null;
  selectedSquareId: string | null;
  path: string[];
  onColumn(id: string): void;
  onSquare(id: string): void;
  onContextColumn(id: string, x: number, y: number): void;
}) {
  const [zoom, setZoom] = useState(100);
  const scroll = useRef<HTMLDivElement>(null);
  const pan = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const byId = new Map(view.squares.map((s) => [s.id, s]));
  const point = (id: string) => {
    const s = byId.get(id)!;
    return { x: s.column * 100 + 50, y: s.row * 100 + 50 };
  };
  return (
    <section
      className="panel schematic-panel"
      aria-label="Interactive campaign map"
    >
      <div className="section-heading">
        <h2>Campaign map</h2>
        <div className="button-row">
          <button
            className="secondary"
            disabled={zoom === 75}
            onClick={() => setZoom((z) => (z === 100 ? 75 : z - 50))}
          >
            Zoom out
          </button>
          <span className="badge">{zoom}%</span>
          <button
            className="secondary"
            disabled={zoom === 200}
            onClick={() =>
              setZoom((z) => (z === 75 ? 100 : Math.min(200, z + 50)))
            }
          >
            Zoom in
          </button>
          <button
            className="secondary"
            onClick={() => {
              setZoom(100);
              scroll.current?.scrollTo(0, 0);
            }}
          >
            Reset map
          </button>
        </div>
      </div>
      <p className="map-hint">
        Right-click a formation for actions. Click adjacent squares to plan its
        route. Drag to pan.
      </p>
      <div
        className="map-scroll operational-map-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Scrollable campaign map"
        onPointerDown={(e) => {
          if (e.button !== 0 || !scroll.current) return;
          pan.current = {
            x: e.clientX,
            y: e.clientY,
            left: scroll.current.scrollLeft,
            top: scroll.current.scrollTop,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          if (!pan.current || !scroll.current || e.buttons !== 1) return;
          const dx = e.clientX - pan.current.x;
          const dy = e.clientY - pan.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) pan.current.moved = true;
          if (pan.current.moved) {
            scroll.current.scrollLeft = pan.current.left - dx;
            scroll.current.scrollTop = pan.current.top - dy;
          }
        }}
        onPointerLeave={() => {
          pan.current = null;
        }}
        onClickCapture={(e) => {
          if (pan.current?.moved) {
            e.stopPropagation();
            pan.current = null;
          }
        }}
      >
        <div className={`map-zoom map-zoom-${zoom}`}>
          <svg
            viewBox="0 0 1200 800"
            role="group"
            aria-label="Selectable campaign squares and columns"
          >
            <image
              href={mapBackdrop}
              width="1200"
              height="800"
              aria-hidden="true"
            />
            {view.squares.map((s) => (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={`Square ${squareLabel(s)}`}
                aria-pressed={selectedSquareId === s.id}
                onClick={() => onSquare(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSquare(s.id);
                  }
                }}
              >
                <rect
                  x={s.column * 100}
                  y={s.row * 100}
                  width="100"
                  height="100"
                  className={`map-square ${selectedSquareId === s.id ? 'selected' : ''} ${view.rules?.blockedSquareIds.includes(s.id) ? 'blocked' : ''}`}
                />
                <text
                  x={s.column * 100 + 7}
                  y={s.row * 100 + 18}
                  className="map-coordinate"
                >
                  {squareLabel({ ...s, locationName: null })}
                </text>
                {s.locationName && (
                  <text
                    x={s.column * 100 + 50}
                    y={s.row * 100 + 43}
                    textAnchor="middle"
                    className="map-location"
                  >
                    {s.locationName}
                  </text>
                )}
              </g>
            ))}
            {(['riverEdges', 'roadEdges'] as const).flatMap((key) =>
              view.map[key].map((edge) => {
                const from = point(edge.from);
                const to = point(edge.to);
                return (
                  <line
                    key={`${key}:${edge.from}:${edge.to}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={
                      key === 'roadEdges'
                        ? 'map-road map-overlay'
                        : 'map-river map-overlay'
                    }
                  />
                );
              }),
            )}
            {view.objectives.map((o) => {
              const p = point(o.squareId);
              return (
                <text
                  key={o.id}
                  x={p.x + 30}
                  y={p.y + 5}
                  className="map-objective map-overlay"
                >
                  <title>{o.title} · house rule</title>◇
                </text>
              );
            })}
            {path.length > 1 && path.every((id) => byId.has(id)) && (
              <polyline
                points={path
                  .map((id) => {
                    const p = point(id);
                    return `${p.x},${p.y}`;
                  })
                  .join(' ')}
                className="map-route map-overlay"
              />
            )}
            {view.columns
              .filter((c) => c.squareId)
              .map((c, index, columns) => {
                const s = byId.get(c.squareId!)!;
                const offset = columns
                  .slice(0, index)
                  .filter((other) => other.squareId === c.squareId).length;
                return (
                  <g
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${c.displayName}`}
                    aria-pressed={selectedId === c.id}
                    transform={markerTransform(
                      s,
                      offset,
                      columns.filter((other) => other.squareId === c.squareId)
                        .length,
                    )}
                    onClick={() => onColumn(c.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextColumn(c.id, e.clientX, e.clientY);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'ContextMenu' ||
                        (e.shiftKey && e.key === 'F10')
                      ) {
                        e.preventDefault();
                        const box = e.currentTarget.getBoundingClientRect();
                        onContextColumn(c.id, box.left, box.bottom);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onColumn(c.id);
                      }
                    }}
                  >
                    <title>{c.displayName}</title>
                    <ColumnMarker
                      side={c.side}
                      concealed={c.concealment === 'hidden'}
                      count={c.units?.length ?? '?'}
                    />
                  </g>
                );
              })}
          </svg>
        </div>
      </div>
      <p className="save-caption">
        Blue = French · red = Allied · gold dashed border = concealed from the
        opposing view. Each infantry silhouette represents a column, regardless
        of its composition; the number is its disclosed unit count. Unverified
        schematic geography.
      </p>
    </section>
  );
}
