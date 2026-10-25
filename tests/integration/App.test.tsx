import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/renderer/App';
import { ErrorBoundary } from '../../src/renderer/ErrorBoundary';
import { screens, useSession } from '../../src/renderer/session';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { campaignFixture, exportFixture } from '../fixtures/campaign';
import type {
  CampaignLibrary,
  FontenoyCampaign,
} from '../../src/domain/campaign';
import { seedFontenoy } from '../../src/domain/fontenoy';
import { useOperationalSession } from '../../src/renderer/operational-session';
import {
  contactCampaign,
  declarationFor,
  tabletopStep,
} from '../fixtures/tabletop';

const emptyLibrary: CampaignLibrary = {
  campaigns: [],
  active: null,
  events: [],
};
function savedLibrary(): CampaignLibrary {
  const campaign = campaignFixture();
  return {
    campaigns: [
      {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        revision: campaign.revision,
        updatedAt: campaign.updatedAt,
      },
    ],
    active: campaign,
    events: exportFixture(campaign).events,
  };
}

beforeEach(() => {
  useOperationalSession.setState({ view: 'umpire' });
  useSession.setState({ screen: 'Dashboard', notice: null });
  useCampaigns.setState({
    tabletopDraft: null,
    planningDraft: null,
    planningHistory: [],
    library: null,
    loading: false,
    pending: false,
    error: null,
    message: null,
    draft: null,
    setupDraft: null,
    setupHistory: [],
  });
  window.desktop = {
    createWaterlooCampaign: vi.fn(),
    commitWaterlooAction: vi.fn(),
    commitAftermathAction: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    commitTabletopAction: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    rollScoutingDie: vi.fn().mockResolvedValue(4),
    exportBattleBrief: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { cancelled: false } }),
    commitOperationalAction: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    exportPlayerView: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { cancelled: false } }),
    initializeScenario: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    saveCampaignSetup: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    startCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    getCampaignLibrary: vi
      .fn()
      .mockResolvedValue({ ok: true, value: emptyLibrary }),
    createCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    renameCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    cloneCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    archiveCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: emptyLibrary }),
    openCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: savedLibrary() }),
    importCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: emptyLibrary }),
    exportCampaign: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { cancelled: false } }),
    confirmDiscardDraft: vi.fn().mockResolvedValue(false),
    getAppInfo: vi.fn().mockResolvedValue({
      version: '0.6.0',
      platform: 'win32',
      milestone: 'F',
    }),
    confirmResetSession: vi.fn().mockResolvedValue(false),
    logError: vi.fn().mockResolvedValue({ recorded: true }),
  };
});
describe('desktop skeleton', () => {
  it('retains a cancelled manual result draft across navigation and clears it only after a committed confirmation', async () => {
    let c = contactCampaign();
    c = tabletopStep(c, {
      kind: 'declare-battle',
      declaration: declarationFor(c),
    });
    c = tabletopStep(c, {
      kind: 'start-battle',
      battleId: c.tabletop!.battles[0]!.id,
    });
    const library = { ...savedLibrary(), active: c, events: [] };
    vi.mocked(window.desktop.getCampaignLibrary).mockResolvedValue({
      ok: true,
      value: library,
    });
    vi.mocked(window.desktop.commitTabletopAction).mockResolvedValue({
      ok: true,
      value: library,
    });
    useSession.setState({ screen: 'Battle Log' });
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Enter battle result' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Battle outcome' }),
      'draw',
    );
    await user.click(
      screen.getByRole('button', { name: 'Mark remaining units survived' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Review and confirm result' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'No changes committed. Your draft is still available.',
        ),
      ).toBeInTheDocument(),
    );
    expect(useCampaigns.getState().tabletopDraft?.kind).toBe('result');
    await user.click(screen.getByRole('button', { name: 'Campaign Map' }));
    expect(
      screen.getByRole('region', { name: 'Campaign status' }),
    ).toHaveTextContent('Uncommitted tabletop draft');
    await user.click(screen.getByRole('button', { name: 'Battle Log' }));
    expect(
      screen.getByRole('combobox', { name: 'Battle outcome' }),
    ).toHaveValue('draw');
    vi.mocked(window.desktop.commitTabletopAction).mockImplementation(
      async (input) => ({
        ok: true,
        value: {
          ...library,
          active: {
            ...tabletopStep(c, input.command),
            revision: c.revision + 1,
          },
        },
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Review and confirm result' }),
    );
    await waitFor(() =>
      expect(useCampaigns.getState().tabletopDraft).toBeNull(),
    );
    expect(
      screen.getByRole('region', { name: 'Confirmed tabletop result' }),
    ).toHaveTextContent('draw');
    expect(
      (useCampaigns.getState().library?.active as FontenoyCampaign | null)
        ?.units,
    ).toEqual(c.units);
  });
  it.each(['draft', 'active', 'archived'] as const)(
    'handles review confirmations directly for a %s campaign',
    async (status) => {
      const campaign = seedFontenoy(campaignFixture(), () =>
        crypto.randomUUID(),
      );
      campaign.status = status;
      vi.mocked(window.desktop.getCampaignLibrary).mockResolvedValue({
        ok: true,
        value: { ...savedLibrary(), active: campaign },
      });
      useSession.setState({ screen: 'Armies/Columns' });
      render(<App />);
      const user = userEvent.setup();
      const house = await screen.findByRole('checkbox', {
        name: 'I reviewed the provisional operational setup and schedule.',
      });
      const map = screen.getByRole('checkbox', {
        name: 'I understand the map is schematic and routes are unverified.',
      });
      if (status !== 'draft') {
        expect(house).toBeDisabled();
        expect(map).toBeDisabled();
        expect(useCampaigns.getState().setupDraft).toBeNull();
        return;
      }
      expect(house).toBeEnabled();
      expect(map).toBeEnabled();
      await user.click(map);
      await waitFor(() => expect(map).toBeChecked());
      await user.click(house);
      expect(house).toBeChecked();
      expect(
        useCampaigns.getState().setupDraft?.settings.reviewedHouseRules,
      ).toBe(true);
      expect(
        (useCampaigns.getState().library?.active as FontenoyCampaign | null)
          ?.settings,
      ).toEqual(campaign.settings);
      expect(window.desktop.saveCampaignSetup).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Start Campaign' }),
      ).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Undo setup edit' }));
      expect(house).not.toBeChecked();
      expect(map).toBeChecked();
    },
  );
  it.each(['empty', 'legacy', 'configured'] as const)(
    'shows the Campaign Map for a %s library without changing saved state',
    async (kind) => {
      const library = kind === 'empty' ? emptyLibrary : savedLibrary();
      if (kind === 'configured')
        library.active = seedFontenoy(campaignFixture(), () =>
          crypto.randomUUID(),
        );
      vi.mocked(window.desktop.getCampaignLibrary).mockResolvedValue({
        ok: true,
        value: library,
      });
      render(<App />);
      const user = userEvent.setup();
      await waitFor(() =>
        expect(useCampaigns.getState().library).toEqual(library),
      );
      await user.click(screen.getByRole('button', { name: 'Campaign Map' }));
      expect(
        screen.getByRole(
          kind === 'configured' ? 'group' : 'img',
          kind === 'configured'
            ? { name: 'Selectable campaign squares and columns' }
            : undefined,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('No map loaded')).not.toBeInTheDocument();
      if (kind !== 'configured') {
        await user.click(
          screen.getByRole('button', {
            name:
              kind === 'legacy'
                ? 'Review campaign setup'
                : 'Open campaign library',
          }),
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          kind === 'legacy' ? 'Armies/Columns' : 'Dashboard',
        );
      } else {
        expect(
          screen.getByRole('region', { name: 'Interactive campaign map' }),
        ).toHaveTextContent('Fontenoy');
      }
      expect(useCampaigns.getState().library).toEqual(library);
      expect(window.desktop.initializeScenario).not.toHaveBeenCalled();
      expect(window.desktop.createCampaign).not.toHaveBeenCalled();
    },
  );
  it('reviews a complete module, preserves forces during transfers and requires saving before starting', async () => {
    const campaign = seedFontenoy(campaignFixture(), () => crypto.randomUUID());
    const initial = { ...savedLibrary(), active: campaign, events: [] };
    vi.mocked(window.desktop.getCampaignLibrary).mockResolvedValue({
      ok: true,
      value: initial,
    });
    vi.mocked(window.desktop.saveCampaignSetup).mockImplementation(
      async (input) => ({
        ok: true,
        value: {
          ...initial,
          active: {
            ...campaign,
            settings: input.settings,
            columns: input.columns,
            commanders: input.commanders,
            revision: 2,
          },
        },
      }),
    );
    useSession.setState({ screen: 'Armies/Columns' });
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByText('French: 20')).toBeInTheDocument(),
    );
    expect(screen.getByText('Allied: 18')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start Campaign' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Edit setup' }));
    const unit = campaign.units[0]!;
    await user.selectOptions(
      screen.getByRole('combobox', { name: `Assign ${unit.displayName}` }),
      campaign.columns[1]!.id,
    );
    expect(
      useCampaigns.getState().setupDraft?.columns[0]!.unitIds,
    ).not.toContain(unit.id);
    await user.click(screen.getByRole('button', { name: 'Undo setup edit' }));
    expect(useCampaigns.getState().setupDraft?.columns[0]!.unitIds).toContain(
      unit.id,
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I reviewed the provisional operational setup and schedule.',
      }),
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I understand the map is schematic and routes are unverified.',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Start Campaign' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save setup' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Start Campaign' }),
      ).toBeEnabled(),
    );
    expect(window.desktop.saveCampaignSetup).toHaveBeenCalledOnce();
    expect(
      (useCampaigns.getState().library?.active as FontenoyCampaign | null)
        ?.units,
    ).toHaveLength(38);
  });
  it('navigates all seven screens and keeps honest campaign status visible', async () => {
    render(<App />);
    const user = userEvent.setup();
    for (const name of screens) {
      await user.click(screen.getByRole('button', { name: name }));
      expect(
        screen.getByRole('heading', { level: 1, name }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.getByRole('region', { name: 'Campaign status' }),
      ).toHaveTextContent('Not started');
    }
    expect(screen.getByText('0.6.0')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Rules boundary' }),
    ).toHaveTextContent('house rules');
  });
  it('holds edits in a draft and commits only after explicit submission', async () => {
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New campaign' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Campaign title' }),
      'My saved draft',
    );
    expect(window.desktop.createCampaign).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: 'Campaign status' }),
    ).toHaveTextContent('Uncommitted draft');
    await user.click(screen.getByRole('button', { name: 'Create and save' }));
    expect(window.desktop.createCampaign).toHaveBeenCalledWith({
      title: 'My saved draft',
      actor: 'Local player',
      reason: 'Created a campaign draft.',
    });
    expect(
      screen.queryByRole('region', { name: 'Campaign draft' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Campaign status' }),
    ).toHaveTextContent('All changes saved');
  });
  it('undoes uncommitted edits, retains them across navigation, and confirms discard', async () => {
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New campaign' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Campaign title' }),
      'AB',
    );
    await user.click(screen.getByRole('button', { name: 'Undo last edit' }));
    expect(screen.getByRole('textbox', { name: 'Campaign title' })).toHaveValue(
      'A',
    );
    await user.click(screen.getByRole('button', { name: 'Campaign Map' }));
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByRole('textbox', { name: 'Campaign title' })).toHaveValue(
      'A',
    );
    await user.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(screen.getByRole('textbox', { name: 'Campaign title' })).toHaveValue(
      'A',
    );
    vi.mocked(window.desktop.confirmDiscardDraft).mockResolvedValue(true);
    await user.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(
      screen.queryByRole('textbox', { name: 'Campaign title' }),
    ).not.toBeInTheDocument();
    expect(window.desktop.createCampaign).not.toHaveBeenCalled();
  });
  it('keeps a failed save editable and exposes the actionable error', async () => {
    vi.mocked(window.desktop.createCampaign).mockResolvedValue({
      ok: false,
      error: {
        code: 'storage',
        message: 'Disk is full. Free space and retry.',
      },
    });
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New campaign' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Campaign title' }),
      'Keep my edits',
    );
    await user.click(screen.getByRole('button', { name: 'Create and save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Disk is full');
    expect(screen.getByRole('textbox', { name: 'Campaign title' })).toHaveValue(
      'Keep my edits',
    );
  });
  it('preserves a notice on cancel and clears it on explicit confirmation', async () => {
    useSession.setState({ screen: 'Settings', notice: 'Diagnostic example' });
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Reset session notice' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Diagnostic example');
    vi.mocked(window.desktop.confirmResetSession).mockResolvedValue(true);
    await user.click(
      screen.getByRole('button', { name: 'Reset session notice' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('shows and logs desktop connection errors without crashing navigation', async () => {
    vi.mocked(window.desktop.getAppInfo).mockRejectedValue(
      new Error('IPC unavailable'),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong',
      ),
    );
    expect(window.desktop.logError).toHaveBeenCalledWith({
      source: 'renderer',
      message: 'IPC unavailable',
    });
  });
  it('catches rendering errors and offers reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('Render failed');
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole('heading', { name: 'Unable to display this screen' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reload application' }),
    ).toBeInTheDocument();
    expect(window.desktop.logError).toHaveBeenCalledWith({
      source: 'boundary',
      message: 'Render failed',
    });
  });
});
