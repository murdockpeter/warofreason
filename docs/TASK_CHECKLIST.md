# Running implementation checklist

## New operational direction — 2026-10-25

The Waterloo-based adaptation now has a separate [rules/repository review](WATERLOO_RULES_REVIEW.md) and [implementation TODO](WATERLOO_TODO.md). Its agreed scope includes simultaneous movement, externally resolved tactical battles with editable manual results, likely reinforcement arrival windows and original replacement charts. These documents plan future work; the completed implementation history below remains unchanged.

Milestones A–F are complete. The user has now requested a map-first interface simplification increment before G. Further interface refinement and human playtesting remain ongoing work.

## Phase map refresh verification — 2026-10-22

- [x] Strengthen the existing operational Electron checks to measure rendered counter positions inside their target square, alongside saved state. Verify cancellation leaves French at D3, confirmed French resolution renders E3, staging/issuing Allied orders retains L4, and resolving directly on the still-mounted map immediately renders K4 while advancing the turn. Both built and packaged checks pass; typecheck and formatting pass. No application change was necessary.

## Medium-dark livery — 2026-10-22

- [x] Formation dossier visual refinement: generously rounded 26px modal corners, double brass edge, deeper framing, a generic original crossed-standard emblem, clearer formation identity/location/access badges, stronger readiness cards and paired composition/commander panels. Numbered roster sections, refined table headings and responsive stacking complete the presentation. The emblem frame provides a visual home for later formation artwork; no speculative image-management controls were added.
- [x] Dossier refinement validation: five existing guidance/privacy integration tests pass; built and packaged offline manual/dossier checks pass. Typecheck, lint, changed-file formatting, production build and Windows packaging pass. Rendered dossier screenshots were visually inspected, including the packaged app. No campaign data or player profiles were changed.

- [x] Replace the cream/green presentation with medium-dark charcoal/slate surfaces, warm light text and muted brass actions; centralise the palette in CSS custom properties.
- [x] Apply the palette to navigation, status, forms, tables, context menus, Help, formation dossiers, split panes and feedback states; keep map artwork/counter identity colours and printable brief styling intact.
- [x] Match Electron's initial window background to the new theme and use dark native controls/scrollbars. Main text/panel contrast is 9.53:1, secondary text/panel 6.27:1 and primary action text/fill 6.03:1, calculated from the palette.
- [x] Validation: typecheck, lint, whole-project Prettier, production build and Windows packaging pass. Six built/packaged smoke, map-play and guide/dossier checks pass, plus one development startup/style check. Computed dark colour scheme/panel/chrome assertions pass. Packaged map, manual, dossier and split screenshots were visually inspected; no campaign data, rules or player profiles changed.

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

## Campaign map backdrop — 2026-10-21

- [x] Campaign map artwork: locally bundled generated Age of Reason backdrop beneath the existing schematic grid; labels and counters retain contrast, and illustrated terrain is explicitly decorative. No campaign data or mechanics changed.
- [x] Validation: typecheck, lint, formatting of changed files, all 50 unit/integration tests, production build and unpacked Windows packaging passed. All three Fontenoy Electron tests passed, including built and packaged setup/start/export/import flows and the legacy profile regression. Rendered map screenshot visually inspected with the backdrop present.
- [x] Fix map visibility before scenario setup: Campaign Map now shows the backdrop preview for empty libraries and older drafts, with navigation to the library/setup. Configured campaigns keep their real grid and column overlays. Regression coverage checks all three states without saving or loading a module automatically. Typecheck, lint, formatting, 53 unit/integration tests, all seven built/packaged Electron tests and the development test pass; image loading is checked in development and offline built/packaged runs. Windows package rebuilt.

## Setup review usability — 2026-10-21

- [x] Campaign map marker artwork: original inline black SVG infantry silhouettes with tricorn hats, coats and muskets replace circular counters in setup and operational maps. Pale backgrounds, French blue/Allied red borders and count bands, concealed gold dashes and selection/focus highlights preserve readability. Generic silhouettes represent columns, not disclosed troop composition; opposing unknown counts remain `?`. Stacked markers scale within their square. Existing keyboard/click controls and faction projection remain in use.
- [x] Marker validation: typecheck, lint, changed-file Prettier and production Windows build/package pass. Built operational and packaged operational/setup Electron checks pass, covering selection, zoom/pan, planning, faction privacy and setup/start/transfer. Operational map screenshot visually inspected. No new campaign mechanics or external artwork dependencies were introduced.

