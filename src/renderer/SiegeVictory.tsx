import type { FontenoyCampaign } from '../domain/campaign';
import type { AftermathCommand } from '../domain/aftermath-schema';
import {
  aftermathDraft,
  defaultAftermathRules,
  epicPointSummary,
} from '../domain/aftermath';
import {
  battleReviewed,
  pendingCampaignReviews,
} from '../domain/aftermath-state';
import { squareLabel } from '../domain/setup-editing';
import { useCampaigns } from './campaign-store';
import { useSession } from './session';
import { AftermathEditor } from './AftermathEditors';

export function SiegeVictory({ campaign }: { campaign: FontenoyCampaign }) {
  const state = useCampaigns();
  const navigate = useSession((s) => s.navigate);
  const strategic = campaign.aftermath;
  const canEdit =
    campaign.status === 'active' &&
    !!campaign.operations &&
    campaign.operations.phase !== 'resolution' &&
    !campaign.operations.orders.length &&
    !strategic?.victory &&
    !state.pending;
  const begin = (command: AftermathCommand) => {
    void state.beginTabletop({ kind: 'aftermath', command });
  };
  const draft =
    state.tabletopDraft?.kind === 'aftermath'
      ? state.tabletopDraft.command
      : null;
  const battles = campaign.tabletop?.battles ?? [];
  return (
    <div className="tabletop-layout">
      <section
        className="panel tabletop-overview"
        aria-label="Campaign aftermath and siege"
      >
        <h2>Campaign aftermath, siege & victory</h2>
        <p>
          Review campaign consequences explicitly. Loss/recovery, supply, siege
          thresholds, exhaustion and victory are configurable house rules. Epic
          Points are entered manually; tactical Army Morale and disruption stay
          in the battle record.
        </p>
        {!strategic ? (
          <>
            <p>
              Enable these rules prospectively. Initial defaults: regular
              rebuilding{' '}
              {defaultAftermathRules.allowRegularRebuild
                ? 'allowed at conscript quality'
                : 'disabled'}
              , recovery delay {defaultAftermathRules.recoveryTurns} turn(s),
              siege threshold {defaultAftermathRules.siegeThreshold}, supplied
              investment progress {defaultAftermathRules.siegeIncrement} per
              completed turn.
            </p>
            <button
              disabled={!canEdit}
              onClick={() => {
                void state.commitAftermath({ kind: 'enable' });
              }}
            >
              Enable post-battle and siege rules
            </button>
          </>
        ) : (
          <>
            <p>
              Siege: {campaign.settings.siege.progress} /{' '}
              {strategic.rules.siegeThreshold} ·{' '}
              {strategic.conditions.invested ? 'invested' : 'not invested'} ·{' '}
              {strategic.conditions.supplied
                ? 'supply verified'
                : 'supply unverified'}{' '}
              ·{' '}
              {strategic.conditions.relieved
                ? 'relief verified'
                : 'no verified relief'}
              .
            </p>
            <p className="provenance-note">
              Rule {strategic.rules.ruleId} · {strategic.rules.strategy}.
              Victory is checked only at a completed-turn checkpoint after all
              contacts and battle reviews. Progress requires investment and
              verified supply, without relief.
            </p>
            {strategic.victory ? (
              <div role="status">
                <h3>Campaign outcome: {strategic.victory.winner}</h3>
                <p>
                  Turn {strategic.victory.turn} · {strategic.victory.timestamp}
                </p>
                <ul>
                  {strategic.victory.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={!canEdit}
                  onClick={() =>
                    begin({
                      kind: 'rules',
                      rules: structuredClone(strategic.rules),
                    })
                  }
                >
                  Review campaign house rules
                </button>
                <button
                  className="secondary"
                  disabled={!canEdit}
                  onClick={() =>
                    begin({
                      kind: 'siege-conditions',
                      conditions: { ...strategic.conditions },
                      notes: '',
                    })
                  }
                >
                  Record investment, supply and relief
                </button>
                <button
                  className="secondary"
                  disabled={!canEdit}
                  onClick={() =>
                    begin({
                      kind: 'exhaustion',
                      values: { ...strategic.exhaustion },
                      notes: '',
                    })
                  }
                >
                  Record campaign exhaustion
                </button>
              </div>
            )}
            {strategic.pendingTurn !== null && (
              <section aria-label="Completed turn checkpoint">
                <h3>Turn {strategic.pendingTurn} awaits finalization</h3>
                <p>
                  {pendingCampaignReviews(campaign)
                    ? 'Finish outstanding contacts, tabletop results and campaign aftermath reviews first.'
                    : 'Finalize once to process due recoveries, update siege progress and evaluate the agreed victory conditions.'}
                </p>
                <button
                  disabled={
                    !canEdit ||
                    !!state.tabletopDraft ||
                    pendingCampaignReviews(campaign)
                  }
                  onClick={() => {
                    void state.commitAftermath({ kind: 'finalize-turn' });
                  }}
                >
                  Finalize turn {strategic.pendingTurn}
                </button>
              </section>
            )}
          </>
        )}
        {!canEdit && !strategic?.victory && (
          <p>
            Start the campaign and enable operational play first. Reopen and
            clear any issued orders before changing campaign state. Archived
            records are read-only.
          </p>
        )}
        {state.error && (
          <p role="alert" className="campaign-error">
            {state.error}
          </p>
        )}
        {state.message && <p role="status">{state.message}</p>}
      </section>
      {draft && <AftermathEditor campaign={campaign} command={draft} />}
      {strategic && (
        <>
          <section
            className="panel tabletop-overview"
            aria-label="Post-battle reviews"
          >
            <h2>Post-battle campaign review</h2>
            {!battles.length && <p>No tabletop battles recorded yet.</p>}
            {battles.map((battle) => (
              <div className="candidate-row" key={battle.id}>
                <p>
                  {battle.declaration.title} ·{' '}
                  {battle.stage.replaceAll('_', ' ')} ·{' '}
                  {battleReviewed(campaign, battle.id)
                    ? 'campaign changes applied'
                    : 'campaign review outstanding'}
                </p>
                {battle.stage === 'resolved' &&
                !battleReviewed(campaign, battle.id) ? (
                  <button
                    disabled={!canEdit}
                    onClick={() =>
                      begin({
                        kind: 'apply-battle',
                        input: aftermathDraft(campaign, battle),
                      })
                    }
                  >
                    Review aftermath: {battle.declaration.title}
                  </button>
                ) : (
                  battle.stage !== 'resolved' && (
                    <button
                      className="secondary"
                      onClick={() => navigate('Battle Log')}
                    >
                      Complete tabletop battle
                    </button>
                  )
                )}
              </div>
            ))}
          </section>
          <section
            className="panel tabletop-overview"
            aria-label="Recovery and points"
          >
            <h2>Recovery and campaign totals</h2>
            <div className="force-totals">
              {(['french', 'allied'] as const).map((side) => {
                const points = epicPointSummary(campaign, side);
                return (
                  <p key={side}>
                    {side}: exhaustion {strategic.exhaustion[side]} · manually
                    entered Epic Points {points.entered}
                    {points.unrecorded
                      ? ` (${points.unrecorded} battle(s) not recorded)`
                      : ''}
                  </p>
                );
              })}
            </div>
            {strategic.recoveries.length ? (
              <ul>
                {strategic.recoveries.map((r, index) => (
                  <li key={`${r.unitId}:${index}`}>
                    {campaign.units.find((u) => u.id === r.unitId)?.displayName}{' '}
                    ·{' '}
                    {r.recoveredAtTurn === null
                      ? `recovering; due turn ${r.dueTurn}`
                      : `recovered at turn ${r.recoveredAtTurn}`}{' '}
                    · current quality{' '}
                    {campaign.units.find((u) => u.id === r.unitId)?.quality ??
                      'no regular quality'}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No scheduled recoveries.</p>
            )}
          </section>
          <section
            className="panel tabletop-overview"
            aria-label="Campaign commanders"
          >
            <h2>Commanders / Notables</h2>
            <p>
              Names and private references only; no tactical card effects are
              interpreted.
            </p>
            <button
              disabled={!canEdit}
              onClick={() =>
                begin({
                  kind: 'commander-arrived',
                  side: 'french',
                  displayName: '',
                  notableReference: '',
                  notes: '',
                })
              }
            >
              Record arriving commander
            </button>
            <ul>
              {campaign.commanders.map((c) => (
                <li key={c.id}>
                  <p>
                    {c.displayName} · {c.campaignStatus ?? 'active'} ·{' '}
                    {campaign.columns.find((column) =>
                      column.commanderIds.includes(c.id),
                    )?.displayName ?? 'unattached'}
                    {c.notableReference ? ` · ${c.notableReference}` : ''}
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary"
                      disabled={!canEdit}
                      onClick={() =>
                        begin({
                          kind: 'commander-attach',
                          commanderId: c.id,
                          columnId:
                            campaign.columns.find((column) =>
                              column.commanderIds.includes(c.id),
                            )?.id ?? null,
                          notes: '',
                        })
                      }
                    >
                      Manage attachment: {c.displayName}
                    </button>
                    <button
                      className="secondary"
                      disabled={!canEdit}
                      onClick={() =>
                        begin({
                          kind: 'commander-status',
                          commanderId: c.id,
                          status: c.campaignStatus ?? 'active',
                          notes: '',
                        })
                      }
                    >
                      Record status: {c.displayName}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section
            className="panel tabletop-overview"
            aria-label="Campaign after-action summary"
          >
            <h2>After-action summary</h2>
            {strategic.reviews.map((review) => (
              <details key={review.id}>
                <summary>
                  {
                    battles.find((b) => b.id === review.battleId)?.declaration
                      .title
                  }{' '}
                  · applied turn {review.turn}
                </summary>
                <p>
                  {review.timestamp} · {review.rules.ruleId} ·{' '}
                  {review.rules.strategy}
                </p>
                <p className="preserve-lines">{review.input.notes}</p>
                <ul>
                  {review.unitChanges.map((r) => (
                    <li key={r.unitId}>
                      {
                        campaign.units.find((u) => u.id === r.unitId)
                          ?.displayName
                      }
                      : {r.beforeStatus} / {r.beforeQuality ?? '—'} →{' '}
                      {r.afterStatus} / {r.afterQuality ?? '—'}
                      {r.dueTurn ? `; due turn ${r.dueTurn}` : ''}
                    </li>
                  ))}
                </ul>
                <p>
                  Manual Epic Points: French{' '}
                  {review.input.epicPoints.french ?? 'not recorded'}, Allied{' '}
                  {review.input.epicPoints.allied ?? 'not recorded'}. Exhaustion
                  added: French {review.input.exhaustionDelta.french}, Allied{' '}
                  {review.input.exhaustionDelta.allied}.
                </p>
                <ul>
                  {review.input.commanders.map((r) => (
                    <li key={r.commanderId}>
                      {
                        campaign.commanders.find((c) => c.id === r.commanderId)
                          ?.displayName
                      }
                      : {r.status}
                    </li>
                  ))}
                </ul>
                <ul>
                  {review.input.positions.map((p) => (
                    <li key={p.columnId}>
                      {
                        campaign.columns.find((c) => c.id === p.columnId)
                          ?.displayName
                      }
                      :{' '}
                      {squareLabel(
                        campaign.squares.find((s) => s.id === p.squareId)!,
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {strategic.boundaries.map((b) => (
              <p key={b.turn}>
                Turn {b.turn} finalized · siege {b.progressBefore} →{' '}
                {b.progressAfter} · {b.recoveredUnitIds.length}{' '}
                recovery/recoveries ·{' '}
                {b.victory
                  ? `outcome ${b.victory.winner}`
                  : 'no victory condition met'}
                .
              </p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
