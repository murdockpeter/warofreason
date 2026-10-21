import type { FontenoyCampaign } from '../domain/campaign';
import { applyAftermathCommand } from '../domain/aftermath';
import type { AftermathCommand } from '../domain/aftermath-schema';
import { squareLabel } from '../domain/setup-editing';
import { useCampaigns } from './campaign-store';

export function AftermathEditor({
  campaign,
  command,
}: {
  campaign: FontenoyCampaign;
  command: AftermathCommand;
}) {
  const state = useCampaigns();
  const change = (value: AftermathCommand) =>
    state.editTabletop({ kind: 'aftermath', command: value });
  const notes = 'notes' in command ? command.notes : '';
  return (
    <section
      className="panel tabletop-editor"
      aria-label="Campaign changes worksheet"
    >
      <h2>
        {command.kind === 'apply-battle'
          ? 'Review battle aftermath'
          : command.kind === 'rules'
            ? 'Campaign house rules'
            : command.kind.replaceAll('-', ' ')}
      </h2>
      <fieldset disabled={state.pending}>
        {command.kind === 'rules' && (
          <>
            <p>
              All values below are provisional campaign rules. They do not
              automate Maurice tactical combat or the official Epic Point
              calculation.
            </p>
            <div className="form-grid">
              <label>
                Recovery strategy
                <select
                  aria-label="Recovery strategy"
                  value={command.rules.strategy}
                  onChange={(e) =>
                    change({
                      ...command,
                      rules: {
                        ...command.rules,
                        strategy: e.target
                          .value as typeof command.rules.strategy,
                      },
                    })
                  }
                >
                  <option value="conscript_rebuild_v1">
                    Conscript rebuilding policy
                  </option>
                  <option value="manual_review_v1">
                    Individual manual review
                  </option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={command.rules.allowRegularRebuild}
                  onChange={(e) =>
                    change({
                      ...command,
                      rules: {
                        ...command.rules,
                        allowRegularRebuild: e.target.checked,
                      },
                    })
                  }
                />
                Allow broken regulars to rebuild at conscript quality
              </label>
              {(['irregularRecovery', 'artilleryRecovery'] as const).map(
                (key) => (
                  <label key={key}>
                    {key === 'irregularRecovery'
                      ? 'Irregular recovery variant'
                      : 'Artillery recovery variant'}
                    <select
                      value={command.rules[key]}
                      onChange={(e) =>
                        change({
                          ...command,
                          rules: {
                            ...command.rules,
                            [key]: e.target.value as 'lost' | 'same_quality',
                          },
                        })
                      }
                    >
                      <option value="lost">Broken units lost</option>
                      <option value="same_quality">
                        Allow recovery (no regular quality)
                      </option>
                    </select>
                  </label>
                ),
              )}
              {(
                [
                  'recoveryTurns',
                  'retiredRestTurns',
                  'siegeThreshold',
                  'siegeIncrement',
                  'exhaustionThreshold',
                ] as const
              ).map((key) => (
                <label key={key}>
                  {
                    {
                      recoveryTurns: 'Recovery delay (turns)',
                      retiredRestTurns: 'Rest after retiring (turns)',
                      siegeThreshold: 'Siege success threshold',
                      siegeIncrement: 'Progress per supplied invested turn',
                      exhaustionThreshold:
                        'Exhaustion threshold (blank disables)',
                    }[key]
                  }
                  <input
                    type="number"
                    min={
                      key === 'retiredRestTurns' || key === 'siegeIncrement'
                        ? 0
                        : 1
                    }
                    max={
                      key === 'recoveryTurns' || key === 'retiredRestTurns'
                        ? 100
                        : key === 'siegeIncrement'
                          ? 1000
                          : 10000
                    }
                    value={command.rules[key] ?? ''}
                    onChange={(e) =>
                      change({
                        ...command,
                        rules: {
                          ...command.rules,
                          [key]:
                            key === 'exhaustionThreshold' &&
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
              {(['deadlineOutcome', 'conflictOutcome'] as const).map((key) => (
                <label key={key}>
                  {key === 'deadlineOutcome'
                    ? 'Deadline outcome if no other condition'
                    : 'Outcome when victory conditions conflict'}
                  <select
                    value={command.rules[key]}
                    onChange={(e) =>
                      change({
                        ...command,
                        rules: {
                          ...command.rules,
                          [key]: e.target.value as 'french' | 'allied' | 'draw',
                        },
                      })
                    }
                  >
                    {['french', 'allied', 'draw'].map((side) => (
                      <option key={side} value={side}>
                        {side}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p>
              Changing rules affects future reviews/checkpoints. Applied battle
              reviews and existing recovery due dates remain unchanged.
            </p>
          </>
        )}
        {command.kind === 'apply-battle' && (
          <BattleAftermathFields
            campaign={campaign}
            command={command}
            change={change}
          />
        )}
        {command.kind === 'siege-conditions' && (
          <>
            <p>
              Record the umpire-verified operational situation. The illustration
              does not verify supply or investment. Progress and victory are
              checked only when a completed turn is finalized.
            </p>
            {(['invested', 'supplied', 'relieved'] as const).map((key) => (
              <label key={key} className="check-label">
                <input
                  type="checkbox"
                  checked={command.conditions[key]}
                  onChange={(e) =>
                    change({
                      ...command,
                      conditions: {
                        ...command.conditions,
                        [key]: e.target.checked,
                      },
                    })
                  }
                />
                {
                  {
                    invested: 'Investment active',
                    supplied: 'Supply route verified by umpire',
                    relieved: 'Relief achieved and verified',
                  }[key]
                }
              </label>
            ))}
          </>
        )}
        {command.kind === 'exhaustion' && (
          <>
            <p>
              Campaign exhaustion is a manual operational record, separate from
              battle Army Morale.
            </p>
            <div className="form-grid">
              {(['french', 'allied'] as const).map((side) => (
                <label key={side}>
                  {side} campaign exhaustion
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={command.values[side]}
                    onChange={(e) =>
                      change({
                        ...command,
                        values: {
                          ...command.values,
                          [side]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </>
        )}
        {command.kind === 'commander-arrived' && (
          <>
            <label>
              Commander name
              <input
                maxLength={120}
                value={command.displayName}
                onChange={(e) =>
                  change({ ...command, displayName: e.target.value })
                }
              />
            </label>
            <label>
              Commander faction
              <select
                value={command.side}
                onChange={(e) =>
                  change({
                    ...command,
                    side: e.target.value as 'french' | 'allied',
                  })
                }
              >
                <option value="french">French</option>
                <option value="allied">Allied</option>
              </select>
            </label>
            <label>
              Private Notable/card reference (optional)
              <textarea
                maxLength={4000}
                value={command.notableReference}
                onChange={(e) =>
                  change({ ...command, notableReference: e.target.value })
                }
              />
            </label>
            <p>No card effect is interpreted or applied automatically.</p>
          </>
        )}
        {command.kind === 'commander-status' && (
          <label>
            Commander status
            <select
              value={command.status}
              onChange={(e) =>
                change({
                  ...command,
                  status: e.target.value as typeof command.status,
                })
              }
            >
              {['active', 'lost', 'retired'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}
        {command.kind === 'commander-attach' && (
          <label>
            Attach to column
            <select
              aria-label="Attach to column"
              value={command.columnId ?? ''}
              onChange={(e) =>
                change({ ...command, columnId: e.target.value || null })
              }
            >
              <option value="">Unattached</option>
              {campaign.columns
                .filter(
                  (column) =>
                    column.factionId ===
                    campaign.commanders.find(
                      (c) => c.id === command.commanderId,
                    )?.factionId,
                )
                .map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.displayName}
                  </option>
                ))}
            </select>
          </label>
        )}
        {'notes' in command && (
          <label>
            Reason for campaign change
            <textarea
              maxLength={4000}
              value={notes}
              onChange={(e) => {
                if ('notes' in command)
                  change({ ...command, notes: e.target.value });
              }}
            />
          </label>
        )}
      </fieldset>
      <div className="button-row">
        <button
          disabled={state.pending}
          onClick={() => {
            void state.saveTabletop();
          }}
        >
          {command.kind === 'apply-battle'
            ? 'Review and apply battle changes'
            : 'Save campaign changes'}
        </button>
        <button
          className="secondary"
          disabled={state.pending}
          onClick={() => {
            void state.discard();
          }}
        >
          Discard campaign draft
        </button>
      </div>
    </section>
  );
}
function BattleAftermathFields({
  campaign,
  command,
  change,
}: {
  campaign: FontenoyCampaign;
  command: Extract<AftermathCommand, { kind: 'apply-battle' }>;
  change(command: AftermathCommand): void;
}) {
  const input = command.input;
  const battle = campaign.tabletop!.battles.find(
    (b) => b.id === input.battleId,
  )!;
  const update = (patch: Partial<typeof input>) =>
    change({ ...command, input: { ...input, ...patch } });
  let previewError = '';
  let preview: FontenoyCampaign | null = null;
  try {
    preview = applyAftermathCommand(campaign, {
      command,
      recordId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      timestamp: campaign.updatedAt,
    });
  } catch (error) {
    previewError =
      error instanceof Error ? error.message : 'Review incomplete.';
  }
  return (
    <>
      <h3>{battle.declaration.title}</h3>
      <p>
        Broken regulars rebuild at conscript quality only when allowed.
        Irregular/artillery recovery follows the chosen variant. Surviving units
        are unchanged; retiring units rest only if configured. Final tactical
        disruption is not a permanent status.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Broken unit</th>
              <th>Campaign action</th>
            </tr>
          </thead>
          <tbody>
            {input.broken.map((entry, index) => (
              <tr key={entry.unitId}>
                <td>
                  {
                    campaign.units.find((u) => u.id === entry.unitId)
                      ?.displayName
                  }
                </td>
                <td>
                  <select
                    aria-label={`Campaign action ${campaign.units.find((u) => u.id === entry.unitId)?.displayName}`}
                    disabled={
                      campaign.aftermath!.rules.strategy !== 'manual_review_v1'
                    }
                    value={entry.action}
                    onChange={(e) =>
                      update({
                        broken: input.broken.map((r, i) =>
                          i === index
                            ? {
                                ...r,
                                action: e.target.value as typeof r.action,
                              }
                            : r,
                        ),
                      })
                    }
                  >
                    <option value="recover">Scheduled recovery</option>
                    <option value="lost">Lost from campaign</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Commander decisions</h3>
      {input.commanders.map((entry, index) => (
        <label key={entry.commanderId}>
          Campaign status{' '}
          {
            campaign.commanders.find((c) => c.id === entry.commanderId)
              ?.displayName
          }
          <select
            value={entry.status}
            onChange={(e) =>
              update({
                commanders: input.commanders.map((r, i) =>
                  i === index
                    ? { ...r, status: e.target.value as typeof r.status }
                    : r,
                ),
              })
            }
          >
            {['active', 'lost', 'retired'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ))}
      <h3>Post-battle positions</h3>
      <p>
        Record agreed positions; no retreat or pursuit is inferred. Opposing
        columns must be separated before the hold is released.
      </p>
      {input.positions.map((position, index) => (
        <label key={position.columnId}>
          Post-battle square{' '}
          {
            campaign.columns.find((c) => c.id === position.columnId)
              ?.displayName
          }
          <select
            value={position.squareId}
            onChange={(e) =>
              update({
                positions: input.positions.map((r, i) =>
                  i === index ? { ...r, squareId: e.target.value } : r,
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
      ))}
      <h3>Manual points and exhaustion</h3>
      <p>
        Enter Epic Points calculated from your own Maurice materials. Blank
        means not recorded; the app only sums entered values and does not
        approximate the official formula. Army Morale is not copied into
        exhaustion.
      </p>
      <div className="form-grid">
        {(['french', 'allied'] as const).map((side) => (
          <label key={`points:${side}`}>
            {side} Epic Points (optional)
            <input
              type="number"
              min="0"
              max="10000"
              value={input.epicPoints[side] ?? ''}
              onChange={(e) =>
                update({
                  epicPoints: {
                    ...input.epicPoints,
                    [side]:
                      e.target.value === '' ? null : Number(e.target.value),
                  },
                })
              }
            />
          </label>
        ))}
        {(['french', 'allied'] as const).map((side) => (
          <label key={`exhaustion:${side}`}>
            {side} exhaustion added
            <input
              type="number"
              min="0"
              max="10000"
              value={input.exhaustionDelta[side]}
              onChange={(e) =>
                update({
                  exhaustionDelta: {
                    ...input.exhaustionDelta,
                    [side]: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <label>
        After-action notes
        <textarea
          maxLength={4000}
          value={input.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <h3>Change preview</h3>
      {previewError ? (
        <p aria-live="polite">{previewError}</p>
      ) : (
        <ul aria-label="Battle changes preview">
          {preview!.aftermath!.reviews.at(-1)!.unitChanges.map((r) => (
            <li key={r.unitId}>
              {campaign.units.find((u) => u.id === r.unitId)?.displayName}:{' '}
              {r.beforeStatus} / {r.beforeQuality ?? 'no regular quality'} →{' '}
              {r.afterStatus} / {r.afterQuality ?? 'no regular quality'}
              {r.dueTurn ? `; ready at turn ${r.dueTurn} checkpoint` : ''}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
