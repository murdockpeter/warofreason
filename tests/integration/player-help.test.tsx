import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpManual } from '../../src/renderer/HelpManual';
import { FormationDossier } from '../../src/renderer/FormationDossier';
import { nextPlayerStep } from '../../src/renderer/player-help';
import { projectOperationalView } from '../../src/domain/operations';
import {
  preparedTabletop,
  tabletopStep,
  contactCampaign,
} from '../fixtures/tabletop';
import { aftermathStep, passPhase } from '../fixtures/aftermath';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});

describe('player guidance and formation dossiers', () => {
  it('explains current planning, keeps drafts intact and navigates only on explicit request', async () => {
    const c = preparedTabletop();
    const before = structuredClone(c);
    const navigate = vi.fn();
    const dismiss = vi.fn();
    render(
      <HelpManual
        campaign={c}
        view="french"
        screen="Campaign Map"
        hasDraft
        onNavigate={navigate}
        onDismiss={dismiss}
      />,
    );
    expect(
      screen.getByRole('region', { name: 'What to do now' }),
    ).toHaveTextContent('Plan your faction’s orders');
    expect(screen.getByText(/You have unsaved edits/)).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Split formations' }));
    expect(
      screen.getByRole('region', { name: 'Split formations' }),
    ).toHaveTextContent('Keep at least one unit');
    expect(navigate).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(c).toEqual(before);
    await user.click(
      screen.getByRole('button', { name: 'Go to Campaign Map' }),
    );
    expect(navigate).toHaveBeenCalledWith('Campaign Map');
    expect(dismiss).toHaveBeenCalledOnce();
  });
  it('changes next-step guidance for setup, wrong faction, issued orders and completed turns', () => {
    expect(nextPlayerStep(null, 'umpire').screen).toBe('Dashboard');
    const c = preparedTabletop();
    expect(nextPlayerStep(c, 'allied').title).toBe(
      'The other faction is active',
    );
    c.operations!.phase = 'resolution';
    expect(nextPlayerStep(c, 'french').screen).toBe('Turn Orders');
    c.status = 'draft';
    expect(nextPlayerStep(c, 'umpire').screen).toBe('Armies/Columns');
    const checkpoint = passPhase(
      passPhase(aftermathStep(preparedTabletop(), { kind: 'enable' })),
    );
    expect(nextPlayerStep(checkpoint, 'umpire').title).toBe(
      'Finish the completed turn',
    );
    expect(nextPlayerStep(contactCampaign(), 'umpire').title).toBe(
      'Prepare your engagement',
    );
  });
  it('shows own current roster, statuses and commanders without mutating state', async () => {
    const c = preparedTabletop();
    c.units.find((u) => c.columns[0]!.unitIds.includes(u.id))!.currentStatus =
      'recovering';
    const before = structuredClone(c);
    const view = projectOperationalView(c, 'french');
    const column = view.columns.find((col) => col.id === c.columns[0]!.id)!;
    const dismiss = vi.fn();
    render(
      <FormationDossier view={view} column={column} onDismiss={dismiss} />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Formation intelligence' }),
    ).toBeVisible();
    expect(screen.getByText('Current formation record')).toBeVisible();
    expect(
      within(
        screen.getByRole('region', { name: 'Formation roster' }),
      ).getByText('recovering'),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Formation commanders' }),
    ).toHaveTextContent(c.commanders[0]!.displayName);
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: 'Close Formation intelligence' }),
      );
    expect(dismiss).toHaveBeenCalledOnce();
    expect(c).toEqual(before);
  });
  it('withholds unreported enemy rosters, counts and commanders', () => {
    const c = preparedTabletop();
    const view = projectOperationalView(c, 'french');
    const column = view.columns.find((col) => col.id === c.columns[2]!.id)!;
    render(
      <FormationDossier view={view} column={column} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('Roster withheld')).toBeVisible();
    expect(screen.getByText('Undisclosed')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    for (const unit of c.units.filter((u) => u.contingent !== 'french'))
      expect(screen.queryByText(unit.displayName)).not.toBeInTheDocument();
    expect(
      screen.queryByText(c.commanders[1]!.displayName),
    ).not.toBeInTheDocument();
  });
  it('labels identified enemy readiness and roster as observations and retains the report location', () => {
    let c = preparedTabletop();
    c = tabletopStep(c, {
      kind: 'scout',
      input: {
        scoutId: c.columns[1]!.id,
        targetColumnId: c.columns[3]!.id,
        roll: 4,
        rollSource: 'physical',
        modifier: 0,
        reason: 'Umpire identified the force.',
        state: 'identified',
        estimate: '',
      },
    });
    c.columns[3]!.squareId = c.columns[2]!.squareId;
    const view = projectOperationalView(c, 'french');
    const column = view.columns.find((col) => col.id === c.columns[3]!.id)!;
    render(
      <FormationDossier view={view} column={column} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('Dated scouting report')).toBeVisible();
    expect(screen.getByText('Ready (observed)')).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Observed quality' }),
    ).toBeVisible();
    expect(screen.getByText(/observed turn 1/)).toHaveTextContent(
      'expires at turn 2',
    );
    expect(column.squareId).not.toBe(c.columns[3]!.squareId);
  });
});
