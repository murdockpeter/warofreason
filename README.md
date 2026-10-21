# Maurice Campaign Companion

An offline Electron desktop companion for tabletop Maurice campaigns. **Milestones A–F** provide the secure desktop shell, persistent campaigns, reviewed Fontenoy setup, operational orders, scouting, printable battle briefs, confirmed manual results and explicit campaign aftermath, recovery, siege and victory. Milestone G covers campaign summaries, further printing and playtesting; interface simplification follows.

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

Started campaigns now reopen directly on the map. **Right-click a formation** for movement, hold, split, inspection and scouting actions. The **Split formation** modal has two panes for transferring units and commanders. Route controls stay above the map; setup, rule configuration and detailed records are collapsed or accessible through **Campaign menu**. See [the map play guide](docs/MAP_PLAY.md).

Use **ⓘ Help** at the bottom right (or **F1**) for the offline player manual and guidance on what to do next. **Inspect formation** now opens an intelligence modal with composition, readiness, commanders and roster; unknown enemy details stay withheld, and scouting information is labelled with its observation/expiry turn. Selecting a formation also exposes a direct **ⓘ Inspect** button above the map.

Dashboard, Campaign Map, Armies/Columns, Turn Orders, Battle Log, Siege & Victory and Settings. The dashboard manages campaigns, Armies/Columns provides setup review, and Campaign Map provides selectable squares/columns, zoom/pan and route previews on the original 12 × 8 schematic. Turn Orders reviews and issues planned orders before confirmed resolution.

The existing walkthroughs below use screen names found in **Campaign menu**. Open **Map options & campaign setup** for faction views, and **Orders** for the detailed issue/reopen/resolve controls.

## Try Fontenoy setup (Milestone C)

1. Stop the previous development run and restart `npm run dev` after updating; the main/preload API has changed.
2. Open your existing **Fontenoy** draft. Choose **Load Fontenoy setup**, then confirm the load with the button on Armies/Columns. Existing IDs/history are retained; custom legacy entities are never overwritten. New campaigns load the module automatically.
3. Choose **Edit setup**. Review **French 20 / Allied 18**, with **Dutch 7 / Anglo-Allied 11**. Move a unit between friendly columns, change opening squares, mark columns hidden, or add/remove columns and commanders. Unit contingent identity stays with the unit.
4. Review the provisional opening date, first faction, days/turn, number of turns and initial siege status/progress. Map scale starts unspecified. Add proposed roads or river crossings between adjacent squares if desired; the artwork does not supply movement edges.
5. Check both acknowledgements, then **Save setup**. All units must be assigned once to nonempty positioned friendly columns before **Start Campaign** becomes available. No official column capacity or movement rule is assumed.
6. Choose **Start Campaign** and confirm. The status strip shows turn 1 and the chosen opening date/faction. Close/reopen or export/import to verify the setup survives.

Setup is a full **umpire view**, including columns marked hidden. Campaign Map and Turn Orders also provide French/Allied views that hide concealed opponents and mask opposing composition. Shared management screens require switching back to umpire view. The map has eight approximate labels and no default roads/rivers; it is not verified 1745 geography. After starting, setup is read-only; clone the campaign to prepare a different draft.

See [the sourced Fontenoy specification](docs/CAMPAIGN_SPEC_FONTENOY.md) for published scenario facts versus provisional house rules. Tactical combat and card effects remain at the table. Siege and victory require explicit enablement and confirmed turn-end processing.

## Try operational play (Milestone D)

1. Restart `npm run dev` to load the updated main/preload API, or launch the rebuilt executable in `release/win-unpacked`.
2. Start a reviewed campaign. On **Campaign Map**, use umpire view and choose **Enable operational play**. Existing started campaigns require this explicit action; their saves and journal are retained.
3. The initial house rule grants 3 movement points per faction phase: configured road step 1, off-road step 2, river crossing +1. Expand **Movement house rules and roadblocks** to adjust these or select blocked squares before issuing orders. No official Maurice movement rule is asserted.
4. Select an active-side column, then adjacent squares to preview a route. Click **Add order**. Use **Undo route step**, **Undo order edit**, or **Remove order** to revise it. Navigation retains added orders; unsaved orders require confirmation to discard. Empty orders mean hold position.
5. On **Turn Orders**, choose **Issue orders**. This saves the order list without moving anything. Issued orders survive restart. **Return to planning** permits changes while preserving the issued version in the journal.
6. **Resolve orders** opens a default-Cancel confirmation. Confirmation commits movement and passes to the other faction on the same day. After the second faction resolves, the turn and date advance using the configured schedule. The final second-faction resolution ends the configured window, without declaring a winner.
7. Enemy occupancy cannot be crossed. Attempting to enter its square stops the column in the preceding square and records deterministic engagement candidates. Use Battle Log to declare and play the battle; no combat is automatically resolved. Participants remain held pending post-battle campaign review in F.
8. Try French/Allied views. Opposing visible columns show `?` and no composition/commanders; concealed opposing columns are omitted. **Export faction view** saves only the redacted, committed player view, with no journal. It is not an importable backup. Dashboard's full **Export saved JSON** remains an umpire backup containing both sides and history.