- [x] Draft review checkboxes can be selected without first finding Edit setup. Selecting a confirmation opens an unsaved setup draft; Save setup is still required before Start Campaign. Started and archived campaigns remain read-only, with an explanation beside the confirmations.
- [x] Validation: typecheck, lint, changed-file formatting, 56 unit/integration tests and all three Fontenoy Electron tests passed. Built and packaged tests select a confirmation directly, then save and start successfully. Undo and unchanged saved state before commit are covered. Production build and unpacked Windows package rebuilt.

## Later milestones — not started

- [ ] G: playtesting, printing and polish.
- [ ] Follow-up usability pass: simplify the completed end-to-end workflow, reduce decisions and repeated explanations, improve action placement, and test it with a first-time player.

## Map-first interface and formation controls — 2026-10-21

- [x] Player guidance: fixed ⓘ Help button and F1 open an offline manual with seven task topics, contextual next-step guidance, draft-preservation explanation and explicit navigation. No guide action commits gameplay or bypasses view gates.
- [x] Formation inspection: context menu and selected-formation ⓘ Inspect open a styled read-only dossier with readiness cards, composition, commander names and a scrollable roster. Unknown enemy data stays withheld; identified snapshots show observation/expiry dates and observed classifications/statuses. Close/Escape preserves draft orders.
- [x] Guidance/inspection tests cover draft retention, explicit navigation, planning/setup/resolution/checkpoint/contact guidance, own current records, withheld enemy rosters and identified enemy snapshots. Built and packaged offline tests exercise Help/F1/Escape/focus return, topic selection, all three inspection disclosure cases and unchanged campaign/journal state, alongside the existing split/restart/route flow.
- [x] Help/dossier validation: 112 unit/integration tests, all four relevant built/packaged guide and map-play checks, and one development startup/style/navigation check pass. Typecheck, lint, whole-project formatting, production build and Windows packaging pass. The packaged manual and dossier were visually inspected; long readers keep their Close header visible while content scrolls. Existing player data, campaign schemas and rules were not changed; no push/publish occurred.

- [x] U01: started campaigns reopen directly on Campaign Map; replace the permanent sidebar with Campaign menu and retain a direct map button.
- [x] U02: collapse setup, map options, detailed orders, formation rosters and rule/help explanations; remove development milestone labels from the play interface. Display current verified siege progress/supply and objectives when aftermath is enabled.
- [x] U03: right-click formation menu for map movement, hold, split, inspection and scouting; Shift+F10/menu-key access and a visible Formation actions alternative. Enemy/inactive/committed actions retain their existing validation and disclosure restrictions.
- [x] U04: route preview, cost/errors and add/undo/remove controls above the map; compact phase issue/review/confirmed resolution and completed-turn review shortcuts.
- [x] U05: two-pane modal split, with explicit unit/commander transfers, new formation name, nonempty resulting formations and cancellation/discard protection.
- [x] U06: real transactional split command and replay-validated journal event, preserving location, roster identity/classification/status, faction/concealment and earlier snapshots; restart and full backup/import retain it. This is explicitly a campaign reorganisation policy, never an official Maurice mechanic.
- [x] U07: [MAP_PLAY.md](MAP_PLAY.md) documents the new controls and constraints. Domain tests cover conservation, invalid/foreign/duplicate/empty transfers, commitment/phase locks, stale edits, portable replay and forged-transition rejection.
- [x] Validation: 107 unit/integration tests pass; typecheck, lint, whole-project Prettier, production build and unpacked Windows packaging pass. Thirteen desktop checks passed in the full built/packaged run; the two tabletop checks passed on rerun after updating their navigation step to the new menu. This validates all 15 desktop scenarios, including the new built/packaged map-menu/split/restart/route flow. Native discard answers are stubbed; actual IPC, journal, SQLite and files execute. Packaged map workspace and split modal screenshots were visually inspected. Existing player profiles were not used and no push/publish was performed.
- [x] Development launch/styling/image/navigation check passes with external requests blocked.
- [ ] Gather first-time-player feedback on the new map flow and refine further. Milestone G remains separate; this interface increment does not implement its summaries, extra printouts or previous-turn forks.

## Milestone D — map and operational orders

