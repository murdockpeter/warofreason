# Running implementation checklist

Milestones A–C are authorized. Milestone D and beyond remain deferred.

- [x] A01 Initialize repository, README, license and development/build/check/package scripts.
- [x] A02 Secure Electron + Vite + React + strict TypeScript; typed validated preload IPC.
- [x] A03 Dashboard, Campaign Map, Armies/Columns, Turn Orders, Battle Log, Siege & Victory, Settings navigation.
- [x] A04 Campaign day, faction, siege, objectives and unsaved-change status strip.
- [x] A05 Errors, local diagnostics, empty states and confirmation dialogs.
- [x] A06 Initial domain/contract validation tests and UI coverage.
- [x] Acceptance: offline development startup verified.
- [x] Acceptance: packaged Windows executable launches and navigation works.
- [x] Acceptance: renderer isolation verified; lint, typecheck, tests and build pass.

## Milestone B — campaign state and persistence

- [x] B01: versioned campaign schema, UUIDs and reference integrity.
- [x] B02: SQLite migration 001 and main-process repository.
- [x] B03: create, rename, clone, archive and reopen campaigns.
- [x] B04: transactional autosave and recover last active campaign.
- [x] B05: atomic JSON export/import, validation and duplicate protection.
- [x] B06: who/what/when/why journal, before/after snapshots and undo of draft edits.
- [x] B acceptance: repeated restarts preserve state; rejected imports preserve saves; duplicate IDs never overwrite.

## Milestone C — Fontenoy module and setup

- [x] C01: sourced specification with rules provenance.
- [x] C02: original 12 × 8 schematic with stable square IDs and adjustable map scale/adjacency.
- [x] C03: eight labelled places; no unverified default roads/rivers.
- [x] C04: correct French 20 and Allied 18 scenario-scale units.
- [x] C05: Dutch 7 / Anglo-Allied 11 provenance retained.
- [x] C06: editable provisional columns, concealment, commanders, schedule and siege.
- [x] C07: reviewed and validated Start Campaign action; retain existing saves and journal.
- [x] C acceptance: adjust and save setup, start, restart and round-trip export without losing state.

## Later milestones — not started

- [ ] D: operational map and orders.
- [ ] E: reconnaissance and manual tabletop bridge.
- [ ] F: configurable post-battle/siege rules and traceable victory evaluation.
- [ ] G: playtesting, printing and polish.

## Completion evidence — 2026-10-21

- `npm run typecheck`, `npm run lint`, `npm run format:check`: passed.
- `npm test`: 15 passing domain, contract and React tests.
- `npm run package`: production build and unpacked Windows x64 package passed.
- `npm run test:e2e`: 2 passing real Electron tests, including packaged execution with offline reload and all seven screens. Checks no renderer `require`/`process`, a separate isolated preload context, sandboxed renderer metrics, bounded bridge methods, malformed input rejection and native confirmation responses.
- `npm run test:dev`: 1 passing development launch test with external network requests blocked. `npm run dev` also started and closed successfully.
- Regression verified in built, packaged and development runs: reload cancellations (`ERR_ABORTED`, -3) produce no startup-error popup. Simulated real main-frame failure still triggers the error handler; subframe failures do not report the whole application as unavailable.
- Windows executable: `release/win-unpacked/Maurice Campaign Companion.exe`. Keep its supporting folder intact. Installer script is configured; installer execution/signing is outside this acceptance check.
- Dependency audit: no production dependency advisories; 8 moderate findings in transitive development packaging dependencies (`electron-builder` download/proxy logging chain). No forced dependency overrides applied. Recheck tooling before distribution.
- Windows CI is configured but has not run on a remote CI service in this session.
- Follow-up styling fix: development CSP now permits Vite's injected style elements; production policy remains strict. Computed-style regression checks pass for development, built and packaged apps. Typecheck, lint, formatting and build also pass after the fix.

## Milestone B completion evidence — 2026-10-21

- Version 0.2.0 implements all B01–B06 items; see architecture and design decisions for the bundled SQLite driver choice.
- TypeScript, ESLint, production build and unpacked Windows packaging pass.
- `npm test`: 40 passing tests, including failed migration/write rollback, stale edits, clone reference remapping, read-only archives and safe import/export behavior.
- `npm run test:e2e`: 4 passing tests across built and packaged Electron. Campaign state survives repeated graceful restarts and abrupt exit; invalid/mismatched/duplicate imports preserve the prior library; source JSON imports successfully into a separate empty profile and survives another restart.
- Real close behavior verified: cancelling retains unsaved edits; explicitly discarding closes the window, and reopening restores only committed data.
- Updated campaign library, archive controls, journal and error presentation visually inspected from the packaged application screenshot. Styling assertions remain in all Electron launch suites.
- Automated tests use isolated temporary profiles. No player campaign data or private reference PDFs were used. Private `contextonly/` PDFs are now explicitly ignored.
- `npm run test:dev`: 1 passing development launch/styling test with external requests blocked. `npm run format:check` passed. Production dependency audit reports zero advisories; the previously recorded development packaging-tool advisories remain unchanged. Remote CI and installer signing remain outside this local verification.

## Milestone C completion evidence — 2026-10-21

- Application 0.3.0 implements C01–C07 with module `fontenoy` 0.1.0 and clearly marked operational `house_rule_v0.1` settings. Sources and their limits are documented in `CAMPAIGN_SPEC_FONTENOY.md`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, production build and unpacked Windows packaging pass.
- `npm test`: 50 passing tests. Added exact per-type/quality/contingent totals, stable square/force preservation, friendly transfers, duplicate/invalid references, setup/start validation, legacy loading and clone graph remapping.
- `npm run test:e2e`: 7 passing tests across built and packaged Electron. New coverage changes the French split from 10/10 to 9/11, positions/concealment, schedule/first side, siege settings, map scale and a proposed road; then saves, cancels/confirms Start, restarts and exports/imports without losing state. Unsaved setup close cancellation preserves edits.
- Existing B-profile regression opens old state unchanged, explicitly loads the module, and verifies the same campaign ID/title and untouched prior journal snapshots. No player save directory was used by automated tests.
- `npm run test:dev`: 1 passing development launch/styling check with external requests blocked. An already-running local Vite server was reused without stopping it; CI remains configured to start a fresh server.
- Packaged setup summary and original schematic map screenshots visually inspected. ASAR contents verified: no private PDF/reference files. No private source prose, artwork or card effects were incorporated.
- Production dependency audit reports zero advisories. Previously recorded development-tool advisories, remote CI execution and unsigned installer limitations remain unchanged.

Milestones A–C are complete. Stop here; Milestone D remains unstarted. Columns, schedule and siege values are configurable setup proposals, with no movement, scouting, player-specific fog of war, tactical resolution, siege progression or victory evaluation implemented.
