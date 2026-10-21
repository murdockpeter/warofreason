import type { OperationalView } from '../domain/operations';
import { squareLabel } from '../domain/setup-editing';
import { ReaderDialog } from './ReaderDialog';

const names = {
  regular_infantry: 'Regular infantry',
  irregular_infantry: 'Irregular infantry',
  regular_cavalry: 'Regular cavalry',
  irregular_cavalry: 'Irregular cavalry',
  artillery: 'Artillery',
};

/** Only accepts the already-redacted player projection, never the full campaign. */
export function FormationDossier({
  view,
  column,
  onDismiss,
}: {
  view: OperationalView;
  column: OperationalView['columns'][number];
  onDismiss(): void;
}) {
  const own = view.view === 'umpire' || column.side === view.view;
  const snapshot = !own && !!column.intelligence;
  const square = view.squares.find((s) => s.id === column.squareId);
  const units = column.units;
  const intel = column.intelligence;
  return (
    <ReaderDialog
      title="Formation intelligence"
      className="dossier-dialog"
      onDismiss={onDismiss}
    >
      <div className={`dossier-banner ${column.side ?? 'unknown'}`}>
        <div>
          <span className="dossier-kicker">FORMATION DOSSIER</span>
          <h3>{column.displayName}</h3>
          <p>
            {column.side === 'french'
              ? 'French'
              : column.side === 'allied'
                ? 'Allied'
                : 'Faction unreported'}{' '}
            · {square ? squareLabel(square) : 'Position unreported'}
          </p>
        </div>
        <span className="dossier-seal">
          {own
            ? view.view === 'umpire'
              ? 'Umpire record'
              : 'Your formation'
            : (intel?.state ?? 'Limited intelligence')}
        </span>
      </div>
      <div className="dossier-intelligence">
        <h3>
          {own
            ? 'Current formation record'
            : snapshot
              ? 'Dated scouting report'
              : 'Composition unconfirmed'}
        </h3>
        {own ? (
          <p>
            Current roster and commander assignments in your{' '}
            {view.view === 'umpire' ? 'umpire' : 'faction'} view.
            {column.concealment === 'hidden'
              ? ' This formation is marked concealed from the opposing view.'
              : ''}
          </p>
        ) : intel ? (
          <>
            <p>
              Intelligence: {intel.state} · observed turn {intel.observedTurn},{' '}
              {intel.observedDate} · expires at turn {intel.expiresAtTurn}.
            </p>
            <p>
              This is an observed snapshot, not live tracking. Readiness,
              qualities and commander names below are observations from that
              report.
            </p>
            {intel.estimate && (
              <p className="dossier-estimate">
                Umpire estimate: {intel.estimate}
              </p>
            )}
          </>
        ) : (
          <p>
            The map shows this opposing marker, but its roster and commanders
            have not been disclosed. Ask the umpire about scouting to learn
            more.
          </p>
        )}
      </div>
      <dl className="dossier-metrics">
        {[
          [
            snapshot ? 'Observed units' : 'Units',
            units?.length ?? 'Undisclosed',
          ],
          [
            snapshot ? 'Ready (observed)' : 'Ready',
            units
              ? units.filter((u) => u.currentStatus === 'ready').length
              : '—',
          ],
          [
            snapshot ? 'Recovering (observed)' : 'Recovering',
            units
              ? units.filter((u) => u.currentStatus === 'recovering').length
              : '—',
          ],
          [
            snapshot ? 'Lost (observed)' : 'Lost',
            units
              ? units.filter((u) => u.currentStatus === 'lost').length
              : '—',
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {units ? (
        <>
          <section
            className="dossier-composition"
            aria-label="Formation composition"
          >
            <h3>Composition{snapshot ? ' at observation' : ''}</h3>
            <div className="composition-chips">
              {(Object.keys(names) as (keyof typeof names)[]).map((type) => {
                const count = units.filter((u) => u.type === type).length;
                return count ? (
                  <span key={type}>
                    <strong>{count}</strong> {names[type]}
                  </span>
                ) : null;
              })}
            </div>
          </section>
          <section
            className="dossier-commanders"
            aria-label="Formation commanders"
          >
            <h3>{snapshot ? 'Observed commanders' : 'Commanders'}</h3>
            {column.commanders?.length ? (
              <ul>
                {column.commanders.map((name, index) => (
                  <li key={`${name}:${index}`}>{name}</li>
                ))}
              </ul>
            ) : (
              <p>No commanders recorded{snapshot ? ' in this report' : ''}.</p>
            )}
          </section>
          <section aria-label="Formation roster">
            <h3>{snapshot ? 'Observed roster' : 'Unit roster'}</h3>
            <div className="dossier-roster">
              <table>
                <caption>
                  {snapshot
                    ? 'Roster as observed; current enemy state is not disclosed.'
                    : 'Current classification and readiness. Lost units remain in the historical roster.'}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Unit</th>
                    <th scope="col">Type</th>
                    <th scope="col">
                      {snapshot ? 'Observed quality' : 'Current quality'}
                    </th>
                    <th scope="col">
                      {snapshot ? 'Observed status' : 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit, index) => (
                    <tr key={index}>
                      <th scope="row">{unit.displayName}</th>
                      <td>{names[unit.type]}</td>
                      <td>{unit.quality ?? 'Not applicable'}</td>
                      <td>
                        <span
                          className={`readiness-badge ${unit.currentStatus}`}
                        >
                          {unit.currentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="dossier-withheld" role="note">
          <h3>Roster withheld</h3>
          <p>Opposing composition and commanders are not disclosed.</p>
        </div>
      )}
      <details className="dossier-reading-help">
        <summary>ⓘ How to read this dossier</summary>
        <p>
          Ready units can participate in later battles, subject to existing
          orders and engagement holds. Recovering/lost units are retained for
          campaign tracking. Regular quality is shown separately from the unit’s
          name; artillery and irregular units have no regular quality.
          Intelligence can expire or be superseded. No tactical bonuses are
          inferred here.
        </p>
      </details>
      <p className="reader-footnote">
        Read-only inspection · Escape or Close returns to the map and preserves
        your orders.
      </p>
    </ReaderDialog>
  );
}
