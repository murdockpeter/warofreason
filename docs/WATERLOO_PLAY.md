# Play the simultaneous Crossroads scenario

This page records the earlier reference prototype. For the intended Maurice / Fontenoy campaign, use [the current operational guide](MAURICE_FONTENOY_OPERATIONS.md). Crossroads examples remain only to explain the generic adapted mechanics and preserve earlier saves/tests.

The app includes a playable original hex scenario using the Waterloo-inspired operational profile. Version 0.8.0 adds optional ordinary screening detachments, simultaneous withdrawals and own-side zone/command overlays. It runs alongside existing Fontenoy campaigns. Historical Waterloo scenarios remain separate work. All movement/timing defaults are original adaptations; use any external tactical game for battles.

## Prepare screens and withdrawals

Existing Crossroads campaigns can select **Enable preparation rules** in umpire view before saving movement orders. This adds one reserve screening detachment per existing corps and a pre-movement preparation step. Earlier snapshots stay unchanged. Campaigns without this opt-in keep their previous movement workflow.

1. Review weather/charts, HQ modes/locations and due blown returns first. Once a screen is placed or withdrawals are submitted, these earlier preparation stages close. An HQ whose army has no on-map units can use an empty hex within three hexes of a recorded scenario road, even inside enemy zones.
2. Open **Screening detachments**. Each HQ can place one associated screen per phase. Trace from its HQ within range (Normal mode can double a wholly road trace) or from its on-map parent within four hexes. Traces avoid enemy control/influence; the placement hex avoids every friendly/enemy unit's control/influence. HQs can place screens of lost parent corps. Screens remain stationary and project adjacent control, not corps influence.
3. **Recall [screen]** returns it to reserve from any position, including enemy zones. It becomes available next phase; recalling does not refund a used HQ placement. At the tabletop, allocate actual screen troops from their parent corps and avoid counting them twice. A battle result can explicitly recall or eliminate the screen.
4. For a corps in enemy control, choose **Plan withdrawal**, nominate the enemy and select three retreat steps. Each step must be adjacent, passable, strictly farther from that enemy and outside all enemy control. Friendly screens/HQs may be crossed; corps block passage. Set a unique friendly priority if retreats compete for a hex. Use **No legal retreat — accept blown** only for a trapped corps; the application verifies that the current board offers no legal three-step route.
5. Save and **Lock French withdrawals** / **Lock Coalition withdrawals** independently. Empty submissions hold. In umpire view, review both sides' projected result, then **Confirm simultaneous withdrawals**. Native cancellation keeps the saved submissions. Before resolution the umpire can reopen both; confirmed withdrawals cannot be reopened.
6. Withdrawals resolve in three shared 20-minute steps. Conflicting opponents cannot gain priority from save/array order. A friendly contender with lower saved priority takes the destination; blocked losers become blown. Occupied corps hexes cannot be entered during the same step that they are vacated. All withdrawn corps hold for the rest of the phase. Other corps prepare concurrently: after a 60-minute withdrawal stage, they do not pay another 30 minutes before their first march. An empty withdrawal stage costs no time.

Use **Map overlay** for your selected side's control, corps influence or HQ command range. Side views show only their own HQ markers/ratings and withdrawal orders; umpire view can inspect either side. Organization precedes withdrawal, so an enemy retreat does not grant holding infantry another formation change in the same phase. The next phase resets withdrawal submissions and HQ placement allowances.

## Open and plan

1. Restart the development app or launch the rebuilt Windows executable. On Dashboard choose **New simultaneous campaign**, then **Open simultaneous map**. The original scenario has French infantry and cavalry against Anglo-Allied infantry and a Prussian reserve.
2. In umpire view choose **Planning side**, or select a faction with **Map view**. Inspect a friendly corps by selecting its counter. Click adjacent hexes to prepare a route. **Undo route step** or **Cancel route** revises the unsaved draft.
3. Choose connected roads or off-road/mixed travel and a departure time. **Save movement segment** persists the order without moving troops. Select the corps again to add another segment from its previous planned endpoint. A corps has at most three segments, each limited to its allowance and 120 minutes. Unordered corps hold.
4. **Lock French orders**, switch planning side, then **Lock Coalition orders**. Each side's lock is saved independently and survives restart. Neither side moves first. The umpire can reopen both submissions before resolution; after movement commits, the recorded history stays intact.

