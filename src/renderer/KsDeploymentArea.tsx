import { useState } from 'react';
import { almaRoster, almaById, almaSources } from '../domain/alma-roster';
import { useKs } from './ks-store';
import { DeskDrawer } from './DeskDrawer';
import { ReaderDialog } from './ReaderDialog';
import { ksAllegiances } from './crimean-maps';

export function KsDeploymentArea({
  disabled,
  onPlace,
}: {
  disabled: boolean;
  onPlace(ids: string[]): void;
}) {
  const state = useKs(),
    c = state.library?.active;
  const [review, setReview] = useState(false),
    [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const staged = c?.deploymentArea?.forces ?? [];
  const visible = staged.filter((f) =>
    `${f.name} ${almaById.get(f.historical.organizationId)?.path.join(' ')} ${ksAllegiances[f.allegiance]}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const chosen = staged.filter((f) => selected.includes(f.id)).map((f) => f.id);
  const loaded = c?.deploymentArea?.loadedRosterIds.includes(almaRoster.id);
  const groups = new Map<string, typeof staged>();
  for (const f of visible) {
    const path = `${ksAllegiances[f.allegiance]} / ${almaById.get(f.historical.organizationId)!.path.join(' / ')}`;
    groups.set(path, [...(groups.get(path) ?? []), f]);
  }
  const toggle = (ids: string[], checked: boolean) =>
    setSelected((old) =>
      checked
        ? [...new Set([...old, ...ids])]
        : old.filter((id) => !ids.includes(id)),
    );
  return (
    <DeskDrawer title="Deployment Area" edge="side">
      <p>
        Alma, 20 September 1854. Load the dated source roster off-map, select
        records, then click the map to preview their placement.
      </p>
      <button
        disabled={disabled || !c || c.status !== 'active'}
        onClick={() => setReview(true)}
      >
        Review Alma roster & sources
      </button>
      <p>
        <strong>{staged.length} ready to deploy</strong>
        {loaded
          ? ` · ${almaRoster.entries.length - staged.length} deployed`
          : ' · roster not loaded'}
      </p>
      <label>
        Search deployment area
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Army, brigade or regiment"
        />
      </label>
      <div className="button-row">
        <button
          disabled={disabled || !visible.length}
          onClick={() =>
            toggle(
              visible.map((f) => f.id),
              true,
            )
          }
        >
          Select visible ({visible.length})
        </button>
        <button
          disabled={disabled || !chosen.length}
          onClick={() => setSelected([])}
        >
          Clear selection
        </button>
        <button
          disabled={disabled || !chosen.length || c?.status !== 'active'}
          onClick={(e) => {
            e.currentTarget
              .closest('details.desk-drawer')
              ?.removeAttribute('open');
            onPlace(chosen);
          }}
        >
          Place selected ({chosen.length})
        </button>
      </div>
      <p>
        Placement transfers these identities out of this tray; it never clones
        them. Layout is schematic. Detached and uncertain records require umpire
        review.
      </p>
      {[...groups].map(([path, forces]) => (
        <details key={path} className="ks-roster-group">
          <summary>
            {path} ({forces.length})
          </summary>
          <label>
            <input
              type="checkbox"
              disabled={disabled}
              checked={forces.every((f) => chosen.includes(f.id))}
              onChange={(e) =>
                toggle(
                  forces.map((f) => f.id),
                  e.target.checked,
                )
              }
            />{' '}
            Select group
          </label>
          {forces.map((f) => {
            const entry = almaById.get(f.historical.organizationId)!;
            return (
              <article key={f.id} className="ks-roster-entry">
                <label>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={chosen.includes(f.id)}
                    onChange={(e) => toggle([f.id], e.target.checked)}
                  />
                  {f.name}
                </label>
                {entry.flags.length > 0 && (
                  <strong className="ks-roster-flags">
                    {entry.flags.join(' · ')}
                  </strong>
                )}
                <details>
                  <summary>Source & composition</summary>
                  <p>{entry.strength}</p>
                  <p>{entry.commandChain}</p>
                  <p>{entry.notes}</p>
                  <small>{entry.source}</small>
                </details>
              </article>
            );
          })}
        </details>
      ))}
      {review && (
        <ReaderDialog
          title="Alma roster review"
          onDismiss={() => {
            if (!state.pending) setReview(false);
          }}
        >
          <h3>
            20 September 1854 · {almaRoster.entries.length} source records
          </h3>
          <p>
            A field-army baseline, not a certified list of every soldier
            present. Records represent named regiments, battalions, batteries or
            explicitly labelled aggregates, not equal combat units.
          </p>
          <ul>
            {(['britain', 'france', 'ottoman', 'russia'] as const).map((a) => (
              <li key={a}>
                {ksAllegiances[a]}:{' '}
                {almaRoster.entries.filter((e) => e.allegiance === a).length}{' '}
                records
              </li>
            ))}
          </ul>
          <p>
            The Ottoman contingent remains an aggregate because subordinate
            identities are unresolved. French cavalry is flagged
            detached/uncertain; contemporary dispatches report its absence.
            British Fourth Division composition, artillery returns and some
            Russian reserve/naval entries require reconciliation. No headcounts,
            ratings or starting positions are invented.
          </p>
          <p>
            Loading adds every listed record to the deployment area, including
            flagged records. It does not place counters or change campaign time.
            Review flagged records before choosing what to deploy.
          </p>
          <ul>
            {almaSources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
          {state.error && <p role="alert">{state.error}</p>}
          <button
            disabled={disabled || loaded || !c || c.status !== 'active'}
            onClick={async () => {
              if (
                await state.commit(
                  {
                    kind: 'stage-roster',
                    rosterId: almaRoster.id,
                    forceIds: almaRoster.entries.map(() => crypto.randomUUID()),
                  },
                  'Loaded the dated Alma source roster into off-map staging. Uncertain and detached records remain labelled; no historical placement or combat ratings assumed.',
                )
              )
                setReview(false);
            }}
          >
            {loaded
              ? 'Alma roster already loaded'
              : 'Load Alma roster into deployment area'}
          </button>
        </ReaderDialog>
      )}
    </DeskDrawer>
  );
}
