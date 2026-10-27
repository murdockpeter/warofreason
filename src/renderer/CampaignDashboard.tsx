import { useCampaigns } from './campaign-store';
import { useSession } from './session';

export function CampaignDashboard() {
  const state = useCampaigns();
  const { library, draft, pending, loading, error, message } = state;
  const active = library?.active;
  const busy = pending || loading;
  return (
    <div className="campaign-dashboard">
      <section
        className="panel campaign-library"
        data-helper="library"
        aria-label="Campaign library"
      >
        <div className="section-heading">
          <h2>Campaign library</h2>
          <div className="button-row">
            <button
              disabled={busy || !library}
              onClick={() => void state.createHistoricalFontenoy()}
            >
              New historical Fontenoy campaign
            </button>
            <button
              disabled={busy || !library}
              onClick={() => {
                void state.begin('create');
              }}
            >
              New campaign
            </button>
            <button
              disabled={busy || !library}
              onClick={() => {
                void state.createFontenoyOperations();
              }}
            >
              New simultaneous Fontenoy campaign
            </button>
            <button
              className="secondary"
              disabled={busy || !library}
              onClick={() => {
                void state.importFile();
              }}
            >
              Import JSON
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                void state.initialize();
              }}
            >
              Reload library
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="campaign-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="campaign-message">
            {message}
          </p>
        )}
        {loading && <p role="status">Loading saved campaigns…</p>}
        {pending && <p role="status">Completing operation…</p>}
        {library?.campaigns.length === 0 && (
          <p>
            No campaigns saved. Create a Fontenoy draft with French 20 and
            Allied 18 scenario-scale units, then review the provisional setup.
          </p>
        )}
        {!library && !loading && (
          <p>
            Load the campaign library before creating or opening a campaign.
          </p>
        )}
        {!!library?.campaigns.length && (
          <ul className="campaign-list">
            {library.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <div>
                  <strong>{campaign.title}</strong>
                  <span>
                    {campaign.status === 'archived'
                      ? 'Archived · read-only'
                      : campaign.status === 'active'
                        ? 'Started campaign'
                        : 'Draft · review setup before starting'}{' '}
                    · Revision {campaign.revision}
                  </span>
                </div>
                <button
                  className="secondary"
                  disabled={busy || active?.id === campaign.id}
                  onClick={() => {
                    void state.open(campaign.id);
                  }}
                  aria-label={`Open ${campaign.title}`}
                >
                  {active?.id === campaign.id ? 'Open' : 'Open campaign'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {draft && (
        <section className="panel campaign-editor" aria-label="Campaign draft">
          <h2>
            {draft.kind === 'create'
              ? 'Create campaign'
              : draft.kind === 'clone'
                ? 'Clone campaign'
                : 'Rename campaign'}
          </h2>
          <p>
            Uncommitted edits stay here when you switch screens. Undo or discard
            them before saving.
          </p>
          <form
            data-helper="campaign-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void state.save();
            }}
          >
            <label>
              Campaign title
              <input
                autoFocus
                required
                maxLength={120}
                value={draft.title}
                disabled={busy}
                onChange={(event) => state.edit('title', event.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Recorded by
                <input
                  required
                  maxLength={120}
                  value={draft.actor}
                  disabled={busy}
                  onChange={(event) => state.edit('actor', event.target.value)}
                />
              </label>
              <label>
                Reason
                <input
                  required
                  maxLength={500}
                  value={draft.reason}
                  disabled={busy}
                  onChange={(event) => state.edit('reason', event.target.value)}
                />
              </label>
            </div>
            <div className="button-row">
              <button type="submit" disabled={busy}>
                {draft.kind === 'create'
                  ? 'Create and save'
                  : draft.kind === 'clone'
                    ? 'Clone and save'
                    : 'Save changes'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy || draft.history.length === 0}
                onClick={state.undo}
              >
                Undo last edit
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void state.discard();
                }}
              >
                Discard draft
              </button>
            </div>
          </form>
        </section>
      )}
      {active ? (
        <section className="panel active-campaign" aria-label="Open campaign">
          <p className="eyebrow">OPEN CAMPAIGN</p>
          <h2>{active.title}</h2>
          <p>
            {active.status === 'archived'
              ? 'Archived record. Clone it to create an editable copy.'
              : active.schemaVersion === 3
                ? active.fontenoy
                  ? active.fontenoy.historicalProfile
                    ? 'Historical Fontenoy roster: 143 regimental/aggregate records linked to campaign formations, with reported battalion/squadron complements. Review the scenario adaptation before play; existing 38-unit campaigns remain separate.'
                    : 'Maurice — Fontenoy, 1745. French 20 / Allied 18, with Dutch and Anglo-Allied rosters, Tournai objectives and simultaneous operations. Maurice is the default tactical game; outcomes remain manual.'
                  : 'Earlier operational reference scenario. Create a Fontenoy campaign to use Maurice forces, commanders, geography and objectives.'
                : active.schemaVersion === 1
                  ? 'Saved legacy draft. Load the Fontenoy module to review its forces and provisional setup.'
                  : active.status === 'active'
                    ? 'Campaign started with the reviewed setup. Movement and turn resolution are deferred to Milestone D.'
                    : 'Saved Fontenoy draft. French: 20 · Allied: 18 (Dutch: 7, Anglo-Allied: 11). Review and edit provisional column assignments before starting.'}
          </p>
          <div className="button-row">
            {active.schemaVersion === 2 && (
              <button
                disabled={busy}
                onClick={() => {
                  void state.copyFontenoyOperations();
                }}
              >
                Create simultaneous Fontenoy copy
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => {
                useSession
                  .getState()
                  .navigate(
                    active.schemaVersion === 3
                      ? 'Campaign Map'
                      : 'Armies/Columns',
                  );
              }}
            >
              {active.schemaVersion === 3
                ? 'Open simultaneous map'
                : active.schemaVersion === 1
                  ? 'Load Fontenoy setup'
                  : 'Review Fontenoy setup'}
            </button>
            <button
              className="secondary"
              disabled={busy || active.status === 'archived'}
              onClick={() => {
                void state.begin('rename');
              }}
            >
              Rename campaign
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                void state.begin('clone');
              }}
            >
              Clone campaign
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                void state.exportFile();
              }}
            >
              Export saved JSON
            </button>
            <button
              className="secondary"
              disabled={busy || active.status === 'archived'}
              onClick={() => {
                void state.archive();
              }}
            >
              Archive campaign
            </button>
          </div>
          <p className="save-caption">
            Revision {active.revision} · Last saved{' '}
            {new Date(active.updatedAt).toLocaleString()}. Exports include saved
            state and the complete campaign journal; draft edits are excluded.
          </p>
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>No campaign open</h2>
          <p>Create a campaign draft or import a saved campaign.</p>
        </section>
      )}
      {!!library?.events.length && (
        <section
          className="panel campaign-journal"
          aria-label="Campaign journal"
        >
          <h2>Campaign journal</h2>
          <p>
            Committed changes record who changed what, when and why. Discarded
            drafts do not enter this journal.
          </p>
          <ol>
            {[...library.events].reverse().map((event) => (
              <li key={event.id}>
                <details>
                  <summary>
                    <strong>
                      {event.category.charAt(0).toUpperCase() +
                        event.category.slice(1)}
                    </strong>{' '}
                    · Revision {event.after.revision} · {event.actor}{' '}
                    <span>{new Date(event.timestamp).toLocaleString()}</span>
                  </summary>
                  <p>{event.reason}</p>
                  <div className="snapshot-grid">
                    <div>
                      <h3>Before</h3>
                      <pre>
                        {event.before
                          ? JSON.stringify(event.before, null, 2)
                          : 'No previous campaign state.'}
                      </pre>
                    </div>
                    <div>
                      <h3>After</h3>
                      <pre>{JSON.stringify(event.after, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
