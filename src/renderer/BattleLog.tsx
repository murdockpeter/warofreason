import { useState } from 'react';
import type { FontenoyCampaign } from '../domain/campaign';
import {
  battleResultDraft,
  candidateAssigned,
  defaultScoutingRules,
} from '../domain/tabletop';
import { squareLabel } from '../domain/setup-editing';
import { useCampaigns } from './campaign-store';
import { useSession } from './session';
import { BattleBrief } from './BattleBrief';
import { battleReviewed } from '../domain/aftermath-state';
import {
  DeclarationWizard,
  ResultEditor,
  ScoutingEditor,
  ScoutingRulesEditor,
} from './TabletopEditors';

export function BattleLog({ campaign }: { campaign: FontenoyCampaign }) {
  const state = useCampaigns();
  const navigate = useSession((s) => s.navigate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const battles = campaign.tabletop?.battles ?? [];
  const selected = battles.find((b) => b.id === selectedId) ?? battles.at(-1);
  const rules = campaign.tabletop?.rules ?? defaultScoutingRules;
  const available =
    campaign.status === 'active' &&
    !!campaign.operations &&
    campaign.operations.phase !== 'resolution' &&
    !campaign.aftermath?.victory;
  const scoutAvailable =
    available &&
    campaign.operations?.phase === 'planning' &&
    campaign.aftermath?.pendingTurn == null;
  const candidates = (campaign.operations?.engagements ?? []).filter(
    (e) => !candidateAssigned(campaign, e),
  );
  const draft = state.tabletopDraft;
  return (
    <div className="tabletop-layout" data-helper="legacy-battles">
      <section className="panel tabletop-overview" aria-label="Tabletop bridge">
        <h2>Scouting & tabletop battles</h2>
        <p>
          Record what players and the umpire agreed, prepare a shared brief,
          then play Maurice at the table. Battle results are recorded here;
          campaign effects are reviewed separately in Milestone F.
        </p>
        <div className="button-row">
          <button
            disabled={!scoutAvailable || state.pending}
            onClick={() => {
              void state.beginTabletop({
                kind: 'scout',
                input: {
                  scoutId: '',
                  targetColumnId: '',
                  roll: null,
                  rollSource: 'physical',
                  modifier: 0,
                  reason: '',
                  state: 'unknown',
                  estimate: '',
                },
              });
            }}
          >
            Record scouting
          </button>
          <button
            className="secondary"
            disabled={!scoutAvailable || state.pending}
            onClick={() => {
              void state.beginTabletop({
                kind: 'scouting-rules',
                rules: structuredClone(rules),
              });
            }}
          >
            Review scouting rules
          </button>
          <button
            className="secondary"
            onClick={() => navigate('Campaign Map')}
          >
            Back to campaign map
          </button>
        </div>
        <p className="save-caption">
          House rule {rules.ruleId}: range {rules.rangeSquares}, lifetime{' '}
          {rules.expiresAfterTurns} turn(s), {rules.attemptsPerColumnPerTurn}{' '}
          attempt(s) per column/turn. Eligible types:{' '}
          {rules.eligibleTypes.map((t) => t.replaceAll('_', ' ')).join(', ')}.
          The umpire decides intelligence; no success threshold is automated.
        </p>
        {!available && (
          <p>
            {campaign.status === 'archived'
              ? 'Archived campaign · read-only.'
              : campaign.operations?.phase === 'resolution'
                ? 'Resolve or reopen issued orders before preparing tabletop actions.'
                : 'Start the campaign and enable operational play on Campaign Map first.'}
          </p>
        )}
        {state.error && (
          <p role="alert" className="campaign-error">
            {state.error}
          </p>
        )}
        {state.message && <p role="status">{state.message}</p>}
      </section>
      {draft?.kind === 'scout' && (
        <ScoutingEditor campaign={campaign} draft={draft} />
      )}
      {draft?.kind === 'scouting-rules' && (
        <ScoutingRulesEditor draft={draft} />
      )}
      {draft?.kind === 'declaration' && (
        <DeclarationWizard
          key={`${draft.declaration.candidate.attackerId}:${draft.declaration.candidate.defenderId}:${draft.declaration.candidate.turn}`}
          campaign={campaign}
          draft={draft}
        />
      )}
      {draft?.kind === 'result' &&
        battles.some((b) => b.id === draft.battleId) && (
          <ResultEditor
            battle={battles.find((b) => b.id === draft.battleId)!}
            draft={draft}
          />
        )}
      <section
        className="panel tabletop-overview"
        aria-label="Battle candidates"
      >
        <h2>Engagements awaiting declaration</h2>
        {!candidates.length && (
          <p>
            No unassigned engagement candidates. A legal route into an opposing
            occupied square records a candidate on resolution.
          </p>
        )}
        {candidates.map((candidate) => {
          const attacker = campaign.columns.find(
            (c) => c.id === candidate.attackerId,
          )!;
          const defender = campaign.columns.find(
            (c) => c.id === candidate.defenderId,
          )!;
          const square = campaign.squares.find(
            (s) => s.id === candidate.squareId,
          )!;
          return (
            <div
              key={`${candidate.attackerId}:${candidate.defenderId}:${candidate.turn}`}
              className="candidate-row"
            >
              <p>
                Turn {candidate.turn} · {squareLabel(square)} ·{' '}
                {attacker.displayName} / {defender.displayName}
              </p>
              <button
                disabled={!available || state.pending}
                onClick={() => {
                  void state.beginTabletop({
                    kind: 'declaration',
                    declaration: {
                      candidate,
                      title: `Battle at ${squareLabel(square)}`,
                      participants: [
                        {
                          columnId: attacker.id,
                          role: 'attacker',
                          entryEdge: 'on_table',
                          reinforcement: false,
                          arrivalNotes: '',
                        },
                        {
                          columnId: defender.id,
                          role: 'defender',
                          entryEdge: 'on_table',
                          reinforcement: false,
                          arrivalNotes: '',
                        },
                      ],
                      objectives: '',
                      terrainNotes: '',
                      specialInstructions: '',
                    },
                  });
                }}
              >
                Declare Battle
              </button>
            </div>
          );
        })}
      </section>
      {!!battles.length && (
        <section className="panel tabletop-overview" aria-label="Saved battles">
          <h2>Saved battles</h2>
          <ul>
            {[...battles].reverse().map((battle) => (
              <li key={battle.id}>
                <button
                  className="secondary"
                  onClick={() => setSelectedId(battle.id)}
                >
                  {battle.declaration.title} ·{' '}
                  {battle.stage.replaceAll('_', ' ')}
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="button-row">
              {selected.stage === 'pending' && (
                <button
                  disabled={!available || state.pending || !!draft}
                  onClick={() => {
                    void state.commitTabletop({
                      kind: 'start-battle',
                      battleId: selected.id,
                    });
                  }}
                >
                  Begin tabletop battle
                </button>
              )}
              {selected.stage === 'in_progress' && (
                <button
                  disabled={!available || state.pending}
                  onClick={() => {
                    void state.beginTabletop({
                      kind: 'result',
                      battleId: selected.id,
                      result: battleResultDraft(selected),
                    });
                  }}
                >
                  Enter battle result
                </button>
              )}
              {selected.stage === 'resolved' && (
                <>
                  <p>
                    Confirmed result is read-only.{' '}
                    {battleReviewed(campaign, selected.id)
                      ? 'Campaign changes have been reviewed and applied.'
                      : 'Review the campaign consequences before releasing participants.'}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => navigate('Siege & Victory')}
                  >
                    Review post-battle campaign changes
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}
      {selected && (
        <BattleBrief key={selected.id} campaign={campaign} battle={selected} />
      )}
      {!!campaign.tabletop?.contacts.length && (
        <section
          className="panel tabletop-overview"
          aria-label="Scouting journal"
        >
          <h2>Scouting reports · umpire record</h2>
          <ol>
            {[...campaign.tabletop.contacts].reverse().map((contact) => (
              <li key={contact.id}>
                <strong>{contact.input.state}</strong> · turn {contact.turn},{' '}
                {contact.date} · {contact.timestamp} ·{' '}
                {campaign.turn < contact.expiresAtTurn
                  ? `expires at turn ${contact.expiresAtTurn}`
                  : 'expired'}
                <p>
                  Scout:{' '}
                  {
                    campaign.columns.find((c) => c.id === contact.input.scoutId)
                      ?.displayName
                  }
                  ; target: {contact.snapshot.displayName} at{' '}
                  {squareLabel(
                    campaign.squares.find(
                      (s) => s.id === contact.snapshot.squareId,
                    )!,
                  )}
                  . Roll {contact.input.roll} ({contact.input.rollSource}){' '}
                  {contact.input.modifier >= 0 ? '+' : ''}
                  {contact.input.modifier} ={' '}
                  {contact.input.roll + contact.input.modifier}. Umpire
                  decision: {contact.input.reason}
                </p>
                {contact.input.state === 'estimated' && (
                  <p>Approved estimate: {contact.input.estimate}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
