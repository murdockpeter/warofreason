import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualAdjudication } from '../../src/renderer/ManualAdjudication';
import {
  beginAdjudication,
  chooseAdjudicationHex,
} from '../../src/renderer/manual-adjudication-session';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import {
  simultaneousStep as step,
  operationalNow,
} from '../fixtures/simultaneous-aftermath';
import { WaterlooDesk } from '../../src/renderer/WaterlooDesk';
import { useOperationalSession } from '../../src/renderer/operational-session';
import { newManualRuling } from '../../src/domain/manual-adjudication';

const originalCommit = useCampaigns.getState().commitWaterloo;
const seed = () =>
  seedFontenoyOperational(
    'Manual UI',
    () => crypto.randomUUID(),
    operationalNow,
  );
beforeEach(() => {
  useCampaigns.setState({
    pending: false,
    waterlooDraft: null,
    commitWaterloo: originalCommit,
    error: null,
  });
  useOperationalSession.setState({ view: 'umpire' });
});

it('retains a map-click ruling across navigation and submits the reviewed input without mutating the source', async () => {
  const c = seed(),
    before = structuredClone(c),
    commit = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  useCampaigns.setState({ commitWaterloo: commit });
  beginAdjudication(c, c.corps[0]!.id);
  expect(chooseAdjudicationHex(c.hexes.at(-1)!.id)).toBe(true);
  const ui = render(<ManualAdjudication c={c} />);
  await user.type(
    screen.getByLabelText('Umpire ruling and rationale'),
    'Agreed march through the woods.',
  );
  await user.type(
    screen.getByLabelText(`Reported strength for ${c.corps[0]!.name}`),
    'About 2,000 men',
  );
  ui.unmount();
  render(<ManualAdjudication c={c} />);
  expect(screen.getByLabelText('Umpire ruling and rationale')).toHaveValue(
    'Agreed march through the woods.',
  );
  expect(
    screen.getByRole('region', { name: 'Manual ruling preview' }),
  ).toHaveTextContent(c.hexes.at(-1)!.id);
  await user.click(
    screen.getByRole('button', { name: 'Confirm manual ruling' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'manual-adjudication',
      ruling: expect.objectContaining({
        decision: 'Agreed march through the woods.',
        placements: [
          expect.objectContaining({
            hexId: c.hexes.at(-1)!.id,
            reportedStrength: 'About 2,000 men',
          }),
        ],
      }),
    }),
  );
  expect(c).toEqual(before);
});

it('blocks a stale draft and invalid stacking in the preview', async () => {
  const c = seed(),
    user = userEvent.setup();
  beginAdjudication(c, c.corps[0]!.id);
  chooseAdjudicationHex(c.corps[1]!.hexId!);
  const ui = render(<ManualAdjudication c={c} />);
  await user.type(
    screen.getByLabelText('Umpire ruling and rationale'),
    'Review this placement.',
  );
  expect(
    screen.getByRole('button', { name: 'Confirm manual ruling' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('region', { name: 'Manual ruling preview' }),
  ).toHaveTextContent('stack');
  ui.rerender(<ManualAdjudication c={{ ...c, revision: c.revision + 1 }} />);
  expect(
    screen.getByRole('region', { name: 'Manual ruling preview' }),
  ).toHaveTextContent('campaign changed');
});

it('withholds the umpire editor and private history from faction views while showing friendly reported strength', () => {
  let c = seed();
  const ruling = newManualRuling(c, c.corps[0]!.id);
  ruling.placements[0]!.reportedStrength = 'About 2,000 men';
  ruling.decision = 'Private ruling explanation.';
  c = step(c, { kind: 'manual-adjudication', ruling });
  useOperationalSession.setState({ view: 'french' });
  render(<WaterlooDesk campaign={c} />);
  expect(
    screen.queryByRole('region', { name: 'Manual adjudication' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Private ruling explanation.'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/Reported strength: About 2,000 men/),
  ).toBeInTheDocument();
});
