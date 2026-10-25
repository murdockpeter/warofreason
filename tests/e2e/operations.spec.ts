import { selectMapView } from './profile';
import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  navigateTo,
  launchDesktop,
  removeTestProfile,
  testProfile,
} from './profile';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import type { FontenoyCampaign } from '../../src/domain/campaign';

async function expectCounterInSquare(
  page: Page,
  formation: string,
  reference: string,
) {
  const counter = page.getByRole('button', {
    name: `Select ${formation}`,
    exact: true,
  });
  const square = page
    .getByRole('button', { name: new RegExp(`^Square ${reference}(?: |$)`) })
    .locator('rect');
  await expect
    .poll(
      async () => {
        const [marker, cell] = await Promise.all([
          counter.boundingBox(),
          square.boundingBox(),
        ]);
        if (!marker || !cell) return false;
        const x = marker.x + marker.width / 2;
        const y = marker.y + marker.height / 2;
        return (
          x > cell.x &&
          x < cell.x + cell.width &&
          y > cell.y &&
          y < cell.y + cell.height
        );
      },
      { message: `${formation} counter should render inside ${reference}` },
    )
    .toBe(true);
}

for (const packaged of [false, true]) {
  test(`${packaged ? 'packaged' : 'built'} operational planning, privacy, resolution and day advancement`, async () => {
    test.setTimeout(90000);
    const profile = testProfile();
    const audit = {
      actor: 'Operational tester',
      reason: 'Operational acceptance.',
    };
    const repo = new SqliteCampaignRepository(
      path.join(profile, 'campaigns.sqlite'),
    );
    const seeded = repo.create({ title: 'Operational acceptance', ...audit })
      .active as FontenoyCampaign;
    const squares = [
      seeded.columns[0]!.squareId!,
      ...[4, 5].map(
        (column) =>
          seeded.squares.find((s) => s.row === 2 && s.column === column)!.id,
      ),
    ];
    seeded.settings.reviewedHouseRules = true;
    seeded.settings.reviewedSchematicMap = true;
    seeded.settings.map.roadEdges = [
      { from: squares[0]!, to: squares[1]!, provenance: 'house_rule_v0.1' },
      { from: squares[1]!, to: squares[2]!, provenance: 'house_rule_v0.1' },
    ];
    seeded.columns[2]!.concealment = 'hidden';
    repo.saveSetup({
      id: seeded.id,
      expectedRevision: 1,
      settings: seeded.settings,
      columns: seeded.columns,
      commanders: seeded.commanders,
      ...audit,
    });
    repo.start({ id: seeded.id, expectedRevision: 2, ...audit });
    repo.close();
    let app: ElectronApplication | null = null;
    try {
      app = await launchDesktop(profile, packaged);
      let page = await app.firstWindow();
      const snapshot = async () => {
        const result = await page.evaluate(() =>
          window.desktop.getCampaignLibrary(),
        );
        if (!result.ok || result.value.active?.schemaVersion !== 2)
          throw new Error('Expected started Fontenoy.');
        return { ...result.value, active: result.value.active };
      };
      await navigateTo(page, 'Campaign Map');
      await page
        .getByRole('button', { name: 'Enable operational play' })
        .click();
      await expect(page.getByText('french · planning · turn 1')).toBeVisible();
      await page
        .getByText('Movement house rules and roadblocks', { exact: true })
        .click();
      await page
        .getByRole('listbox', { name: 'Blocked squares' })
        .selectOption([squares[2]!]);
      await page.getByRole('button', { name: 'Save movement rules' }).click();
      await page
        .getByRole('button', {
          name: `Select ${seeded.columns[0]!.displayName}`,
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Square E3', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Square F3', exact: true })
        .click();
      await expect(
        page.getByText('The route crosses a blocked square.', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Add order' }),
      ).toBeDisabled();
      await page.getByRole('button', { name: 'Undo route step' }).click();
      await page.getByRole('button', { name: 'Add order' }).click();
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('Unissued orders');
      await page.locator('.map-orders > summary').click();
      await page.getByRole('button', { name: 'Undo order edit' }).click();
      await expect(
        page.getByText('No orders visible in this view.'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Add order' }).click();
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await expect(page.getByText('200%', { exact: true })).toBeVisible();
      const viewport = page.locator('.operational-map-scroll');
      const bounds = await viewport.boundingBox();
      if (!bounds) throw new Error('Expected map viewport.');
      await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + 100);
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + bounds.width * 0.7 - 100,
        bounds.y + 40,
        { steps: 5 },
      );
      await page.mouse.up();
      await expect
        .poll(() => viewport.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      await page
        .getByRole('button', { name: 'Reset map', exact: true })
        .click();
      const map = page.getByRole('region', {
        name: 'Interactive campaign map',
      });
      await map.screenshot({
        path: `test-results/${packaged ? 'packaged' : 'built'}-operational-map.png`,
      });
      await navigateTo(page, 'Turn Orders');
      await expect(
        page.getByRole('region', { name: 'Operational orders' }),
      ).toContainText('D3 → E3');
      await page
        .getByRole('button', { name: 'Issue orders', exact: true })
        .click();
      const issued = await snapshot();
      expect(issued.active!.columns[0]!.squareId).toBe(squares[0]);
      const rejected = await page.evaluate(
        async ({ id, revision, columnId, route }) =>
          window.desktop.commitOperationalAction({
            id,
            expectedRevision: revision,
            actor: 'Tester',
            reason: 'Reject alteration of issued orders.',
            command: { kind: 'issue', orders: [{ columnId, path: route }] },
          }),
        {
          id: seeded.id,
          revision: issued.active!.revision,
          columnId: seeded.columns[0]!.id,
          route: squares,
        },
      );
      expect(rejected.ok).toBe(false);
      expect(await snapshot()).toEqual(issued);
      await page.getByRole('button', { name: 'Return to planning' }).click();
      await page
        .getByRole('button', { name: 'Issue orders', exact: true })
        .click();
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      await navigateTo(page, 'Turn Orders');
      await expect(
        page.getByText('Issued orders · awaiting resolution', { exact: true }),
      ).toBeVisible();
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 0,
          checkboxChecked: false,
        });
      });
      const beforeCancel = await snapshot();
      await page
        .getByRole('button', { name: 'Resolve orders', exact: true })
        .click();
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(await snapshot()).toEqual(beforeCancel);
      await navigateTo(page, 'Campaign Map');
      await expectCounterInSquare(page, seeded.columns[0]!.displayName, 'D3');
      await navigateTo(page, 'Turn Orders');
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      await page
        .getByRole('button', { name: 'Resolve orders', exact: true })
        .click();
      await expect(page.getByText('allied · planning · turn 1')).toBeVisible();
      expect((await snapshot()).active!.columns[0]!.squareId).toBe(squares[1]);
      await navigateTo(page, 'Campaign Map');
      await expectCounterInSquare(page, seeded.columns[0]!.displayName, 'E3');
      await page
        .getByRole('button', {
          name: `Select ${seeded.columns[3]!.displayName}`,
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Square K4', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Add order', exact: true })
        .click();
      await expectCounterInSquare(page, seeded.columns[3]!.displayName, 'L4');
      await navigateTo(page, 'Turn Orders');
      await page
        .getByRole('button', { name: 'Issue orders', exact: true })
        .click();
      await navigateTo(page, 'Campaign Map');
      await expectCounterInSquare(page, seeded.columns[3]!.displayName, 'L4');
      await page
        .getByRole('button', { name: 'Confirm phase resolution', exact: true })
        .click();
      await expect(page.getByText('french · planning · turn 2')).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Campaign status' }),
      ).toContainText('1745-05-03');
      await expectCounterInSquare(page, seeded.columns[0]!.displayName, 'E3');
      await expectCounterInSquare(page, seeded.columns[3]!.displayName, 'K4');
      await selectMapView(page, 'french');
      await expect(
        page.getByRole('button', {
          name: `Select ${seeded.columns[2]!.displayName}`,
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', {
          name: 'Select Opposing column',
          exact: true,
        }),
      ).toHaveCount(1);
      await page
        .getByRole('button', { name: 'Select Opposing column', exact: true })
        .click();
      await page.locator('.formation-inspection > summary').click();
      await expect(
        page.getByText(
          'Opposing composition and commanders are not disclosed.',
        ),
      ).toBeVisible();
      const target = path.join(profile, 'french-view.json');
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: filename,
        });
      }, target);
      await page.getByRole('button', { name: 'Export faction view' }).click();
      await expect(
        page.getByText('Saved faction view. This is not a campaign backup.'),
      ).toBeVisible();
      const exported = readFileSync(target, 'utf8');
      expect(exported).not.toContain(seeded.columns[2]!.id);
      expect(exported).not.toContain('"events"');
      for (const unit of seeded.units.filter((u) => u.contingent !== 'french'))
        expect(exported).not.toContain(unit.displayName);
      await navigateTo(page, 'Dashboard');
      await expect(
        page.getByRole('heading', { name: 'Shared campaign management' }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Campaign journal' }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Switch to umpire view' }).click();
      const final = await snapshot();
      expect(
        final.events.filter((e) => e.category === 'orders_resolved'),
      ).toHaveLength(2);
      expect(final.events.at(-1)!.reason).toContain(
        'house_rule_v0.1/operations-1',
      );
      await app.close();
      app = await launchDesktop(profile, packaged);
      page = await app.firstWindow();
      expect(await snapshot()).toEqual(final);
    } finally {
      if (app) await app.close();
      removeTestProfile(profile);
    }
  });
}
