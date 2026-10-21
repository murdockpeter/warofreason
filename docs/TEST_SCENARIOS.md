# Milestones B–F verification

## Map-first interface acceptance

Help/inspection: open ⓘ Help, read the current next-step card, switch topics and close without changing saved or uncommitted state. Verify F1/Escape and return of focus. Right-click an own formation → Inspect formation: inspect readiness/composition/commanders/current roster. In faction view, inspect a visible opponent without a report: withhold roster/count/commanders. Inspect a hidden opponent released by identification: show the dated snapshot and observed quality/status, never live tracking. Closing either dialog must leave campaign revision/journal unchanged. Verify both built and packaged apps offline and visually inspect the manual/dossier.

Started campaigns reopen on the map with Campaign menu, Map options, Orders and formation details collapsed. Right-click or Shift+F10 opens the formation menu; enemy actions remain disabled. Move/hold stages ordinary validated orders, with route controls above the map. Phase review/resolution and required turn checkpoints remain explicit.

Test a two-pane split with unit and commander transfers, cancellation and unchanged saved state; then save, restart, inspect both counters and plot/issue an order for the new formation. Confirm exact roster conservation, same-square placement, immutable unit facts and a `formation_split` journal event. Reject empty/foreign/duplicate transfers, stale revisions and forged split positions on portable import. Existing scouting, tabletop, siege, persistence and faction-redaction regressions must still pass through the new menu/navigation controls. See [MAP_PLAY.md](MAP_PLAY.md).

## Automated checks

- **Schema:** valid UUIDs, unique entity IDs and coordinates, faction references/ownership, unit classification compatibility, unique assignments, strict versions and journal continuity.
- **SQLite:** transactional migration success/failure, idempotent reopen, create/rename/archive/clone, remapped clone references, stale-revision rejection across connections, active selection recovery and rollback of the entire action when journal insertion fails.
- **Transfer:** successful file replacement and round-trip import, temporary-file cleanup after publication failure, bounded file reads, invalid JSON, unsupported versions, invalid references and duplicate IDs without mutations.
- **Renderer:** navigation, computed layout/styles, pending/unsaved status, explicit save, undo, draft retention across screens, discard confirmation, save-error retention and error boundary.
- **Real Electron (built and packaged):** isolated renderer/bridge, offline launch, real SQLite lifecycle with repeated restarts, archive confirmation, atomic export via native-dialog selection, invalid/mismatched/duplicate import rejection, abrupt-exit WAL recovery, import into a fresh profile, and close-confirmation cancel/discard behavior.
- **Development:** loopback-only server with external requests blocked; injected CSS and navigation verified.

Automated profile directories are created under the OS temporary directory with checked `maurice-*test-` prefixes and do not access the player's library. Native dialog responses are stubbed in E2E; real handlers, transactions and files are exercised. Remote Windows CI is configured separately and has not been executed from this session.

## Manual desktop acceptance

1. Stop any prior development process, then run `npm run dev`.
2. Dashboard → New campaign → enter title, actor and reason → Create and save. In current C builds, verify French 20 / Allied 18 are seeded with source attribution; the campaign day remains unstarted until explicit review/start.
3. Rename campaign → edit title → Undo last edit. Edit again, visit Campaign Map and return; the draft should still be present. Save changes.
4. Expand Campaign journal entries; verify category, actor, reason, timestamp and before/after title/revision.
5. Close and reopen the application twice. The latest committed campaign and journal must return without manual selection.
6. Clone campaign. The copy must be independently editable and the source must retain its original history.
7. Archive a campaign, testing Cancel first, then Archive. Reopen the archived record; rename/archive controls must be disabled while clone/export remain available.
8. Export saved JSON. Importing it into the same library must reject the duplicate ID without overwriting the current save. Try an invalid text file and a copy with `formatVersion` changed to 99; both must fail with an actionable error.
9. Launch a separate manual profile as documented in README, import the unchanged JSON and restart that profile. The imported record and source journal plus import event must return.
10. Begin a rename but do not save. Close the window: Keep editing must retain the input; Discard and close must lose only the uncommitted edit. Reopen to confirm the committed title/journal remain unchanged.

