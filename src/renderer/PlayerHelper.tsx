import { useEffect, useRef, useState } from 'react';
import type { Campaign } from '../domain/campaign';
import type { MapView } from '../domain/operations-schema';
import { useCampaigns } from './campaign-store';
import { useSession } from './session';
import { useOperationalSession } from './operational-session';
import { useHelperSession } from './helper-session';
import { playerGuide } from './player-guide';
import type { GuideChoice } from './player-guide';
import type { Screen } from './session';

export function PlayerHelper({
  campaign,
  view,
  onHelp,
}: {
  campaign: Campaign | null;
  view: MapView;
  onHelp(): void;
}) {
  const store = useCampaigns();
  const { screen, navigate } = useSession();
  const { planningSide } = useOperationalSession();
  const { enabled } = useHelperSession();
  const [request, setRequest] = useState<{
    choice: GuideChoice;
    signature: string;
  } | null>(null);
  const shownRequest = useRef<typeof request>(null);
  let draft: { target: string; screen: Screen } | null = null;
  if (store.waterlooDraft) {
    const kind = store.waterlooDraft.kind;
    draft = {
      target:
        kind === 'epic'
          ? 'epic'
          : kind === 'officer'
            ? 'officers'
            : kind === 'route'
              ? 'route'
              : kind === 'result'
                ? 'result'
                : kind === 'withdrawal'
                  ? 'preparation'
                  : kind.startsWith('siege')
                    ? 'siege'
                    : 'recovery',
      screen: 'Campaign Map',
    };
  } else if (store.setupDraft)
    draft = { target: 'screen', screen: 'Armies/Columns' };
  else if (store.draft)
    draft = { target: 'campaign-editor', screen: 'Dashboard' };
  else if (store.planningDraft)
    draft = { target: 'screen', screen: 'Campaign Map' };
  else if (store.tabletopDraft)
    draft = {
      target: 'screen',
      screen:
        store.tabletopDraft.kind === 'aftermath'
          ? 'Siege & Victory'
          : store.tabletopDraft.kind === 'formation'
            ? 'Campaign Map'
            : 'Battle Log',
    };
  const guide = playerGuide(campaign, view, planningSide, draft);
  const signature = JSON.stringify(guide);
  useEffect(() => {
    if (!enabled) return;
    const choices = JSON.parse(signature).choices as GuideChoice[];
    const highlighted: HTMLElement[] = [];
    for (const choice of choices.filter((c) => c.screen === screen)) {
      const target = document.querySelector<HTMLElement>(
        `[data-helper="${choice.target}"]`,
      );
      if (target && !target.matches(':disabled')) {
        target.classList.add('helper-next');
        highlighted.push(target);
      }
    }
    return () =>
      highlighted.forEach((target) => target.classList.remove('helper-next'));
  }, [enabled, signature, screen, store.pending]);
  useEffect(() => {
    if (
      !enabled ||
      !request ||
      shownRequest.current === request ||
      request.choice.screen !== screen ||
      request.signature !== signature
    )
      return;
    const target =
      document.querySelector<HTMLElement>(
        `[data-helper="${request.choice.target}"]`,
      ) ?? document.querySelector<HTMLElement>('[data-helper="view"]');
    if (!target) return;
    shownRequest.current = request;
    for (
      let parent = target.parentElement;
      parent;
      parent = parent.parentElement
    )
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    if (target instanceof HTMLDetailsElement) target.open = true;
    const focus = target.matches('button,input,select,textarea')
      ? target
      : (target.querySelector<HTMLElement>('[data-helper-focus="formation"]') ??
        target.querySelector<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary',
        ) ??
        target);
    const hadTabIndex = focus.hasAttribute('tabindex');
    if (
      !hadTabIndex &&
      focus === target &&
      !focus.matches('button,input,select,textarea,summary')
    )
      focus.tabIndex = -1;
    target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    focus.focus({ preventScroll: true });
    return () => {
      if (!hadTabIndex && focus === target) focus.removeAttribute('tabindex');
    };
  }, [enabled, request, screen, signature]);
  if (!enabled) return null;
  const busy = store.pending || store.loading;
  return (
    <section className="player-helper" aria-label="Player helper">
      <div className="section-heading">
        <span className="eyebrow">HELPER MODE · WHAT NEXT?</span>
        <button className="secondary" onClick={onHelp}>
          Read the player manual
        </button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <h2>{busy ? 'Loading or saving your campaign…' : guide.title}</h2>
        <p>
          {busy
            ? 'Your next choices will be available when this finishes.'
            : guide.text}
        </p>
      </div>
      {guide.stage !== undefined && (
        <ol className="helper-stages" aria-label="Shared turn steps">
          {['Prepare', 'Plan', 'Resolve', 'Battle review', 'Finish'].map(
            (label, i) => (
              <li
                key={label}
                aria-current={guide.stage === i ? 'step' : undefined}
              >
                {i + 1}. {label}
              </li>
            ),
          )}
        </ol>
      )}
      <div className="helper-choices">
        {guide.choices.map((choice, i) => (
          <div key={choice.label}>
            <strong>
              {i + 1}. {choice.label}
            </strong>
            <p>{choice.detail}</p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setRequest({ choice, signature });
                navigate(choice.screen);
              }}
            >
              Show me: {choice.label}
            </button>
          </div>
        ))}
      </div>
      {request?.signature === signature && (
        <p className="helper-location" role="status">
          Find: {request.choice.label}. Review the highlighted controls before
          confirming an action. Shared management requires umpire view when both
          players are ready.
        </p>
      )}
    </section>
  );
}
