import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { seedWaterloo, applyWaterlooCommand } from '../../domain/waterloo';
import {
  seedFontenoyOperational,
  cloneFontenoyOperational,
} from '../../domain/fontenoy-operational';
import { cloneCampaignSchema } from '../../shared/campaign-contracts';
import type { CloneCampaignInput } from '../../shared/campaign-contracts';
import type { WaterlooReceipt } from '../../domain/waterloo-schema';
import { waterlooInputSchema } from '../../shared/campaign-contracts';
import type { WaterlooInput } from '../../shared/campaign-contracts';
import {
  campaignSchema,
  campaignEventSchema,
  exportSchema,
  librarySchema,
} from '../../domain/campaign';
import type {
  Campaign,
  CampaignEvent,
  CampaignExport,
  CampaignLibrary,
} from '../../domain/campaign';
import {
  archiveCampaignSchema,
  campaignRefSchema,
  createCampaignSchema,
  renameCampaignSchema,
  revisionRefSchema,
  setupCampaignSchema,
  operationalInputSchema,
  tabletopInputSchema,
  aftermathInputSchema,
} from '../../shared/campaign-contracts';
import type {
  ArchiveCampaignInput,
  CreateCampaignInput,
  RenameCampaignInput,
  RevisionRef,
  SetupCampaignInput,
  OperationalInput,
  TabletopInput,
  AftermathInput,
} from '../../shared/campaign-contracts';
import { seedFontenoy, setupIssues } from '../../domain/fontenoy';
import { migrate } from './migrations';
import { CampaignError } from './errors';
import {
  applyTabletopCommand,
  tabletopCategories,
} from '../../domain/tabletop';
import type { TabletopReceipt } from '../../domain/tabletop-schema';
import {
  applyAftermathCommand,
  aftermathCategories,
} from '../../domain/aftermath';
import type { AftermathReceipt } from '../../domain/aftermath-schema';
import {
  applyOperationalCommand,
  operationalCategories,
} from '../../domain/operations';

export interface CampaignRepository {
  createWaterloo(input: CreateCampaignInput): CampaignLibrary;
  waterloo(input: WaterlooInput): CampaignLibrary;
  aftermath(input: AftermathInput): CampaignLibrary;
  tabletop(input: TabletopInput): CampaignLibrary;
  operate(input: OperationalInput): CampaignLibrary;
  initializeScenario(input: ArchiveCampaignInput): CampaignLibrary;
  saveSetup(input: SetupCampaignInput): CampaignLibrary;
  start(input: ArchiveCampaignInput): CampaignLibrary;
  library(): CampaignLibrary;
  create(input: CreateCampaignInput): CampaignLibrary;
  rename(input: RenameCampaignInput): CampaignLibrary;
  clone(input: CloneCampaignInput): CampaignLibrary;
  archive(input: ArchiveCampaignInput): CampaignLibrary;
  open(id: string): CampaignLibrary;
  importCampaign(input: unknown): CampaignLibrary;
  exportCampaign(input: RevisionRef): CampaignExport;
  close(): void;
}

