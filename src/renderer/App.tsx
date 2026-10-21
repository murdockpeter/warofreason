import { useEffect, useState } from 'react';
import { screens, useSession } from './session';
import type { Screen } from './session';
import { reportError } from './diagnostics';
import { CampaignDashboard } from './CampaignDashboard';
import { useCampaigns } from './campaign-store';
import { FontenoySetup } from './FontenoySetup';
import { CampaignMap } from './CampaignMap';
import { OperationalMap } from './OperationalMap';
import { BattleLog } from './BattleLog';
import { SiegeVictory } from './SiegeVictory';
import { useOperationalSession } from './operational-session';
import { SplitFormation } from './SplitFormation';
import { HelpManual } from './HelpManual';

const descriptions: Record<
  Screen,
  { lead: string; empty: string; detail: string; milestone: string }
> = {
  Dashboard: {
    lead: 'Your campaign, from march to tabletop.',
    empty: 'No campaign open',
    detail: 'Create, manage and reopen saved Fontenoy campaigns.',
    milestone: 'B · Campaign state',
  },
  'Campaign Map': {
    lead: 'The operational picture.',
    empty: 'No map loaded',
    detail:
      'A reviewed scenario module will supply the map. Movement and scouting await agreed, versioned campaign house rules.',
    milestone: 'D · Map & operations',
  },
  'Armies/Columns': {
    lead: 'Know the forces under your command.',
    empty: 'No armies assigned',
    detail:
      'Scenario-scale Maurice units and provisional column assignments will be reviewed during campaign setup.',
    milestone: 'C · Scenario setup',
  },
  'Turn Orders': {
    lead: 'Plan the next campaign day.',
    empty: 'No orders to review',
    detail:
      'Planning and resolution will preserve issued orders. No movement costs or turn durations are assumed here.',
    milestone: 'D · Operational orders',
  },
  'Battle Log': {
    lead: 'Take the campaign to the tabletop.',
    empty: 'No battles recorded',
    detail:
      'Battle briefs and manual results will connect the campaign to your tabletop Maurice games. Tactical combat is played at the table.',
    milestone: 'E · Tabletop bridge',
  },
  'Siege & Victory': {
    lead: 'Track the campaign’s objectives.',
    empty: 'No siege or objectives configured',
    detail:
      'Siege progression and campaign victory conditions require explicit, configurable house rules. No thresholds are active.',
    milestone: 'F · Siege & outcomes',
  },
  Settings: {
    lead: 'A local companion for your table.',
    empty: '',
    detail: '',
    milestone: 'A · Foundation',
  },
};