- [x] D01: selectable squares/columns, zoom/pan, configured roads/river crossings, objectives, blocks and square inspector over the decorative backdrop.
- [x] D02: own-side/umpire composition and commander inspector, movement allowance and orders.
- [x] D03: deterministic orthogonal path/cost validation; versioned data-driven, adjustable movement house rules.
- [x] D04: separate planning, saved issued orders and confirmed resolution; restart-safe orders and journal snapshots.
- [x] D05: faction phases and configured day/turn advancement; undo unissued edits or reopen issued planning before committing resolution; deadline ends the operational window without deciding victory.
- [x] D06: French/Allied/umpire display views; concealed opponents omitted, opposing composition/commanders/orders masked, shared management screens gated behind explicit umpire switch; redacted faction export excludes history. Shared local desktop, not authenticated access control.
- [x] D07: blocked-square/hostile occupancy validation, deterministic engagement candidates and participant movement hold pending Milestone E.
- [x] D acceptance: blocked/invalid moves cannot mutate state, operational actions record their rule, faction views/exports mask opposing composition, committed orders survive restarts, and final build/package/regression validation passes.

## Milestone E — reconnaissance and tabletop bridge

- [x] E01: active-side scouting workflow; physical/app d6, agreed modifiers/reason and manual umpire adjudication; versioned configurable eligibility/range/attempt limits.
- [x] E02: unknown/located/estimated/identified records with timestamps, observed snapshots and turn-based expiry; faction projections disclose only permitted, current intelligence.
- [x] E03: candidate-based Declare Battle wizard with eligibility, participant/entry-edge selection, agreed reinforcement arrivals, objectives and terrain/special notes; frozen forces cannot be committed elsewhere.
- [x] E04: shared frozen Battle Brief with original rosters, types/qualities/contingents, commanders/Notable names, origins and player-agreed instructions; escaped offline HTML and printable A4 PDF.
- [x] E05: manual outcome and complete per-unit/commander result entry, optional final disruption/Army Morale/notes. No campaign effects are applied in E.
- [x] E06: native default-Cancel result confirmation, draft retention on cancel/error, immutable result/journal, no automated tactical combat/card effects.
- [x] E acceptance: full map contact → printable brief → manual confirmed result → journal/restart/export/import round trip passes in built and packaged Electron, with no automated tactical outcome or campaign aftermath.

## Milestone F — post-battle state and siege

- [x] F01: versioned module defaults, replaceable pure loss/recovery strategies and per-campaign configuration.
- [x] F02: explicitly allowed regular rebuilding at conscript quality, opening-quality preservation, chosen irregular/artillery variants, scheduled recovery and optional retired rest; no permanent disruption carryover.
- [x] F03: manual nullable Epic Points per side and entered-value/missing-value summaries; no approximation of official scoring.
- [x] F04: explicit commander/Notable arrivals, active/lost/retired statuses, private references and friendly attachments; committed officer locks and no card effects.
- [x] F05: umpire-verified investment/supply/relief, parameterized siege progress and one confirmed update per completed turn.
- [x] F06: checkpoint-only siege/relief/exhaustion/deadline victory, configurable simultaneous-condition outcome and recorded reasons; Army Morale remains separate.
- [x] F07: previewed and confirmed battle effects, after-action changes, recovery queue, checkpoint history and auditable replayable events.
- [x] F acceptance: strategic changes are transactional and journaled; premature/duplicate finalization and repeated battle effects fail without mutation; conflicting final-turn conditions are tested; built and packaged restart/export/import flows pass.

## Milestone A completion evidence — 2026-10-21

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

Milestones A–C were completed before beginning D. Operational movement now uses explicitly configured house rules. Scouting, the tabletop bridge, siege progression and victory evaluation remain subsequent milestones.

## Milestone D completion evidence — 2026-10-21

- Application 0.4.0 implements D01–D07, with explicit opt-in operational play for existing started campaigns and module-configured `house_rule_v0.1/operations-1` defaults. No published tactical movement or combat mechanic is asserted.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, production build and unpacked Windows packaging pass.
- `npm test`: 65 passing unit/integration tests, covering connectivity/costs/blocks, wrong-side/duplicate orders, faction/date/deadline sequencing, deterministic contacts and movement holds, projection redaction, journal replay/tamper rejection, rollback/stale revisions, restart/import and clone compatibility.
- `npm run test:e2e`: all nine built/packaged Electron checks passed. After a final legacy-journal validation hardening, the five setup/legacy/operational checks were rerun and passed against the rebuilt package. Operational tests cover route preview/add/undo, zoom/pan/reset, cross-screen order retention, issue/reopen/restart, native Resolve cancellation/confirmation, two-faction day advancement, redacted faction export and gated shared management.
- `npm run test:dev`: one development startup/styling/image-loading check passed with external requests blocked. Built and packaged operational map screenshots were visually inspected.
- Test profiles were isolated; no player saves or private reference files were used. Existing v1/v2 histories remain unchanged until explicit commands. SQL migration 001/export format 2 remain in use; clones remove operational state and create a new setup draft.
- Milestone E remains next: reconnaissance/contact intelligence and manual tabletop battle briefs/results. F covers post-battle/siege/victory; G covers polish/playtesting. A dedicated interface simplification pass follows the functional milestones, as requested.

