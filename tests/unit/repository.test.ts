// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteCampaignRepository } from '../../src/main/persistence/repository';
import {
  readCampaignFile,
  writeCampaignFile,
  maxCampaignFileBytes,
} from '../../src/main/persistence/files';
import { campaignSchema } from '../../src/domain/campaign';
import { migrate } from '../../src/main/persistence/migrations';
import type { FontenoyCampaign } from '../../src/domain/campaign';
import { campaignFixture, exportFixture } from '../fixtures/campaign';

let directory: string;
let database: string;
let repo: SqliteCampaignRepository;
const audit = { actor: 'Test player', reason: 'Testing committed changes.' };
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'maurice-repo-test-'));
  database = path.join(directory, 'campaigns.sqlite');
  repo = new SqliteCampaignRepository(database);
});
afterEach(() => {
  repo.close();
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.join(os.tmpdir(), 'maurice-repo-test-')))
    throw new Error('Unsafe test cleanup path');
  rmSync(resolved, { recursive: true, force: true });
});
function restart() {
  repo.close();
  repo = new SqliteCampaignRepository(database);
}
function create(title = 'First campaign') {
  return repo.create({ title, ...audit }).active!;
}
describe('SQLite repository', () => {
  it('upgrades a legacy empty draft explicitly without replacing identity or old journal snapshots', () => {
    const legacy = campaignFixture();
    legacy.factions = [];
    legacy.units = [];
    legacy.columns = [];
    legacy.commanders = [];
    legacy.squares = [];
    repo.importCampaign(exportFixture(legacy));
    const before = repo.library();
    const after = repo.initializeScenario({
      id: legacy.id,
      expectedRevision: before.active!.revision,
      ...audit,
    });
    expect(after.active?.id).toBe(legacy.id);
    expect(after.active?.title).toBe(legacy.title);
    expect(after.active?.seed).toBe(legacy.seed);
    expect(after.active?.schemaVersion).toBe(2);
    expect(after.active?.units).toHaveLength(38);
    expect(after.events.slice(0, -1)).toEqual(before.events);
    expect(after.events.at(-1)?.category).toBe('scenario_loaded');
    restart();
    expect(repo.library()).toEqual(after);
  });
  it('does not overwrite custom legacy entities while loading a scenario', () => {
    repo.importCampaign(exportFixture());
    const before = repo.library();
    expect(() =>
      repo.initializeScenario({
        id: before.active!.id,
        expectedRevision: before.active!.revision,
        ...audit,
      }),
    ).toThrow('custom entities');
    expect(repo.library()).toEqual(before);
  });
  it('saves edited setup, validates start, recovers started state, and clones it back into an editable draft', () => {
    const campaign = create() as FontenoyCampaign;
    expect(() =>
      repo.start({ id: campaign.id, expectedRevision: 1, ...audit }),
    ).toThrow('Acknowledge');
    const before = repo.library();
    const duplicate = structuredClone(campaign.columns);
    duplicate[1]!.unitIds.push(duplicate[0]!.unitIds[0]!);
    expect(() =>
      repo.saveSetup({
        id: campaign.id,
        expectedRevision: 1,
        ...audit,
        settings: campaign.settings,
        columns: duplicate,
        commanders: campaign.commanders,
      }),
    ).toThrow();
    expect(repo.library()).toEqual(before);
    const settings = structuredClone(campaign.settings);
    settings.reviewedHouseRules = true;
    settings.reviewedSchematicMap = true;
    settings.map.kilometresPerSquare = 4;
    settings.schedule.daysPerTurn = 1;
    settings.map.roadEdges.push({
      from: campaign.squares[0]!.id,
      to: campaign.squares[1]!.id,
      provenance: 'house_rule_v0.1',
    });
    const columns = structuredClone(campaign.columns);
    const transferred = columns[0]!.unitIds.shift()!;
    columns[1]!.unitIds.push(transferred);
    columns[1]!.concealment = 'hidden';
    repo.saveSetup({
      id: campaign.id,
      expectedRevision: 1,
      ...audit,
      settings,
      columns,
      commanders: campaign.commanders,
    });
    const started = repo.start({
      id: campaign.id,
      expectedRevision: 2,
      ...audit,
    });
    expect(started.active?.status).toBe('active');
    expect(started.active?.date).toBe('1745-05-01');
    expect(started.events.map((e) => e.category)).toEqual([
      'created',
      'setup_changed',
      'started',
    ]);
    restart();
    expect(repo.library()).toEqual(started);
    expect(() =>
      repo.saveSetup({
        id: campaign.id,
        expectedRevision: 3,
        ...audit,
        settings,
        columns,
        commanders: campaign.commanders,
      }),
    ).toThrow('Only a configured draft');
    const exported = repo.exportCampaign({
      id: campaign.id,
      expectedRevision: 3,
    });
    expect(exported.formatVersion).toBe(2);
    const destination = new SqliteCampaignRepository(
      path.join(directory, 'started-import.sqlite'),
    );
    try {
      expect(destination.importCampaign(exported).active?.status).toBe(
        'active',
      );
    } finally {
      destination.close();
    }
    const cloned = repo.clone({
      id: campaign.id,
      expectedRevision: 3,
      title: 'New setup',
      ...audit,
    }).active as FontenoyCampaign;
    expect(cloned.status).toBe('draft');
    expect(cloned.turn).toBe(0);
    expect(cloned.date).toBeNull();
    expect(cloned.settings.map.roadEdges[0]!.from).toBe(cloned.squares[0]!.id);
    expect(cloned.settings.siege.targetSquareId).toBe(
      cloned.squares.find((s) => s.locationName === 'Tournai')!.id,
    );
    expect(cloned.settings.objectives[0]!.id).not.toBe(
      settings.objectives[0]!.id,
    );
  });
  it('rolls back a failed migration without leaving a partially-created schema', () => {
    const check = new DatabaseSync(':memory:');
    try {
      check.exec(
        "CREATE TABLE campaigns (sentinel TEXT); INSERT INTO campaigns VALUES ('keep');",
      );
      expect(() => migrate(check)).toThrow();
      expect(
        check
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'schema_migrations'",
          )
          .get(),
      ).toBeUndefined();
      expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(0);
      expect(
        check.prepare('SELECT sentinel FROM campaigns').get()?.sentinel,
      ).toBe('keep');
    } finally {
      check.close();
    }
  });
  it('migrates once and preserves campaign, active selection and journal across repeated restarts', () => {
    const first = create();
    const second = create('Second campaign');
    repo.rename({
      id: first.id,
      expectedRevision: 1,
      title: 'Renamed campaign',
      ...audit,
    });
    repo.open(second.id);
    restart();
    expect(repo.library().active?.id).toBe(second.id);
    repo.open(first.id);
    restart();
    expect(repo.library().active?.title).toBe('Renamed campaign');
    expect(repo.library().events.map((event) => event.category)).toEqual([
      'created',
      'renamed',
    ]);
    const check = new DatabaseSync(database);
    expect(
      check.prepare('SELECT count(*) AS n FROM schema_migrations').get()?.n,
    ).toBe(1);
    check.close();
  });
  it('clones all aggregate IDs and references without altering the source history', () => {
    repo.importCampaign(exportFixture());
    const source = repo.library().active!;
    const copy = repo.clone({
      id: source.id,
      expectedRevision: source.revision,
      title: 'Independent copy',
      ...audit,
    }).active!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.seed).not.toBe(source.seed);
    expect(copy.units[0]!.id).not.toBe(source.units[0]!.id);
    expect(copy.columns[0]!.unitIds).toEqual([copy.units[0]!.id]);
    expect(copy.columns[0]!.commanderIds).toEqual([copy.commanders[0]!.id]);
    expect(copy.columns[0]!.squareId).toBe(copy.squares[0]!.id);
    expect(copy.units[0]!.factionId).toBe(copy.factions[0]!.id);
    expect(campaignSchema.safeParse(copy).success).toBe(true);
    expect(repo.library().events).toHaveLength(1);
    expect(repo.library().events[0]!.sourceCampaignId).toBe(source.id);
    expect(repo.open(source.id).events).toHaveLength(2);
  });
  it('archives without deletion, persists the archive and allows an editable clone', () => {
    const first = create();
    repo.archive({ id: first.id, expectedRevision: 1, ...audit });
    restart();
    expect(repo.library().active?.status).toBe('archived');
    expect(() =>
      repo.rename({
        id: first.id,
        expectedRevision: 2,
        title: 'Illegal rename',
        ...audit,
      }),
    ).toThrow('read-only');
    expect(
      repo.clone({
        id: first.id,
        expectedRevision: 2,
        title: 'Continued copy',
        ...audit,
      }).active?.status,
    ).toBe('draft');
    expect(repo.open(first.id).active?.status).toBe('archived');
  });
  it('rejects stale revisions across connections and preserves the latest committed title', () => {
    const first = create();
    const other = new SqliteCampaignRepository(database);
    try {
      repo.rename({
        id: first.id,
        expectedRevision: 1,
        title: 'Latest title',
        ...audit,
      });
      expect(() =>
        other.rename({
          id: first.id,
          expectedRevision: 1,
          title: 'Stale edit',
          ...audit,
        }),
      ).toThrow('changed');
    } finally {
      other.close();
    }
    expect(repo.library().active?.title).toBe('Latest title');
    expect(repo.library().events).toHaveLength(2);
  });
  it('rolls back campaign, journal and active selection if the event write fails', () => {
    const first = create();
    create('Selected campaign');
    const before = repo.library();
    const check = new DatabaseSync(database);
    check.exec(
      "CREATE TRIGGER fail_event BEFORE INSERT ON campaign_events BEGIN SELECT RAISE(ABORT, 'simulated journal write failure'); END;",
    );
    try {
      expect(() =>
        repo.rename({
          id: first.id,
          expectedRevision: 1,
          title: 'Must roll back',
          ...audit,
        }),
      ).toThrow('simulated');
    } finally {
      check.close();
    }
    restart();
    expect(repo.library()).toEqual(before);
    expect(repo.open(first.id).active?.title).toBe(first.title);
  });
  it('rejects invalid and duplicate imports without changing any existing save', () => {
    create();
    const before = repo.library();
    const bad = exportFixture();
    bad.campaign.columns[0]!.unitIds.push('not-a-uuid');
    expect(() => repo.importCampaign(bad)).toThrow();
    expect(repo.library()).toEqual(before);
    repo.importCampaign(exportFixture());
    const imported = repo.library();
    expect(() => repo.importCampaign(exportFixture())).toThrow(
      'already exists',
    );
    expect(repo.library()).toEqual(imported);
    restart();
    expect(repo.library()).toEqual(imported);
  });
  it('round trips a versioned export and preserves source history plus import audit', () => {
    const source = create();
    const exported = repo.exportCampaign({
      id: source.id,
      expectedRevision: 1,
    });
    const destination = new SqliteCampaignRepository(
      path.join(directory, 'destination.sqlite'),
    );
    try {
      const result = destination.importCampaign(exported);
      expect(result.active?.id).toBe(source.id);
      expect(result.events.map((e) => e.category)).toEqual([
        'created',
        'imported',
      ]);
      expect(result.events[1]!.before).toEqual(source);
    } finally {
      destination.close();
    }
  });
  it('refuses a future database version without replacing its schema or campaigns', () => {
    const otherPath = path.join(directory, 'future.sqlite');
    const check = new DatabaseSync(otherPath);
    check.exec(
      "PRAGMA user_version = 99; CREATE TABLE keep_me (value TEXT); INSERT INTO keep_me VALUES ('preserved');",
    );
    check.close();
    expect(() => new SqliteCampaignRepository(otherPath)).toThrow(
      'unsupported schema',
    );
    const reopened = new DatabaseSync(otherPath);
    expect(reopened.prepare('SELECT value FROM keep_me').get()?.value).toBe(
      'preserved',
    );
    reopened.close();
  });
});
describe('file transfer safety', () => {
  it('exports valid JSON atomically and can replace a previous export', () => {
    const filename = path.join(directory, 'campaign.json');
    writeFileSync(filename, 'previous export');
    writeCampaignFile(filename, exportFixture());
    expect(readCampaignFile(filename).campaign).toEqual(campaignFixture());
    expect(
      readdirSync(directory).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });
  it('cleans a failed temporary export without disturbing the existing destination', () => {
    const filename = path.join(directory, 'blocked.json');
    mkdirSync(filename);
    writeFileSync(path.join(filename, 'keep.txt'), 'keep');
    expect(() => writeCampaignFile(filename, exportFixture())).toThrow();
    expect(readFileSync(path.join(filename, 'keep.txt'), 'utf8')).toBe('keep');
    expect(
      readdirSync(directory).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });
  it('rejects malformed, oversized and unsupported files without changing the repository', () => {
    create();
    const before = repo.library();
    const filename = path.join(directory, 'bad.json');
    writeFileSync(filename, '{truncated');
    expect(() => readCampaignFile(filename)).toThrow('valid JSON');
    writeFileSync(
      filename,
      JSON.stringify({ ...exportFixture(), formatVersion: 50 }),
    );
    expect(() => readCampaignFile(filename)).toThrow();
    writeFileSync(filename, Buffer.alloc(maxCampaignFileBytes + 1));
    expect(() => readCampaignFile(filename)).toThrow('20 MiB');
    expect(repo.library()).toEqual(before);
  });
});
