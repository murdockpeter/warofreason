# Maurice Campaign Companion

An offline Electron desktop companion for tabletop Maurice campaigns. **Milestones A–C** provide the secure desktop shell, persistent campaign library and reviewed Fontenoy setup. Operational movement and tabletop workflows remain future work.

## Run locally (Windows 11)

Install Node.js 24.7 or newer, then run:

```powershell
npm ci
npm run dev
```

Dependency installation initially needs internet access. Once installed, development and packaged execution require no external service. Vite binds only to `127.0.0.1:5173`. Renderer edits reload automatically; restart development after main/preload changes.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run package
npm run test:e2e
npm run test:dev
```

`package` creates `release/win-unpacked/Maurice Campaign Companion.exe` and supporting files (keep the folder together). `package:installer` creates an unsigned Windows NSIS installer. Windows may show unsigned/SmartScreen warnings for development builds. Packaging may download Electron/builder tooling on first use. No certificate or publishing is configured.

`test:e2e` needs both build and package output and launches real Electron windows, including the packaged executable. It verifies SQLite saves/restarts/imports using isolated temporary profiles. `test:dev` checks development with external requests blocked; locally it reuses an existing loopback Vite server if one is running, while CI starts a fresh server. `format:check` verifies Prettier; `format` applies it. CI repeats validation on Windows. Local Node 24.7 may print an experimental SQLite warning; Electron 45's bundled SQLite is checked by the packaged tests.

## Available screens

Dashboard, Campaign Map, Armies/Columns, Turn Orders, Battle Log, Siege & Victory and Settings. The dashboard manages campaigns, Armies/Columns provides setup review, and Campaign Map displays an original 12 × 8 schematic. Orders, battle workflows, siege progression and victory evaluation remain deferred.

## Try Fontenoy setup (Milestone C)

1. Stop the previous development run and restart `npm run dev` after updating; the main/preload API has changed.
2. Open your existing **Fontenoy** draft. Choose **Load Fontenoy setup**, then confirm the load with the button on Armies/Columns. Existing IDs/history are retained; custom legacy entities are never overwritten. New campaigns load the module automatically.
3. Choose **Edit setup**. Review **French 20 / Allied 18**, with **Dutch 7 / Anglo-Allied 11**. Move a unit between friendly columns, change opening squares, mark columns hidden, or add/remove columns and commanders. Unit contingent identity stays with the unit.
4. Review the provisional opening date, first faction, days/turn, number of turns and initial siege status/progress. Map scale starts unspecified; player-added roads are explicitly provisional and do not enable movement.
5. Check both acknowledgements, then **Save setup**. All units must be assigned once to nonempty positioned friendly columns before **Start Campaign** becomes available. No official column capacity or movement rule is assumed.
6. Choose **Start Campaign** and confirm. The status strip shows turn 1 and the chosen opening date/faction. Close/reopen or export/import to verify the setup survives.

The map/rosters are a full **umpire/setup view**, including columns marked hidden. Player-specific fog of war is Milestone D. The map has eight approximate labels and no default roads/rivers; it is not verified 1745 geography. After starting, setup is read-only; clone the campaign to prepare a different draft.

See [the sourced Fontenoy specification](docs/CAMPAIGN_SPEC_FONTENOY.md) for published scenario facts versus provisional house rules. No tactical rules, card effects, movement, scouting, siege advancement or automatic victory are implemented.

## Try campaign management

1. On Dashboard, choose **New campaign**, enter a title, review the actor/reason, then **Create and save**. This creates a configured Fontenoy draft with 38 scenario-scale units and editable provisional columns.
2. Choose **Rename campaign**. Edit the title, try **Undo last edit**, then **Save changes**. Only committed edits are saved; draft edits survive screen navigation and require confirmation to discard.
3. Close and reopen the app. The last open campaign and its journal return automatically.
4. **Clone campaign** makes an independent copy; **Archive campaign** confirms and preserves a read-only record. Archived records remain visible and can be exported or cloned.
5. **Export saved JSON** writes the saved campaign and complete journal. **Import JSON** validates the format and references before saving. Importing the same campaign ID into the same library is rejected without overwriting it.

For a successful import test, start a separate, empty profile after stopping the current development run:

```powershell
npm run dev -- --user-data-dir="$env:TEMP\maurice-manual-profile"
```

Import your export there, then restart with the same argument to verify recovery. Omit the argument to return to your usual library. Do not delete a profile containing campaigns you want to keep.

Expand entries in **Campaign journal** to inspect actor, reason, timestamp and before/after state, including module loading, setup changes and campaign start. Unsaved title edits support up to 100 undo steps; setup supports up to 50. Committed history is preserved. Export excludes unsaved edits. Settings' **Reset session notice** clears only a diagnostic notice, not campaign data.

## Local data

SQLite storage is in `%APPDATA%\maurice-campaign-companion\campaigns.sqlite` on Windows (or the explicitly selected profile). No account, server or native module compilation is required. Committed changes save automatically in transactions. Prefer JSON exports for portable copies; if backing up the database files directly, close the app first and preserve the entire profile. Never replace an open database or discard its WAL file.

An unreadable or unsupported database is reported and preserved, not reset. Invalid JSON, unsupported versions, bad references and duplicate campaign IDs are rejected with actionable errors. Exports use format v2; legacy v1 drafts/imports and historical journal snapshots remain supported. Arbitrary third-party or future scenario formats are not guessed or silently coerced.

## Architecture and rules boundary

See [architecture](docs/ARCHITECTURE.md), [running checklist](docs/TASK_CHECKLIST.md), [design decisions](docs/DESIGN_DECISIONS.md) and the [full coding plan](docs/MAURICE_CAMPAIGN_CODING_PLAN.md).

The sandboxed renderer has no Node access. Named, Zod-validated IPC methods expose campaign commands, app metadata, confirmation and bounded diagnostics. Main owns SQLite, file dialogs and atomic JSON transfers; renderer payloads cannot supply filesystem paths. Main owns local diagnostic logs in Electron's OS-specific application logs directory (`app.getPath('logs')`); there is no remote telemetry. Do not put private card text in error messages.

Maurice tactical play stays at the table. Published Fontenoy unit counts/type/quality are cited as scenario facts. The operational setup, dates, concealment, siege settings and goals are **provisional house rules**, not official Maurice mechanics. No tactical or operational resolution is automated. No copyrighted rules prose, card art or private reference PDFs are shipped. Keep private research in ignored `reference/` or `contextonly/`; packaging includes only built application files and license metadata.

All rights reserved pending an explicit license choice by the owner; see LICENSE.
