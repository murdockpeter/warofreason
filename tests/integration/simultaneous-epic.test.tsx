import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimultaneousEpic } from '../../src/renderer/SimultaneousEpic';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import {
  simultaneousStep as step,
  operationalNow,
  applyUnitBattle,
  unitBattleCampaign,
} from '../fixtures/simultaneous-aftermath';
import { currentEpicEntries } from '../../src/domain/simultaneous-epic';
import { playerGuide } from '../../src/renderer/player-guide';
const originalCommit = useCampaigns.getState().commitWaterloo;
const seed = () =>
  step(
    seedFontenoyOperational(
      'Epic UI',
      () => crypto.randomUUID(),
      operationalNow,
    ),
    { kind: 'maurice-epic-enable' },
  );
beforeEach(() =>
  useCampaigns.setState({
    pending: false,
    waterlooDraft: null,
    error: null,
    commitWaterloo: originalCommit,
  }),
);
it('preserves zero/blank entry drafts through navigation and submits manual values', async () => {
  const c = seed(),
    before = structuredClone(c),
    user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  const ui = render(<SimultaneousEpic c={c} view="umpire" />);
  await user.click(
    screen.getByRole('button', { name: 'Record campaign event points' }),
  );
  await user.type(
    screen.getByLabelText('Campaign event title'),
    'Reviewed award',
  );
  await user.type(screen.getByLabelText('French Epic Points'), '0');
  await user.type(
    screen.getByLabelText('Entry explanation'),
    'Manually reviewed.',
  );
  ui.unmount();
  render(<SimultaneousEpic c={c} view="umpire" />);
  expect(screen.getByLabelText('French Epic Points')).toHaveValue(0);
  expect(screen.getByLabelText('Allied Epic Points')).toHaveValue(null);
  await user.click(
    screen.getByRole('button', { name: 'Confirm Epic Points entry' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'maurice-epic-record',
      entryId: null,
      expectedVersion: 0,
      input: expect.objectContaining({ points: { french: 0, allied: null } }),
    }),
  );
  expect(c).toEqual(before);
});
it('withholds opposing points, event titles, explanations and history in faction views', () => {
  let c = seed();
  c = step(c, {
    kind: 'maurice-epic-record',
    entryId: null,
    expectedVersion: 0,
    reason: 'Private umpire reason',
    input: {
      source: { kind: 'campaign', title: 'Secret event title' },
      points: { french: 0, allied: 9987 },
      notes: 'Private shared explanation',
    },
  });
  render(<SimultaneousEpic c={c} view="french" />);
  const panel = screen.getByText('Epic Points · manual ledger').parentElement!;
  expect(panel).toHaveTextContent('French: 0');
  for (const secret of [
    '9987',
    'Secret event title',
    'Private umpire reason',
    'Private shared explanation',
    'Allied:',
  ])
    expect(panel).not.toHaveTextContent(secret);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('edits the latest version with a separate required correction reason', async () => {
  let c = seed();
  c = step(c, {
    kind: 'maurice-epic-record',
    entryId: null,
    expectedVersion: 0,
    reason: 'Entered.',
    input: {
      source: { kind: 'campaign', title: 'Event' },
      points: { french: 2, allied: 0 },
      notes: 'Players reviewed.',
    },
  });
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(undefined);
  useCampaigns.setState({ commitWaterloo: commit });
  render(<SimultaneousEpic c={c} view="umpire" />);
  await user.click(screen.getByRole('button', { name: 'Correct Event' }));
  expect(screen.getByLabelText('Correction reason')).toBeRequired();
  await user.clear(screen.getByLabelText('French Epic Points'));
  await user.type(screen.getByLabelText('French Epic Points'), '3');
  await user.type(
    screen.getByLabelText('Correction reason'),
    'Corrected a transcription error.',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm Epic Points correction' }),
  );
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      entryId: currentEpicEntries(c)[0]!.entryId,
      expectedVersion: 1,
      reason: 'Corrected a transcription error.',
    }),
  );
});
it('offers optional post-battle guidance without making scoring a turn-end requirement', () => {
  const c = applyUnitBattle(unitBattleCampaign());
  expect(
    playerGuide(c, 'umpire', 'french', null).choices.some(
      (ch) => ch.target === 'epic',
    ),
  ).toBe(true);
  expect(
    playerGuide(c, 'french', 'french', null).choices.some(
      (ch) => ch.target === 'epic',
    ),
  ).toBe(false);
  expect(() => step(c, { kind: 'finalize' })).not.toThrow();
});
