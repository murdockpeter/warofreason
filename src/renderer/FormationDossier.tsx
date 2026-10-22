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
        <div className="dossier-emblem" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none">
            <circle
              cx="60"
              cy="57"
              r="42"
              stroke="currentColor"
              strokeOpacity=".3"
            />
            <circle
              cx="60"
              cy="57"
              r="36"
              stroke="currentColor"
              strokeOpacity=".16"
            />
            <path
              d="M30 89 78 25M90 89 42 25"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="m42 27 22 3-12 19-15-5Zm36 0-22 3 12 19 15-5Z"
              fill="currentColor"
              fillOpacity=".8"
            />
            <path
              d="M28 62q-8 24 22 34M92 62q8 24-22 34"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m28 68-8-8 1 13 8 3m1 2-9-1 6 10 8 1m2 0-7 3 10 6 8-2m44-27 8-8-1 13-8 3m-1 2 9-1-6 10-8 1m-2 0 7 3-10 6-8-2"
              fill="currentColor"
              fillOpacity=".55"
            />
            <path
              d="m60 53 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"
              fill="currentColor"
            />
          </svg>
          <span>FIELD RECORD</span>
        </div>
        <div className="dossier-identity">
          <span className="dossier-kicker">
            CAMPAIGN DESK / FORMATION DOSSIER
          </span>
          <h3>{column.displayName}</h3>
          <div className="dossier-identity-meta">
            <span className={`dossier-faction ${column.side ?? 'unknown'}`}>
              {column.side === 'french'
                ? 'French'
                : column.side === 'allied'
                  ? 'Allied'
                  : 'Faction unreported'}
            </span>
            <span className="dossier-position">
              {square ? squareLabel(square) : 'Position unreported'}
            </span>
          </div>
        </div>
        <div className="dossier-access">
          <span className="dossier-seal">
            {own
              ? view.view === 'umpire'
                ? 'Umpire record'
                : 'Your formation'
              : (intel?.state ?? 'Limited intelligence')}
          </span>
          <small>
            {own
              ? 'Current assignments'
              : snapshot
                ? 'Observed intelligence'
                : 'Unverified strength'}
          </small>
        </div>
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
        ].map(([label, value], index) => (
          <div key={label} className={`dossier-metric metric-${index}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {units ? (
        <>
          <div className="dossier-overview-grid">
            <section
              className="dossier-composition"
              aria-label="Formation composition"
            >
              <h3>
                <span className="dossier-section-number" aria-hidden="true">
                  01
                </span>{' '}
                Composition{snapshot ? ' at observation' : ''}
              </h3>
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
              <h3>
                <span className="dossier-section-number" aria-hidden="true">
                  02
                </span>{' '}
                {snapshot ? 'Observed commanders' : 'Commanders'}
              </h3>
              {column.commanders?.length ? (
                <ul>
                  {column.commanders.map((name, index) => (
                    <li key={`${name}:${index}`}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No commanders recorded{snapshot ? ' in this report' : ''}.
                </p>
              )}
            </section>
          </div>
          <section
            className="dossier-roster-section"
            aria-label="Formation roster"
          >
            <h3>
              <span className="dossier-section-number" aria-hidden="true">
                03
              </span>{' '}
              {snapshot ? 'Observed roster' : 'Unit roster'}
            </h3>
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
