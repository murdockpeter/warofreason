# Running implementation checklist

## GitHub Actions dependency install repair - 2026-10-26

- [x] Read failed run 40373159672: npm ci ETARGET for retry ^0.6.0, separate from the Node 20 action warning.
- [x] Verify npm metadata and repair @humanfs/node 0.16.8 lockfile dependency to retry ^0.4.0; package-lock-only refresh changes no resolved dependency versions.
- [x] Verify release commit SHAs/manifests, pin checkout 7.0.1 and setup-node 7.1.0 (Node 24), and use .nvmrc for application Node.
- [x] Clean isolated npm ci including Electron postinstall passes (545 packages). Workflow YAML parses and preserves all validation steps. Workflow still requires a push to run on GitHub; no remote green run is claimed. Automatic approval review blocked cleanup of the dedicated maurice-ci-verify folder in Windows Temp with "blocked by policy"; the folder remains, separate from project/player data.

## Optional manual Epic Points - 2026-10-26 / 0.12.0

- [x] Inspect existing manual scoring, simultaneous journal/draft/correction guards and Helper checkpoint guidance.
- [x] Add optional versioned ledger, one entry per reviewed battle, separate campaign events, null/zero distinction and append-only corrections with current-version totals.
- [x] Add collapsed controls, own-side summaries/privacy, guarded entry/correction drafts and post-battle Helper guidance.
- [x] Validate sources, revisions, totals, battle dependencies, rollback/restart/replay/import/clone and renderer workflows: all 251 unit/integration tests pass. Built and packaged Epic Points walkthroughs pass for null/zero, cancelled confirmations/draft navigation, corrections replacing totals, event/battle entries, privacy, unchanged battle/strategic state and portable restart; packaged ledger visually inspected.
- [x] Complete acceptance: all 251 unit/integration tests, all 33 built/packaged Electron checks and offline development startup pass. Typecheck, lint, whole-project formatting, production build and Windows unpacked packaging pass; packaged ledger visually inspected. No player saves or private materials changed, and no commit/push/publish performed. Next: simultaneous scouting/intelligence. CI lockfile/runtime repair is recorded above.

## Simultaneous commanders and Notables - 2026-10-26 / 0.11.0

- [x] Review existing commander records, frozen briefs, legacy management and correction/clone boundaries.
- [x] Add opt-in reviewed baseline, validated manual arrival/details/status/attachment commands and traceable officer history.
- [x] Protect unresolved engagements, clear-planning attachments, faction ownership, inactive detachments, dependent corrections and baseline cloning.
- [x] Add collapsed faction-safe management controls, guarded drafts and Helper mode guidance; leave card effects and HQ ratings manual.
- [x] Validate domain invariants, frozen briefs, future active-officer snapshots, dependent correction guards, metadata-only attachment conservation, SQLite rollback/restart/replay/import/clone, renderer privacy/drafts and checkpoint Helper choices. All 235 unit/integration tests pass.
- [x] All 31 built/packaged desktop checks pass. Both commander and helper walkthroughs pass again after final adjustments, including cancelled confirmations, draft navigation, arrival/attachment/retirement, checkpoint guidance, faction privacy, unchanged HQs/units, restart and portable history. Development offline launch passes. Typecheck, lint, whole-project formatting, production build and Windows unpacked packaging pass; packaged commander panel visually inspected.
- [x] Document acceptance evidence and remaining optional Epic Point/scouting integration. Only the focused commander/Notable increment is complete. Tests used isolated profiles; no player saves/private materials changed and no commit/push/publish performed. Card effects, tactical officer outcomes and HQ ratings remain manually adjudicated.

## Player helper mode - 2026-10-26 / 0.10.1

