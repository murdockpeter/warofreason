import type { DatabaseSync } from 'node:sqlite';
import { CampaignError } from './errors';

export const migration001 = `
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK(revision > 0),
  document TEXT NOT NULL CHECK(json_valid(document))
) STRICT;
CREATE TABLE campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  revision INTEGER NOT NULL CHECK(revision > 0),
  document TEXT NOT NULL CHECK(json_valid(document)),
  UNIQUE(campaign_id, revision)
) STRICT;
CREATE TABLE application_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  active_campaign_id TEXT REFERENCES campaigns(id)
) STRICT;
INSERT INTO application_state VALUES (1, NULL);
INSERT INTO schema_migrations VALUES (1, '001_initial', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
PRAGMA user_version = 1;
`;
export function migrate(db: DatabaseSync) {
  const current = db.prepare('PRAGMA user_version').get()?.user_version;
  if (current === 1) return;
  if (current !== 0)
    throw new CampaignError(
      'storage',
      'This database uses a newer or unsupported schema. Open it with a compatible application; do not replace the database.',
    );
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(migration001);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