export function App() {
  const { view, setView } = useOperationalSession();
  const { screen, navigate, notice, setNotice } = useSession();
  const [version, setVersion] = useState('Connecting…');
  const [pending, setPending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const openHelp = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        if (!document.querySelector('dialog[open]')) setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', openHelp);
    return () => window.removeEventListener('keydown', openHelp);
  }, []);
  const {
    library,
    draft,
    setupDraft,
    planningDraft,
    tabletopDraft,
    pending: campaignPending,
    initialize,
  } = useCampaigns();
  useEffect(() => {
    void initialize().then(() => {
      const active = useCampaigns.getState().library?.active;
      if (
        active?.status === 'active' &&
        useSession.getState().screen === 'Dashboard'
      )
        useSession.getState().navigate('Campaign Map');
    });
  }, [initialize]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (
        useCampaigns.getState().planningDraft ||
        useCampaigns.getState().tabletopDraft ||
        useCampaigns.getState().draft ||
        useCampaigns.getState().setupDraft ||
        useCampaigns.getState().pending
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  useEffect(() => {
    let active = true;
    void window.desktop
      .getAppInfo()
      .then((info) => {
        if (active) setVersion(info.version);
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, []);
  async function resetNotice() {
    setPending(true);
    try {
      if (await window.desktop.confirmResetSession()) setNotice(null);
    } catch (error) {
      reportError(error);
    } finally {
      setPending(false);
    }
  }
  const content = descriptions[screen];
  const current = setupDraft ?? library?.active;
  const scenario = current?.schemaVersion === 2 ? current : null;
  return (
    <div
      className={`app-shell ${screen === 'Campaign Map' ? 'map-focused' : ''}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <details className="campaign-navigation">
        <summary>☰ Campaign menu</summary>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <div>
              <strong>MAURICE</strong>
              <span>Campaign Companion</span>
            </div>
          </div>
          <div className="nav-label">CAMPAIGN DESK</div>
          <nav aria-label="Main navigation">
            {screens
              .filter((item) => item !== 'Campaign Map')
              .map((item, index) => (
                <button
                  key={item}
                  aria-current={screen === item ? 'page' : undefined}
                  onClick={(e) => {
                    navigate(item);
                    const menu = e.currentTarget.closest('details');
                    if (menu) menu.open = false;
                  }}
                >
                  <span className="nav-number" aria-hidden="true">
                    0{index + 1}
                  </span>
                  {item}
                </button>
              ))}
          </nav>
          <div className="sidebar-footer">
            <span className="online-dot" /> Local desktop
            <span>Campaign outcomes · Milestone F</span>
          </div>
        </aside>
      </details>
      <div className="workspace">
        <header className="topbar">
          <button
            className="secondary"
            aria-current={screen === 'Campaign Map' ? 'page' : undefined}
            onClick={() => navigate('Campaign Map')}
          >
            Campaign Map
          </button>
          <span>
            THE ROAD TO FONTENOY <span className="muted">/ 1745</span>
          </span>
          <span className="badge">
            {library?.active?.status === 'archived'
              ? 'Archived campaign'
              : scenario?.aftermath?.victory
                ? 'Campaign concluded'
                : library?.active?.status === 'active'
                  ? 'Campaign started'
                  : 'Campaign setup'}
          </span>
        </header>
        <section className="status-strip" aria-label="Campaign status">
          {[
            [
              'Campaign day',
              scenario?.date
                ? `${scenario.date} · turn ${scenario.turn}`
                : 'Not started',
            ],
            ['Active faction', scenario?.activeSide ?? 'Not assigned'],
            [
              'Siege status',
              scenario?.aftermath
                ? `${scenario.settings.siege.progress} / ${scenario.aftermath.rules.siegeThreshold} · ${scenario.aftermath.conditions.supplied ? 'supply verified' : 'supply unverified'}`
                : scenario
                  ? `${scenario.settings.siege.status.replaceAll('_', ' ')} · proposed`
                  : 'Not configured',
            ],
            [
              'Objectives',
              scenario?.aftermath?.victory
                ? `Outcome: ${scenario.aftermath.victory.winner}`
                : scenario
                  ? scenario.aftermath
                    ? scenario.aftermath.conditions.relieved
                      ? 'Relief verified'
                      : scenario.aftermath.conditions.invested
                        ? 'Tournai invested'
                        : 'Investment unverified'
                    : '2 proposed goals'
                  : 'Not configured',
            ],
            [
              'Unsaved changes',
              campaignPending
                ? 'Operation pending'
                : tabletopDraft
                  ? tabletopDraft.kind === 'formation'
                    ? 'Uncommitted formation split'
                    : 'Uncommitted tabletop draft'
                  : planningDraft
                    ? 'Unissued orders'
                    : setupDraft
                      ? 'Uncommitted setup'
                      : draft
                        ? 'Uncommitted draft'
                        : library?.active
                          ? 'All changes saved'
                          : 'None · no active campaign',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
        <main id="main" tabIndex={-1}>
          {notice && (
            <div role="alert" className="error-notice">
              {notice}
              <button
                onClick={() => setNotice(null)}
                aria-label="Dismiss diagnostic notice"
              >
                Dismiss
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">CAMPAIGN COMPANION</p>
              <h1>{screen}</h1>
              <p className="lead">{content.lead}</p>
            </div>
            <span className="milestone">{content.milestone}</span>
          </div>
          {view !== 'umpire' &&
          screen !== 'Campaign Map' &&
          screen !== 'Turn Orders' &&
          screen !== 'Settings' ? (
            <section className="panel settings">
              <h2>Shared campaign management</h2>
              <p>
                This screen includes both sides’ rosters or campaign records.
                Switch to umpire view when both players are ready to share that
                information.
              </p>
              <button onClick={() => setView('umpire')}>
                Switch to umpire view
              </button>
            </section>
          ) : screen === 'Dashboard' ? (
            <CampaignDashboard />
          ) : screen === 'Armies/Columns' ? (
            <FontenoySetup />
          ) : screen === 'Campaign Map' ? (
            <CampaignMap campaign={current ?? null} />
          ) : screen === 'Turn Orders' && scenario ? (
            <OperationalMap campaign={scenario} ordersOnly />
          ) : screen === 'Battle Log' && scenario ? (
            <BattleLog campaign={scenario} />
          ) : screen === 'Siege & Victory' && scenario ? (
            <SiegeVictory campaign={scenario} />
          ) : screen === 'Settings' ? (
            <section className="panel settings">
              <h2>Application</h2>
              <dl>
                <div>
                  <dt>Version</dt>
                  <dd>{version}</dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>Local SQLite · automatic save on committed actions</dd>
                </div>
                <div>
                  <dt>Connectivity</dt>
                  <dd>Local only · no account required</dd>
                </div>
                <div>
                  <dt>Diagnostics</dt>
                  <dd>Local app log · no remote telemetry</dd>
                </div>
              </dl>
              <h2>Session notice</h2>
              <p>
                Clear a diagnostic notice after reviewing it. A confirmation
                dialog will open.
              </p>
              <button
                disabled={pending}
                onClick={() => {
                  void resetNotice();
                }}
              >
                {pending ? 'Waiting for confirmation…' : 'Reset session notice'}
              </button>
            </section>
          ) : (
            <section className="panel empty-state">
              <div className="empty-symbol" aria-hidden="true">
                ◇
              </div>
              <p className="eyebrow">READY FOR THE NEXT CHAPTER</p>
              <h2>{content.empty}</h2>
              <p>{content.detail}</p>
            </section>
          )}
          <details className="rules-help">
            <summary>Rules & help</summary>
            <section className="rules-note" aria-label="Rules boundary">
              <span className="rule-mark" aria-hidden="true">
                i
              </span>
              <div>
                <h2>Campaign rules remain provisional</h2>
                <p>
                  Operational movement, scouting, siege and victory proposals
                  are house rules, pending review. Operational movement uses the
                  configured house rules; Maurice tactical play remains at the
                  table.
                </p>
              </div>
            </section>
          </details>
          <footer className="page-footer">
            Built for the tabletop{' '}
            <span>Milestone F · Aftermath, siege & victory</span>
          </footer>
        </main>
        <button
          className="help-launcher"
          aria-label="Help & player manual"
          title="Help & player manual (F1)"
          onClick={() => setHelpOpen(true)}
        >
          <span className="help-icon" aria-hidden="true">
            i
          </span>{' '}
          Help
        </button>
        {helpOpen && (
          <HelpManual
            campaign={library?.active ?? null}
            view={view}
            screen={screen}
            hasDraft={!!(draft || setupDraft || planningDraft || tabletopDraft)}
            onNavigate={navigate}
            onDismiss={() => setHelpOpen(false)}
          />
        )}
        {scenario && (view === 'umpire' || view === scenario.activeSide) && (
          <SplitFormation campaign={scenario} />
        )}
      </div>
    </div>
  );
}
