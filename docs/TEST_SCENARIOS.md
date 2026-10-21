# Milestones B–C verification

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
