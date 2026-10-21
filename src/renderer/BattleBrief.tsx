import { useState } from 'react';
import type { Battle } from '../domain/tabletop-schema';
import type { FontenoyCampaign } from '../domain/campaign';
import { squareLabel } from '../domain/setup-editing';

export function BattleBrief({
  campaign,
  battle,
}: {
  campaign: FontenoyCampaign;
  battle: Battle;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function exportBrief(format: 'pdf' | 'html') {
    setBusy(true);
    try {
      const result = await window.desktop.exportBattleBrief({
        id: campaign.id,
        expectedRevision: campaign.revision,
        battleId: battle.id,
        format,
      });
      setMessage(
        result.ok
          ? result.value.cancelled
            ? 'Export cancelled.'
            : 'Battle brief saved. Open the PDF or HTML file to print it.'
          : result.error.message,
      );
    } catch {
      setMessage(
        'The brief could not be exported. Saved campaign data is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel battle-brief" aria-label="Battle brief">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            FROZEN TABLETOP BRIEF · {battle.stage.replaceAll('_', ' ')}
          </p>
          <h2>{battle.declaration.title}</h2>
        </div>
        <div className="button-row">
          <button
            disabled={busy}
            onClick={() => {
              void exportBrief('pdf');
            }}
          >
            Save printable PDF
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              void exportBrief('html');
            }}
          >
            Export brief HTML
          </button>
        </div>
      </div>
      {message && <p role="status">{message}</p>}
      <p>
        Turn {battle.turn} · {battle.date} · {squareLabel(battle.location)}.
        Frozen at declaration: {battle.createdAt}.
      </p>
      <p className="provenance-note">
        Shared umpire/tabletop brief: contains both sides. Entry edges,
        eligibility and reinforcements are player-agreed house rules (
        {battle.ruleId}). Use your own Maurice materials for tactical setup and
        Notable effects.
      </p>
      <h3>Objectives</h3>
      <p className="preserve-lines">{battle.declaration.objectives}</p>
      <h3>Terrain notes</h3>
      <p className="preserve-lines">
        {battle.declaration.terrainNotes ||
          'Agree terrain at the table; no automatic conversion from the campaign illustration.'}
      </p>
      <h3>Special setup instructions</h3>
      <p className="preserve-lines">
        {battle.declaration.specialInstructions || 'None recorded.'}
      </p>
      {battle.participants.map((p) => (
        <section key={p.columnId}>
          <h3>
            {p.role}: {p.displayName} · {p.side}
          </h3>
          <p>
            Origin {squareLabel(p.origin)} · Entry{' '}
            {p.entryEdge.replaceAll('_', ' ')} ·{' '}
            {p.reinforcement
              ? 'Reinforcement (arrival by agreement)'
              : 'Initial force'}
          </p>
          <p className="preserve-lines">{p.arrivalNotes}</p>
          <p>
            Commanders / Notables:{' '}
            {p.commanders.map((c) => c.displayName).join(', ') ||
              'None recorded'}
            .
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Type</th>
                  <th>Quality</th>
                  <th>Contingent</th>
                </tr>
              </thead>
              <tbody>
                {p.units.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName}</td>
                    <td>{u.type.replaceAll('_', ' ')}</td>
                    <td>{u.quality ?? '—'}</td>
                    <td>{u.contingent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {battle.result && (
        <section aria-label="Confirmed tabletop result">
          <h3>
            Confirmed result: {battle.result.outcome.replaceAll('_', ' ')}
          </h3>
          <p>
            Final Army Morale — French{' '}
            {battle.result.armyMorale.french ?? 'not recorded'}; Allied{' '}
            {battle.result.armyMorale.allied ?? 'not recorded'}. This does not
            change campaign exhaustion.
          </p>
          <p className="preserve-lines">{battle.result.notes}</p>
          <ul>
            {battle.result.units.map((r) => (
              <li key={r.unitId}>
                {
                  battle.participants
                    .flatMap((p) => p.units)
                    .find((u) => u.id === r.unitId)?.displayName
                }
                : {r.outcome.replaceAll('_', ' ')} · Disrupted at end:{' '}
                {r.disruptedAtEnd === null
                  ? 'not recorded'
                  : r.disruptedAtEnd
                    ? 'yes'
                    : 'no'}{' '}
                {r.notes}
              </li>
            ))}
          </ul>
          <ul>
            {battle.result.commanders.map((r) => (
              <li key={r.commanderId}>
                {
                  battle.participants
                    .flatMap((p) => p.commanders)
                    .find((c) => c.id === r.commanderId)?.displayName
                }
                : {r.status} {r.notes}
              </li>
            ))}
          </ul>
          <p>
            {campaign.aftermath?.reviews.some((r) => r.battleId === battle.id)
              ? 'Campaign consequences were applied separately; see Siege & Victory for the after-action summary.'
              : 'Campaign consequences require a separate review in Siege & Victory. This tabletop result alone does not apply losses, quality changes or persistent disruption.'}
          </p>
        </section>
      )}
    </section>
  );
}
