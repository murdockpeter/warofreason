# The Road to Fontenoy, 1745 — module specification

Current application increment: **0.6.0 / Milestone F**. The setup facts below remain unchanged. Optional [campaign aftermath](CAMPAIGN_AFTERMATH.md) adds separately reviewed regular-to-conscript rebuilding, configured recovery, commander records, manually entered Epic Points/exhaustion and confirmed siege/victory checkpoints. These remain campaign house rules. Opening force validation preserves original quality metadata; later briefs show current quality/readiness. No official tactical rules or card effects are automated. Earlier C–E descriptions below document the boundaries of those increments.

Module `fontenoy` version **0.1.0**, provisional operational ruleset **house_rule_v0.1**. Implemented in application 0.3.0 (Milestone C). This is a reviewed setup workflow, not an operational or tactical engine.

## Evidence and provenance

1. **Published Maurice scenario facts — `official_maurice`:** Sam Mustafa, _Maurice_, chapter 11, printed pp. 94–95; the Fontenoy force table is on printed p. 95 (private reference PDF page 96). The locally supplied, legally obtained PDF was consulted privately. Only factual counts/type/quality and a bibliographic reference are encoded; no source paragraphs, diagrams, cards or artwork are distributed.
2. **Historical context — `historical_scenario`:** the [Royal Collection Trust catalogue, RCIN 729096](https://militarymaps.rct.uk/war-of-the-austrian-succession-1740-8/map-of-the-battle-of-fontenoy-1745-fontenoy-walloon-region-belgium-50deg3403n-03deg2824e-13) identifies the battle date as 11 May 1745, names Saxe and Cumberland, and describes the French positions around Fontenoy and Antoing. Maurice's own historical introduction connects the battle to the siege of Tournai. These support the contextual names; they do not establish the opening column deployments used by this campaign.
3. **Geographical caution:** [Royal Collection Trust's Fontenoy map record](https://militarymaps.rct.uk/war-of-the-austrian-succession-1740-8/map-of-the-battle-of-fontenoy-1745-fontenoy-walloon-region-belgium-50deg3403n-03deg2824e-13) and [Le combat de Leuze, original historical research](https://www.persee.fr/doc/hes_0752-5702_1996_num_15_1_1862) help identify the local setting and Leuze between Tournai and Ath. The remaining town labels identify the intended regional scope, not verified coordinates. No complete 1745 road/river network has been researched. No default road or river edges are asserted.
4. **Campaign proposals — `house_rule_v0.1`:** all operational groupings, opening squares, concealed-column flags, commander attachments, dates/turn schedule, initial siege state/progress and campaign objectives are replaceable player choices. They are not official Maurice campaign mechanics. _Hundred Days_ is a structural inspiration named by the supplied plan; none of its text, art or rules tables are incorporated.

## Scenario-scale forces

Counts below describe game units, not battalions, brigades or corps. Generic display labels avoid claiming independently verified regimental identities. Quality remains a regular-unit classification; artillery has null quality. Tactical Army Morale is not seeded into a persistent exhaustion counter.

| Contingent      | Elite regular infantry | Trained regular infantry | Elite regular cavalry | Trained regular cavalry | Artillery | Total |
| --------------- | ---------------------: | -----------------------: | --------------------: | ----------------------: | --------: | ----: |
| French          |                      3 |                        8 |                     2 |                       4 |         3 |    20 |
| Dutch           |                      1 |                        3 |                     1 |                       1 |         1 |     7 |
| Anglo-Allied    |                      1 |                        6 |                     1 |                       1 |         2 |    11 |
| Allied combined |                      2 |                        9 |                     2 |                       2 |         3 |    18 |

Every unit records its faction UUID, contingent (`french`, `dutch`, `anglo_allied`), type/quality, `official_maurice` provenance and the source reference. Reassigning an Allied unit to a different Allied column preserves its contingent; contingent identity is not inferred from a column name. No tactical card effects or advantages are automated.

## Original schematic map

- 12 columns × 8 rows, with stable square UUIDs independent of grid coordinates. Grid references run A1–L8.
- Eight place labels: Tournai, Fontenoy, Antoing, Leuze, Ath, Soignies, Lille and Valenciennes. Their grid placement is a legibility choice; it is not a georeferenced historical map. The canvas/geometry is original and does not trace or embed source map artwork.
- Kilometres per square starts unspecified. Players can enter an approximate scale; it does not make the schematic a surveyed map and does not change movement costs.
- No default roads/rivers or terrain classifications. Players may add/remove **proposed** roads between orthogonally adjacent cells. Edges store square IDs and house-rule provenance; no movement legality/cost is inferred.
- Changing scale/adjacency preserves units, square IDs and assignments. Later verified geography must preserve/remap these references explicitly. The persisted map is separate from the module's original template.
- Setup map and rosters are an **umpire view**. Campaign Map and Turn Orders now offer the Milestone D faction projections described below; concealed flags mask opposing columns in those views.

## Provisional opening setup

The versioned JSON template holds all opening choices. Defaults are conveniences for review, not historical facts or official limits:

- French columns A/B receive 10 units each, in template order, at Tournai/Lille.
- The Dutch column has 7 units at Ath; the Anglo-Allied column has 11 at Soignies. Players may split or mix Allied contingents among Allied columns without changing unit provenance.
- Saxe and Cumberland are contextual commander names. Default attachments to French A and the Anglo-Allied column are provisional. Names and assignments may change, and players may add/remove commanders. Edited/added commander names are marked house rules; no Notable text, bonuses or effects are supplied.
- Columns may be added/removed/renamed, relocated to an opening square, or marked hidden. Removing a column does not delete its units. No official column capacity, number limit, movement rate or formation compatibility rule is invented here.
- Proposed schedule: 1 May 1745, 11 two-day turns, French first. This covers 1–22 May inclusive. All are editable. This window does not claim to encompass Tournai's complete historical siege or citadel surrender; that choice remains a playtest/research decision.
- Proposed siege target: Tournai; status not started, progress 0. Players can change initial status/progress. No automatic progression, supply rule or threshold is active.
- Proposed goals: French investment of Tournai and Allied relief. They are setup descriptions; no campaign victory evaluator is implemented.

Safety bounds in validators (array sizes, input lengths, schedule lengths and numeric ranges) are application constraints, not Maurice rules.

## Review, save and start

New campaigns seed the complete module as a **draft**. Legacy B drafts remain untouched until the player explicitly chooses **Load Fontenoy setup**. The upgrade preserves campaign ID, title, seed, timestamps and every prior journal snapshot; it appends a `scenario_loaded` event. Legacy drafts with custom entities are rejected rather than overwritten.

Armies/Columns provides **Edit setup**, per-unit friendly-column transfers, opening positions, concealment, commander management, schedule, siege state, map scale and proposed roads. Uncommitted edits support undo/discard and survive screen navigation. **Save setup** commits one validated `setup_changed` event. Incomplete assignments can be saved while preparing, but duplicate/foreign references cannot.

**Start Campaign** requires the exact module composition, all units assigned once, nonempty positioned columns for both sides, valid references and schedule, and explicit acknowledgement of the provisional operational setup and schematic map. Unsaved edits must be committed first. A native confirmation defaults to keeping the campaign in review. Confirming appends `started`, sets turn 1, and uses the chosen opening date/first faction. It does not move units, resolve scouting/combat, progress a siege or evaluate victory. Setup becomes read-only after starting; clone to prepare a different setup.

## Persistence compatibility

Configured campaigns use aggregate schema **2** and JSON export format **2**. Historical schema-1 snapshots remain readable and unchanged inside mixed-version journals. Format-1 JSON imports remain supported. Exports use format 2; version mismatches are rejected. SQLite's table layout remains migration 001 because its versioned aggregate documents require no destructive table migration. No existing database is reset or silently re-seeded.

Cloning remaps square/entity/objective UUIDs, siege targets and road/river references, preserves module data/settings, and resets lifecycle metadata to a draft with no current day. Export/import and restart retain the reviewed setup and source attribution.

## Operational increment (Milestone D)

Operational play is explicitly enabled after Start Campaign, retaining the same campaign identity and history. The optional aggregate-v2 extension stores versioned movement rules, phase, issued paths and engagement candidates. Defaults in `src/data/operations.v0.1.json` are provisional: 3 movement points per faction phase, road step 1, off-road step 2, configured river crossing +1; player-adjustable costs and blocked squares. Roads/river crossings must be configured independently of the decorative generated image.

Both factions act sequentially before a day advance. Orders are saved before positions change; resolution is separately confirmed. Friendly stacking is allowed. Hostile destination contact stops the moving column before the occupied square, records deterministic candidates and holds participants for the tabletop workflow. Opposing columns already co-located in setup produce candidates when operational play is enabled. No battle, pursuit, siege or victory outcome is automated. At the configured deadline, the operational window ends without declaring a winner. See design decisions for the provisional rule rationale and tests.

Campaign Map/Turn Orders offer a neutral umpire view and faction projections. Opposing composition/commanders/orders are redacted; hidden opposing columns are omitted. Faction exports exclude private snapshots/history and are not campaign backups. Full backup exports remain complete. Views are for a trusted shared local desktop, not authenticated player access.

## Scouting and tabletop increment (Milestone E)

`house_rule_v0.1/tabletop-1` adds umpire-adjudicated scouting, dated contact snapshots and configurable expiry/eligibility/ranges, plus candidate-based declarations and frozen shared battle briefs. An identified contact can release its observed roster/commanders; expired intelligence does not track current concealed forces. Opposing orders and raw private snapshots remain excluded from faction views/exports.

The three-step declaration records participants, entry edges, manually agreed reinforcement instructions, objectives and terrain notes. No automatic conversion from decorative geography or interpretation of tactical cards occurs. Offline HTML and printable PDF briefs list original scenario-scale unit facts and players' notes. Manual decisive/marginal/draw results, per-unit observations and commander changes require confirmation and are preserved through restart/full export/import. No loss, recovery, quality, permanent disruption, siege or victory effect is applied until F. See [TABLETOP_WORKFLOW.md](TABLETOP_WORKFLOW.md).