- [x] Add an on-by-default, locally remembered helper toggle and contextual next-choice panel, separate from campaign mechanics and saves.
- [x] Guide planning sides, move/hold, locks/waiting, preparation, contact/battle entry/approval/resolution, siege/finalization, completed campaigns, legacy setup/play and unfinished drafts.
- [x] Reveal collapsed controls, highlight and keyboard-focus the requested area without clicking, committing or switching faction view automatically.
- [x] Verify privacy, draft preservation, guidance transitions, no automatic actions, local preference persistence and actual built/packaged workflows. New desktop walkthroughs cover initial library guidance, map navigation/friendly-counter focus, move draft cancellation, hold/side/lock/resolution transitions, native cancellation, waiting views and preference retention through restart. Packaged helper panel visually inspected.
- [x] Complete validation: all 217 unit/integration tests and all 29 built/packaged Electron checks pass. Development startup/navigation/style check passes offline; typecheck, lint, whole-project formatting, production build and Windows unpacked packaging pass. No campaign mechanics, player saves or private materials changed; tests used isolated profiles. No commit/push/publish performed. Next campaign integration block remains commander/Notable management, optional Epic Points and scouting/intelligence.

## Simultaneous Tournai siege and victory - 2026-10-26 / 0.10.0

- [x] Review the complete original plan, current operational TODO and existing siege/victory workflow.
- [x] Add opt-in siege policy, explicit calendar cadence/deadline, checkpoint-only manual conditions/exhaustion and immutable explanations.
- [x] Reuse the existing siege/victory evaluator, accumulate only attested eligible time, preview/apply checkpoint effects and lock concluded campaigns.
- [x] Add compact Tournai controls, guarded drafts, recorded history and contextual Help without inferred supply/relief or tactical adjudication.
- [x] Validate timing, supply interruption, relief, deadline/conflicting outcomes, frozen history, persistence/replay/import/clone, concluding unit recovery and legacy compatibility: 209 unit/integration tests pass. All 27 desktop checks pass.
- [x] Validate built/packaged Electron workflows and development launch: all 27 desktop checks pass, including cancelled policy/review/finalization confirmations, retained drafts, restart, concluded campaign locking and portable outcome replay. Both new walkthroughs pass again after scoped styling; packaged Tournai panel visually inspected. Development offline startup check passes. Typecheck, lint, formatting, production build and Windows unpacked packaging pass.
- [x] Record completion evidence and identify the next TODO block: commander/Notable management, optional Epic Points and scouting/intelligence integration. Tests used isolated temporary profiles; no player saves changed and no commit/push/publish performed. Siege timing, supply/relief and victory remain provisional house rules; human playtesting is still pending.

## Simultaneous Maurice unit aftermath — 2026-10-25 / 0.9.0

- [x] Explicit opt-in policy with source-cadence calendar conversion, shared regular/irregular/artillery recovery strategies and fixed scheduled dates.
- [x] Manual frozen-unit outcomes, optional disruption/notes and final Army Morale; record/approve preserve units until battle-end resolution applies reviewed effects.
- [x] Conscripts preserve original quality, retired rest preserves classification, losses retain identity, future briefs include only ready units, and phase finalization processes due recovery once.
- [x] Safe result revisions restore the exact unit baseline and replace only that battle's queue; dependent corrections remain blocked. SQLite action/journal writes are atomic, restart/import replay is validated, and fresh clones restore opening readiness/quality.
- [x] Umpire policy/results and faction-filtered recovery queues, session draft/discard guards, Help and detailed operational documentation.
- [x] 187 unit/integration tests pass, including transaction rollback, time conversion, pre-application observations, correction, classification, source conservation, queue privacy, ready-only briefs, empty-formation/early-return rejection, portable replay and clean cloning. Typecheck and lint pass.
- [x] All 25 built/packaged regression checks pass. The new flows record/approve a broken unit, cancel/confirm actions, apply rebuilding at battle end, restart, cancel/confirm recovery finalization, export/import and restart again. Production build and Windows packaging pass; packaged after-action summary visually inspected. No player profile or prior history was modified. Shared-phase Tournai siege/victory remains the next integration item.
- [x] Development startup/navigation/style check passes with external requests blocked; whole-project formatting and final whitespace checks pass.

## Fontenoy hex-map period backdrop — 2026-10-25

