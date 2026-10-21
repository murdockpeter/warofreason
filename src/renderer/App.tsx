import { useEffect, useState } from 'react';
import { screens, useSession } from './session';
import type { Screen } from './session';
import { reportError } from './diagnostics';
import { CampaignDashboard } from './CampaignDashboard';
import { useCampaigns } from './campaign-store';
import { FontenoySetup } from './FontenoySetup';
import { SchematicMap } from './SchematicMap';

const descriptions: Record<
  Screen,
  { lead: string; empty: string; detail: string; milestone: string }
> = {
  Dashboard: {
    lead: 'Your campaign, from march to tabletop.',
    empty: 'No campaign open',
    detail:
      'Create, manage and reopen saved campaign drafts. The Road to Fontenoy scenario follows in Milestone C.',
    milestone: 'B · Campaign state',
  },
  'Campaign Map': {
    lead: 'The operational picture.',
    empty: 'No map loaded',
    detail:
      'A reviewed scenario module will supply the map. Movement and scouting await agreed, versioned campaign house rules.',
    milestone: 'C–D · Map & operations',
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
  const { screen, navigate, notice, setNotice } = useSession();
  const [version, setVersion] = useState('Connecting…');
  const [pending, setPending] = useState(false);
  const {
    library,
    draft,
    setupDraft,
    pending: campaignPending,
    initialize,
  } = useCampaigns();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (
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
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
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
          {screens.map((item, index) => (
            <button
              key={item}
              aria-current={screen === item ? 'page' : undefined}
              onClick={() => navigate(item)}
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
          <span>Fontenoy setup · Milestone C</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            THE ROAD TO FONTENOY <span className="muted">/ 1745</span>
          </span>
          <span className="badge">
            {library?.active?.status === 'archived'
              ? 'Archived campaign'
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
              scenario
                ? `${scenario.settings.siege.status.replaceAll('_', ' ')} · proposed`
                : 'Not configured',
            ],
            ['Objectives', scenario ? '2 proposed goals' : 'Not configured'],
            [
              'Unsaved changes',
              campaignPending
                ? 'Operation pending'
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
          {screen === 'Dashboard' ? (
            <CampaignDashboard />
          ) : screen === 'Armies/Columns' ? (
            <FontenoySetup />
          ) : screen === 'Campaign Map' && scenario ? (
            <SchematicMap campaign={scenario} />
          ) : screen === 'Siege & Victory' && scenario ? (
            <section className="panel settings">
              <h2>Reviewed siege setup</h2>
              <p>
                Provisional siege state:{' '}
                {scenario.settings.siege.status.replaceAll('_', ' ')}. Progress:{' '}
                {scenario.settings.siege.progress}.
              </p>
              <ul>
                {scenario.settings.objectives.map((objective) => (
                  <li key={objective.id}>{objective.title} · house rule</li>
                ))}
              </ul>
              <p>
                No siege progression, threshold or victory evaluation is
                implemented. Edit the initial setup in Armies/Columns before
                starting.
              </p>
            </section>
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
          <section className="rules-note" aria-label="Rules boundary">
            <span className="rule-mark" aria-hidden="true">
              i
            </span>
            <div>
              <h2>Campaign rules remain provisional</h2>
              <p>
                Operational movement, scouting, siege and victory proposals are
                house rules, pending review. This build implements no campaign
                mechanics and does not automate Maurice tactical play.
              </p>
            </div>
          </section>
          <footer className="page-footer">
            Built for the tabletop{' '}
            <span>Milestone C · Fontenoy module & setup</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
