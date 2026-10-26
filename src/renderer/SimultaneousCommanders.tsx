import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import type { OfficerAction } from '../domain/simultaneous-commanders-schema';
import { canManageOfficers } from '../domain/simultaneous-commanders';
import { campaignTime } from '../domain/waterloo';
import { useCampaigns } from './campaign-store';

export function SimultaneousCommanders({
  c,
  view,
}: {
  c: WaterlooCampaign;
  view: MapView;
}) {
  const store = useCampaigns();
  const m = c.fontenoy;
  if (!m) return null;
  const draft =
    store.waterlooDraft?.kind === 'officer' ? store.waterlooDraft : null;
  const busy =
    store.pending || c.status === 'archived' || !!m.siege.campaign?.victory;
  const canEdit =
    view === 'umpire' && !!m.officers && canManageOfficers(c) && !busy;
  const canAttach = canEdit && canManageOfficers(c, true);
  const visibleIds = new Set(
    m.commanders
      .filter(
        (u) =>
          view === 'umpire' ||
          m.factions.find((f) => f.id === u.factionId)?.side === view,
      )
      .map((u) => u.id),
  );
  const officers = m.commanders.filter((u) => visibleIds.has(u.id));
  const start = (action: OfficerAction) =>
    useCampaigns.setState({
      waterlooDraft: { kind: 'officer', action },
      error: null,
    });
  const edit = (action: OfficerAction) =>
    useCampaigns.setState({ waterlooDraft: { kind: 'officer', action } });
  const formationName = (id: string | null) =>
    c.corps.find((f) => f.id === id)?.name ?? 'Unassigned';
  const a = draft?.action;
  const subject =
    a && a.kind !== 'arrival'
      ? m.commanders.find((u) => u.id === a.commanderId)
      : null;
  return (
    <details className="panel simultaneous-officers" data-helper="officers">
      <summary>
        Commanders &amp; Notables · {officers.length} in this view
      </summary>
      <p>
        Record agreed officer decisions manually. Private Notable references are
        reminders for your own materials; no card effects, tactical bonuses or
        HQ rating changes are calculated.
      </p>
      {!m.officers && (
        <p>
          Management is not enabled. Review the current roster during clear
          planning to preserve it as the baseline for future setup clones.
        </p>
      )}
      {view === 'umpire' && !m.officers && (
        <button
          disabled={
            busy || !!store.waterlooDraft || !canManageOfficers(c, true)
          }
          onClick={() =>
            void store.commitWaterloo({ kind: 'maurice-commanders-enable' })
          }
        >
          Enable commander management
        </button>
      )}
      {view === 'umpire' && m.officers && (
        <>
          <p>
            Transfers require clear planning before orders or preparation
            submissions. Details, arrivals and status can also be recorded at a
            fully settled checkpoint, before its siege review. Resolve
            outstanding contacts and battles first.
          </p>
          <button
            disabled={!canEdit || !!store.waterlooDraft}
            onClick={() =>
              start({
                kind: 'arrival',
                side: 'french',
                displayName: '',
                notableReference: '',
                notes: '',
              })
            }
          >
            Record officer arrival
          </button>
        </>
      )}
      <div className="officer-roster">
        {officers.map((u) => {
          const formation = m.formations.find((f) =>
            f.commanderIds.includes(u.id),
          );
          return (
            <details key={u.id}>
              <summary>
                {u.displayName} · {u.campaignStatus ?? 'active'} ·{' '}
                {formationName(formation?.corpsId ?? null)}
              </summary>
              <p>
                {m.factions.find((f) => f.id === u.factionId)?.displayName} ·{' '}
                {u.provenance === 'historical_scenario'
                  ? 'Scenario officer'
                  : 'Player-entered campaign officer'}
              </p>
              <p className="officer-reference">
                Notable reference: {u.notableReference || 'None recorded'}
              </p>
              {view === 'umpire' && m.officers && (
                <div className="button-row">
                  <button
                    disabled={!canEdit || !!store.waterlooDraft}
                    onClick={() =>
                      start({
                        kind: 'details',
                        commanderId: u.id,
                        displayName: u.displayName,
                        notableReference: u.notableReference ?? '',
                        notes: '',
                      })
                    }
                  >
                    Edit {u.displayName}
                  </button>
                  <button
                    disabled={!canEdit || !!store.waterlooDraft}
                    onClick={() =>
                      start({
                        kind: 'status',
                        commanderId: u.id,
                        status: u.campaignStatus ?? 'active',
                        notes: '',
                      })
                    }
                  >
                    Record status for {u.displayName}
                  </button>
                  <button
                    disabled={
                      !canAttach ||
                      !!store.waterlooDraft ||
                      (u.campaignStatus ?? 'active') !== 'active'
                    }
                    onClick={() =>
                      start({
                        kind: 'attachment',
                        commanderId: u.id,
                        corpsId: formation?.corpsId ?? null,
                        notes: '',
                      })
                    }
                  >
                    Assign {u.displayName}
                  </button>
                </div>
              )}
            </details>
          );
        })}
      </div>
      {view === 'umpire' && a && (
        <form
          aria-label="Officer change"
          onSubmit={(e) => {
            e.preventDefault();
            void store.commitWaterloo({ kind: 'maurice-commander', action: a });
          }}
        >
          <fieldset disabled={busy}>
            <legend>
              {a.kind === 'arrival'
                ? 'Record an agreed arrival'
                : `${a.kind === 'attachment' ? 'Change attachment' : a.kind === 'status' ? 'Record resolved status' : 'Edit officer details'}: ${subject?.displayName}`}
            </legend>
            {a.kind === 'arrival' && (
              <label>
                Officer faction
                <select
                  value={a.side}
                  onChange={(e) =>
                    edit({ ...a, side: e.target.value as 'french' | 'allied' })
                  }
                >
                  <option value="french">French</option>
                  <option value="allied">Allied</option>
                </select>
              </label>
            )}
            {(a.kind === 'arrival' || a.kind === 'details') && (
              <>
                <label>
                  Officer name
                  <input
                    required
                    maxLength={120}
                    value={a.displayName}
                    onChange={(e) =>
                      edit({ ...a, displayName: e.target.value })
                    }
                  />
                </label>
                <label htmlFor="officer-reference">
                  Private Notable reference
                </label>
                <textarea
                  id="officer-reference"
                  maxLength={4000}
                  value={a.notableReference}
                  onChange={(e) =>
                    edit({ ...a, notableReference: e.target.value })
                  }
                />
              </>
            )}
            {a.kind === 'status' && (
              <>
                <label>
                  Resolved officer status
                  <select
                    value={a.status}
                    onChange={(e) =>
                      edit({
                        ...a,
                        status: e.target.value as 'active' | 'retired' | 'lost',
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                    <option value="lost">Lost</option>
                  </select>
                </label>
                <p>
                  Retired/lost officers detach from formations. Restoring active
                  status does not reattach the officer. Record only an
                  explicitly resolved decision.
                </p>
              </>
            )}
            {a.kind === 'attachment' && (
              <label>
                Assigned formation
                <select
                  value={a.corpsId ?? ''}
                  onChange={(e) =>
                    edit({ ...a, corpsId: e.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {m.formations
                    .filter((f) =>
                      c.corps.some(
                        (force) =>
                          force.id === f.corpsId &&
                          ['ready', 'blown'].includes(force.status) &&
                          force.side ===
                            m.factions.find((s) => s.id === subject?.factionId)
                              ?.side,
                      ),
                    )
                    .map((f) => (
                      <option key={f.corpsId} value={f.corpsId}>
                        {formationName(f.corpsId)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label htmlFor="officer-change-notes">Decision explanation</label>
            <textarea
              id="officer-change-notes"
              required
              maxLength={4000}
              value={a.notes}
              onChange={(e) => edit({ ...a, notes: e.target.value })}
            />
            <p>
              The journal preserves the prior record. Earlier battle briefs stay
              frozen. Later officer decisions prevent dependent battle-result
              corrections.
            </p>
            <div className="button-row">
              <button type="submit">Confirm officer change</button>
              <button
                type="button"
                disabled={store.pending}
                onClick={() => void store.discard()}
              >
                Discard officer draft
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {m.officers && (
        <details>
          <summary>Officer decision history</summary>
          {!m.officers.records.some((r) => visibleIds.has(r.after.id)) && (
            <p>No officer changes recorded in this view.</p>
          )}
          {[...m.officers.records]
            .reverse()
            .filter((r) => visibleIds.has(r.after.id))
            .map((r) => (
              <details key={r.id}>
                <summary>
                  {r.after.displayName} · {r.action.kind} ·{' '}
                  {campaignTime(c, r.at)}
                </summary>
                <p>{r.action.notes}</p>
                <p>
                  Name: {r.before?.displayName ?? 'Not present'} →{' '}
                  {r.after.displayName}
                </p>
                <p>
                  {r.before?.campaignStatus ??
                    (r.before ? 'active' : 'not present')}{' '}
                  → {r.after.campaignStatus ?? 'active'} ·{' '}
                  {formationName(r.fromCorpsId)} → {formationName(r.toCorpsId)}
                </p>
                <p className="officer-reference">
                  Reference before: {r.before?.notableReference || 'None'} ·
                  recorded reference: {r.after.notableReference || 'None'} ·
                  saved {r.timestamp}
                </p>
              </details>
            ))}
        </details>
      )}
    </details>
  );
}