export class SqliteCampaignRepository implements CampaignRepository {
  private readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      migrate(this.db);
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      const integrity = this.db.prepare('PRAGMA quick_check').get();
      if (integrity?.quick_check !== 'ok')
        throw new CampaignError(
          'storage',
          'Database integrity check failed. Preserve the data directory and restore a known good export.',
        );
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  createWaterloo(input: CreateCampaignInput): CampaignLibrary {
    const request = createCampaignSchema.parse(input);
    return this.transaction(() => {
      this.save(
        null,
        seedWaterloo(request.title, randomUUID, new Date().toISOString()),
        'created',
        request.actor,
        request.reason,
      );
      return this.librarySnapshot();
    });
  }
  waterloo(input: WaterlooInput): CampaignLibrary {
    const request = waterlooInputSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.schemaVersion !== 3)
        throw new CampaignError(
          'validation',
          'Open a simultaneous hex campaign.',
        );
      const stamp = this.next(before);
      const receipt: WaterlooReceipt = {
        command: request.command,
        recordId: randomUUID(),
        timestamp: stamp.updatedAt,
      };
      let changed;
      try {
        changed = applyWaterlooCommand(before, receipt);
      } catch (error) {
        throw new CampaignError(
          'validation',
          error instanceof Error ? error.message : 'Campaign action rejected.',
        );
      }
      const after = campaignSchema.parse({
        ...changed,
        revision: stamp.revision,
        updatedAt: stamp.updatedAt,
      });
      this.save(
        before,
        after,
        before.moduleId === 'fontenoy-operational'
          ? 'simultaneous_action'
          : 'waterloo_action',
        request.actor,
        request.reason,
        null,
        undefined,
        undefined,
        receipt,
      );
      return this.librarySnapshot();
    });
  }
  aftermath(input: AftermathInput): CampaignLibrary {
    const request = aftermathInputSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.schemaVersion !== 2)
        throw new CampaignError('validation', 'Open a configured campaign.');
      const stamp = this.next(before);
      const receipt: AftermathReceipt = {
        command: request.command,
        recordId: randomUUID(),
        timestamp: stamp.updatedAt,
      };
      let changed;
      try {
        changed = applyAftermathCommand(before, receipt);
      } catch (error) {
        throw new CampaignError(
          'validation',
          error instanceof Error ? error.message : 'Campaign action rejected.',
        );
      }
      const after = campaignSchema.parse({
        ...changed,
        revision: stamp.revision,
        updatedAt: stamp.updatedAt,
      });
      this.save(
        before,
        after,
        aftermathCategories[request.command.kind],
        request.actor,
        `Rule: house_rule_v0.1/aftermath-1. ${request.reason}`.slice(0, 500),
        null,
        undefined,
        receipt,
      );
      return this.librarySnapshot();
    });
  }
  tabletop(input: TabletopInput): CampaignLibrary {
    const request = tabletopInputSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.schemaVersion !== 2)
        throw new CampaignError('validation', 'Open a configured campaign.');
      const stamp = this.next(before);
      const receipt: TabletopReceipt = {
        command: request.command,
        recordId: randomUUID(),
        timestamp: stamp.updatedAt,
      };
      let changed;
      try {
        changed = applyTabletopCommand(before, receipt);
      } catch (error) {
        throw new CampaignError(
          'validation',
          error instanceof Error ? error.message : 'Tabletop action rejected.',
        );
      }
      const after = campaignSchema.parse({
        ...changed,
        revision: stamp.revision,
        updatedAt: stamp.updatedAt,
      });
      this.save(
        before,
        after,
        tabletopCategories[request.command.kind],
        request.actor,
        `Rule: house_rule_v0.1/tabletop-1. ${request.reason}`.slice(0, 500),
        null,
        receipt,
      );
      return this.librarySnapshot();
    });
  }
  operate(input: OperationalInput): CampaignLibrary {
    const request = operationalInputSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.schemaVersion !== 2)
        throw new CampaignError(
          'validation',
          'Load and start Fontenoy before issuing orders.',
        );
      let changed;
      try {
        changed = applyOperationalCommand(before, request.command);
      } catch (error) {
        throw new CampaignError(
          'validation',
          error instanceof Error
            ? error.message
            : 'Operational action rejected.',
        );
      }
      const after = campaignSchema.parse(this.next(changed));
      this.save(
        before,
        after,
        operationalCategories[request.command.kind],
        request.actor,
        `Rule: ${changed.operations!.rules.ruleId}; ${changed.operations!.rules.movementPoints} MP, road ${changed.operations!.rules.roadCost}, off-road ${changed.operations!.rules.offRoadCost}, river +${changed.operations!.rules.riverCrossingCost}. ${request.reason}`.slice(
          0,
          500,
        ),
      );
      return this.librarySnapshot();
    });
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private read(id: string): Campaign {
    const row = this.db
      .prepare('SELECT document FROM campaigns WHERE id = ?')
      .get(id);
    if (!row)
      throw new CampaignError(
        'not_found',
        'Campaign no longer exists. Reload the campaign library.',
      );
    return campaignSchema.parse(JSON.parse(String(row.document)) as unknown);
  }
  private current(input: RevisionRef): Campaign {
    const ref = input;
    const campaign = this.read(ref.id);
    if (campaign.revision !== ref.expectedRevision)
      throw new CampaignError(
        'conflict',
        'This campaign changed since you opened it. Reload the library before retrying; your draft has not been saved.',
      );
    return campaign;
  }
  private events(id: string): CampaignEvent[] {
    return this.db
      .prepare(
        'SELECT document FROM campaign_events WHERE campaign_id = ? ORDER BY revision',
      )
      .all(id)
      .map((row) =>
        campaignEventSchema.parse(JSON.parse(String(row.document)) as unknown),
      );
  }
  private activate(id: string) {
    this.db
      .prepare(
        'UPDATE application_state SET active_campaign_id = ? WHERE singleton = 1',
      )
      .run(id);
  }
  library(): CampaignLibrary {
    // A read transaction gives the summary, active snapshot and journal one consistent revision.
    return this.transaction(() => this.librarySnapshot());
  }
  private librarySnapshot(): CampaignLibrary {
    const campaigns = this.db
      .prepare('SELECT document FROM campaigns ORDER BY rowid DESC')
      .all()
      .map((row) =>
        campaignSchema.parse(JSON.parse(String(row.document)) as unknown),
      );
    const id = this.db
      .prepare(
        'SELECT active_campaign_id FROM application_state WHERE singleton = 1',
      )
      .get()?.active_campaign_id;
    const active =
      id === null || id === undefined ? null : this.read(String(id));
    const events = active ? this.events(active.id) : [];
    if (active)
      exportSchema.parse({
        format: 'maurice-campaign',
        formatVersion: 2,
        exportedAt: new Date().toISOString(),
        campaign: active,
        events,
      });
    return librarySchema.parse({
      campaigns: campaigns.map(
        ({ id, title, status, revision, updatedAt }) => ({
          id,
          title,
          status,
          revision,
          updatedAt,
        }),
      ),
      active,
      events,
    });
  }
  private save(
    before: Campaign | null,
    after: Campaign,
    category: CampaignEvent['category'],
    actor: string,
    reason: string,
    sourceCampaignId: string | null = null,
    tabletopAction?: TabletopReceipt,
    aftermathAction?: AftermathReceipt,
    waterlooAction?: WaterlooReceipt,
  ) {
    campaignSchema.parse(after);
    const event = campaignEventSchema.parse({
      id: randomUUID(),
      campaignId: after.id,
      category,
      actor,
      reason,
      timestamp: after.updatedAt,
      rulesetVersion: after.rulesetVersion,
      sourceCampaignId,
      before,
      after,
      ...(tabletopAction ? { tabletopAction } : {}),
      ...(aftermathAction ? { aftermathAction } : {}),
      ...(waterlooAction ? { waterlooAction } : {}),
    });
    if (before) {
      const result = this.db
        .prepare(
          'UPDATE campaigns SET revision = ?, document = ? WHERE id = ? AND revision = ?',
        )
        .run(after.revision, JSON.stringify(after), after.id, before.revision);
      if (Number(result.changes) !== 1)
        throw new CampaignError(
          'conflict',
          'Campaign revision changed. Reload before retrying.',
        );
    } else
      this.db
        .prepare(
          'INSERT INTO campaigns (id, revision, document) VALUES (?, ?, ?)',
        )
        .run(after.id, after.revision, JSON.stringify(after));
    this.insertEvent(event);
    this.activate(after.id);
  }
  private insertEvent(event: CampaignEvent) {
    this.db
      .prepare(
        'INSERT INTO campaign_events (id, campaign_id, revision, document) VALUES (?, ?, ?, ?)',
      )
      .run(
        event.id,
        event.campaignId,
        event.after.revision,
        JSON.stringify(event),
      );
  }
  private next<T extends Campaign>(campaign: T): T {
    return {
      ...campaign,
      revision: campaign.revision + 1,
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(campaign.updatedAt)),
      ).toISOString(),
    };
  }
  create(input: CreateCampaignInput): CampaignLibrary {
    const request = createCampaignSchema.parse(input);
    return this.transaction(() => {
      const now = new Date().toISOString();
      if (request.profile === 'simultaneous_fontenoy') {
        this.save(
          null,
          seedFontenoyOperational(request.title, randomUUID, now),
          'created',
          request.actor,
          request.reason,
        );
        return this.librarySnapshot();
      }
      const campaign: Campaign = {
        id: randomUUID(),
        schemaVersion: 1,
        moduleId: 'fontenoy',
        moduleVersion: 'unconfigured',
        rulesetVersion: 'unconfigured',
        title: request.title,
        status: 'draft',
        revision: 1,
        turn: 0,
        date: null,
        activeSide: null,
        settings: {},
        seed: randomUUID(),
        createdAt: now,
        updatedAt: now,
        factions: [],
        units: [],
        commanders: [],
        columns: [],
        squares: [],
      };
      this.save(
        null,
        seedFontenoy(campaign, randomUUID),
        'created',
        request.actor,
        request.reason,
      );
      return this.librarySnapshot();
    });
  }
  rename(input: RenameCampaignInput): CampaignLibrary {
    const request = renameCampaignSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.status === 'archived')
        throw new CampaignError(
          'validation',
          'Archived campaigns are read-only. Clone the campaign to continue editing.',
        );
      if (before.title === request.title)
        throw new CampaignError(
          'validation',
          'Enter a different title or discard the draft.',
        );
      this.save(
        before,
        { ...this.next(before), title: request.title },
        'renamed',
        request.actor,
        request.reason,
      );
      return this.librarySnapshot();
    });
  }
  clone(input: CloneCampaignInput): CampaignLibrary {
    const request = cloneCampaignSchema.parse(input);
    return this.transaction(() => {
      const source = this.current(request);
      if (request.profile === 'simultaneous_fontenoy') {
        if (source.schemaVersion !== 2)
          throw new CampaignError(
            'validation',
            'Open a saved Fontenoy setup to make its simultaneous operational copy.',
          );
        let after;
        try {
          after = seedFontenoyOperational(
            request.title,
            randomUUID,
            new Date().toISOString(),
            source,
          );
        } catch (error) {
          throw new CampaignError(
            'validation',
            error instanceof Error
              ? error.message
              : 'Review the Fontenoy setup.',
          );
        }
        this.save(
          null,
          after,
          'cloned',
          request.actor,
          request.reason,
          source.id,
        );
        return this.librarySnapshot();
      }
      if (source.schemaVersion === 3) {
        const after = source.fontenoy
          ? cloneFontenoyOperational(
              source,
              request.title,
              randomUUID,
              new Date().toISOString(),
            )
          : seedWaterloo(request.title, randomUUID, new Date().toISOString());
        this.save(
          null,
          after,
          'cloned',
          request.actor,
          request.reason,
          source.id,
        );
        return this.librarySnapshot();
      }
      const ids = new Map<string, string>();
      for (const records of [
        source.factions,
        source.units,
        source.commanders,
        source.columns,
        source.squares,
      ])
        for (const item of records) ids.set(item.id, randomUUID());
      const remap = (id: string) => {
        const replacement = ids.get(id);
        if (!replacement)
          throw new CampaignError(
            'validation',
            'Cannot clone a campaign with broken references.',
          );
        return replacement;
      };
      const now = new Date().toISOString();
      const afterData = {
        ...source,
        ...(source.schemaVersion === 2 && source.aftermath
          ? { aftermath: undefined }
          : {}),
        ...(source.schemaVersion === 2 && source.tabletop
          ? { tabletop: undefined }
          : {}),
        ...(source.schemaVersion === 2 && source.operations
          ? { operations: undefined }
          : {}),
        id: randomUUID(),
        title: request.title,
        status: 'draft',
        turn: 0,
        date: null,
        activeSide: null,
        revision: 1,
        seed: randomUUID(),
        createdAt: now,
        updatedAt: now,
        factions: source.factions.map((f) => ({ ...f, id: remap(f.id) })),
        units: source.units.map((u) => {
          const copy = {
            ...u,
            id: remap(u.id),
            factionId: remap(u.factionId),
            currentStatus: 'ready' as const,
          };
          if ('initialQuality' in copy) {
            if (
              copy.initialQuality === 'elite' ||
              copy.initialQuality === 'trained'
            )
              copy.quality = copy.initialQuality;
            delete copy.initialQuality;
          }
          return copy;
        }),
        commanders: source.commanders.map((c) => ({
          ...c,
          ...('campaignStatus' in c
            ? { campaignStatus: 'active' as const }
            : {}),
          id: remap(c.id),
          factionId: remap(c.factionId),
        })),
        squares: source.squares.map((s) => ({ ...s, id: remap(s.id) })),
        columns: source.columns.map((c) => ({
          ...c,
          id: remap(c.id),
          factionId: remap(c.factionId),
          squareId: c.squareId === null ? null : remap(c.squareId),
          unitIds: c.unitIds.map(remap),
          commanderIds: c.commanderIds.map(remap),
        })),
      };
      if (source.schemaVersion === 2) {
        afterData.settings = {
          ...source.settings,
          map: {
            ...source.settings.map,
            roadEdges: source.settings.map.roadEdges.map((e) => ({
              ...e,
              from: remap(e.from),
              to: remap(e.to),
            })),
            riverEdges: source.settings.map.riverEdges.map((e) => ({
              ...e,
              from: remap(e.from),
              to: remap(e.to),
            })),
          },
          siege: {
            ...source.settings.siege,
            targetSquareId: remap(source.settings.siege.targetSquareId),
          },
          objectives: source.settings.objectives.map((o) => ({
            ...o,
            id: randomUUID(),
            squareId: remap(o.squareId),
          })),
        };
      }
      const after = campaignSchema.parse(afterData);
      this.save(
        null,
        after,
        'cloned',
        request.actor,
        request.reason,
        source.id,
      );
      return this.librarySnapshot();
    });
  }
  archive(input: ArchiveCampaignInput): CampaignLibrary {
    const request = archiveCampaignSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.status === 'archived')
        throw new CampaignError(
          'validation',
          'This campaign is already archived.',
        );
      this.save(
        before,
        { ...this.next(before), status: 'archived' },
        'archived',
        request.actor,
        request.reason,
      );
      return this.librarySnapshot();
    });
  }
  open(id: string): CampaignLibrary {
    campaignRefSchema.parse({ id });
    return this.transaction(() => {
      this.read(id);
      this.activate(id);
      return this.librarySnapshot();
    });
  }
  exportCampaign(input: RevisionRef): CampaignExport {
    const request = revisionRefSchema.parse(input);
    return this.transaction(() => {
      const campaign = this.current(request);
      return exportSchema.parse({
        format: 'maurice-campaign',
        formatVersion: 2,
        exportedAt: new Date().toISOString(),
        campaign,
        events: this.events(campaign.id),
      });
    });
  }
  importCampaign(input: unknown): CampaignLibrary {
    const parsed = exportSchema.safeParse(input);
    if (!parsed.success) throw parsed.error;
    const data = parsed.data;
    return this.transaction(() => {
      if (
        this.db
          .prepare('SELECT id FROM campaigns WHERE id = ?')
          .get(data.campaign.id)
      )
        throw new CampaignError(
          'conflict',
          'A campaign with this ID already exists. Import was cancelled without overwriting it. Open or clone the existing campaign instead.',
        );
      for (const event of data.events)
        if (
          this.db
            .prepare('SELECT id FROM campaign_events WHERE id = ?')
            .get(event.id)
        )
          throw new CampaignError(
            'conflict',
            'An imported journal event ID already exists. No data was changed.',
          );
      this.db
        .prepare(
          'INSERT INTO campaigns (id, revision, document) VALUES (?, ?, ?)',
        )
        .run(
          data.campaign.id,
          data.campaign.revision,
          JSON.stringify(data.campaign),
        );
      for (const event of data.events) this.insertEvent(event);
      this.save(
        data.campaign,
        this.next(data.campaign),
        'imported',
        'Local player',
        'Imported a validated campaign JSON file.',
      );
      return this.librarySnapshot();
    });
  }
  initializeScenario(input: ArchiveCampaignInput): CampaignLibrary {
    const request = archiveCampaignSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.status !== 'draft' || before.schemaVersion !== 1)
        throw new CampaignError(
          'validation',
          'Only an unconfigured draft can load the Fontenoy module.',
        );
      if (
        [
          before.factions,
          before.units,
          before.columns,
          before.commanders,
          before.squares,
        ].some((records) => records.length)
      )
        throw new CampaignError(
          'validation',
          'This legacy draft contains custom entities. They will not be overwritten. Export and preserve the record; create a new Fontenoy campaign instead.',
        );
      this.save(
        before,
        seedFontenoy(this.next(before), randomUUID),
        'scenario_loaded',
        request.actor,
        request.reason,
      );
      return this.librarySnapshot();
    });
  }
  saveSetup(input: SetupCampaignInput): CampaignLibrary {
    const request = setupCampaignSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.schemaVersion !== 2 || before.status !== 'draft')
        throw new CampaignError(
          'validation',
          'Only a configured draft can change its setup. Clone a started campaign to prepare a new setup.',
        );
      const after = campaignSchema.parse({
        ...this.next(before),
        settings: request.settings,
        columns: request.columns,
        commanders: request.commanders,
      });
      this.save(before, after, 'setup_changed', request.actor, request.reason);
      return this.librarySnapshot();
    });
  }
  start(input: ArchiveCampaignInput): CampaignLibrary {
    const request = archiveCampaignSchema.parse(input);
    return this.transaction(() => {
      const before = this.current(request);
      if (before.schemaVersion !== 2 || before.status !== 'draft')
        throw new CampaignError(
          'validation',
          'Open a configured draft to start the campaign.',
        );
      const issues = setupIssues(before);
      if (issues.length)
        throw new CampaignError(
          'validation',
          `Setup needs review: ${issues.slice(0, 5).join(' ')}`.slice(0, 1900),
        );
      this.save(
        before,
        {
          ...this.next(before),
          status: 'active',
          turn: 1,
          date: before.settings.schedule.startDate,
          activeSide: before.settings.schedule.firstSide,
        },
        'started',
        request.actor,
        request.reason,
      );
      return this.librarySnapshot();
    });
  }
}
