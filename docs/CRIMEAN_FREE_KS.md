# Crimean War — Free Kriegsspiel (0.19.0)

## First session

1. Restart the app after updating main/preload code. In **Campaign module**, choose **Crimean War · Free KS**. This workspace is independent of Maurice/Fontenoy.
2. Choose **New Crimean KS**, supply a title and create the campaign. It begins with no units or deployment. Open Deployment Area to review and load the dated Alma roster, or use your own scenario. Source gaps are labelled; no invented OOB is presented as established history.
3. Choose a **Map sheet**. **Add force**, then click its initial position. Enter its name, allegiance, kind, descriptive strength, commander and condition. Composition and extra notes are optional. Saving creates a journalled scenario placement, not a calculated combat unit.
4. Right-click a live marker. **Inspect / edit force** changes its record; **Draw planned route** records an order separately from location. Click route points, then **Record intent** and describe the order. No time or movement is resolved automatically.
5. After adjudicating an outcome, choose **Move / transfer force** and click the agreed destination. To transfer between sheets, change the Map sheet while this action is active, then choose a point. Review the placement, explain the ruling and **Record ruling**. By default it clears the previous intent; you may explicitly retain it. Cancelling does not change the save.
6. **Set campaign time** records the umpire’s agreed date/time. It does not move anything or infer elapsed travel. **Record adjudication** adds a narrative decision without a map change. Edit strength/condition/notes after agreeing other outcomes. Retire forces via their status field instead of deleting history.
7. Inspect **Ruling journal** for saved decisions. **KS campaigns** contains create/open/rename/archive and **Export KS JSON** / **Import KS JSON**. An archive is read-only. A duplicate import never replaces an existing save.

Use wheel or buttons to zoom, drag to pan, **Fit sheet** for the full source, and **Find selected force** for detail. Clicking a force opens its record; dragging pans rather than changing its saved position. The module remembers your workspace choice between app starts. Force identities survive transfers and restarts. Module switching and app closure protect unrecorded drafts.

## The two source maps

- **Crimean peninsula:** James Wyld, _The Crimea_, London, **1 May 1855**. Library of Congress Geography and Map Division, item 2015591080. Bundled scan: 8102 × 5814 pixels, obtained via Wikimedia Commons. Includes inset maps with other scales; use the main peninsula panel for campaign placement. [LOC catalogue](https://www.loc.gov/item/2015591080/).
- **Sevastopol / Balaklava:** _Military sketch of the fortress of Sevastopol and adjacent country_, from Richard Airey’s _Opening address_, **1856**, British Library HMNTS 9077.e.15. Bundled scan: 5888 × 4284 pixels, from the British Library Mechanical Curator collection via Commons. It depicts the recent siege; do not label it as published in 1855. [Digital-copy source](https://commons.wikimedia.org/wiki/File:Fortress_of_SEVASTOPOL_and_adjacent_country.jpg).

These are real historical scans, not generated scenery. Source dates, credits and caveats are available in **Map sources**. The detailed sheet’s coloured troop positions are permanently printed reference, separate from your outlined live counters. Maps may include information later than your scenario start date. The source warns that the British Library scan’s contrast/colours were enhanced for machine interpretation. No further image editing was performed. Download URLs and SHA-256 hashes are recorded in [map sources](../assets/maps/crimea/SOURCES.md); notices also ship in LICENSE.

Coordinates are normalized to each complete scan, including margins/insets. The sheets have different scales/orientations and **are not automatically georeferenced** to one another. A transfer means the umpire deliberately chose the destination point; it does not compute a march or survey position. Printed scale bars can support your discussion, but the app does not measure geographical distances yet.

## Scope of this first playable module

This is an **umpire map and ruling journal**, with every force and note visible. It has no turn locks, speed tables, combat engine, automatic losses, morale grades, supply, siege thresholds, victory conditions or official Maurice mechanics. It never converts a descriptive strength into a calculated combat rating. Use it alongside a human-led Free KS discussion and enter agreed results explicitly.

Player-specific fog of war and exports, online multiplayer, an automated AI referee, georeferenced map registration/rulers, custom map import, batch rosters, structured split/merge and multi-force simultaneous rulings are follow-on work. This is not a server-authorized player client or a completed historical Crimean order of battle.

## Storage and backup

- Crimean KS uses **free-ks.sqlite** under the existing app user-data directory. Maurice stays in **campaigns.sqlite**. Switching modules never changes the other module’s active campaign or roster.
- KS database recovery is lazy and independent: a KS storage error is shown within that module, without resetting it or preventing Maurice from opening.
- KS JSON uses `war-of-reason-free-ks`, format version 1, with the full journal. It is distinct from Maurice exports and contains stable source-map IDs rather than external file paths or embedded scan copies. Use a compatible app with the same bundled maps.
- Main-process SQLite writes and event inserts are one transaction. Expected revisions reject stale rulings. Imports validate exact replay from empty creation through every command and reject snapshot tampering, malformed data and duplicate IDs. Export uses native file selection and the shared bounded atomic writer. There is no silent history replacement.
- Export backs up committed state; live form edits and unrecorded map actions are excluded. Map scans are bundled for offline use.

## GitHub Actions reliability fix

The last three failed runs ended at **npm test** because replay-heavy persistence checks exceeded Vitest’s default five-second test limit. The newest run timed out both historical-profile persistence and simultaneous unit-recovery persistence; earlier runs timed out the recovery case. Those two tests now have explicit **30-second** budgets while retaining every rollback/restart/import/replay assertion. Other test timeouts and the two-worker configuration remain unchanged; no retries or skipped assertions were introduced. Local validation is recorded in the running checklist. Remote CI requires these changes to be pushed before it can validate them.

The desktop suite also keeps an exact preload API allowlist, now updated for the six validated KS methods with unexpected-path rejection coverage. The Epic Points test records a viewport screenshot instead of trying to scroll an oversized fixed ledger into a stable screenshot box; its state and ledger assertions are unchanged. The 0.18.0 module validation passed all 324 unit/integration and all 52 desktop checks; the newer deployment-area acceptance is recorded in TASK_CHECKLIST.md.

## Historical deployment area (0.19.0)

1. Open or create a Crimean KS campaign, then open **Deployment Area**.
2. Choose **Review Alma roster & sources**, read the coverage notes, and **Load Alma roster into deployment area**. This loads 120 dated source records off-map. The Ottoman contingent is an unresolved aggregate; detached and uncertain records are labelled.
3. Search by army, organization or regiment. Select a group, individual records or **Select visible**. Choose **Place selected**.
4. Choose either map sheet and click the map. Dashed numbered counters show an unsaved preview. Click elsewhere to reposition it. Changing sheets clears the preview.
5. Choose **Confirm deployment** to transfer the selected records onto the map, or **Cancel map action** to leave them in the tray. Repeat for other formations. Each identity can be deployed once; this operation does not clone forces.
6. Inspect a deployed force to see its original source identity and caveats alongside editable KS observations. Placements are umpire choices, not verified historical positions. Loading the roster does not set the campaign clock.

See [Alma sources and coverage](CRIMEAN_ALMA_OOB_SOURCES.md). This roster does not invent subordinate Ottoman identities or assume all listed detached troops fought at Alma. Existing custom forces are retained; check for conceptual duplicates before deploying similar historical records.
