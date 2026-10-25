import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimultaneousRecoveryPanel } from '../../src/renderer/SimultaneousRecovery';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import { defaultSimultaneousRecoveryPolicy } from '../../src/domain/simultaneous-aftermath';
import {
  applyUnitBattle,
  unitBattleCampaign,
  simultaneousStep,
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
it('keeps a reviewed calendar policy draft through navigation and submits its explicit hours', async () => {
  const seed = seedFontenoyOperational(
    'Policy review',
    () => crypto.randomUUID(),
    operationalNow,
  );
  const c = simultaneousStep(seed, {
    kind: 'maurice-recovery-policy',
    policy: defaultSimultaneousRecoveryPolicy(seed),
  });
  const commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  const user = userEvent.setup();
  const component = render(<SimultaneousRecoveryPanel c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', { name: 'Review unit recovery rules' }),
  );
  const hours = screen.getByRole('spinbutton', {
    name: 'Calendar hours per recovery turn',
  });
  await user.clear(hours);
  await user.type(hours, '24');
  component.unmount();
  render(<SimultaneousRecoveryPanel c={c} view="umpire" />);
  expect(
    screen.getByRole('spinbutton', {
      name: 'Calendar hours per recovery turn',
    }),
  ).toHaveValue(24);
  await user.click(
    screen.getByRole('button', { name: 'Confirm unit recovery policy' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'maurice-recovery-policy',
      policy: expect.objectContaining({ minutesPerRecoveryTurn: 1440 }),
    }),
  );
  expect(c.fontenoy!.aftermath!.policy.minutesPerRecoveryTurn).toBe(2880);
});
it('does not disclose opposing unit recovery records or expose rule editing in faction view', () => {
  const c = applyUnitBattle(unitBattleCampaign());
  render(<SimultaneousRecoveryPanel c={c} view="allied" />);
  expect(
    screen.queryByRole('button', { name: 'Review unit recovery rules' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText('No recorded recoveries in this view.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(c.fontenoy!.units[0]!.displayName, { exact: false }),
  ).not.toBeInTheDocument();
});
