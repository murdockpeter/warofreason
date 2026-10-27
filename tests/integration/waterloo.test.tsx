import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WaterlooDesk } from '../../src/renderer/WaterlooDesk';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { useOperationalSession } from '../../src/renderer/operational-session';
import { seedWaterloo, applyWaterlooCommand } from '../../src/domain/waterloo';
const seed = () =>
  seedWaterloo(
    'UI acceptance',
    () => crypto.randomUUID(),
    '2026-10-25T12:00:00.000Z',
  );
const originalCommit = useCampaigns.getState().commitWaterloo;
const openDrawer = (title: string) =>
  fireEvent.click(
    screen.getByText(title, { selector: '.desk-drawer > summary' }),
  );
beforeEach(() => {
  useCampaigns.setState({
    waterlooDraft: null,
    pending: false,
    error: null,
    message: null,
    commitWaterloo: originalCommit,
  });
  useOperationalSession.setState({ view: 'umpire' });
});
describe('simultaneous campaign interface', () => {
  it('submits a trapped withdrawal without requiring invented retreat hexes', async () => {
    const c = applyWaterlooCommand(seed(), {
      command: { kind: 'enable-preparation' },
      recordId: crypto.randomUUID(),
      timestamp: '2026-10-25T12:00:00.000Z',
    });
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    for (const h of c.hexes)
      if (['4,4', '5,3', '6,3', '4,5', '5,5'].includes(h.id))
        h.terrain = 'water';
    const commit = vi.fn().mockResolvedValue(undefined);
    useCampaigns.setState({ commitWaterloo: commit });
    const user = userEvent.setup();
    render(<WaterlooDesk campaign={c} />);
    openDrawer('Turn desk');
    await user.click(
      screen.getByRole('button', {
        name: 'Plan withdrawal for French I Corps',
      }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: /No legal retreat/ }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Retreat step 1' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save withdrawal' }));
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'withdrawals',
        orders: [expect.objectContaining({ blocked: true, path: ['5,4'] })],
      }),
    );
  });
  it('keeps a Coalition withdrawal draft and side through navigation', async () => {
    const c = applyWaterlooCommand(seed(), {
      command: { kind: 'enable-preparation' },
      recordId: crypto.randomUUID(),
      timestamp: '2026-10-25T12:00:00.000Z',
    });
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    const user = userEvent.setup(),
      commit = vi.fn().mockResolvedValue(undefined);
    useCampaigns.setState({ commitWaterloo: commit });
    const first = render(<WaterlooDesk campaign={c} />);
    expect(
      screen.queryByRole('button', { name: 'Lock French orders' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Planning side' }),
      'allied',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Plan withdrawal for Anglo-Allied I Corps',
      }),
    );
    for (const [i, hex] of ['7,4', '8,4', '9,4'].entries())
      await user.selectOptions(
        screen.getByRole('combobox', { name: `Retreat step ${i + 1}` }),
        hex,
      );
    first.unmount();
    render(<WaterlooDesk campaign={c} />);
    expect(screen.getByRole('combobox', { name: 'Planning side' })).toHaveValue(
      'allied',
    );
    expect(
      screen.getByRole('combobox', { name: 'Retreat step 3' }),
    ).toHaveValue('9,4');
    await user.click(screen.getByRole('button', { name: 'Save withdrawal' }));
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'withdrawals',
        side: 'allied',
        lock: false,
      }),
    );
  });
  it('filters opposing withdrawal paths and HQ overlays from a faction view', async () => {
    const c = applyWaterlooCommand(seed(), {
      command: { kind: 'enable-preparation' },
      recordId: crypto.randomUUID(),
      timestamp: '2026-10-25T12:00:00.000Z',
    });
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    c.preparation!.submissions[1]!.orders = [
      {
        corpsId: c.corps[2]!.id,
        enemyId: c.corps[0]!.id,
        priority: 0,
        path: ['6,4', '7,4', '8,4', '9,4'],
      },
    ];
    c.preparation!.submissions[1]!.locked = true;
    useOperationalSession.setState({ view: 'french' });
    const user = userEvent.setup();
    render(<WaterlooDesk campaign={c} />);
    expect(screen.queryByText(/6,4 → 7,4 → 8,4 → 9,4/)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Withdrawal resolution preview'),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Map overlay' }),
      'control',
    );
    expect(
      screen.getByRole('button', { name: 'Hex 4,4' }).querySelector('polygon'),
    ).toHaveClass('hex-overlay-control');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Map overlay' }),
      'command',
    );
    expect(
      screen.getByRole('combobox', { name: 'Overlay HQ' }),
    ).toHaveTextContent('Napoleon');
    expect(
      screen.getByRole('combobox', { name: 'Overlay HQ' }),
    ).not.toHaveTextContent('Wellington');
    expect(
      screen.queryByRole('img', { name: 'Wellington HQ · normal' }),
    ).not.toBeInTheDocument();
  });
  it('offers an umpire preview of both locked withdrawals before confirmation', async () => {
    let c = applyWaterlooCommand(seed(), {
      command: { kind: 'enable-preparation' },
      recordId: crypto.randomUUID(),
      timestamp: '2026-10-25T12:00:00.000Z',
    });
    c.corps[0]!.hexId = '5,4';
    c.corps[2]!.hexId = '6,4';
    c = applyWaterlooCommand(c, {
      command: {
        kind: 'withdrawals',
        side: 'french',
        orders: [
          {
            corpsId: c.corps[0]!.id,
            enemyId: c.corps[2]!.id,
            priority: 0,
            path: ['5,4', '4,4', '3,4', '2,4'],
          },
        ],
        lock: true,
      },
      recordId: crypto.randomUUID(),
      timestamp: c.updatedAt,
    });
    c = applyWaterlooCommand(c, {
      command: { kind: 'withdrawals', side: 'allied', orders: [], lock: true },
      recordId: crypto.randomUUID(),
      timestamp: c.updatedAt,
    });
    const commit = vi.fn().mockResolvedValue(undefined);
    useCampaigns.setState({ commitWaterloo: commit });
    const user = userEvent.setup();
    render(<WaterlooDesk campaign={c} />);
    expect(
      screen.getByLabelText('Withdrawal resolution preview'),
    ).toHaveTextContent('retreats to 2,4');
    await user.click(
      screen.getByRole('button', { name: 'Confirm simultaneous withdrawals' }),
    );
    expect(commit).toHaveBeenCalledWith({ kind: 'resolve-withdrawals' });
    expect(c.corps[0]!.hexId).toBe('5,4');
  });
  it('preserves the Coalition route and side across unmount/navigation', async () => {
    const c = seed(),
      user = userEvent.setup(),
      commit = vi.fn().mockResolvedValue(undefined);
    useCampaigns.setState({ commitWaterloo: commit });
    const first = render(<WaterlooDesk campaign={c} />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Planning side' }),
      'allied',
    );
    await user.click(
      screen.getByRole('button', { name: 'Select Anglo-Allied I Corps' }),
    );
    await user.click(screen.getByRole('button', { name: 'Hex 8,4' }));
    expect(useCampaigns.getState().waterlooDraft?.kind).toBe('route');
    first.unmount();
    render(<WaterlooDesk campaign={c} />);
    expect(screen.getByRole('combobox', { name: 'Planning side' })).toHaveValue(
      'allied',
    );
    expect(screen.getByText('9,4 → 8,4', { exact: true })).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Save movement segment' }),
    );
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'orders', side: 'allied', lock: false }),
    );
  });
  it('withholds opposing roster, saved orders and adjudication in a faction view', async () => {
    const c = seed(),
      user = userEvent.setup();
    c.corps[2]!.roster = 'Private enemy tactical list';
    c.submissions[1]!.orders = [
      {
        corpsId: c.corps[2]!.id,
        priority: 0,
        segments: [
          {
            path: ['9,4', '8,4'],
            hqId: c.hqs[1]!.id,
            roadOnly: true,
            startAt: 390,
          },
        ],
      },
    ];
    useOperationalSession.setState({ view: 'french' });
    render(<WaterlooDesk campaign={c} />);
    expect(
      screen.queryByText('Private enemy tactical list'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/9,4 → 8,4/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Pending encounters' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getAllByRole('button', { name: 'Select opposing corps' })[0]!,
    );
    openDrawer('Formation');
    expect(
      screen.getByText('Composition and readiness withheld.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Private enemy tactical list'),
    ).not.toBeInTheDocument();
  });
  it('keeps drafts undoable and leaves saved orders untouched on cancel', async () => {
    const c = seed(),
      user = userEvent.setup(),
      commit = vi.fn();
    useCampaigns.setState({ commitWaterloo: commit });
    render(<WaterlooDesk campaign={c} />);
    await user.click(
      screen.getByRole('button', { name: 'Select French I Corps' }),
    );
    await user.click(screen.getByRole('button', { name: 'Hex 4,4' }));
    await user.click(screen.getByRole('button', { name: 'Hex 5,4' }));
    await user.click(screen.getByRole('button', { name: 'Undo route step' }));
    expect(screen.getByText('3,4 → 4,4', { exact: true })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel route' }));
    expect(useCampaigns.getState().waterlooDraft).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    expect(c.submissions[0]!.orders).toEqual([]);
  });
});
