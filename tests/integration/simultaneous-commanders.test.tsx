import { playerGuide } from '../../src/renderer/player-guide';
import { defaultSimultaneousSiegePolicy } from '../../src/domain/simultaneous-siege';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimultaneousCommanders } from '../../src/renderer/SimultaneousCommanders';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import {
  simultaneousStep as step,
  operationalNow,
} from '../fixtures/simultaneous-aftermath';
const originalCommit = useCampaigns.getState().commitWaterloo;
const seed = () =>
  step(
    seedFontenoyOperational(
      'Officer UI',
      () => crypto.randomUUID(),
      operationalNow,
    ),
    { kind: 'maurice-commanders-enable' },
  );
beforeEach(() =>
  useCampaigns.setState({
    pending: false,
    waterlooDraft: null,
    error: null,
    commitWaterloo: originalCommit,
  }),
);
it('preserves officer details across navigation and submits a reasoned manual decision', async () => {
  const c = seed(),
    commit = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  useCampaigns.setState({ commitWaterloo: commit });
  const before = structuredClone(c),
    ui = render(<SimultaneousCommanders c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', {
      name: `Edit ${c.fontenoy!.commanders[0]!.displayName}`,
    }),
  );
  await user.type(
    screen.getByLabelText('Private Notable reference'),
    'My private reminder',
  );
  await user.type(
    screen.getByLabelText('Decision explanation'),
    'Players agreed this reference.',
  );
  ui.unmount();
  render(<SimultaneousCommanders c={c} view="umpire" />);
  expect(screen.getByLabelText('Private Notable reference')).toHaveValue(
    'My private reminder',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm officer change' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'maurice-commander',
      action: expect.objectContaining({
        kind: 'details',
        notableReference: 'My private reminder',
        notes: 'Players agreed this reference.',
      }),
    }),
  );
  expect(c).toEqual(before);
});
it('filters opposing officer names, references, history and unfinished drafts from faction views', () => {
  let c = seed();
  c = step(c, {
    kind: 'maurice-commander',
    action: {
      kind: 'arrival',
      side: 'allied',
      displayName: 'Secret Allied notable',
      notableReference: 'Secret reference',
      notes: 'Private Allied explanation.',
    },
  });
  useCampaigns.setState({
    waterlooDraft: {
      kind: 'officer',
      action: {
        kind: 'arrival',
        side: 'allied',
        displayName: 'Unfinished secret',
        notableReference: 'Private draft',
        notes: '',
      },
    },
  });
  render(<SimultaneousCommanders c={c} view="french" />);
  for (const secret of [
    'Secret Allied notable',
    'Secret reference',
    'Private Allied explanation.',
    'Unfinished secret',
    c.fontenoy!.commanders.find((u) => mSide(c, u.factionId) === 'allied')!
      .displayName,
  ])
    expect(
      screen.queryByText(secret, { exact: false }),
    ).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
const mSide = (c: ReturnType<typeof seed>, id: string) =>
  c.fontenoy!.factions.find((f) => f.id === id)!.side;
it('offers only own-faction mapped attachments and requires an explanation', async () => {
  const c = seed(),
    user = userEvent.setup(),
    u = c.fontenoy!.commanders[0]!;
  render(<SimultaneousCommanders c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', { name: `Assign ${u.displayName}` }),
  );
  const select = screen.getByLabelText('Assigned formation');
  for (const f of c.corps.filter((f) => f.side !== mSide(c, u.factionId)))
    expect(select).not.toHaveTextContent(f.name);
  expect(screen.getByLabelText('Decision explanation')).toBeRequired();
});

it('offers officer outcomes before the checkpoint siege review and removes that choice afterwards', () => {
  let c = seed();
  c = step(c, {
    kind: 'maurice-siege-policy',
    policy: defaultSimultaneousSiegePolicy(c),
  });
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  c = step(c, { kind: 'resolve' });
  expect(
    playerGuide(c, 'umpire', 'french', null).choices.some(
      (ch) => ch.target === 'officers',
    ),
  ).toBe(true);
  c = step(c, {
    kind: 'maurice-siege-review',
    review: {
      conditions: { invested: false, supplied: false, relieved: false },
      exhaustion: { french: 0, allied: 0 },
      notes: 'Conditions reviewed.',
    },
  });
  expect(
    playerGuide(c, 'umpire', 'french', null).choices.some(
      (ch) => ch.target === 'officers',
    ),
  ).toBe(false);
});