## Milestone E completion evidence — 2026-10-21

- Application 0.5.0 implements E01–E06. `TABLETOP_WORKFLOW.md` explains the umpire-adjudicated scouting procedure, configurable joining range, shared brief and manual result boundary. Defaults and all eligibility/range/lifetime/attempt values are versioned `house_rule_v0.1/tabletop-1` configuration, never labelled official Maurice campaign mechanics.
- Typecheck, ESLint, whole-project Prettier, production build and unpacked Windows packaging pass. `npm test`: 80 passing unit/integration tests. Added contact disclosure/expiry/no-live-tracking, identified-enemy order redaction, eligibility and configuration, frozen force commitment, complete result validation, escaped briefs, cancelled-draft navigation, transaction rollback/stale revisions, journal replay/tamper rejection and portable recovery.
- `npm run test:e2e`: all 11 built/packaged Electron checks pass. Both new tabletop flows record physical/app scouting, inspect released intelligence, resolve map contact, declare/save/reopen a battle, generate actual PDF and escaped HTML, enter unit/commander/Army Morale observations, cancel then confirm a result, and export/import/restart in a separate profile. Confirmed results leave campaign forces/commanders unchanged.
- `npm run test:dev`: one development startup/styling/image-loading check passed with external requests blocked. The packaged Battle Brief screenshot was visually inspected. Actual `printToPDF` output is checked; physical printing and a human tabletop game remain playtesting work.
- Test profiles are isolated. No player saves or private source PDFs were used or copied. Existing campaign/history payloads remain unchanged until explicit tabletop commands; clones reset operational/tabletop records into an independent draft. No external publish/push was performed.
- Milestone F is next: explicit post-battle campaign changes, recovery, siege and victory. Milestone G and the requested dedicated interface simplification pass remain pending.

## Milestone F completion evidence — 2026-10-21

- Application **0.6.0** implements F01–F07. [CAMPAIGN_AFTERMATH.md](CAMPAIGN_AFTERMATH.md) documents defaults, prospective enablement, recovery/checkpoint timing, manual Epic Points, victory precedence and the official/house-rule boundary. The original coding plan remains an unchanged reference; this file tracks actual completion.
- `npm run typecheck`, `npm run lint`, whole-project `npm run format:check`, production build and unpacked Windows packaging pass. `npm test`: **97 passing unit/integration tests**. F coverage includes source-quality preservation, fixed/manual loss variants, irregular/artillery classification, retired rest, commander decisions/arrivals/attachments, repeat-battle reuse, ready-force occupancy, premature/duplicate checkpoint rejection, supply gating, no early victory, final-turn conflicts for all configured outcomes, final siege precedence, independent exhaustion, late-contact holds, SQLite rollback/restart/portable replay/tamper rejection and clean setup clones.
- `npm run test:e2e`: **all 13 built/packaged Electron checks pass**. New F flows cancel then confirm aftermath with retained navigation drafts, apply conscript recovery and explicit commander loss, record/attach an arriving Notable, attest supplied investment, restart, cancel/confirm turn finalization, recover the unit, finish a final-turn siege victory and export/import/restart in an empty profile. Existing A–E regression checks pass unchanged in behavior.
- `npm run test:dev`: **one passing** offline development launch/style/image check. Packaged campaign outcome screenshot visually inspected. Native dialog answers are automated in isolated test profiles; human tabletop playtesting and installer signing/execution remain outside this local verification.
- Existing saves and historical snapshots are retained; F is explicitly enabled. SQL migration 001/export 2 remain unchanged. No player campaign data/private reference PDFs were used, no official tactical calculation or card effect was added, and no push/publish was performed.
- Milestone G is next. Its campaign summaries, additional printouts, previous-turn forks and human playtesting remain unimplemented. The dedicated interface simplification pass follows the functional milestones.