- [x] Generate and bundle original engraved-watercolour Flanders/1745 artwork, retaining its final prompt in `assets/maps/fontenoy-1745-operational-backdrop-v1.prompt.md` and preserving earlier map artwork.
- [x] Render it behind the Fontenoy hex grid with translucent terrain, readable outlined place/HQ labels, unchanged operational overlays and an optional plain-map toggle. Decorative geography does not alter movement data.
- [x] Typecheck, lint, whole-project formatting, production build and Windows packaging pass. Both built/packaged Fontenoy walkthroughs pass, including actual offline image decoding, backdrop toggle, simultaneous movement, saved-setup copy and restart persistence. Packaged rendered map visually inspected. Existing player campaign retained and app reopened with the new artwork.

## Maurice / Fontenoy setting correction — 2026-10-25

The current scope is Maurice-centred Fontenoy/Tournai in 1745. C3i Waterloo supplies operational mechanics only. The [Fontenoy operational guide](MAURICE_FONTENOY_OPERATIONS.md) and [aligned TODO](MAURICE_OPERATIONAL_TODO.md) take precedence over earlier Crossroads/Waterloo scenario plans below.

- [x] Create actual simultaneous Fontenoy campaigns with the sourced 38-unit Maurice roster, opening qualities/contingents, 1745 dates, existing geography, French/Dutch/Anglo-Allied columns, appropriate commanders and Tournai objectives.
- [x] Offer independent fresh operational copies of saved Fontenoy setups, preserving source histories and configured map edges. Cloning an operational Fontenoy campaign retains its setting and unit mappings.
- [x] Display mapped Maurice rosters/commanders and freeze them into battle/reinforcement briefs. Default the external tactical game to Maurice while retaining manually editable outcomes and arrivals.
- [x] Retain simultaneous movement, reinforcement windows, opt-in screening/withdrawals and own-side overlays. Preserve the established Fontenoy workflow, including its full aftermath/siege features; their integration into simultaneous play remains explicitly pending.
- [x] Final corrected-profile verification: all 169 unit/integration tests and all 23 built/packaged desktop checks pass, including real Fontenoy creation, movement, restart, saved-setup copying and source history preservation. Development launch with external requests blocked, typecheck, lint, whole-project formatting, build and Windows packaging pass. Packaged Fontenoy map/roster visually inspected. ASAR version 0.8.0 and main/preload build consistency verified; private references/PDFs excluded. Tests use isolated profiles; no player profile changed and no push/publish occurred.

## New operational direction — 2026-10-25

Historical research: the C3i adaptation has a separate [rules/repository review](WATERLOO_RULES_REVIEW.md) and [earlier implementation TODO](WATERLOO_TODO.md). Its agreed mechanics include simultaneous movement, externally resolved tactical battles with editable manual results, likely reinforcement arrival windows and original replacement charts. Waterloo-specific scenario plans are superseded by the setting correction above.

P0 design drafting is complete in the [movement and timing specification](WATERLOO_MOVEMENT_SPEC.md). Version 0.7.0 supplies the first playable Crossroads slice; 0.8.0 adds opt-in preparation and overlays. Original chart calibration and the broader historical adaptation remain open. See [the play guide](WATERLOO_PLAY.md) and current Waterloo backlog for the precise implementation boundary.

## Ordinary screens, simultaneous withdrawal and overlays — 2026-10-25

