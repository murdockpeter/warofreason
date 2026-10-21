import { useState } from 'react';
import type { FontenoyCampaign } from '../domain/campaign';
import { declarationIssues, defaultScoutingRules } from '../domain/tabletop';
import {
  battleOutcomeSchema,
  unitOutcomeSchema,
} from '../domain/tabletop-schema';
import type { Battle, ScoutInput } from '../domain/tabletop-schema';
import { squareLabel } from '../domain/setup-editing';
import { useCampaigns } from './campaign-store';
import type { TabletopDraft } from './tabletop-draft';

function EditorActions({ label }: { label: string }) {
  const state = useCampaigns();
  return (
    <div className="button-row">
      <button
        disabled={state.pending}
        onClick={() => {
          void state.saveTabletop();
        }}
      >
        {label}
      </button>
      <button
        className="secondary"
        disabled={state.pending}
        onClick={() => {
          void state.discard();
        }}
      >
        Discard tabletop draft
      </button>
    </div>
  );
}
export function ScoutingEditor({
  campaign,
  draft,
}: {
  campaign: FontenoyCampaign;
  draft: Extract<TabletopDraft, { kind: 'scout' }>;
}) {
  const state = useCampaigns();
  const [rolling, setRolling] = useState(false);
  const [rollError, setRollError] = useState('');
  const input = draft.input;
  const update = (patch: Partial<typeof input>) =>
    state.editTabletop({ ...draft, input: { ...input, ...patch } });
  const scout = campaign.columns.find((c) => c.id === input.scoutId);
  async function roll() {
    setRolling(true);
    setRollError('');
    try {
      const value = await window.desktop.rollScoutingDie();
      if (useCampaigns.getState().tabletopDraft === draft)
        update({ roll: value, rollSource: 'app' });
    } catch {
      setRollError(
        'The die could not be rolled. Retry or enter a physical die.',
      );
    } finally {
      setRolling(false);
    }
  }
  return (
    <section className="panel tabletop-editor" aria-label="Scouting worksheet">
      <h2>Record scouting</h2>
      <p>
        Umpire workflow: enter or roll one d6, record any agreed modifier and
        choose the intelligence released. There is no automatic official success
        table.
      </p>
      <fieldset disabled={state.pending || rolling}>
        <div className="form-grid">
          <label>
            Scout column
            <select
              aria-label="Scout column"
              value={input.scoutId}
              onChange={(e) =>
                update({ scoutId: e.target.value, targetColumnId: '' })
              }
            >
              <option value="">Choose active-side column</option>
              {campaign.columns
                .filter(
                  (c) =>
                    campaign.factions.find((f) => f.id === c.factionId)
                      ?.side === campaign.activeSide,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Scouting target
            <select
              aria-label="Scouting target"
              value={input.targetColumnId}
              onChange={(e) => update({ targetColumnId: e.target.value })}
            >
              <option value="">Choose opposing column (umpire)</option>
              {campaign.columns
                .filter((c) => scout && c.factionId !== scout.factionId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Die result (d6)
            <input
              type="number"
              min="1"
              max="6"
              value={input.roll ?? ''}
              onChange={(e) =>
                update({
                  roll: e.target.value === '' ? null : Number(e.target.value),
                  rollSource: 'physical',
                })
              }
            />
          </label>
          <label>
            Agreed modifier
            <input
              type="number"
              min="-20"
              max="20"
              value={input.modifier}
              onChange={(e) => update({ modifier: Number(e.target.value) })}
            />
          </label>
          <label>
            Intelligence released
            <select
              aria-label="Intelligence released"
              value={input.state}
              onChange={(e) =>
                update({ state: e.target.value as ScoutInput['state'] })
              }
            >
              {['unknown', 'located', 'estimated', 'identified'].map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <button
          className="secondary"
          onClick={() => {
            void roll();
          }}
        >
          Roll scouting die
        </button>
        <p>
          Roll source: {input.rollSource}. Modified total:{' '}
          {input.roll === null ? 'not rolled' : input.roll + input.modifier}.
          This total does not automatically decide intelligence.
        </p>
        <label>
          Modifier and adjudication reason
          <textarea
            maxLength={4000}
            value={input.reason}
            onChange={(e) => update({ reason: e.target.value })}
          />
        </label>
        {input.state === 'estimated' && (
          <label>
            Approved estimate
            <textarea
              maxLength={4000}
              value={input.estimate}
              onChange={(e) => update({ estimate: e.target.value })}
            />
          </label>
        )}
      </fieldset>
      {rollError && <p role="alert">{rollError}</p>}
      <EditorActions label="Save scouting report" />
    </section>
  );
}
export function DeclarationWizard({
  campaign,
  draft,
}: {
  campaign: FontenoyCampaign;
  draft: Extract<TabletopDraft, { kind: 'declaration' }>;
}) {
  const state = useCampaigns();
  const [step, setStep] = useState(1);
  const declaration = draft.declaration;
  const update = (patch: Partial<typeof declaration>) =>
    state.editTabletop({ ...draft, declaration: { ...declaration, ...patch } });
  const attacker = campaign.columns.find(
    (c) => c.id === declaration.candidate.attackerId,
  )!;
  const location = campaign.squares.find(
    (s) => s.id === declaration.candidate.squareId,
  )!;
  const issues = declarationIssues(campaign, declaration);
  const candidates = campaign.columns.filter((c) => {
    const square = campaign.squares.find((s) => s.id === c.squareId);
    return (
      square &&
      Math.abs(square.row - location.row) +
        Math.abs(square.column - location.column) <=
        (campaign.tabletop?.rules.battleJoinRange ??
          defaultScoutingRules.battleJoinRange)
    );
  });
  return (
    <section
      className="panel tabletop-editor"
      aria-label="Declare Battle wizard"
    >
      <h2>Declare Battle · step {step} of 3</h2>
      <p>
        {squareLabel(location)} · Choose participating columns and record agreed
        tabletop instructions. Eligibility is a provisional campaign rule, not
        official Maurice reinforcement timing.
      </p>
      <fieldset disabled={state.pending}>
        {step === 1 && (
          <>
            <h3>Participants and entry edges</h3>
            {candidates.map((column) => {
              const participant = declaration.participants.find(
                (p) => p.columnId === column.id,
              );
              const primary =
                column.id === declaration.candidate.attackerId ||
                column.id === declaration.candidate.defenderId;
              const patch = (value: Partial<NonNullable<typeof participant>>) =>
                update({
                  participants: declaration.participants.map((p) =>
                    p.columnId === column.id ? { ...p, ...value } : p,
                  ),
                });
              return (
                <div className="participant-card" key={column.id}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!participant}
                      disabled={primary}
                      onChange={(e) =>
                        update({
                          participants: e.target.checked
                            ? [
                                ...declaration.participants,
                                {
                                  columnId: column.id,
                                  role:
                                    column.factionId === attacker.factionId
                                      ? 'attacker'
                                      : 'defender',
                                  entryEdge: 'on_table',
                                  reinforcement: false,
                                  arrivalNotes: '',
                                },
                              ]
                            : declaration.participants.filter(
                                (p) => p.columnId !== column.id,
                              ),
                        })
                      }
                    />
                    {column.displayName}
                    {primary ? ' · primary force' : ''}
                  </label>
                  {participant && (
                    <>
                      <label>
                        Entry edge for {column.displayName}
                        <select
                          value={participant.entryEdge}
                          onChange={(e) =>
                            patch({
                              entryEdge: e.target
                                .value as typeof participant.entryEdge,
                            })
                          }
                        >
                          {['north', 'east', 'south', 'west', 'on_table'].map(
                            (edge) => (
                              <option key={edge} value={edge}>
                                {edge.replaceAll('_', ' ')}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          disabled={primary}
                          checked={participant.reinforcement}
                          onChange={(e) =>
                            patch({ reinforcement: e.target.checked })
                          }
                        />
                        Reinforcement: {column.displayName}
                      </label>
                      <label>
                        Arrival instructions for {column.displayName}
                        <textarea
                          maxLength={4000}
                          value={participant.arrivalNotes}
                          onChange={(e) =>
                            patch({ arrivalNotes: e.target.value })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
        {step === 2 && (
          <>
            <label>
              Battle title
              <input
                maxLength={120}
                value={declaration.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <label>
              Battle objectives
              <textarea
                maxLength={4000}
                value={declaration.objectives}
                onChange={(e) => update({ objectives: e.target.value })}
              />
            </label>
            <label>
              Terrain notes
              <textarea
                maxLength={4000}
                value={declaration.terrainNotes}
                onChange={(e) => update({ terrainNotes: e.target.value })}
              />
            </label>
            <label>
              Special setup instructions
              <textarea
                maxLength={4000}
                value={declaration.specialInstructions}
                onChange={(e) =>
                  update({ specialInstructions: e.target.value })
                }
              />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h3>Review declaration</h3>
            <p>{declaration.title}</p>
            <ul>
              {declaration.participants.map((p) => (
                <li key={p.columnId}>
                  {
                    campaign.columns.find((c) => c.id === p.columnId)
                      ?.displayName
                  }{' '}
                  · {p.role} · {p.entryEdge} ·{' '}
                  {p.reinforcement ? 'reinforcement' : 'initial force'}
                </li>
              ))}
            </ul>
            <p className="preserve-lines">{declaration.objectives}</p>
            <p>
              Saving freezes the selected ready units, commanders, origins and
              instructions and holds every selected column. Combat must be
              played at the table.
            </p>
            {issues.length > 0 && (
              <ul className="setup-issues">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </fieldset>
      <div className="button-row">
        {step > 1 && (
          <button className="secondary" onClick={() => setStep((s) => s - 1)}>
            Previous step
          </button>
        )}
        {step < 3 && (
          <button onClick={() => setStep((s) => s + 1)}>Next step</button>
        )}
      </div>
      {step === 3 ? (
        <EditorActions label="Save battle declaration" />
      ) : (
        <button
          className="secondary"
          disabled={state.pending}
          onClick={() => {
            void state.discard();
          }}
        >
          Discard tabletop draft
        </button>
      )}
    </section>
  );
}
export function ResultEditor({
  battle,
  draft,
}: {
  battle: Battle;
  draft: Extract<TabletopDraft, { kind: 'result' }>;
}) {
  const state = useCampaigns();
  const result = draft.result;
  const update = (patch: Partial<typeof result>) =>
    state.editTabletop({ ...draft, result: { ...result, ...patch } });
  const units = battle.participants.flatMap((p) => p.units);
  return (
    <section
      className="panel tabletop-editor"
      aria-label="Tabletop result worksheet"
    >
      <h2>Enter tabletop result</h2>
      <p>
        Record the result you played. Every committed unit needs an explicit
        outcome. No tactical combat, morale calculation, permanent disruption or
        campaign losses are inferred.
      </p>
      <fieldset disabled={state.pending}>
        <label>
          Battle outcome
          <select
            aria-label="Battle outcome"
            value={result.outcome}
            onChange={(e) =>
              update({ outcome: e.target.value as typeof result.outcome })
            }
          >
            <option value="">Choose the tabletop outcome</option>
            {battleOutcomeSchema.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          {(['french', 'allied'] as const).map((side) => (
            <label key={side}>
              Final {side} Army Morale (optional)
              <input
                type="number"
                min="0"
                max="1000"
                value={result.armyMorale[side] ?? ''}
                onChange={(e) =>
                  update({
                    armyMorale: {
                      ...result.armyMorale,
                      [side]:
                        e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <button
          className="secondary"
          onClick={() =>
            update({
              units: result.units.map((u) =>
                u.outcome ? u : { ...u, outcome: 'survived' },
              ),
            })
          }
        >
          Mark remaining units survived
        </button>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Outcome</th>
                <th>Disrupted at end</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {result.units.map((entry, index) => {
                const unit = units.find((u) => u.id === entry.unitId)!;
                const patch = (value: Partial<typeof entry>) =>
                  update({
                    units: result.units.map((u, i) =>
                      i === index ? { ...u, ...value } : u,
                    ),
                  });
                return (
                  <tr key={entry.unitId}>
                    <td>{unit.displayName}</td>
                    <td>
                      <select
                        aria-label={`Outcome ${unit.displayName}`}
                        value={entry.outcome}
                        onChange={(e) =>
                          patch({
                            outcome: e.target.value as typeof entry.outcome,
                          })
                        }
                      >
                        <option value="">Choose</option>
                        {unitOutcomeSchema.options.map((value) => (
                          <option key={value} value={value}>
                            {value.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Disruption ${unit.displayName}`}
                        value={
                          entry.disruptedAtEnd === null
                            ? ''
                            : String(entry.disruptedAtEnd)
                        }
                        onChange={(e) =>
                          patch({
                            disruptedAtEnd:
                              e.target.value === ''
                                ? null
                                : e.target.value === 'true',
                          })
                        }
                      >
                        <option value="">Not recorded</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Result notes ${unit.displayName}`}
                        maxLength={4000}
                        value={entry.notes}
                        onChange={(e) => patch({ notes: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h3>Commanders / Notables</h3>
        {result.commanders.map((entry, index) => {
          const commander = battle.participants
            .flatMap((p) => p.commanders)
            .find((c) => c.id === entry.commanderId)!;
          return (
            <div key={entry.commanderId} className="form-grid">
              <label>
                Status {commander.displayName}
                <select
                  value={entry.status}
                  onChange={(e) =>
                    update({
                      commanders: result.commanders.map((c, i) =>
                        i === index
                          ? { ...c, status: e.target.value as typeof c.status }
                          : c,
                      ),
                    })
                  }
                >
                  {['unchanged', 'lost', 'retired', 'other'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Commander notes {commander.displayName}
                <input
                  maxLength={4000}
                  value={entry.notes}
                  onChange={(e) =>
                    update({
                      commanders: result.commanders.map((c, i) =>
                        i === index ? { ...c, notes: e.target.value } : c,
                      ),
                    })
                  }
                />
              </label>
            </div>
          );
        })}
        <label>
          Battle result notes
          <textarea
            maxLength={4000}
            value={result.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
      </fieldset>
      <EditorActions label="Review and confirm result" />
    </section>
  );
}
export function ScoutingRulesEditor({
  draft,
}: {
  draft: Extract<TabletopDraft, { kind: 'scouting-rules' }>;
}) {
  const state = useCampaigns();
  const rules = draft.rules;
  const names = {
    rangeSquares: 'Scouting range (squares)',
    battleJoinRange: 'Battle joining range (squares)',
    expiresAfterTurns: 'Intelligence lifetime (turns)',
    attemptsPerColumnPerTurn: 'Attempts per column per turn',
  };
  return (
    <section
      className="panel tabletop-editor"
      aria-label="Scouting rules editor"
    >
      <h2>Scouting house rules</h2>
      <p>
        These player-adjustable values do not implement an official Maurice
        scouting table. Changing rules affects new reports; existing reports
        retain their original expiry.
      </p>
      <fieldset disabled={state.pending}>
        <div className="form-grid">
          {(Object.keys(names) as (keyof typeof names)[]).map((key) => (
            <label key={key}>
              {names[key]}
              <input
                type="number"
                min={key === 'battleJoinRange' ? 0 : 1}
                max={
                  key === 'rangeSquares' || key === 'battleJoinRange'
                    ? 20
                    : key === 'expiresAfterTurns'
                      ? 100
                      : 10
                }
                value={rules[key]}
                onChange={(e) =>
                  state.editTabletop({
                    ...draft,
                    rules: { ...rules, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <label>
          Eligible scout unit types
          <select
            multiple
            aria-label="Eligible scout unit types"
            value={rules.eligibleTypes}
            onChange={(e) =>
              state.editTabletop({
                ...draft,
                rules: {
                  ...rules,
                  eligibleTypes: [...e.target.selectedOptions].map(
                    (o) => o.value as (typeof rules.eligibleTypes)[number],
                  ),
                },
              })
            }
          >
            {[
              'regular_infantry',
              'irregular_infantry',
              'regular_cavalry',
              'irregular_cavalry',
              'artillery',
            ].map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <EditorActions label="Save scouting rules" />
    </section>
  );
}
