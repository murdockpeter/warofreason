import { useEffect, useState } from 'react';
import type { KsForce, KsMapId, KsPosition } from '../domain/crimean-ks';
import { useKs } from './ks-store';
import { KsMapCanvas } from './KsMapCanvas';
import { KsRulingDialog } from './KsRulingDialog';
import type { KsDraft } from './KsRulingDialog';
import { crimeanMaps, ksAllegiances } from './crimean-maps';
import { ModulePicker } from './ModulePicker';
import { DeskDrawer } from './DeskDrawer';
import { ReaderDialog } from './ReaderDialog';

import { KsDeploymentArea } from './KsDeploymentArea';
import { deploymentLayout } from '../domain/ks-deployment';

type Mode =
  | { kind: 'deploy'; ids: string[]; anchor: KsPosition | null }
  | { kind: 'add' }
  | { kind: 'move'; forceId: string }
  | { kind: 'route'; forceId: string; points: KsPosition[] };
type Menu = {
  client: { x: number; y: number };
  point?: KsPosition;
  force?: KsForce;
};
export function CrimeanWorkspace({
  onSwitchModule,
}: {
  onSwitchModule(): void;
}) {
  const state = useKs(),
    c = state.library?.active;
  const [mapId, setMapId] = useState<KsMapId>('crimea_wyld_1855');
  const [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<KsDraft | null>(null);
  const [mode, setMode] = useState<Mode | null>(null),
    [menu, setMenu] = useState<Menu | null>(null),
    [help, setHelp] = useState(false);
  const dirty = !!draft || !!mode;
  const force = c?.forces.find((f) => f.id === selected);
  const editable = !!c && c.status === 'active' && !state.pending;
  const map = crimeanMaps[mapId];
  const placements =
    mode?.kind === 'deploy' && mode.anchor
      ? deploymentLayout(mode.ids, mode.anchor, map.width / map.height)
      : [];
  const preview = placements.flatMap((p) => {
    const f = c?.deploymentArea?.forces.find((f) => f.id === p.forceId);
    return f ? [{ force: f, position: p.position }] : [];
  });
  useEffect(() => {
    void useKs.getState().load();
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty || useKs.getState().pending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
      if (e.key === 'F1' && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener('beforeunload', guard);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('beforeunload', guard);
      window.removeEventListener('keydown', escape);
    };
  }, [dirty]);
  const makeForce = (position: KsPosition) => {
    setDraft({
      kind: 'force',
      isNew: true,
      force: {
        id: crypto.randomUUID(),
        name: '',
        allegiance: 'russia',
        kind: 'infantry',
        mapId,
        position,
        strength: '',
        commander: '',
        condition: '',
        composition: '',
        notes: '',
        status: 'active',
        intent: null,
      },
    });
    setMode(null);
    setMenu(null);
  };
  const selectForce = (f: KsForce) => {
    if (dirty) return;
    setSelected(f.id);
    setDraft({ kind: 'force', force: f, isNew: false });
    setMenu(null);
  };
  const move = (f: KsForce) => {
    setSelected(f.id);
    setMode({ kind: 'move', forceId: f.id });
    setMenu(null);
  };
  const route = (f: KsForce) => {
    setSelected(f.id);
    setMapId(f.mapId);
    setMode({ kind: 'route', forceId: f.id, points: [f.position] });
    setMenu(null);
  };
  const point = (position: KsPosition) => {
    setMenu(null);
    if (!editable || draft) return;
    if (mode?.kind === 'deploy') setMode({ ...mode, anchor: position });
    if (mode?.kind === 'add') makeForce(position);
    if (mode?.kind === 'move') {
      const moving = c!.forces.find((f) => f.id === mode.forceId);
      if (moving) setDraft({ kind: 'move', force: moving, mapId, position });
      setMode(null);
    }
    if (mode?.kind === 'route')
      setMode({ ...mode, points: [...mode.points, position].slice(0, 100) });
  };
  const closeDraft = () => {
    if (draft?.kind === 'create') setSelected(null);
    setMenu(null);
    setDraft(null);
    useKs.setState({ error: null });
  };
  const context = menu?.force ?? force;
  return (
    <div className="app-shell ks-workspace">
      <header className="ks-topbar">
        <strong>
          CRIMEAN WAR <span>Free Kriegsspiel</span>
        </strong>
        <ModulePicker
          module="crimean"
          disabled={state.pending}
          onChange={() => {
            void (async () => {
              if (!dirty || (await window.desktop.confirmDiscardDraft())) {
                setDraft(null);
                setMode(null);
                onSwitchModule();
              }
            })();
          }}
        />
        <button className="secondary" onClick={() => setHelp(true)}>
          ⓘ Help
        </button>
      </header>
      <section className="ks-campaign-bar" aria-label="Free KS campaign status">
        <div>
          <span>CAMPAIGN</span>
          <strong>{c?.title ?? 'No Crimean KS campaign open'}</strong>
        </div>
        <div>
          <span>CAMPAIGN TIME</span>
          <strong>{c?.campaignTime || 'Set by the umpire'}</strong>
        </div>
        <div>
          <span>STATUS</span>
          <strong>
            {state.pending
              ? 'Saving…'
              : dirty
                ? 'Unrecorded draft'
                : c?.status === 'archived'
                  ? 'Archived · read only'
                  : 'Umpire workspace · all information visible'}
          </strong>
        </div>
      </section>
      <div className="ks-controls">
        <label>
          Map sheet
          <select
            aria-label="Map sheet"
            value={mapId}
            disabled={!!draft || mode?.kind === 'route' || mode?.kind === 'add'}
            onChange={(e) => {
              setMapId(e.target.value as KsMapId);
              if (mode?.kind === 'deploy') setMode({ ...mode, anchor: null });
              setMenu(null);
            }}
          >
            {Object.entries(crimeanMaps).map(([id, item]) => (
              <option key={id} value={id}>
                {item.title} · {id === 'crimea_wyld_1855' ? '1855' : '1856'}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!editable || dirty}
          onClick={() => {
            setMenu(null);
            setMode({ kind: 'add' });
          }}
        >
          Add force
        </button>
        <label>
          Selected force
          <select
            aria-label="Selected force"
            disabled={!c || dirty}
            value={force?.id ?? ''}
            onChange={(e) => {
              setSelected(e.target.value || null);
              const f = c?.forces.find((f) => f.id === e.target.value);
              if (f) setMapId(f.mapId);
            }}
          >
            <option value="">Choose a force</option>
            {c?.forces
              .filter((f) => f.status === 'active')
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        {force && (
          <button
            className="secondary"
            disabled={dirty}
            onClick={() => selectForce(force)}
          >
            Inspect selected
          </button>
        )}
        <button
          className="secondary"
          disabled={!editable || dirty}
          onClick={() => setDraft({ kind: 'time' })}
        >
          Set campaign time
        </button>
        <button
          className="secondary"
          disabled={!editable || dirty}
          onClick={() => setDraft({ kind: 'note' })}
        >
          Record adjudication
        </button>
      </div>
      <div className="ks-drawer-controls">
        <DeskDrawer title="KS campaigns" edge="side">
          <div className="button-row">
            <button
              disabled={dirty || state.pending}
              onClick={() => setDraft({ kind: 'create' })}
            >
              New Crimean KS
            </button>
            <button
              disabled={dirty || state.pending}
              onClick={() => {
                setSelected(null);
                setMenu(null);
                void state.importCampaign();
              }}
            >
              Import KS JSON
            </button>
            <button
              disabled={dirty || state.pending}
              onClick={() => void state.load()}
            >
              Reload KS library
            </button>
          </div>
          {state.library?.campaigns.map((item) => (
            <div className="ks-library-row" key={item.id}>
              <span>
                {item.title} · {item.status}
              </span>
              <button
                disabled={dirty || state.pending || item.id === c?.id}
                onClick={() => {
                  setSelected(null);
                  setMenu(null);
                  void state.open(item.id);
                }}
              >
                Open KS
              </button>
            </div>
          ))}
          {c && (
            <div className="button-row">
              <button
                disabled={dirty || state.pending}
                onClick={() => void state.exportCampaign()}
              >
                Export KS JSON
              </button>
              <button
                disabled={!editable || dirty}
                onClick={() => setDraft({ kind: 'rename' })}
              >
                Rename KS
              </button>
              <button
                disabled={!editable || dirty}
                onClick={() => setDraft({ kind: 'archive' })}
              >
                Archive KS
              </button>
            </div>
          )}
          <p>
            Crimean KS has its own campaign library and database. These actions
            do not modify Maurice saves. Imports retain the original journal and
            never overwrite an existing campaign.
          </p>
        </DeskDrawer>
        <KsDeploymentArea
          disabled={!editable || dirty}
          onPlace={(ids) => {
            setMenu(null);
            setMode({ kind: 'deploy', ids, anchor: null });
          }}
        />
        <DeskDrawer title="Forces" edge="side">
          <p>
            Deployed historical records retain their source identities. You may
            also add custom umpire-entered forces.
          </p>
          {c?.forces.length ? (
            c.forces.map((f) => (
              <article key={f.id} className="ks-library-row">
                <div>
                  <strong>{f.name}</strong>
                  <p>
                    {ksAllegiances[f.allegiance]} · {f.kind} · {f.status}
                    <br />
                    {f.strength || 'Strength unrecorded'}
                    <br />
                    {crimeanMaps[f.mapId].title}
                  </p>
                </div>
                <button
                  disabled={dirty || state.pending}
                  onClick={() => selectForce(f)}
                >
                  Inspect / edit
                </button>
              </article>
            ))
          ) : (
            <p>
              No forces deployed. Use Deployment Area for the Alma roster, or
              choose Add force and click its initial position on the map.
            </p>
          )}
        </DeskDrawer>
        <DeskDrawer title="Ruling journal" edge="side">
          <p>
            Recorded decisions change the map only when explicitly saved.
            Planned intent stays separate from actual position.
          </p>
          {state.library?.events
            .slice()
            .reverse()
            .map((event) => (
              <details key={event.id}>
                <summary>
                  {event.command?.kind.replaceAll('-', ' ') ??
                    'Campaign created'}{' '}
                  · {event.after.campaignTime || 'Campaign time unset'}
                </summary>
                <p>{event.reason}</p>
                <small>
                  {event.actor} · recorded{' '}
                  {new Date(event.timestamp).toLocaleString()}
                </small>
                {event.command && 'forceId' in event.command && (
                  <p>
                    Force:{' '}
                    {
                      event.after.forces.find(
                        (f) =>
                          f.id ===
                          (event.command && 'forceId' in event.command
                            ? event.command.forceId
                            : ''),
                      )?.name
                    }
                  </p>
                )}
              </details>
            ))}
        </DeskDrawer>
        <DeskDrawer title="Map sources" edge="side">
          <h3>{map.title}</h3>
          <p>{map.date}</p>
          <p>{map.credit}</p>
          <p>{map.rights}</p>
          <p>{map.note}</p>
          <p>
            Source catalogue:{' '}
            <a href={map.source} target="_blank" rel="noreferrer">
              {map.source}
            </a>
          </p>
          <p>
            Source links are citations. The bundled scans work offline. The app
            does not derive travel times, distances or game state from the
            printed map.
          </p>
        </DeskDrawer>
      </div>
      {state.error && !draft && (
        <div className="error-notice" role="alert">
          {state.error}
          <button
            onClick={() => void state.load()}
            disabled={state.pending || dirty}
          >
            Reload KS library
          </button>
        </div>
      )}
      {!c && (
        <div className="ks-next-step">
          <span>
            Start here: create a Crimean KS campaign, then place your forces.
          </span>
          <button
            disabled={state.pending}
            onClick={() => setDraft({ kind: 'create' })}
          >
            New Crimean KS
          </button>
        </div>
      )}
      {c && !c.forces.length && !dirty && (
        <div className="ks-next-step">
          Next: open Deployment Area to load the Alma roster, or choose Add
          force to enter a custom force.
        </div>
      )}
      {mode && (
        <div className="ks-next-step" role="status">
          <strong>
            {mode.kind === 'deploy'
              ? `Deploy ${mode.ids.length} records: click the map to preview, then confirm. This is an umpire-selected layout.`
              : mode.kind === 'add'
                ? 'Click the map to place a new force.'
                : mode.kind === 'move'
                  ? 'Choose a map sheet if transferring, then click the adjudicated destination.'
                  : `Draw planned route: ${mode.points.length} points. Click map points in order.`}
          </strong>
          {mode.kind === 'deploy' && (
            <button
              disabled={!placements.length || state.pending}
              onClick={async () => {
                if (
                  await state.commit(
                    { kind: 'deploy-staged', mapId, placements },
                    'Umpire-selected initial deployment from the Alma roster. Schematic counter layout, not a verified historical deployment.',
                  )
                ) {
                  setSelected(mode.ids[0] ?? null);
                  setMode(null);
                }
              }}
            >
              Confirm deployment ({mode.ids.length})
            </button>
          )}
          {mode.kind === 'route' && (
            <>
              <button
                disabled={mode.points.length < 2}
                onClick={() => {
                  setDraft({
                    kind: 'intent',
                    force: c!.forces.find((f) => f.id === mode.forceId)!,
                    points: mode.points,
                  });
                  setMode(null);
                }}
              >
                Record intent
              </button>
              <button
                disabled={mode.points.length < 2}
                onClick={() =>
                  setMode({ ...mode, points: mode.points.slice(0, -1) })
                }
              >
                Undo point
              </button>
            </>
          )}
          <button
            className="secondary"
            disabled={state.pending}
            onClick={() => setMode(null)}
          >
            Cancel map action
          </button>
        </div>
      )}
      <main
        className="desk-map ks-map-panel"
        aria-label="Crimean Free KS workspace"
      >
        <KsMapCanvas
          key={`${c?.id ?? 'preview'}-${mapId}`}
          mapId={mapId}
          forces={c?.forces ?? []}
          deploymentPreview={preview}
          selected={selected}
          route={mode?.kind === 'route' ? mode.points : []}
          onPoint={point}
          onSelect={selectForce}
          onMapMenu={(p, client) => {
            if (editable && !dirty) setMenu({ point: p, client });
          }}
          onForceMenu={(f, client) => {
            if (!dirty) {
              setSelected(f.id);
              setMenu({ force: f, client });
            }
          }}
        />
      </main>
      <footer className="ks-footer">
        {map.title} · {map.date} · Free placement; umpire adjudication · Printed
        troops belong to the historical scan.
      </footer>
      {menu && (
        <div
          role="menu"
          aria-label="Free KS map actions"
          className="ks-context-menu"
          style={{
            left: Math.max(8, Math.min(window.innerWidth - 260, menu.client.x)),
            top: Math.max(8, Math.min(window.innerHeight - 270, menu.client.y)),
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMenu(null);
          }}
        >
          {menu.force ? (
            <>
              <button role="menuitem" onClick={() => selectForce(menu.force!)}>
                Inspect / edit force
              </button>
              <button
                role="menuitem"
                disabled={!editable}
                onClick={() => move(menu.force!)}
              >
                Move / transfer force
              </button>
              <button
                role="menuitem"
                disabled={!editable}
                onClick={() => route(menu.force!)}
              >
                Draw planned route
              </button>
              {menu.force.intent && (
                <button
                  role="menuitem"
                  disabled={!editable}
                  onClick={() => {
                    setDraft({
                      kind: 'intent',
                      force: menu.force!,
                      points: [],
                      clear: true,
                    });
                    setMenu(null);
                  }}
                >
                  Clear planned intent
                </button>
              )}
            </>
          ) : (
            <>
              <button role="menuitem" onClick={() => makeForce(menu.point!)}>
                Add force here
              </button>
              {context && context.status === 'active' && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setDraft({
                      kind: 'move',
                      force: context,
                      mapId,
                      position: menu.point!,
                    });
                    setMenu(null);
                  }}
                >
                  Place selected force here
                </button>
              )}
            </>
          )}
          <button
            role="menuitem"
            className="secondary"
            onClick={() => setMenu(null)}
          >
            Close actions
          </button>
        </div>
      )}
      {draft && (
        <KsRulingDialog
          key={`${draft.kind}-${draft.kind === 'force' ? draft.force.id : c?.revision}`}
          draft={draft}
          onClose={closeDraft}
        />
      )}
      {help && (
        <ReaderDialog
          title="Crimean Free KS manual"
          onDismiss={() => setHelp(false)}
        >
          <p>
            This is an umpire’s map and campaign journal. All forces and notes
            are visible in this workspace. Fog of war, player messaging and
            automated AI adjudication are not implemented here.
          </p>
          <ol>
            <li>
              Create a campaign in KS campaigns. Choose a source map and agree
              the scenario’s start time.
            </li>
            <li>
              Choose Add force and click the map. Enter a name, allegiance, type
              and any reported strength. Alternatively open Deployment Area,
              review and load the Alma roster, select records or groups, then
              choose Place selected. Click the map to preview and Confirm
              deployment to save. Cancel leaves the records in the tray.
              Changing sheets clears the preview so you can choose a fresh
              location.
            </li>
            <li>
              Right-click a force to inspect it, draw planned intent, or move
              it. A planned route records an order without changing position.
            </li>
            <li>
              After discussing an outcome, choose Move / transfer force and
              click the agreed destination. Review it, explain the ruling, then
              select Record ruling. You may transfer the same force to the other
              sheet by selecting it before placing the destination.
            </li>
            <li>
              Use Set campaign time to record elapsed time explicitly. Record
              adjudication saves narrative decisions that do not need a map
              change. Edit strength and condition manually after agreeing
              losses, fatigue or reinforcement.
            </li>
            <li>
              Use zoom and drag to inspect fine map detail. Printed map symbols
              and troop positions remain historical reference, separate from
              your live counters.
            </li>
            <li>
              Review the Ruling journal and export KS JSON for backup. Imports
              are validated and will not replace an existing campaign. Archive
              completed games to make them read-only.
            </li>
          </ol>
          <p>
            The map sheets are dated 1855 and 1856. They are not blank pre-war
            surveys, and their scale and orientation differ. Placements on one
            sheet do not imply a surveyed location on the other. Use their
            printed scale bars and your own adjudication; the app does not
            calculate distance, movement, combat, morale, supply, siege progress
            or victory.
          </p>
        </ReaderDialog>
      )}
    </div>
  );
}