These are local pass-and-play display filters, not authentication or protection against someone inspecting the shared desktop/database or deliberately choosing umpire mode.

## Try scouting and the tabletop bridge (Milestone E)

1. Restart `npm run dev` after updating, or launch the rebuilt executable. Open a started campaign with operational play enabled. Use umpire view, then **Battle Log → Record scouting**.
2. Select an eligible active-side scout and opposing target. Enter a physical d6 or **Roll scouting die**, any agreed modifier, and an adjudication reason. Choose the intelligence the umpire approves, then **Save scouting report**. No automatic success table is assumed. Review configurable range/lifetime/attempt limits with **Review scouting rules**.
3. Inspect the observer's Campaign Map view. Located/estimated/identified reports reveal only the permitted snapshot until expiry; hidden columns are not live-tracked. An estimate is entered by the umpire; identification can release the observed roster/commanders.
4. Resolve movement into an opposing square to create a contact. Open **Scouting & battle briefs → Declare Battle**. The three-step wizard selects participants/entry edges, agreed reinforcement instructions and objectives/terrain/special notes, then freezes the shared brief.
5. **Save printable PDF** or **Export brief HTML**, and open the file in your reader/browser to print. Briefs contain both sides' committed forces. Play Maurice using your own tabletop materials.
6. **Begin tabletop battle → Enter battle result**. Enter the actual outcome, each unit's broken/retired/survived/not-engaged result, optional disruption and Army Morale, and commander changes. **Review and confirm result** opens a default-Cancel native confirmation; cancellation retains the draft.
7. Confirming saves an immutable result and journal entry. Restart or full export/import retains it. E does not apply losses, quality changes, persistent disruption, commander changes, siege progress or victory. Participants await the explicit post-battle workflow in F.

See [the full tabletop workflow and house-rule defaults](docs/TABLETOP_WORKFLOW.md).

## Try aftermath, siege and victory (Milestone F)

1. Restart `npm run dev` or launch the rebuilt executable. Open a started operational campaign in umpire view, then **Siege & Victory → Enable post-battle and siege rules**. Existing saves/history are preserved; past siege turns are not replayed.
2. Choose **Review campaign house rules**. Agree rebuilding/recovery delays, irregular/artillery policy, siege/exhaustion thresholds, deadline result and conflicting-condition result. All are provisional campaign rules.
3. After confirming a tabletop result, open its campaign aftermath review. Inspect broken-unit rebuilding/losses, commander decisions and agreed post-battle squares. Enter Epic Points manually from your own materials and any separately agreed exhaustion increases. Add notes, inspect the preview and confirm. Cancellation keeps the draft. Regular rebuilding uses conscript quality; tactical disruption/Army Morale stay in the battle record.
4. Record verified **investment, supply and relief** with a reason. Manage explicit commander arrivals, statuses and friendly attachments on the same screen; no card effects are automated.
5. After both faction phases, choose **Finalize turn N**. Outstanding contacts/battle reviews must be completed first. Confirmation processes due recoveries, supplied siege progress and victory once, with an auditable summary. Further orders wait for this checkpoint.
6. Inspect the after-action and checkpoint records, then restart or export/import a full JSON backup. A recorded campaign outcome blocks further strategic play; cloning starts a fresh setup draft.

See [the complete aftermath workflow, defaults and victory precedence](docs/CAMPAIGN_AFTERMATH.md). Epic Points are manual entries, never an approximation of official scoring. Campaign exhaustion is independent of battle Army Morale.

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

Maurice tactical play stays at the table. Published Fontenoy unit counts/type/quality are cited as scenario facts. The operational setup, movement, dates, concealment, siege settings and goals are **provisional house rules**, not official Maurice mechanics. Only configured operational orders are resolved; no tactical combat is automated. No copyrighted rules prose, card art or private reference PDFs are shipped. Keep private research in ignored `reference/`, `contextonly/` or `contextignore/`; packaging includes only built application files and license metadata.

All rights reserved pending an explicit license choice by the owner; see LICENSE.
