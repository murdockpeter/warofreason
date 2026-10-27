import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WaterlooDesk } from '../../src/renderer/WaterlooDesk';
import { SimultaneousIntelligence } from '../../src/renderer/SimultaneousIntelligence';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { useOperationalSession } from '../../src/renderer/operational-session';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import { playerGuide } from '../../src/renderer/player-guide';
import {
  simultaneousStep as step,
  operationalNow,
} from '../fixtures/simultaneous-aftermath';
const seed = () =>
  seedFontenoyOperational(
    'Intelligence UI',
    () => crypto.randomUUID(),
    operationalNow,
  );
const originalCommit = useCampaigns.getState().commitWaterloo;
function withReport() {
  let c = seed();
  c = step(c, {
    kind: 'maurice-scout-request',
    input: {
      corpsId: c.corps[0]!.id,
      hexId: '6,4',
      question: 'French private question',
    },
  });
  c = step(c, {
    kind: 'maurice-intelligence-report',
    requestId: c.fontenoy!.intelligence!.requests[0]!.id,
    expectedVersion: 0,
    input: {
      level: 'identified',
      hexId: '6,4',
      label: 'Released sighting',
      details: 'Agreed released composition',
      expiresAfterTurn: 1,
      notes: 'Player message',
    },
    reason: 'SECRET UMPIRE REASON',
  });
  return c;
}
beforeEach(() => {
  useCampaigns.setState({
    pending: false,
    waterlooDraft: null,
    error: null,
    message: null,
    commitWaterloo: originalCommit,
  });
  useOperationalSession.setState({ view: 'umpire', planningSide: 'french' });
});
it('preserves a scouting draft across navigation and lets map clicks choose its area without moving', async () => {
  const c = seed(),
    user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  const ui = render(<WaterlooDesk campaign={c} />);
  await user.click(
    screen.getByText('Intelligence', { selector: '.desk-drawer > summary' }),
  );
  await user.selectOptions(screen.getByLabelText('Planning side'), 'allied');
  await user.click(
    screen.getByText('Scouting & intelligence', { exact: true }),
  );
  await user.click(screen.getByRole('button', { name: 'Request scouting' }));
  await user.type(
    screen.getByLabelText('Scouting question'),
    'Observe this road.',
  );
  await user.click(screen.getByRole('button', { name: /^Hex 6,4/ }));
  expect(screen.getByLabelText('Area to scout')).toHaveValue('6,4');
  expect(screen.queryByLabelText('Hex route draft')).not.toBeInTheDocument();
  ui.unmount();
  render(<WaterlooDesk campaign={c} />);
  expect(screen.getByLabelText('Planning side')).toHaveValue('allied');
  expect(screen.getByLabelText('Scouting question')).toHaveValue(
    'Observe this road.',
  );
  expect(screen.getByLabelText('Map view')).toBeDisabled();
  await user.click(
    screen.getByRole('button', { name: 'Confirm scouting request' }),
  );
  expect(commit).toHaveBeenCalledWith({
    kind: 'maurice-scout-request',
    input: {
      corpsId: c.corps[2]!.id,
      hexId: '6,4',
      question: 'Observe this road.',
    },
  });
});
it('shows faction snapshot markers without live enemy counters or private report history', () => {
  const c = withReport();
  c.corps[2]!.hexId = '9,4';
  c.corps[2]!.roster = 'SECRET LIVE ROSTER';
  useOperationalSession.setState({ view: 'french' });
  render(<WaterlooDesk campaign={c} />);
  expect(
    screen.queryByRole('button', { name: 'Select opposing corps' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', {
      name: 'Intelligence report at 6,4 · observed phase 1',
    }),
  ).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent('SECRET LIVE ROSTER');
  expect(document.body).not.toHaveTextContent('SECRET UMPIRE REASON');
  expect(document.body).not.toHaveTextContent(c.corps[2]!.name);
  expect(screen.queryByText('Private report history')).not.toBeInTheDocument();
});
it('withholds another side’s requests and expires the map marker and observation details', () => {
  const c = withReport();
  const ui = render(
    <SimultaneousIntelligence c={c} view="allied" side="allied" />,
  );
  expect(document.body).not.toHaveTextContent('French private question');
  expect(document.body).not.toHaveTextContent('Agreed released composition');
  ui.unmount();
  c.turn = 2;
  useOperationalSession.setState({ view: 'french' });
  render(<WaterlooDesk campaign={c} />);
  expect(
    screen.queryByRole('button', { name: /^Intelligence report at/ }),
  ).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent('Agreed released composition');
  expect(document.body).toHaveTextContent('expired');
});
it('edits a report with explicit release fields and separate private rationale', async () => {
  const c = withReport(),
    user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  render(<SimultaneousIntelligence c={c} view="umpire" side="french" />);
  await user.click(
    screen.getByText('Scouting & intelligence', { exact: true }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Correct / withdraw report' }),
  );
  expect(screen.getByLabelText('Released label')).toHaveValue(
    'Released sighting',
  );
  await user.selectOptions(
    screen.getByLabelText('Released intelligence'),
    'none',
  );
  await user.clear(screen.getByLabelText('Message to player'));
  await user.type(
    screen.getByLabelText('Message to player'),
    'Withdraw this report.',
  );
  await user.type(
    screen.getByLabelText('Private umpire rationale'),
    'Transcription corrected.',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm intelligence report' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'maurice-intelligence-report',
      expectedVersion: 1,
      input: { level: 'none', notes: 'Withdraw this report.' },
      reason: 'Transcription corrected.',
    }),
  );
});
it('opens scouting from a friendly context menu and offers optional Helper guidance', async () => {
  // jsdom does not implement native dialog methods; the desktop suite exercises real dialogs.
  const methods = ['showModal', 'close'] as const;
  const originals = methods.map((name) =>
    Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
  );
  for (const name of methods)
    Object.defineProperty(HTMLDialogElement.prototype, name, {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        if (name === 'showModal') this.setAttribute('open', '');
        else this.removeAttribute('open');
      },
    });
  const c = seed(),
    user = userEvent.setup();
  try {
    render(<WaterlooDesk campaign={c} />);
    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: `Select ${c.corps[0]!.name}`,
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Scout an area…' }));
    expect(screen.getByLabelText('Scouting formation')).toHaveValue(
      c.corps[0]!.id,
    );
    expect(
      playerGuide(c, 'french', 'french', null).choices.some(
        (ch) => ch.target === 'intelligence',
      ),
    ).toBe(true);
  } finally {
    methods.forEach((name, i) => {
      const original = originals[i];
      if (original)
        Object.defineProperty(HTMLDialogElement.prototype, name, original);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    });
  }
});
