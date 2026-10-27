import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerHelper } from '../../src/renderer/PlayerHelper';
import { playerGuide } from '../../src/renderer/player-guide';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { useHelperSession } from '../../src/renderer/helper-session';
import { useOperationalSession } from '../../src/renderer/operational-session';
import { useSession } from '../../src/renderer/session';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import {
  simultaneousStep as step,
  operationalNow,
  unitBattleCampaign,
  unitBattleResult,
} from '../fixtures/simultaneous-aftermath';
import { defaultSimultaneousSiegePolicy } from '../../src/domain/simultaneous-siege';
import { preparedTabletop } from '../fixtures/tabletop';
const seed = () =>
  seedFontenoyOperational(
    'Guided play',
    () => crypto.randomUUID(),
    operationalNow,
  );
beforeEach(() => {
  useCampaigns.setState({
    loading: false,
    pending: false,
    draft: null,
    setupDraft: null,
    planningDraft: null,
    tabletopDraft: null,
    waterlooDraft: null,
  });
  useSession.setState({ screen: 'Campaign Map' });
  useOperationalSession.setState({ view: 'umpire', planningSide: 'french' });
  useHelperSession.getState().setEnabled(true);
});
it('explains move/hold choices, highlights controls and focuses without clicking or committing', async () => {
  const c = seed(),
    before = structuredClone(c),
    lock = vi.fn();
  const user = userEvent.setup();
  render(
    <>
      <PlayerHelper campaign={c} view="umpire" onHelp={vi.fn()} />
      <section data-helper="map">The map</section>
      <button data-helper="lock" onClick={lock}>
        Lock orders
      </button>
    </>,
  );
  expect(
    screen.getByRole('region', { name: 'Player helper' }),
  ).toHaveTextContent('Choose French orders');
  const target = screen.getByRole('button', {
    name: 'Lock orders',
  });
  expect(target).toHaveClass('helper-next');
  await user.click(
    screen.getByRole('button', {
      name: 'Show me: Hold positions and lock orders',
    }),
  );
  expect(target).toHaveFocus();
  expect(lock).not.toHaveBeenCalled();
  expect(c).toEqual(before);
});
it('reveals nested collapsed controls without choosing a campaign action or dropping a draft', async () => {
  const c = seed(),
    policy = defaultSimultaneousSiegePolicy(c);
  useCampaigns.setState({ waterlooDraft: { kind: 'siege-policy', policy } });
  render(
    <>
      <PlayerHelper campaign={c} view="umpire" onHelp={vi.fn()} />
      <details>
        <summary>Rules</summary>
        <section data-helper="siege">
          <button>Save policy</button>
        </section>
      </details>
    </>,
  );
  const before = structuredClone(useCampaigns.getState().waterlooDraft);
  await userEvent
    .setup()
    .click(
      screen.getByRole('button', { name: 'Show me: Return to your edit' }),
    );
  expect(screen.getByText('Rules').parentElement).toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Save policy' })).toHaveFocus();
  expect(useCampaigns.getState().waterlooDraft).toEqual(before);
});
it('removes guidance and highlights when disabled and saves only a local UI preference', () => {
  const c = seed();
  const ui = render(
    <>
      <PlayerHelper campaign={c} view="umpire" onHelp={vi.fn()} />
      <section data-helper="map">The map</section>
    </>,
  );
  expect(screen.getByText('The map')).toHaveClass('helper-next');
  useHelperSession.getState().setEnabled(false);
  ui.rerender(
    <>
      <PlayerHelper campaign={c} view="umpire" onHelp={vi.fn()} />
      <section data-helper="map">The map</section>
    </>,
  );
  expect(
    screen.queryByRole('region', { name: 'Player helper' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('The map')).not.toHaveClass('helper-next');
  expect(localStorage.getItem('maurice.helper-mode')).toBe('off');
});
it('tracks selected side, locks and shared resolution without revealing enemy routes or rosters', () => {
  let c = seed();
  c = step(c, { kind: 'orders', side: 'french', orders: [], lock: true });
  expect(playerGuide(c, 'umpire', 'french', null).title).toBe(
    'Next: plan Allied orders',
  );
  expect(playerGuide(c, 'umpire', 'allied', null).title).toBe(
    'Choose Allied orders',
  );
  const privateCopy = structuredClone(c);
  privateCopy.corps
    .filter((f) => f.side === 'allied')
    .forEach((f) => {
      f.name = 'SECRET FORMATION';
      f.roster = 'SECRET ROSTER';
    });
  expect(
    JSON.stringify(playerGuide(privateCopy, 'french', 'allied', null)),
  ).not.toContain('SECRET');
  expect(playerGuide(privateCopy, 'french', 'allied', null)).toEqual(
    playerGuide(c, 'french', 'french', null),
  );
  c = step(c, { kind: 'orders', side: 'allied', orders: [], lock: true });
  expect(playerGuide(c, 'umpire', 'allied', null).choices[0]!.target).toBe(
    'resolve',
  );
  expect(playerGuide(c, 'french', 'french', null).title).toBe(
    'Next: resolve movement in Umpire view',
  );
});
it('guides a local faction handoff by focusing Map view without switching sides or changing the campaign', async () => {
  const c = step(seed(), {
    kind: 'orders',
    side: 'french',
    orders: [],
    lock: true,
  });
  const before = structuredClone(c),
    change = vi.fn(),
    user = userEvent.setup();
  render(
    <>
      <PlayerHelper campaign={c} view="french" onHelp={vi.fn()} />
      <label>
        Map view
        <select data-helper="view" defaultValue="french" onChange={change}>
          <option value="french">French</option>
          <option value="allied">Allied</option>
          <option value="umpire">Umpire</option>
        </select>
      </label>
    </>,
  );
  expect(
    screen.getByRole('region', { name: 'Player helper' }),
  ).toHaveTextContent('Next: plan Allied orders');
  expect(
    screen.getByRole('region', { name: 'Player helper' }),
  ).toHaveTextContent('leave them empty to hold');
  await user.click(
    screen.getByRole('button', { name: 'Show me: Find Allied map view' }),
  );
  expect(screen.getByRole('combobox', { name: 'Map view' })).toHaveFocus();
  expect(screen.getByRole('combobox', { name: 'Map view' })).toHaveValue(
    'french',
  );
  expect(change).not.toHaveBeenCalled();
  expect(c).toEqual(before);
});
it('names the correct other side when Allied orders are locked first', () => {
  const c = step(seed(), {
    kind: 'orders',
    side: 'allied',
    orders: [],
    lock: true,
  });
  expect(playerGuide(c, 'allied', 'french', null)).toMatchObject({
    title: 'Next: plan French orders',
    choices: [
      expect.objectContaining({
        label: 'Find French map view',
        target: 'view',
      }),
      expect.anything(),
    ],
  });
  expect(playerGuide(c, 'umpire', 'allied', null).choices[0]).toMatchObject({
    label: 'Find French planning',
    target: 'planning-side',
  });
});
it('distinguishes result entry, approval and resuming the clock', () => {
  let c = unitBattleCampaign();
  expect(playerGuide(c, 'umpire', 'french', null).title).toBe(
    'Take the battle to the tabletop',
  );
  c = step(c, {
    kind: 'result',
    battleId: c.battles[0]!.id,
    result: unitBattleResult(c),
    reason: 'Manual observations.',
  });
  expect(playerGuide(c, 'umpire', 'french', null).title).toBe(
    'Review the recorded battle effects',
  );
  c = step(c, { kind: 'approve-result', battleId: c.battles[0]!.id });
  expect(playerGuide(c, 'umpire', 'french', null).choices[0]!.target).toBe(
    'resolve',
  );
  expect(
    playerGuide(c, 'allied', 'allied', null).choices.map((ch) => ch.target),
  ).toEqual(['view']);
});
it('requires siege review before proposing finalization and then explains a concluded campaign', () => {
  let c = seed();
  const policy = defaultSimultaneousSiegePolicy(c);
  policy.minutesPerSiegeTurn = 360;
  policy.rules.siegeThreshold = 1;
  c = step(c, { kind: 'maurice-siege-policy', policy });
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  c = step(c, { kind: 'resolve' });
  expect(playerGuide(c, 'umpire', 'french', null).choices[0]!.target).toBe(
    'siege-review',
  );
  expect(playerGuide(c, 'french', 'french', null).choices[0]!.target).toBe(
    'view',
  );
  c = step(c, {
    kind: 'maurice-siege-review',
    review: {
      conditions: { invested: true, supplied: true, relieved: false },
      exhaustion: { french: 0, allied: 0 },
      notes: 'Investment and supply attested.',
    },
  });
  expect(playerGuide(c, 'umpire', 'french', null).choices[0]!.target).toBe(
    'finalize',
  );
  c = step(c, { kind: 'finalize' });
  expect(playerGuide(c, 'umpire', 'french', null).title).toBe(
    'Your campaign has concluded',
  );
});
it('guides preparation, empty libraries, archived and legacy campaigns without changing state', () => {
  expect(playerGuide(null, 'umpire', 'french', null).choices[0]!.screen).toBe(
    'Dashboard',
  );
  let c = step(seed(), { kind: 'enable-preparation' });
  expect(playerGuide(c, 'french', 'french', null).stage).toBe(0);
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'withdrawals', side, orders: [], lock: true });
  expect(playerGuide(c, 'umpire', 'french', null).title).toBe(
    'Resolve the shared preparation',
  );
  c.status = 'archived';
  expect(playerGuide(c, 'umpire', 'french', null).title).toBe(
    'This campaign is archived',
  );
  const legacy = preparedTabletop();
  expect(playerGuide(legacy, 'french', 'french', null).choices[0]!.target).toBe(
    'legacy-map',
  );
  expect(playerGuide(legacy, 'allied', 'allied', null).choices[0]!.target).toBe(
    'view',
  );
});
it('does not offer movement when every own formation is off-map or unavailable', () => {
  const c = seed();
  for (const f of c.corps.filter((f) => f.side === 'french')) {
    f.status = 'blown';
    f.hexId = null;
    f.returnSlot = 2;
  }
  const guide = playerGuide(c, 'french', 'french', null);
  expect(guide.text).toContain('No formation is available');
  expect(guide.choices.map((c) => c.target)).toEqual(['lock']);
});
