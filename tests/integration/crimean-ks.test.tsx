import { KsDeploymentArea } from '../../src/renderer/KsDeploymentArea';
import { almaRoster } from '../../src/domain/alma-roster';
import { applyKsCommand } from '../../src/domain/crimean-ks';
import { ksNow } from '../fixtures/crimean-ks';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KsRulingDialog } from '../../src/renderer/KsRulingDialog';
import { CrimeanWorkspace } from '../../src/renderer/CrimeanWorkspace';
import { useKs } from '../../src/renderer/ks-store';
import { ksForce, ksSeed } from '../fixtures/crimean-ks';
const original = useKs.getState();
beforeEach(() => {
  useKs.setState({
    ...original,
    library: { campaigns: [], active: ksSeed(), events: [] },
    pending: false,
    error: null,
    load: vi.fn().mockResolvedValue(true),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
it('retains an edited force and rationale when a ruling fails, and submits free-form strengths without a Maurice quality assumption', async () => {
  const user = userEvent.setup(),
    f = ksForce(),
    close = vi.fn(),
    commit = vi.fn().mockResolvedValue(false);
  useKs.setState({ commit });
  render(
    <KsRulingDialog
      draft={{ kind: 'force', isNew: true, force: f }}
      onClose={close}
    />,
  );
  await user.clear(screen.getByRole('textbox', { name: 'Reported strength' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Reported strength' }),
    'Approximately 1,700 men; cavalry detached',
  );
  await user.click(screen.getByRole('button', { name: 'Record ruling' }));
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'add-force',
      force: expect.objectContaining({
        id: f.id,
        strength: 'Approximately 1,700 men; cavalry detached',
      }),
    }),
    expect.any(String),
  );
  expect(close).not.toHaveBeenCalled();
  expect(
    screen.getByRole('textbox', { name: 'Reported strength' }),
  ).toHaveValue('Approximately 1,700 men; cavalry detached');
  expect(screen.queryByLabelText(/quality/i)).not.toBeInTheDocument();
});
it('protects a map-action draft before switching modules and never mutates saved positions by opening the action', async () => {
  const user = userEvent.setup(),
    switchModule = vi.fn(),
    confirm = vi.fn().mockResolvedValue(false);
  window.desktop = { ...window.desktop, confirmDiscardDraft: confirm };
  const before = structuredClone(useKs.getState().library);
  render(<CrimeanWorkspace onSwitchModule={switchModule} />);
  await user.click(screen.getByRole('button', { name: 'Add force' }));
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Campaign module' }),
    'maurice',
  );
  expect(confirm).toHaveBeenCalledOnce();
  expect(switchModule).not.toHaveBeenCalled();
  expect(useKs.getState().library).toEqual(before);
  confirm.mockResolvedValue(true);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Campaign module' }),
    'maurice',
  );
  expect(switchModule).toHaveBeenCalledOnce();
});
it('clears a previous campaign’s context actions and selection when creating another KS campaign', async () => {
  const user = userEvent.setup(),
    f = ksForce(),
    first = { ...ksSeed(), forces: [f] };
  useKs.setState({
    library: { campaigns: [], active: first, events: [] },
    createCampaign: vi.fn(async (title) => {
      useKs.setState({
        library: { campaigns: [], active: { ...ksSeed(), title }, events: [] },
      });
      return true;
    }),
  });
  render(<CrimeanWorkspace onSwitchModule={vi.fn()} />);
  fireEvent.contextMenu(
    screen.getByRole('button', { name: `Force ${f.name}` }),
    { clientX: 200, clientY: 300 },
  );
  expect(screen.getByRole('menu')).toBeInTheDocument();
  await user.click(
    screen.getByText('KS campaigns', { selector: 'summary', exact: true }),
  );
  await user.click(screen.getByRole('button', { name: 'New Crimean KS' }));
  await user.clear(screen.getByRole('textbox', { name: 'Campaign title' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Campaign title' }),
    'Second independent KS',
  );
  await user.click(screen.getByRole('button', { name: 'Create KS campaign' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Selected force' })).toHaveValue(
    '',
  );
  expect(first.forces).toEqual([f]);
});

it('selects historical groups and individual records without deploying until the map workflow confirms', async () => {
  const user = userEvent.setup(),
    onPlace = vi.fn();
  const c = applyKsCommand(
    ksSeed(),
    {
      kind: 'stage-roster',
      rosterId: almaRoster.id,
      forceIds: almaRoster.entries.map(() => crypto.randomUUID()),
    },
    ksNow,
  );
  useKs.setState({ library: { campaigns: [], active: c, events: [] } });
  render(<KsDeploymentArea disabled={false} onPlace={onPlace} />);
  await user.click(
    screen.getByText('Deployment Area', { selector: 'summary' }),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Search deployment area' }),
    'Codrington',
  );
  await user.click(
    screen.getByText(/British.*Codrington/, {
      selector: '.ks-roster-group > summary',
    }),
  );
  await user.click(screen.getByRole('checkbox', { name: 'Select group' }));
  expect(
    screen.getByRole('checkbox', {
      name: '7th (Royal Fusiliers) Regiment of Foot',
    }),
  ).toBeChecked();
  await user.click(
    screen.getByRole('checkbox', {
      name: '7th (Royal Fusiliers) Regiment of Foot',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Place selected (2)' }));
  expect(onPlace).toHaveBeenCalledWith(
    c.deploymentArea!.forces.slice(1, 3).map((f) => f.id),
  );
  expect(useKs.getState().library!.active!.forces).toEqual([]);
});
it('keeps the source review open when staging fails so the umpire can retry', async () => {
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(false);
  useKs.setState({ commit });
  render(<KsDeploymentArea disabled={false} onPlace={vi.fn()} />);
  await user.click(
    screen.getByText('Deployment Area', { selector: 'summary' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Review Alma roster & sources' }),
  );
  await user.click(
    screen.getByRole('button', {
      name: 'Load Alma roster into deployment area',
    }),
  );
  expect(commit).toHaveBeenCalledOnce();
  expect(
    screen.getByRole('dialog', { name: 'Alma roster review' }),
  ).toBeInTheDocument();
  expect(useKs.getState().library!.active).not.toHaveProperty('deploymentArea');
});