Both sides use the same phase clock: AM 06:00–12:00 and PM 12:00–18:00. Initial preparation defaults to 30 minutes. Road-only Advance infantry uses 15 minutes/hex, fresh cavalry 10; terrain, bridges, weather, HQ range, occupancy and influence can slow or stop them. Charts and HQ mode/placement controls are in collapsed panels. Configure charts and reposition HQs before saving movement orders.

## Resolve and take a battle to the table

1. In umpire view choose **Resolve simultaneous movement** and confirm. Equal-time events resolve together. Corps wait behind friendly occupancy; opponents cannot exchange hexes or claim a contested destination by saving first. Infantry entering enemy influence stops and may need the next phase to close to battle.
2. At a contact, choose **Record stand-off** to hold those forces, or **Declare tactical battle**. The shared cursor pauses for required adjudication. No battle dice are rolled by the app.
3. Open **Nearby potential reinforcements**. Each eligible corps has earliest/likely/latest planning times, a route/entry edge and optional tactical-turn conversion. Adjust the entry edge, or set an agreed arrival override with a reason if your tactical game needs a different schedule. **Commit [corps]** reserves the whole corps and freezes its estimate or override into the brief. An estimate is conditional on a clear route, not a guarantee that it can pass an enemy. Candidate availability is limited to feasible approaches in the current phase.
4. **Save battle PDF** or **Save battle HTML** produces a shared printable brief with both sides' frozen initial forces and committed later arrivals. Use the game's own tactical rules and agree how the campaign's terrain, command and readiness information translate. No tactical ruleset adapter is required.
5. **Enter manual result** records the actual game, outcome, duration, force dispositions, arrivals, cavalry exhaustion and post-battle hexes. Unused reinforcements remain explicit. Surviving corps require distinct valid hexes; losses leave the map. Enter actual reinforcement arrival no earlier than the committed feasible window. The app does not derive losses or retreats from the winner.
6. **Review and confirm manual result** saves the record while leaving forces unchanged. Cancel retains the draft. **Approve campaign effects**, then **Resolve simultaneous movement** again, applies the reviewed effects at the recorded battle end and resumes unrelated movement. A later conflict with the proposed post-battle positions must be reviewed rather than silently stacked.
7. **Edit manual result** creates a new revision. Already-applied effects can be compensated while no later movement/phase depends on them. Otherwise the command explains that dependent events require reconciliation. Earlier records remain in the journal.

Late battle results may extend beyond the phase boundary. The first version waits for their reviewed conclusion before opening the next planning window; its clock never rewinds and affected troops cannot gain another march during the elapsed interval. It does not yet run a separate concurrent next-phase planning session while a tabletop battle is unresolved.

## Finish, return and preserve

**Finish shared phase** becomes available after required contacts and battle reviews. It opens the next AM/PM phase, resets submissions and updates infantry formation/cavalry recovery from current enemy zones. Due blown corps are listed under **Headquarters and due returns**. The opponent reviews up to two returns per side to empty hexes next to their army's HQ; when more than two are due, the nonselected corps are eliminated. Corps without a legal placement stay off-map for later review.

Dashboard still provides rename, archive, full JSON backup/import and campaign switching. A Crossroads clone starts an independent copy of the original opening scenario with fresh identities; it is not a fork of the current battle state. Existing Fontenoy clones retain their previous behavior. Saved actions use the same transactional SQLite/journal boundary; private reference PDFs are not included in the app.

Faction views withhold opposing rosters/orders and shared battle adjudication panels. They are local pass-and-play filters, not authentication: the shared desktop can select umpire view and full backups contain both sides' information.

## Remaining adaptation work

The historical June 15–18 / June 16–18 setups, off-map scenario entry queues, Grand Battery/Old Guard/Hill special rules, final-day exception/scenario VP scoring, arbitrary scenario/roster editors and full dependency reconciliation remain open. See [the implementation backlog](WATERLOO_TODO.md). The fuller [design specification](WATERLOO_MOVEMENT_SPEC.md) remains a target; this guide describes available controls.
