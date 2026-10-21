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
