import { useState } from 'react';
import type { Campaign } from '../domain/campaign';
import type { MapView } from '../domain/operations-schema';
import { helpTopics, nextPlayerStep } from './player-help';
import type { HelpTopic } from './player-help';
import type { Screen } from './session';
import { ReaderDialog } from './ReaderDialog';

export function HelpManual({
  campaign,
  view,
  screen,
  hasDraft,
  onNavigate,
  onDismiss,
}: {
  campaign: Campaign | null;
  view: MapView;
  screen: Screen;
  hasDraft: boolean;
  onNavigate(screen: Screen): void;
  onDismiss(): void;
}) {
  const [topicId, setTopicId] = useState<HelpTopic>(
    screen === 'Battle Log'
      ? 'battle'
      : screen === 'Siege & Victory'
        ? 'siege'
        : screen === 'Campaign Map' || screen === 'Turn Orders'
          ? 'map'
          : 'start',
  );
  const topic = helpTopics.find((t) => t.id === topicId)!;
  const next = nextPlayerStep(campaign, view);
  const go = (destination: Screen) => {
    onNavigate(destination);
    onDismiss();
  };
  if (campaign?.schemaVersion === 3)
    return (
      <ReaderDialog
        title="Player manual"
        className="help-dialog"
        onDismiss={onDismiss}
      >
        <h3>{next.title}</h3>
        <p>{next.text}</p>
        {hasDraft && (
          <p>You have unsaved edits. Reading Help preserves them.</p>
        )}
        <ol>
          {campaign.fontenoy && (
            <li>
              During clear planning, open Maurice unit recovery and
              review/enable its policy. One old recovery turn defaults to{' '}
              {campaign.fontenoy.sourceSchedule.daysPerTurn * 24} calendar
              hours, based on the saved campaign schedule—not one AM/PM phase.
              Agree the conversion and rebuilding variants before battle.
            </li>
          )}
          <li>
            Use Dashboard → New simultaneous Fontenoy campaign, or create a
            simultaneous copy from your saved Fontenoy setup. Maurice and
            Fontenoy in 1745 remain the setting, with French, Dutch and
            Anglo-Allied forces and the campaign around Tournai.
          </li>
          <li>
            Optional preparation: enable screening and withdrawal on Campaign
            Map before orders. Each HQ may deploy one ordinary screen outside
            all unit zones; a recalled screen returns next phase. Save/lock both
            sides’ withdrawals (or empty holds), then review and resolve them
            together. Withdrawn corps hold for the phase. Own control, influence
            and HQ command overlays help plan legal routes.
          </li>
          <li>
            Select a side or use umpire view. Select a friendly corps, then
            adjacent hexes. Save a movement segment; a corps can have up to
            three. Road-only segments must remain on connected roads.
          </li>
          <li>
            Save and lock both sides independently. Unordered corps hold. The
            umpire resolves both sides on one shared five-minute clock.
          </li>
          <li>
            At a contact, record a stand-off or declare a tactical battle.
            Review potential nearby reinforcements; committing reserves the
            corps. Arrival windows are conditional estimates, with optional
            tactical-turn conversion.
          </li>
          <li>
            Play any tactical game. Enter the actual result, arrivals, losses,
            readiness and post-battle hexes. Confirm the result, approve
            campaign effects, then resume movement to apply them at battle end.
          </li>
          <li>
            Confirmed results can be corrected through a new revision.
            Already-applied effects can be compensated only when later movement
            does not depend on them.
          </li>
          <li>
            Finish the shared phase after all reviews. In the next phase,
            reposition HQs and review due blown returns before orders. Save a
            full JSON backup from Dashboard.
          </li>
        </ol>
        <p>
          AM 06:00–12:00; PM 12:00–18:00. Original movement and timing charts
          are available on the campaign map. Maurice is the default tactical
          game; other results can be entered manually. With unit recovery
          enabled, record every frozen unit’s outcome, optional disruption/Army
          Morale and explicit broken-unit decisions. Approval plus battle-end
          resolution applies losses/rebuilding; Finish shared phase processes
          due returns. Units keep conscript quality when rebuilt. Correct
          results before later movement or phase changes depend on them.
          Automatic siege/victory integration remains the next increment.
        </p>
        <button onClick={() => go('Campaign Map')}>Open Campaign Map</button>
      </ReaderDialog>
    );
  return (
    <ReaderDialog
      title="Player manual"
      className="help-dialog"
      onDismiss={onDismiss}
    >
      <section className="help-next" aria-label="What to do now">
        <span className="dossier-kicker">WHAT TO DO NOW</span>
        <h3>{next.title}</h3>
        <p>{next.text}</p>
        <button onClick={() => go(next.screen)}>Open {next.screen}</button>
      </section>
      {hasDraft && (
        <p className="help-draft-note">
          You have unsaved edits. Reading this guide leaves them intact; return
          to your editor to save or discard them.
        </p>
      )}
      <div className="manual-layout">
        <nav aria-label="Manual topics">
          {helpTopics.map((t) => (
            <button
              key={t.id}
              className="secondary"
              aria-pressed={topicId === t.id}
              onClick={() => setTopicId(t.id)}
            >
              {t.title}
            </button>
          ))}
        </nav>
        <section className="manual-topic" aria-label={topic.title}>
          <h3>{topic.title}</h3>
          <ol>
            {topic.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {topic.notes.map((note) => (
            <p className="manual-note" key={note}>
              {note}
            </p>
          ))}
          <button className="secondary" onClick={() => go(topic.screen)}>
            Go to {topic.screen}
          </button>
        </section>
      </div>
      <p className="reader-footnote">
        Available offline · F1 opens Help · Escape closes this manual. Campaign
        procedures are configurable house rules; play Maurice tactical battles
        with your own materials.
      </p>
    </ReaderDialog>
  );
}