## Milestone C automated acceptance

- Exact unit composition by faction and Dutch/Anglo-Allied contingent, with source references and separate house-rule column provenance.
- Stable 96-square map, eight labels, empty default road/river geometry, source unit preservation through scale/edge changes and unique friendly-column transfers.
- Duplicate assignments, wrong faction/contingent ownership, invalid objectives/edges, changed module totals and unreviewed starts rejected.
- Legacy format-1/profile preservation and explicit module loading, including refusal to overwrite custom legacy entities.
- Saved setup and start events, started-state restart/export/import, remapped edges/objectives/siege targets when cloning into a draft.
- Built and packaged UI: review totals, change 10/10 French split to 9/11, relocate/conceal a column, change schedule/first faction/siege/scale, add a proposed road, acknowledge provisional choices, save, cancel Start, confirm Start, restart, export/import into a fresh profile. Real unsaved-setup close cancellation preserves edits. Source units and square IDs are compared before/after.
- Packaged setup/map screenshots inspected; packaged archive checked for private PDF/reference exclusion.

## Milestone C manual acceptance

1. Restart development after main/preload updates. Open the existing B draft and choose Load Fontenoy setup on Dashboard, then the actual load action on Armies/Columns. The name, identity and prior journal should remain.
2. Edit setup. Verify French 20, Dutch 7 and Anglo-Allied 11. Change unit assignments between friendly columns; inspect source contingent labels and try Undo setup edit.
3. Change a column name/opening square/hidden flag, add/remove a column or commander, and verify no units are deleted. Unassigned or empty columns must prevent Start but may be saved during preparation.
4. Review/change the proposed schedule and initial siege state. Change optional scale or add/remove a proposed road; assignments must remain unchanged. No default historic routes should be asserted.
5. Check both acknowledgements and Save setup. Start must remain disabled while any edits are uncommitted or assignments incomplete.
6. Start Campaign → Keep reviewing must preserve the draft; confirming Start must show turn 1 and the selected opening date/faction. Setup becomes read-only.
7. Restart; verify the same 38 units, assignments, map references, settings and journal. Export/import into a separate profile and verify again. Clone a started record to prepare an independent draft.

Movement, scouting, fog-of-war enforcement, tabletop results, siege advancement and victory checks remain outside Milestone C.

## Milestone D acceptance

1. Start a reviewed campaign, enable operational play explicitly, and verify old identity/history remains unchanged. New rules must be labelled house rules, not official Maurice mechanics.
2. Select a column, zoom to 200%, drag to pan, reset the view and inspect a square/objective. Inspect permitted own/umpire composition and commanders.
3. Add a road and river crossing during setup; verify configured costs. Preview disconnected, diagonal, repeated, over-budget and blocked paths; reject without mutation. A hidden or visible opposing column cannot be passed through.
4. Add/undo/remove orders, navigate to Turn Orders, and verify draft retention. Issue orders; positions/date must remain unchanged. Reject stale revisions and replacing orders while in resolution. Restart and verify the same issued list.
5. Return to planning and reissue. Cancel Resolve and verify no changes. Confirm it; move legal routes and activate the other faction on the same day. Resolve that faction to advance the configured turn/day. Stop at the final configured turn without declaring victory.
6. Route to an enemy-occupied destination. Stop before contact; record deterministic engagement candidates and hold involved columns. No battle result, withdrawal or pursuit is invented.
7. Switch to each faction view. Omit concealed opposing columns and redact all opposing unit/commander details, names and orders. Shared campaign management requires an explicit umpire switch. Export faction JSON and verify no hidden identity/roster/journal leak. Full umpire backups remain complete.
8. Restart, export/import a full operational campaign, validate the journal chain, and clone it into an independent editable setup without operational orders/engagements. Reject forged operational journal changes and preserve the existing campaign on failure.

Automated acceptance runs use isolated temporary profiles, including built and packaged Windows executables. The artwork is decorative; no geography, rules prose or cards are copied from private references.

## Milestone E acceptance

