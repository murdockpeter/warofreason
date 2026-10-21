import { useState } from 'react';
import type { FontenoyCampaign } from '../domain/campaign';
import { fontenoyCampaignSchema } from '../domain/campaign';
import {
  contingentLabel,
  fontenoyModule,
  scheduleEndDate,
  setupIssues,
} from '../domain/fontenoy';
import { squareLabel } from '../domain/setup-editing';
import { useCampaigns } from './campaign-store';
import { SchematicMap } from './SchematicMap';

export function FontenoySetup() {
  const state = useCampaigns();
  const active = state.library?.active;
  if (!active)
    return (
      <section className="panel settings">
        <h2>No campaign open</h2>
        <p>Create or open a campaign from Dashboard to review its setup.</p>
      </section>
    );
  if (active.schemaVersion === 1)
    return (
      <section className="panel settings">
        <h2>Load the Fontenoy module</h2>
        <p>
          Your saved draft and journal will be retained. Loading adds the
          versioned scenario forces, an original schematic map, and editable
          provisional assignments.
        </p>
        {state.error && (
          <p role="alert" className="campaign-error">
            {state.error}
          </p>
        )}
        <button
          disabled={state.pending || active.status !== 'draft'}
          onClick={() => {
            void state.loadScenario();
          }}
        >
          Load Fontenoy setup
        </button>
      </section>
    );
  const campaign = state.setupDraft ?? active;
  return <SetupEditor campaign={campaign} />;
}

