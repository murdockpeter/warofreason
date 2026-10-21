# Architecture

Milestones A–C establish an offline desktop shell, persistent campaign library and reviewed Fontenoy module setup. Operational play remains Milestone D and beyond.

## Boundaries

- `src/main`: Electron lifecycle, trusted-window IPC checks, native dialogs, local logging and the persistence repository. Owns all file and database access.
- `src/preload`: bundled CommonJS sandbox-compatible context bridge. Exposes named methods only; never exposes ipcRenderer, Node or paths.
- `src/shared`: Zod request/response contracts and DTOs used across the process boundary.
- `src/domain`: framework-independent vocabulary, versioned aggregates, module/schema validation, pure setup editing commands and portable journal validation. No tactical engine or operational resolution.
- `src/renderer`: React screens, accessible components and Zustand session/draft state. Components invoke store commands; domain validation and storage operations stay outside React. Imports no Node or Electron modules.
- `src/data`: versioned Fontenoy JSON: sourced numeric force facts, original schematic locations and explicitly provisional operational defaults. No private source material is shipped.

Vite bundles the renderer; esbuild bundles main and preload. TypeScript checks each boundary separately. Production uses local files and in-memory navigation state. The production CSP denies network connections; permissions, popups and document navigation are denied. Development permits the loopback Vite origin and its hot-reload socket; only development permits Vite's inline refresh preamble and injected style elements. Production uses bundled external stylesheets with `style-src 'self'`. Main validates both IPC sender and payload; preload validates returned DTOs.

## Persistence boundary

`CampaignRepository` is implemented by `SqliteCampaignRepository` using bundled `node:sqlite` in Electron main. Electron 45.0.0 (Node 24.22.0) and local Node 24.7.0 were directly checked for SQLite availability; built and packaged application tests also exercise it. This deliberately replaces the plan's proposed `better-sqlite3` driver, avoiding a separate ABI/native rebuild dependency while retaining SQLite and the repository boundary. Node 24.7 reports its SQLite API as experimental; runtime upgrades must rerun persistence and packaging checks.

Migration 001 is transactional and recorded both in `schema_migrations` and SQLite `user_version`. Unknown newer versions fail safely. Tables store validated campaign aggregate JSON, per-revision event snapshots, and a foreign-key-protected last-active campaign pointer. Aggregate references are validated in Zod; SQLite foreign keys protect the journal and active pointer. WAL mode, full synchronization and immediate write transactions keep a committed action, its journal event and active selection atomic. Revision preconditions reject stale edits. All queries use bound parameters.

New campaigns now start configured Fontenoy drafts with 38 scenario-scale units. Legacy B drafts stay unconfigured until an explicit module-loading command. Rename, clone and archive commit immediately; opening updates last-active selection. Archive preserves a read-only record. Clone creates fresh campaign/entity/objective IDs and a fresh seed, remaps references (including siege targets and map edges), resets started lifecycle metadata, and starts a new journal with a source-campaign reference. The source history remains unchanged. Import retains validated source history and adds a local import event.

Normal data lives in `app.getPath('userData')/campaigns.sqlite` (Windows: `%APPDATA%/maurice-campaign-companion`). A single instance owns each profile. `--user-data-dir` explicitly selects a separate profile, used by tests so they never touch player saves. Startup validates the recovered aggregate and journal; an invalid database is preserved and reported, never silently replaced.

## Transfer and edit semantics

Format v2 exports contain one campaign plus its complete journal, not a faction-filtered view. Legacy format v1 imports remain supported. Aggregate schema v1 lives in `legacy-campaign.ts`; schema v2 adds configured module/settings, contingent provenance, concealment and a started opening state. Mixed-version journal snapshots are validated without rewriting historical payloads. SQLite table layout 001 remains unchanged because the aggregate documents are explicitly versioned; unsupported document versions are rejected.

## Fontenoy setup boundary

The module template is validated JSON. Fact provenance and provisional defaults are documented in `CAMPAIGN_SPEC_FONTENOY.md`. The seed factory accepts an injected UUID generator, and pure setup commands preserve source units while changing assignments/settings. Square IDs are independent of coordinates; scale/edge edits do not regenerate geography or forces.

Named IPC methods load the module into an empty legacy draft, save settings/columns/commanders, and start a reviewed campaign. The renderer cannot submit replacement unit or square arrays through setup IPC. Main revalidates exact force composition, all references and revision preconditions. Module loading refuses legacy custom entities rather than replacing them. Each command and its new event commit atomically.

Setup edits remain undoable (50 steps) until saved. The saved snapshot may have unassigned units during preparation; Start requires complete unique assignments, nonempty positioned columns, valid schedule and explicit house-rule/map acknowledgements. Start defaults to Cancel in a native dialog and records the chosen opening state only. Started/archived setup is read-only; movement, fog-of-war enforcement, siege progression and victory evaluation remain deferred.

Import reads a bounded regular file (20 MiB maximum), validates format/module/schema versions, IDs, references and journal continuity before starting the transaction. Duplicate campaign/event IDs are rejected. Export writes a flushed temporary file in the destination directory, then renames it over the destination; failures leave the previous destination intact. File paths are selected by native main-process dialogs and never accepted from renderer payloads. A crash before publication may leave a uniquely named temporary file, but never a partial published export.

Uncommitted form edits live only in renderer memory, with up to 100 title-edit or 50 setup-edit undo steps. Switching screens retains them; switching campaigns or replacing an editor requires explicit discard confirmation. Closing with edits prompts the user. Save commits once; failed saves preserve the draft. Committed actions cannot be undone by rewriting history. The status strip distinguishes pending/uncommitted edits from saved state.

## Validation

Vitest covers domain/IPC validation, React editor behavior, migrations, transaction rollback, stale revisions, import validation and atomic file transfer. Playwright launches built and packaged Electron apps to verify isolation, styling, navigation, real SQLite lifecycle, repeated restarts, abrupt-exit recovery, native dialog flows and rejected imports. Profiles are temporary and removed only after checking their resolved path belongs to the test prefix. CI runs static checks, tests, build, Windows packaging and smoke checks.
