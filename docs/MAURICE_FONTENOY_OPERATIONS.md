# Maurice / Fontenoy: simultaneous operational play

The application remains a Maurice campaign companion set around Fontenoy and the siege/relief of Tournai in 1745. C3i Waterloo is a reference for operational mechanics, not the campaign setting. The earlier Crossroads/Waterloo-flavoured prototype is retained only for save compatibility and regression tests.

## Create or carry over a Fontenoy setup

- **New campaign** retains the existing Maurice Fontenoy setup and full established campaign workflow.
- **New simultaneous Fontenoy campaign** creates the new operational workflow with the same sourced Maurice roster: French 20 and Allied 18, including Dutch 7 and Anglo-Allied 11. Opening columns, the 1745 opening date, commanders, named locations and Tournai objectives come from the repository's Fontenoy module.
- **Create simultaneous Fontenoy copy**, available on a saved Fontenoy campaign, creates a fresh operational campaign from its saved columns, forces, map locations, configured edges and objectives. The original campaign and its history remain unchanged. Units receive fresh identities and opening readiness; this is a setup copy, not a migration of ongoing battles or aftermath. Separate stacked columns and assign all units before copying.

The new map retains the 12 × 8 Fontenoy schematic's location coordinates and labels, expressed as 96 hexes for the adapted operational rules. It does not assert verified 1745 cartography. No roads/rivers or map scale are invented when the saved setup leaves them unspecified. Six-hour AM/PM phases and travel/command charts are provisional campaign adaptations; their timing is a game convention rather than a historical march-rate claim.

The hex map includes an original generated period backdrop: engraved watercolour fields, Flemish villages and fortifications on parchment, evoking 1745. Transparent hex shading and outlined labels keep operational information readable. **Show period backdrop** switches to the plain map when preferred. Painted lanes, buildings and waterways are decorative; configured hex data and road edges determine play. The asset and generation prompt are in `assets/maps/fontenoy-1745-operational-backdrop-v1.*` and ship locally for offline use.

## Operational controls

Select French or Allied planning in umpire view. Select a column, choose adjacent hexes and save up to three timed movement segments. Fontenoy defaults to off-road/mixed travel because its base setup has no verified road edges. Lock both sides, then review/confirm simultaneous movement. Stand-offs and tactical battles pause required adjudication. Own-side control, influence and HQ command overlays help with routes; HQ names/affiliations are Maurice de Saxe, Cumberland and a generic Dutch command marker.

Optional **Enable preparation rules** adds ordinary screens and simultaneous withdrawals. Review HQ placement, due returns and charts first; deploy/recall screens before withdrawal submissions. Each side locks retreats or empty holds; the umpire previews and confirms their shared resolution. Withdrawn columns hold for the phase, while other columns receive concurrent preparation credit. Screens are allocated from parent columns for tactical play; they are not an automatic addition to the 38-unit Maurice force.

## Maurice tactical bridge

Column inspection shows the mapped Maurice units, type, quality, contingent and assigned commanders. Battle declaration freezes actual committed unit/commander rosters; agreed reinforcements add their own frozen roster and arrival window. Printable HTML/PDF briefs retain those snapshots. The result editor defaults the tactical game to **Maurice**, and outcomes/positions/arrivals remain manually entered. Another tactical game's adjudication can still be used by agreement.

Version **0.9.0** connects explicit per-unit Maurice observations and loss/recovery to simultaneous operations. Commander/Notable changes, Epic Points and shared-phase siege/victory remain subsequent integration work; the earlier Fontenoy workflow retains those existing features. The simultaneous campaign carries Tournai's recorded siege setup and objectives as context and does not substitute Waterloo's communications-path victory conditions.

## Per-unit aftermath and recovery

1. During clear planning in umpire view, expand **Maurice unit recovery → Review and enable unit recovery**. Review the rebuilding strategy, regular/irregular/artillery variant, recovery delay and retired rest. Select the calendar conversion and **Confirm unit recovery policy**. Native confirmation defaults to cancellation. Existing campaigns are not enabled automatically, and earlier battles are not retrospectively changed.
2. One recovery turn initially uses the saved source schedule's days-per-turn: the usual two-day campaign cadence proposes **48 calendar hours**. This is an editable campaign adaptation, not one six-hour AM/PM phase or an official Maurice recovery rule. Delay starts at the **recorded battle end**; checkpoint timing can make actual readiness later than the due time. Changing policies does not recompute existing scheduled dates.
3. Declare/play the tabletop battle as usual. Future battle/reinforcement briefs freeze only ready mapped Maurice units, with their current quality and commanders. Earlier briefs retain their original snapshots.
4. In **Enter manual result**, record each frozen unit as survived, retired, broken or not engaged. **Mark participating units survived** is an explicit convenience for formations marked as participating; it does not mark unused reinforcements. Broken units require the policy's recovery/loss action. Manual-review strategy allows individual choices only within the allowed rebuilding variant. Optional final disruption, unit notes and each side's final Army Morale are stored as observations.
5. Inspect **Unit effects to review**, then review/confirm the manual result. Recording and **Approve campaign effects** do not yet alter units. Resuming simultaneous resolution applies the approved formation and unit consequences together at battle end, with an after-action record and replayable journal event. Cancellation/error preserves the result draft.
6. Broken regular rebuilding changes current quality to **conscript**, preserves opening quality for scenario validation, and marks the unit recovering. Artillery/irregular recovery never assigns regular quality. Lost units remain in the fixed 38-unit historical roster. Retired rest is optional and preserves quality. Tactical disruption and Army Morale never become permanent unit disruption or campaign exhaustion.
7. At a shared checkpoint, **Finish shared phase** processes units due by the resulting campaign clock, once. This can include the normal overnight jump to the next AM phase. Recovered units become ready at their rebuilt quality. A blown formation still needs its separate reviewed legal return placement and at least one ready unit; recovery never silently places or stacks a formation.

The formation-level disposition must agree with the unit review. A formation with no ready units cannot remain on the map as retained/retreated; review it as blown if it has recovering survivors, or eliminated when all units are explicitly lost. Calling a formation eliminated does not invent unit casualties. Existing operational status/return rules and per-unit readiness are distinct records.

The **Recovery queue** shows scheduled/processed dates and current quality. Faction views expose only their own queue and roster; policy editing and full tactical results remain umpire workflows. Confirmed results retain their unit observations and optional Army Morale under **Recorded Maurice unit observations**.

Result corrections restore the precise pre-application unit baseline, replace that battle's recovery schedules and apply a new result revision. They are allowed only while the existing last-effect/unchanged-battle-end guard says no later movement, phase finalization or policy change depends on the result. Earlier journal and result snapshots remain intact. Late corrections require reconciliation rather than silently overwriting campaign history.

Ordinary screens still use manually agreed abstract troop allocation. A screen does not duplicate its parent's 38-unit roster, and a screen-only result cannot silently eliminate named parent units. Structured detachment troop allocation remains on the TODO list.

## Save compatibility

The recovery extension and per-result observations are optional fields in aggregate 3. Older campaigns/snapshots stay unchanged until explicit commands; SQL migration 001 and JSON export format 2 remain in use. Full backups include policies, schedules, result revisions and replayable commands. Import/restart validate those transitions. A fresh operational clone removes aftermath history and restores opening quality/readiness with new identities. Use version 0.9.0 or newer for saves containing this extension.

See [the aligned implementation backlog](MAURICE_OPERATIONAL_TODO.md). Earlier [operational mechanics notes](WATERLOO_PLAY.md) remain useful for timing, deployment and withdrawal details; their Crossroads examples are reference fixtures rather than the intended campaign.