function SetupEditor({ campaign }: { campaign: FontenoyCampaign }) {
  const state = useCampaigns();
  const editing = !!state.setupDraft;
  const disabled = !editing || state.pending;
  const [roadFrom, setRoadFrom] = useState('');
  const [roadTo, setRoadTo] = useState('');
  const squares = [...campaign.squares].sort(
    (a, b) => a.row - b.row || a.column - b.column,
  );
  const selectedFrom = squares.find((s) => s.id === roadFrom);
  const neighbours = selectedFrom
    ? squares.filter(
        (s) =>
          Math.abs(s.row - selectedFrom.row) +
            Math.abs(s.column - selectedFrom.column) ===
          1,
      )
    : [];
  const parsed = fontenoyCampaignSchema.safeParse(campaign);
  const issues = [
    ...(!parsed.success
      ? parsed.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        )
      : []),
    ...setupIssues(campaign),
  ];
  const status = campaign.status;
  async function acknowledgeReview(
    field: 'reviewedHouseRules' | 'reviewedSchematicMap',
    value: boolean,
  ) {
    if (status !== 'draft' || state.pending || state.loading) return;
    if (!editing) await state.beginSetup();
    const editor = useCampaigns.getState();
    if (editor.setupDraft?.id !== campaign.id) return;
    editor.changeSetup({ kind: 'acknowledge', field, value });
  }
  return (
    <div className="setup-layout">
      <section className="panel setup-intro" aria-label="Fontenoy setup review">
        <p className="eyebrow">
          {status === 'active'
            ? 'STARTED CAMPAIGN'
            : status === 'archived'
              ? 'ARCHIVED RECORD'
              : 'SETUP REVIEW'}{' '}
          · MODULE 0.1.0
        </p>
        <h2>The Road to Fontenoy, 1745</h2>
        <p>{fontenoyModule.historicalBackground}</p>
        <div className="force-totals">
          <strong>
            French:{' '}
            {campaign.units.filter((u) => u.contingent === 'french').length}
          </strong>
          <strong>
            Allied:{' '}
            {campaign.units.filter((u) => u.contingent !== 'french').length}
          </strong>
          <span>
            Dutch:{' '}
            {campaign.units.filter((u) => u.contingent === 'dutch').length} ·
            Anglo-Allied:{' '}
            {
              campaign.units.filter((u) => u.contingent === 'anglo_allied')
                .length
            }
          </span>
        </div>
        <p className="provenance-note">
          Unit counts and classifications: published Maurice scenario facts
          (chapter 11, p. 95). These are abstracted game units, not historical
          battalions. Column splits, locations, concealment, schedule, siege
          state and objectives: provisional house rules.
        </p>
        <div className="button-row">
          {!editing && status === 'draft' && (
            <button
              disabled={state.pending}
              onClick={() => {
                void state.beginSetup();
              }}
            >
              Edit setup
            </button>
          )}
          {editing && (
            <>
              <button
                disabled={state.pending || !parsed.success}
                onClick={() => {
                  void state.saveSetup();
                }}
              >
                Save setup
              </button>
              <button
                className="secondary"
                disabled={state.pending || !state.setupHistory.length}
                onClick={state.undoSetup}
              >
                Undo setup edit
              </button>
              <button
                className="secondary"
                disabled={state.pending}
                onClick={() => {
                  void state.discard();
                }}
              >
                Discard setup edits
              </button>
            </>
          )}
          {status === 'draft' && (
            <button
              disabled={state.pending || editing || issues.length > 0}
              onClick={() => {
                void state.start();
              }}
            >
              Start Campaign
            </button>
          )}
        </div>
        {state.error && (
          <p role="alert" className="campaign-error">
            {state.error}
          </p>
        )}
        {state.message && <p role="status">{state.message}</p>}
        {editing && (
          <p>
            Save your reviewed setup before starting. Unassigned units can be
            saved while preparing; all units must be assigned before Start
            Campaign.
          </p>
        )}
        {status === 'active' && (
          <p>
            Campaign started. Use Campaign Map to enable operational play and
            issue movement orders under your configured house rules.
          </p>
        )}
        {status === 'draft' && (
          <details open={issues.length > 0}>
            <summary>
              {issues.length
                ? `${issues.length} setup review item(s)`
                : 'Setup validated · ready to start'}
            </summary>
            {issues.length > 0 && (
              <ul className="setup-issues">
                {[...new Set(issues)].slice(0, 20).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </details>
        )}
      </section>
      <section
        className="panel settings"
        aria-label="Provisional operational setup"
      >
        <h2>Operational setup · house rules</h2>
        <div className="form-grid">
          <label>
            Opening date
            <input
              type="date"
              value={campaign.settings.schedule.startDate}
              disabled={disabled}
              onChange={(e) =>
                state.changeSetup({
                  kind: 'schedule',
                  value: { startDate: e.target.value },
                })
              }
            />
          </label>
          <label>
            First faction
            <select
              value={campaign.settings.schedule.firstSide}
              aria-label="First faction"
              disabled={disabled}
              onChange={(e) =>
                state.changeSetup({
                  kind: 'schedule',
                  value: { firstSide: e.target.value as 'french' | 'allied' },
                })
              }
            >
              <option value="french">French</option>
              <option value="allied">Allied</option>
            </select>
          </label>
          <label>
            Days per turn
            <input
              type="number"
              min="1"
              max="30"
              value={campaign.settings.schedule.daysPerTurn}
              disabled={disabled}
              onChange={(e) =>
                state.changeSetup({
                  kind: 'schedule',
                  value: { daysPerTurn: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Number of turns
            <input
              type="number"
              min="1"
              max="100"
              value={campaign.settings.schedule.turnCount}
              disabled={disabled}
              onChange={(e) =>
                state.changeSetup({
                  kind: 'schedule',
                  value: { turnCount: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Initial siege status
            <select
              value={campaign.settings.siege.status}
              aria-label="Initial siege status"
              disabled={disabled}
              onChange={(e) =>
                state.changeSetup({
                  kind: 'siege',
                  value: {
                    status: e.target.value as
                      'not_started' | 'invested' | 'relieved',
                  },
                })
              }
            >
              <option value="not_started">Not started</option>
              <option value="invested">Invested (proposed)</option>
              <option value="relieved">Relieved (proposed)</option>
            </select>
          </label>
          <label>
            Initial siege progress
            <input
              type="number"
              min="0"
              max="10000"
              value={campaign.settings.siege.progress}
              disabled={disabled}
              onChange={(e) =>
                state.changeSetup({
                  kind: 'siege',
                  value: { progress: Number(e.target.value) },
                })
              }
            />
          </label>
        </div>
        <p>
          Proposed window ends {scheduleEndDate(campaign.settings.schedule)}.
          This is a configurable campaign window, not a claim about Tournai’s
          historical surrender. Siege progress has no automatic threshold or
          effect.
        </p>
        <ul>
          {campaign.settings.objectives.map((objective) => (
            <li key={objective.id}>
              {objective.title} · house rule; no victory evaluator enabled
            </li>
          ))}
        </ul>
        <label className="check-label">
          <input
            type="checkbox"
            disabled={status !== 'draft' || state.pending || state.loading}
            checked={campaign.settings.reviewedHouseRules}
            onChange={(e) => {
              void acknowledgeReview('reviewedHouseRules', e.target.checked);
            }}
          />
          I reviewed the provisional operational setup and schedule.
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            disabled={status !== 'draft' || state.pending || state.loading}
            checked={campaign.settings.reviewedSchematicMap}
            onChange={(e) => {
              void acknowledgeReview('reviewedSchematicMap', e.target.checked);
            }}
          />
          I understand the map is schematic and routes are unverified.
        </label>
        <p>
          {status === 'draft'
            ? 'Selecting a review confirmation opens an unsaved setup edit. Use Save setup at the top of this page before Start Campaign.'
            : 'Review confirmations are read-only for started and archived campaigns. Clone the campaign from Dashboard to prepare a new draft.'}
        </p>
      </section>
      <SchematicMap campaign={campaign} />
      <section className="panel settings" aria-label="Map configuration">
        <h2>Schematic map configuration</h2>
        <label>
          Approximate kilometres per square (optional)
          <input
            type="number"
            min="0.01"
            max="1000"
            step="any"
            value={campaign.settings.map.kilometresPerSquare ?? ''}
            disabled={disabled}
            onChange={(e) =>
              state.changeSetup({
                kind: 'scale',
                value: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <p>
          Changing scale or proposed roads preserves all square IDs and column
          references. No default roads or rivers are supplied; historic routes
          have not been verified. Added roads are player-defined proposals.
        </p>
        <div className="form-grid">
          <label>
            Proposed road from
            <select
              value={roadFrom}
              aria-label="Proposed road from"
              disabled={disabled}
              onChange={(e) => {
                setRoadFrom(e.target.value);
                setRoadTo('');
              }}
            >
              <option value="">Choose square</option>
              {squares.map((s) => (
                <option key={s.id} value={s.id}>
                  {squareLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proposed road to
            <select
              value={roadTo}
              aria-label="Proposed road to"
              disabled={disabled || !selectedFrom}
              onChange={(e) => setRoadTo(e.target.value)}
            >
              <option value="">Choose adjacent square</option>
              {neighbours.map((s) => (
                <option key={s.id} value={s.id}>
                  {squareLabel(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="secondary"
          disabled={
            disabled ||
            !roadFrom ||
            !roadTo ||
            campaign.settings.map.roadEdges.some(
              (e) =>
                [e.from, e.to].includes(roadFrom) &&
                [e.from, e.to].includes(roadTo),
            )
          }
          onClick={() =>
            state.changeSetup({ kind: 'add-road', from: roadFrom, to: roadTo })
          }
        >
          Add proposed road
        </button>
        <ul>
          {campaign.settings.map.roadEdges.map((edge) => (
            <li key={`${edge.from}:${edge.to}`}>
              {squareLabel(squares.find((s) => s.id === edge.from)!)} ↔{' '}
              {squareLabel(squares.find((s) => s.id === edge.to)!)}{' '}
              <button
                className="secondary compact"
                disabled={disabled}
                onClick={() =>
                  state.changeSetup({
                    kind: 'remove-road',
                    from: edge.from,
                    to: edge.to,
                  })
                }
              >
                Remove road
              </button>
            </li>
          ))}
        </ul>
        <button
          className="secondary"
          disabled={
            disabled ||
            !roadFrom ||
            !roadTo ||
            campaign.settings.map.riverEdges.some(
              (e) =>
                [e.from, e.to].includes(roadFrom) &&
                [e.from, e.to].includes(roadTo),
            )
          }
          onClick={() =>
            state.changeSetup({ kind: 'add-river', from: roadFrom, to: roadTo })
          }
        >
          Add proposed river crossing
        </button>
        <p>
          Use the same adjacent square selectors above for a player-defined
          river crossing. This adds a movement surcharge, not verified river
          geometry.
        </p>
        <ul>
          {campaign.settings.map.riverEdges.map((edge) => (
            <li key={`${edge.from}:${edge.to}`}>
              {squareLabel(squares.find((s) => s.id === edge.from)!)} ↔{' '}
              {squareLabel(squares.find((s) => s.id === edge.to)!)}{' '}
              <button
                className="secondary compact"
                disabled={disabled}
                onClick={() =>
                  state.changeSetup({
                    kind: 'remove-river',
                    from: edge.from,
                    to: edge.to,
                  })
                }
              >
                Remove river crossing
              </button>
            </li>
          ))}
        </ul>
      </section>
      {campaign.factions.map((faction) => (
        <section
          className="panel roster-panel"
          key={faction.id}
          aria-label={`${faction.displayName} army setup`}
        >
          <div className="section-heading">
            <h2>{faction.displayName} columns · provisional</h2>
            <button
              className="secondary"
              disabled={disabled}
              onClick={() =>
                state.changeSetup({ kind: 'add-column', factionId: faction.id })
              }
            >
              Add {faction.displayName} column
            </button>
          </div>
          <p>
            Opening positions and column groupings are editable house-rule
            proposals. Removing a column leaves its units unassigned; it never
            deletes units.
          </p>
          <div className="column-cards">
            {campaign.columns
              .filter((c) => c.factionId === faction.id)
              .map((column) => (
                <fieldset key={column.id}>
                  <legend>
                    {column.displayName || 'Unnamed column'} ·{' '}
                    {column.unitIds.length} units
                  </legend>
                  <label>
                    Column name
                    <input
                      aria-label={`Name for ${column.displayName}`}
                      maxLength={120}
                      value={column.displayName}
                      disabled={disabled}
                      onChange={(e) =>
                        state.changeSetup({
                          kind: 'column-name',
                          id: column.id,
                          value: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Opening square
                    <select
                      aria-label={`Opening square for ${column.displayName}`}
                      value={column.squareId ?? ''}
                      disabled={disabled}
                      onChange={(e) =>
                        state.changeSetup({
                          kind: 'column-location',
                          id: column.id,
                          value: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {squares.map((s) => (
                        <option key={s.id} value={s.id}>
                          {squareLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      aria-label={`Hidden ${column.displayName}`}
                      disabled={disabled}
                      checked={column.concealment === 'hidden'}
                      onChange={(e) =>
                        state.changeSetup({
                          kind: 'column-hidden',
                          id: column.id,
                          value: e.target.checked,
                        })
                      }
                    />
                    Hidden column (umpire flag)
                  </label>
                  <button
                    className="secondary compact"
                    disabled={disabled}
                    onClick={() =>
                      state.changeSetup({
                        kind: 'remove-column',
                        id: column.id,
                      })
                    }
                  >
                    Remove {column.displayName}
                  </button>
                </fieldset>
              ))}
          </div>
          <h3>Unit assignments</h3>
          <div className="roster-scroll">
            <table>
              <caption>
                {faction.displayName} scenario-scale roster · source: Maurice
                chapter 11, p. 95
              </caption>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Contingent</th>
                  <th scope="col">Column</th>
                </tr>
              </thead>
              <tbody>
                {campaign.units
                  .filter((u) => u.factionId === faction.id)
                  .map((unit) => (
                    <tr key={unit.id}>
                      <td title={unit.sourceRef}>
                        {unit.displayName}
                        <small>
                          official_maurice · scenario count/type/quality
                        </small>
                      </td>
                      <td>{contingentLabel[unit.contingent]}</td>
                      <td>
                        <select
                          aria-label={`Assign ${unit.displayName}`}
                          value={
                            campaign.columns.find((c) =>
                              c.unitIds.includes(unit.id),
                            )?.id ?? ''
                          }
                          disabled={disabled}
                          onChange={(e) =>
                            state.changeSetup({
                              kind: 'assign',
                              entity: 'unit',
                              id: unit.id,
                              columnId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Unassigned</option>
                          {campaign.columns
                            .filter((c) => c.factionId === faction.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.displayName}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="section-heading">
            <h3>Commanders · no automated tactical bonuses</h3>
            <button
              className="secondary compact"
              disabled={disabled}
              onClick={() =>
                state.changeSetup({
                  kind: 'add-commander',
                  factionId: faction.id,
                })
              }
            >
              Add {faction.displayName} commander
            </button>
          </div>
          {campaign.commanders
            .filter((c) => c.factionId === faction.id)
            .map((commander) => (
              <div className="commander-row" key={commander.id}>
                <label>
                  Commander name
                  <input
                    aria-label={`Name for ${commander.displayName}`}
                    disabled={disabled}
                    value={commander.displayName}
                    maxLength={120}
                    onChange={(e) =>
                      state.changeSetup({
                        kind: 'commander-name',
                        id: commander.id,
                        value: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Assignment
                  <select
                    aria-label={`Assign ${commander.displayName}`}
                    disabled={disabled}
                    value={
                      campaign.columns.find((c) =>
                        c.commanderIds.includes(commander.id),
                      )?.id ?? ''
                    }
                    onChange={(e) =>
                      state.changeSetup({
                        kind: 'assign',
                        entity: 'commander',
                        id: commander.id,
                        columnId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {campaign.columns
                      .filter((c) => c.factionId === faction.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="secondary compact"
                  disabled={disabled}
                  onClick={() =>
                    state.changeSetup({
                      kind: 'remove-commander',
                      id: commander.id,
                    })
                  }
                >
                  Remove commander
                </button>
                <small>
                  {commander.provenance} · attachment is provisional
                </small>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
