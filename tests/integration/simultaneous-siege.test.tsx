import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimultaneousSiegePanel } from '../../src/renderer/SimultaneousSiege';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import { defaultSimultaneousSiegePolicy } from '../../src/domain/simultaneous-siege';
import {
  simultaneousStep as step,
  operationalNow,
} from '../fixtures/simultaneous-aftermath';
const originalCommit = useCampaigns.getState().commitWaterloo;
beforeEach(() =>
  useCampaigns.setState({
    pending: false,
    waterlooDraft: null,
    error: null,
    commitWaterloo: originalCommit,
  }),
);
function seed() {
  return seedFontenoyOperational(
    'Siege UI',
    () => crypto.randomUUID(),
    operationalNow,
  );
}
function checkpoint() {
  let c = seed();
  c = step(c, {
    kind: 'maurice-siege-policy',
    policy: defaultSimultaneousSiegePolicy(c),
  });
  for (const side of ['french', 'allied'] as const)
    c = step(c, { kind: 'orders', side, orders: [], lock: true });
  return step(c, { kind: 'resolve' });
}
it('retains policy drafts across navigation with explicit calendar hours and selected outcomes', async () => {
  const c = seed(),
    user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  const ui = render(<SimultaneousSiegePanel c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', { name: 'Review and enable siege rules' }),
  );
  expect(
    screen.getByLabelText('Calendar hours per siege interval'),
  ).toHaveValue(48);
  await user.clear(screen.getByLabelText('Calendar hours per siege interval'));
  await user.type(
    screen.getByLabelText('Calendar hours per siege interval'),
    '24',
  );
  ui.unmount();
  render(<SimultaneousSiegePanel c={c} view="umpire" />);
  expect(
    screen.getByLabelText('Calendar hours per siege interval'),
  ).toHaveValue(24);
  await user.click(
    screen.getByRole('button', { name: 'Confirm siege policy' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'maurice-siege-policy',
      policy: expect.objectContaining({ minutesPerSiegeTurn: 1440 }),
    }),
  );
  expect(c.fontenoy!.siege.campaign).toBeUndefined();
});
it('previews reviewed conditions without inferred supply or mutation and requires an explanation', async () => {
  const c = checkpoint(),
    user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  render(<SimultaneousSiegePanel c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', { name: 'Review siege checkpoint' }),
  );
  expect(screen.getByLabelText('French supply confirmed')).not.toBeChecked();
  await user.click(screen.getByLabelText('Investment confirmed'));
  await user.click(screen.getByLabelText('French supply confirmed'));
  expect(screen.getByLabelText('Siege checkpoint preview')).toHaveTextContent(
    '6 eligible hours carried forward',
  );
  expect(screen.getByLabelText('Checkpoint explanation')).toBeRequired();
  await user.type(
    screen.getByLabelText('Checkpoint explanation'),
    'Players attested supply.',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm siege review' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'maurice-siege-review',
      review: expect.objectContaining({
        notes: 'Players attested supply.',
        conditions: { invested: true, supplied: true, relieved: false },
      }),
    }),
  );
  expect(c.fontenoy!.siege.progress).toBe(0);
});
it('keeps faction views read-only and hides unfinished umpire drafts', () => {
  const c = checkpoint();
  useCampaigns.setState({
    waterlooDraft: {
      kind: 'siege-review',
      review: {
        conditions: { invested: false, supplied: false, relieved: false },
        exhaustion: { french: 0, allied: 0 },
        notes: 'Private unfinished draft',
      },
    },
  });
  render(<SimultaneousSiegePanel c={c} view="french" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(
    screen.queryByText('Private unfinished draft'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText('Siege checkpoint preview'),
  ).not.toBeInTheDocument();
});
