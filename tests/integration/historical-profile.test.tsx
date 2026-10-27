import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  historicalSeed,
  reviewHistorical,
} from '../fixtures/historical-profile';
import { HistoricalProfileReview } from '../../src/renderer/HistoricalProfileReview';
import { WaterlooDesk } from '../../src/renderer/WaterlooDesk';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { useOperationalSession } from '../../src/renderer/operational-session';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import { operationalNow } from '../fixtures/simultaneous-aftermath';
const originalCreate = useCampaigns.getState().createHistoricalFontenoy,
  originalCommit = useCampaigns.getState().commitWaterloo;
beforeEach(() => {
  useCampaigns.setState({
    waterlooDraft: null,
    pending: false,
    createHistoricalFontenoy: originalCreate,
    commitWaterloo: originalCommit,
  });
  useOperationalSession.setState({ view: 'umpire' });
});

it('shows historical names/complements in formation inspection and filters the selected regiment', () => {
  const c = reviewHistorical(historicalSeed());
  useOperationalSession.setState({ view: 'french' });
  render(<WaterlooDesk campaign={c} />);
  expect(
    screen.getByText('Historical organization', { selector: 'th' }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText('Royal Corse', {
      selector: '.historical-unit-name',
    }).length,
  ).toBeGreaterThan(0);
  const input = screen.getByLabelText('Find regiment in formation');
  fireEvent.change(input, { target: { value: 'Royal Corse' } });
  const table = input.closest('.waterloo-inspection')!.querySelector('table')!;
  expect(table).toHaveTextContent('1 battalion');
  expect(table).toHaveTextContent('scenario rating');
  expect(table).not.toHaveTextContent('Gardes Fran�aises');
  expect(table).not.toHaveTextContent('French elite regular infantry 1');
  expect(table).not.toHaveTextContent('British');
});

it('retains a historical setup review draft across navigation and submits explicit scale/deployment/source acknowledgements', async () => {
  const c = historicalSeed(),
    commit = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  useCampaigns.setState({ commitWaterloo: commit });
  const ui = render(<HistoricalProfileReview c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', { name: 'Review historical setup' }),
  );
  expect(
    screen.getByRole('button', { name: 'Confirm historical setup' }),
  ).toBeDisabled();
  for (const name of [
    'I reviewed the regimental record scale and scenario ratings',
    'I reviewed the provisional formations and deployment',
    'I reviewed the battle-date coverage and source gaps',
  ])
    fireEvent.click(screen.getByRole('checkbox', { name }));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Historical setup review notes' }),
    { target: { value: 'Agreed regimental campaign representation.' } },
  );
  ui.unmount();
  render(<HistoricalProfileReview c={c} view="umpire" />);
  expect(
    screen.getByRole('textbox', { name: 'Historical setup review notes' }),
  ).toHaveValue('Agreed regimental campaign representation.');
  await user.click(
    screen.getByRole('button', { name: 'Confirm historical setup' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'historical-roster-review',
      review: expect.objectContaining({
        acknowledgedScale: true,
        acknowledgedDeployment: true,
        acknowledgedSourceGaps: true,
      }),
    }),
  );
});

it('gives original campaigns an explicit fresh historical campaign action instead of silently relabelling units', async () => {
  const c = seedFontenoyOperational(
      'Old campaign',
      () => crypto.randomUUID(),
      operationalNow,
    ),
    create = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  useCampaigns.setState({ createHistoricalFontenoy: create });
  render(<HistoricalProfileReview c={c} view="french" />);
  await user.click(
    screen.getByRole('button', { name: 'Create historical campaign' }),
  );
  expect(create).toHaveBeenCalledOnce();
  expect(c.fontenoy!.units).toHaveLength(38);
  expect(c.fontenoy!.historicalProfile).toBeUndefined();
});