1. Use a started operational campaign with an eligible active-side scout in range of a hidden opponent. Record a physical or app-generated d6, modifier/reason and umpire-selected intelligence. Reject out-of-range, ineligible, friendly/wrong-side, engaged or repeated attempts without altering saved state.
2. Test unknown/located/estimated/identified disclosure and timestamps. Move a hidden target after observation: the observer still sees the observed square/roster, not its current position. Advance past expiry; omit the hidden target. A newer unknown or expired report never revives older identification. Identification never exposes opposing issued orders or raw snapshot/unit IDs.
3. Resolve movement to contact, open Battle Log and complete Declare Battle. Verify both primary forces, participant faction/distance/ready-unit validation and explicit reinforcement arrival notes. Reject duplicate/overlapping commitments. Change joining range in the versioned house-rule configuration and verify eligibility follows it.
4. Save the declaration, restart and verify frozen units/quality/commanders/origins/setup notes. Generate real printable PDF and escaped offline HTML. Player text containing markup must be printed as text, without scripts, external images or URLs executing.
5. Begin the physical tabletop battle and enter an actual outcome, complete per-unit outcomes, optional disruption/Army Morale, commander changes and notes. Missing/duplicate/foreign results are rejected. Cancel the native confirmation and verify unchanged state and retained draft across navigation/close cancellation. Confirm and verify immutable result/journal.
6. Confirm that no campaign unit/quality, commander state, siege, exhaustion or victory was automatically altered. Committed participants stay held for F. Export/import into an isolated empty profile and restart; all records and action receipts must survive. Reject tampered receipts and stale revisions without mutation; clones reset tabletop/operational records.

Automated tests cover both built and packaged Windows apps, including actual `printToPDF` output. Printing to a physical printer and playing a complete human tabletop game remain playtesting tasks; the app does not simulate them.

## Milestone F acceptance

1. Explicitly enable aftermath on an existing operational campaign. Verify its ID, earlier results and prior snapshots remain unchanged; no past siege turns are replayed. Review all provisional policy values and save a variant.
2. Confirm a battle with a broken regular, optional retired/artillery results and commander observations. Review aftermath separately. Cancel native confirmation, navigate away/back and verify draft preservation with no saved change. Confirm once: rebuilding gives conscript current quality while preserving opening quality; loss retains the unit record; optional rest preserves quality. Reject missing/duplicate unit decisions, disallowed recovery and repeated application without mutation.
3. Verify agreed post-battle positions and commander decisions release the battle hold. Record a Notable arrival, private reference and friendly attachment; reject enemy attachments and changes to committed officers. Lost/retired officers detach explicitly. Later battle briefs use ready units/current quality, while earlier briefs remain frozen. Lost/recovering-only columns cannot create impossible contacts.
4. Enter Epic Points manually, including a blank side and explicit zero. Verify only recorded values contribute to summaries. Enter campaign exhaustion independently; tactical Army Morale and disruption remain battle facts with no inferred persistent effects.
5. Verify siege cannot progress without both investment and supply. After both faction phases, outstanding contacts/results/reviews prevent finalization and new orders/scouting pause. Cancel then confirm finalization: process due recovery and supplied progress once, preserve rules/conditions/exhaustion snapshots and reject repeated/premature finalization. Test a turn-1 review with delay 1 returning ready at the checkpoint whose displayed turn has advanced to 2.
6. On the last turn, test siege success against the Allied deadline fallback, absence of supply, verified relief, simultaneous exhaustion and simultaneous opposing substantive claims with each configured outcome. No victory appears before explicit finalization. A recorded outcome stores reasons and blocks continued play.
7. Restart, full export/import into an empty profile and restart again. Verify strategic state, receipts and historical records. Reject forged command receipts/stale revisions without mutation. Clone into an independent setup with ready units/opening qualities and no operational/tabletop/aftermath history.

F automated evidence: 97 unit/integration tests, 13 built/packaged Electron checks and one development check, plus typecheck/lint/format/build/package. Native confirmations and file dialogs are stubbed but actual IPC/domain/database/files execute. A complete two-human campaign remains Milestone G playtesting.