- [x] Add optional `waterloo_preparation_v0.1` state without inserting defaults into earlier schema-3 snapshots or changing earlier receipt replay. Explicit enablement allocates one abstract screening element per corps; tactical roster allocation stays manual.
- [x] Enforce army/parent linkage, one placement per HQ/phase, legal HQ/parent traces, Normal-mode road doubling, no placement in any unit zone, stationary deployment, recall and next-phase availability. Freeze HQ/chart/return stages once deployment or withdrawal planning starts; support the empty road-adjacent HQ fallback when no army units are on-map.
- [x] Save independent withdrawal drafts/locks, preserve them through navigation/restart, preview both sides in umpire view, and confirm three shared 20-minute retreat steps. Enforce geometry, enemy control, explicit friendly priority, no corps pass-through, blocked/trapped blown outcomes and a rest-of-phase hold. Credit other corps' concurrent preparation and process organization before withdrawal.
- [x] Add managed-screen tactical recall/elimination/retention, legal friendly corps/screen stacking and deep result baselines so corrections restore HQ/availability metadata without changing earlier records or adding troops.
- [x] Add own-side control, corps influence and HQ command overlays, HQ/DET markers, own-only withdrawal/deployment controls and holding explanations. Keep opposing orders, reserve rosters and HQ ratings out of faction UI.
- [x] Validation: 163 unit/integration tests pass, including new reserve/deployment/recall, trapped/contested retreat, preparation timing, commander fallback, roster conservation, correction, replay/transfer/tamper and UI draft/privacy checks. Standard `npm test` now caps workers at two to prevent replay-heavy SQLite tests competing with many jsdom workers; test timeouts/assertions remain unchanged. Typecheck, lint, whole-project formatting, production build and unpacked Windows packaging pass.
- [x] Final built/packaged desktop, development-launch and archive checks pass as recorded in the corrected-profile acceptance above, including both screening/withdrawal restart walkthroughs.

## Simultaneous Crossroads gameplay — 2026-10-25

- [x] Add schema-3 operational profile and independent original 117-hex scenario, preserving schema-1/2 imports, journals and Fontenoy gameplay. Keep SQL migration 001 and export format 2; record/replay validated Waterloo action receipts.
- [x] Add French/Anglo-Allied/Prussian army affiliations, corps formation/readiness, HQ mode/placement, original movement/terrain/bridge/weather timing and due blown-return review.
- [x] Save/lock both sides' timed movement segments independently; resolve on one shared clock with command/zone checks, explicit friendly priorities, congestion, hostile contention, contacts/stand-offs and phase checkpoints. Route drafts survive navigation and native cancellation.
- [x] Freeze shared battle briefs and conditional reinforcement windows/entry edges; permit reasoned arrival overrides and optional tactical-turn conversion, prevent duplicate commitments and export escaped HTML/real PDFs.
- [x] Record neutral external tactical results with complete force/arrival/position review, separate effect approval/application, immutable revision history and compensation when no later effects depend on the old result. Preserve cancelled result drafts and restart/backup state.
- [x] Add map controls, faction display filters, profile-specific offline Help and [workflow documentation](WATERLOO_PLAY.md); keep historical scenarios, detachments/special rules, simultaneous withdrawal, full reinforcement interception and scenario victory scoring explicitly unimplemented in this slice.
- [x] Domain/integration verification: 142 tests pass, including new command/geometry/zone/weather, locking/collision, reinforcement reservation/override, manual correction, persistence/replay/tamper, legacy compatibility, faction disclosure and draft-retention checks. Typecheck, lint, whole-project formatting, production build and unpacked Windows packaging pass.
- [x] Desktop verification: 17 of 19 checks passed in the full run, including both new built/packaged Crossroads walkthroughs. The two startup checks passed on rerun after replacing their fixed 0.6.0 expectations with package metadata and adding the two named Waterloo methods to the bridge allowlist. Thus all 19 desktop checks pass across those runs. Development launch/navigation/style also passes with external network requests blocked, after the same version-expectation update.
- [x] The new desktop flows verify one-side lock persistence, confirmed/cancelled simultaneous resolution, shared phase advancement, contact, reinforcement commitment, real HTML/PDF export, cancelled result draft retention, separate result/effect application, a superseding correction, faction display filtering and final restart persistence. The rendered original hex map was visually inspected. Packaged ASAR version 0.7.0 and main/preload consistency were checked; private references/PDFs are excluded. Tests use isolated profiles; no player profile was changed and no push/publish occurred.
- Validation note: one existing repository test exceeded its five-second timeout while tests and packaging ran concurrently; the full 142-test run passed when rerun without packaging competition. No timeout threshold was changed. Human tabletop playtesting, detailed chart calibration, installer signing and remaining adaptation rules stay open.

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
