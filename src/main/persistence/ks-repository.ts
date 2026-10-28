import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  applyKsCommand,
  ksCampaignSchema,
  ksEventSchema,
  ksExportSchema,
  ksLibrarySchema,
  seedKs,
} from '../../domain/crimean-ks';
import type { KsEvent, KsExport, KsLibrary } from '../../domain/crimean-ks';
import {
  ksCreateSchema,
  ksActionSchema,
  ksRefSchema,
  ksRevisionSchema,
} from '../../shared/ks-contracts';
import type { z } from 'zod';
import { CampaignError } from './errors';

/** A separate database and journal: no Maurice state or movement strategy is reused. */
export class KsRepository {
  private db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    try {
      this.db.exec(
        'PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;',
      );
      const version = this.db
        .prepare('PRAGMA user_version')
        .get()?.user_version;
      if (version !== 0 && version !== 1)
        throw new Error(
          'Unsupported Free KS storage version. Preserve the database and use a compatible app.',
        );
      if (version === 0)
        this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE ks_campaigns(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL CHECK(json_valid(document))) STRICT;
        CREATE TABLE ks_events(id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES ks_campaigns(id), revision INTEGER NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)), UNIQUE(campaign_id,revision)) STRICT;
        CREATE TABLE ks_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1), active_id TEXT REFERENCES ks_campaigns(id)) STRICT;
        INSERT INTO ks_state VALUES(1,NULL); PRAGMA user_version=1; COMMIT;`);
      if (this.db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok')
        throw new Error('Free KS database integrity check failed.');
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private read(id: string) {
    const row = this.db
      .prepare('SELECT document FROM ks_campaigns WHERE id=?')
      .get(id);
    if (!row)
      throw new CampaignError(
        'not_found',
        'Open an existing Free KS campaign.',
      );
    return ksCampaignSchema.parse(JSON.parse(String(row.document)));
  }
  private events(id: string) {
    return this.db
      .prepare(
        'SELECT document FROM ks_events WHERE campaign_id=? ORDER BY revision',
      )
      .all(id)
      .map((row) => ksEventSchema.parse(JSON.parse(String(row.document))));
  }
  private activate(id: string) {
    this.db
      .prepare('UPDATE ks_state SET active_id=? WHERE singleton=1')
      .run(id);
  }
  private snapshot(): KsLibrary {
    const id = this.db
      .prepare('SELECT active_id FROM ks_state WHERE singleton=1')
      .get()?.active_id;
    const active = id ? this.read(String(id)) : null,
      events = active ? this.events(active.id) : [];
    if (active)
      ksExportSchema.parse({
        format: 'war-of-reason-free-ks',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        campaign: active,
        events,
      });
    return ksLibrarySchema.parse({
      active,
      events,
      campaigns: this.db
        .prepare('SELECT document FROM ks_campaigns ORDER BY rowid DESC')
        .all()
        .map((row) => {
          return ksLibrarySchema.shape.campaigns.element
            .strip()
            .parse(ksCampaignSchema.parse(JSON.parse(String(row.document))));
        }),
    });
  }
  library() {
    return this.transaction(() => this.snapshot());
  }
  create(raw: z.infer<typeof ksCreateSchema>) {
    const input = ksCreateSchema.parse(raw);
    return this.transaction(() => {
      const campaign = seedKs(
        input.title,
        randomUUID(),
        new Date().toISOString(),
      );
      this.db
        .prepare('INSERT INTO ks_campaigns VALUES(?,?,?)')
        .run(campaign.id, campaign.revision, JSON.stringify(campaign));
      this.insert({
        id: randomUUID(),
        campaignId: campaign.id,
        timestamp: campaign.updatedAt,
        actor: input.actor,
        reason: input.reason,
        category: 'created',
        command: null,
        before: null,
        after: campaign,
      });
      this.activate(campaign.id);
      return this.snapshot();
    });
  }
  open(raw: z.infer<typeof ksRefSchema>) {
    const input = ksRefSchema.parse(raw);
    return this.transaction(() => {
      this.read(input.id);
      this.activate(input.id);
      return this.snapshot();
    });
  }
  private insert(event: KsEvent) {
    ksEventSchema.parse(event);
    this.db
      .prepare('INSERT INTO ks_events VALUES(?,?,?,?)')
      .run(
        event.id,
        event.campaignId,
        event.after.revision,
        JSON.stringify(event),
      );
  }
  private current(input: z.infer<typeof ksRevisionSchema>) {
    const before = this.read(input.id);
    if (before.revision !== input.expectedRevision)
      throw new CampaignError(
        'conflict',
        'This Free KS campaign changed. Reload before recording the ruling.',
      );
    return before;
  }
  act(raw: z.infer<typeof ksActionSchema>) {
    const input = ksActionSchema.parse(raw);
    return this.transaction(() => {
      const before = this.current(input),
        timestamp = new Date(
          Math.max(Date.now(), Date.parse(before.updatedAt)),
        ).toISOString();
      const after = applyKsCommand(before, input.command, timestamp);
      this.db
        .prepare(
          'UPDATE ks_campaigns SET revision=?,document=? WHERE id=? AND revision=?',
        )
        .run(after.revision, JSON.stringify(after), after.id, before.revision);
      this.insert({
        id: randomUUID(),
        campaignId: after.id,
        timestamp,
        actor: input.actor,
        reason: input.reason,
        category: 'ruling',
        command: input.command,
        before,
        after,
      });
      this.activate(after.id);
      return this.snapshot();
    });
  }
  export(raw: z.infer<typeof ksRevisionSchema>): KsExport {
    const input = ksRevisionSchema.parse(raw);
    return this.transaction(() =>
      ksExportSchema.parse({
        format: 'war-of-reason-free-ks',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        campaign: this.current(input),
        events: this.events(input.id),
      }),
    );
  }
  import(raw: unknown) {
    const portable = ksExportSchema.parse(raw);
    return this.transaction(() => {
      if (
        this.db
          .prepare('SELECT id FROM ks_campaigns WHERE id=?')
          .get(portable.campaign.id) ||
        portable.events.some((e) =>
          this.db.prepare('SELECT id FROM ks_events WHERE id=?').get(e.id),
        )
      )
        throw new CampaignError(
          'conflict',
          'This campaign or its journal is already present. No existing Free KS save was replaced.',
        );
      const c = portable.campaign;
      this.db
        .prepare('INSERT INTO ks_campaigns VALUES(?,?,?)')
        .run(c.id, c.revision, JSON.stringify(c));
      for (const event of portable.events) this.insert(event);
      this.activate(c.id);
      return this.snapshot();
    });
  }
}
