# Simultaneous campaign movement and battle timing v0.1

Drafted 2026-10-25. This is a concrete specification for implementation and playtesting, not implemented gameplay. The user has requested simultaneous movement, external tactical games, editable manual results, likely reinforcement timing and original charts. The numerical defaults and detailed policies below are proposed original adaptation rules, not user-approved historical values or a reproduction of the published player aid.

## 1. Profile and scope

Use operational profile `waterloo_simultaneous_v0.1`, chart set `waterloo_original_charts_v0.1`, and a separate scenario identifier/version. A scenario supplies its map, armies, forces, calendar and exceptions. A tactical game supplies no required movement or combat engine: a neutral battle record accepts its results manually. A named adapter may later supply extra optional fields.

Keep the current Fontenoy aggregate and replay rules intact. A new discriminated aggregate must represent this profile rather than fitting hexes and shared phases into Fontenoy's fixed square/unit counts. Shared infrastructure includes UUIDs, revisions, transactional events, SQLite, saved drafts, projections and escaped printable exports. Do not automatically convert existing started campaigns.

The first implementation uses an original small hex scenario. Full Waterloo scenario data follows after the shared-clock workflow works. No tactical dice, combat results table, mandatory tactical morale scale or automatic winner-to-loss conversion belongs in this profile.

## 2. Clock and original movement charts

All times are campaign-local, independent of the user's computer timezone. Store a campaign date and integer minute offset, including across midnight, rather than using wall-clock timestamps as simulated time. Audit timestamps remain actual timestamps.

| Setting                          | Default                                                | Meaning                                                      |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Hex scale                        | 1 mile                                                 | Nominal campaign distance; geometry is axial hex coordinates |
| AM                               | 06:00–12:00                                            | 360 minutes                                                  |
| PM                               | 12:00–18:00                                            | 360 minutes                                                  |
| Overnight                        | 18:00–06:00                                            | No ordinary marching; reviewed ongoing battles may continue  |
| Resolution tick                  | 5 minutes                                              | Round each edge and explicit delay upward once               |
| Activation duration              | 120 minutes                                            | Maximum movement time in one declared segment                |
| Segments per corps per phase     | 3                                                      | At most 360 minutes before preparation/delays                |
| First departure preparation      | 30 minutes                                             | Once per phase for a corps ordered to move                   |
| Hold                             | Entire phase unless another timed segment is specified | No movement and no preparation cost                          |
| Default tactical battle duration | 240 minutes                                            | Editable planning assumption, not an imposed battle result   |
| Tactical turn length             | Unspecified                                            | Show minutes until players supply a conversion               |

AM/PM boundaries are defaults for the first playable scenario. Historical scenarios may change them. Returning blown units is scheduled by AM/PM slot number, not by adding 24 hours: overnight means two slots do not always span exactly 24 clock hours.

### 2.1 Corps allowances and travel

| Corps state       | Allowance per segment | Clear off-road minutes/hex | Connected-road minutes/hex |
| ----------------- | --------------------- | -------------------------- | -------------------------- |
| Infantry Advance  | 4                     | 30                         | 15                         |
| Infantry Battle   | 1                     | 120                        | 120; no doubling           |
| Cavalry Fresh     | 6                     | 20                         | 10                         |
| Cavalry Exhausted | 4                     | 30                         | 15                         |

Allowances retain the published movement-state distinction. Their conversion to minutes is original: divide 120 by the allowance, or by twice the allowance for eligible road-only segments. A declared segment is either entirely on connected roads or off-road-rated throughout. A mixed route uses off-road rates even on its road edges. Separate segments may change travel mode; they cannot exceed the three-segment limit.

An activation segment has a start constraint, ordered path and travel mode. Both its printed allowance (doubled for eligible road-only travel) and 120-minute window are ceilings. Terrain or delay can prevent using the full allowance. Preparation occurs before the first segment's window; all later queue/edge delays count inside the active segment's window. Once a window expires, hold until the next predeclared segment; discard untravelled edges of the expired segment. A later segment starts only if its declared origin matches the actual location, otherwise cancel it and explain why. No automatic reroute or merging of unused allowances.

The last segment may have less than 120 minutes before phase end. Never begin an edge that cannot finish before its segment or phase deadline. Ordinary movement finishes on a hex, not halfway across an edge. Unused time/allowance does not carry to the next phase. A normal Advance infantry corps can therefore march 22 clear-road hexes in a phase with 30 minutes of preparation, or 11 clear off-road hexes, provided command, occupancy and influence allow it. These are ceilings for tuning, not promised daily march distances.

| Terrain or edge            | Original movement effect                                             | Control/influence effect                    |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| Clear                      | ×1                                                                   | Normal                                      |
| Town/chateau               | ×1                                                                   | Normal; describe position in tactical brief |
| Woods                      | ×2 off-road                                                          | Normal                                      |
| Rough/hill                 | ×1.5 off-road                                                        | Normal                                      |
| Connected road             | Use road rate; ignore woods/rough multiplier                         | Normal                                      |
| Minor river without bridge | +30 minutes after terrain multiplier                                 | Normal                                      |
| Bridged river              | +15 minutes after road/terrain cost; one traversing corps per bridge | Zones can propagate across the bridge       |
| Major river without bridge | Impassable                                                           | Blocks propagation                          |
| Water/closed terrain       | Impassable                                                           | No land-zone propagation through it         |

Use destination terrain for an edge. Round the total edge cost to the next five minutes, not each intermediate factor. An edge may have one river-crossing category only. Terrain/chart edits take effect next phase and never change replayed travel costs.

Zone propagation uses passable land adjacency: one edge for control, up to two for corps influence. A major river blocks an adjacency unless bridged. Control does not propagate through another hex; influence may pass through units and a legal bridge. Detachments project control only. Terrain other than blocked water/major rivers does not extend zone distance.

### 2.2 Weather and mobilization

| Condition                                               | Original timing effect                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Dry                                                     | Use base chart                                                                               |
| Rain, road segment                                      | Multiply travel portion by 1.5; fixed bridge/river surcharge unchanged                       |
| Rain, first attempted off-road departure                | Infantry changes to Battle; cavalry changes to Exhausted before costing the edge             |
| Soft ground without current rain                        | Off-road travel portion ×1.25; fixed crossing surcharge unchanged                            |
| New discretionary reinforcement order                   | 30-minute message/assembly delay from the order time, instead of a second preparation charge |
| Force already marching on a committed reinforcing route | No new preparation/assembly charge                                                           |
| Reinforcement first available later                     | Cannot prepare or enter before its availability time                                         |

Weather is known before submissions lock. For historical June 17 slots, record the published d6 rain decision manually or use a main-generated audited die. Rain and soft-ground multipliers do not stack; rain sets soft ground for the following slot, with dry soft ground lasting that slot unless refreshed. Tactical effects are briefing information for the external game.

Preparation and message/assembly are alternatives for a departure, never cumulative charges for the same order. Track completed preparation explicitly: a force preparing at the end of one slot for a declared next-slot departure receives credit in that next slot rather than paying again. An already moving corps diverted by a new discretionary order still waits the message delay, but does not pay an additional phase preparation charge.

### 2.3 HQs, stacking and recovery charts

These are complete original starting values where the supplied source lacks a full usable chart. Stars are contextual ratings for briefing, not automatic external-game bonuses.

| HQ         | Normal range | Battle range | Battle stars |
| ---------- | ------------ | ------------ | ------------ |
| Napoleon   | 8            | 3            | 1            |
| Ney        | 6            | 2            | 1            |
| Grouchy    | 6            | 2            | 1            |
| Wellington | 10           | 3            | 2            |
| Blücher    | 8            | 3            | 1            |

Ordinary corps command range is hex distance, ignoring terrain, zones and pieces. Each segment names one associated HQ. Every step outside range must strictly reduce distance; once within range it cannot leave it during that segment. A new segment may name another legal French HQ. Anglo-Allied and Prussian units cannot exchange HQ affiliation. Only detachment placement tracing gains the Normal-mode road-range doubling in this adaptation, avoiding ambiguous ordinary movement tracing.

Allow one corps, one friendly detachment and one HQ per hex; HQ placement itself still obeys its placement restrictions. Different categories may coexist. Enemy corps never share a hex; enemy detachments cannot coexist with a friendly corps. A previously placed enemy HQ alone neither blocks nor participates in contact. A hex containing any piece or marker is not empty for a rule requiring an empty hex. Stationary detachments do not consume corps marching time.

Retain A–G placement/recall/formation procedures described in the review, performed from shared snapshots for each step. Resolve cross-side incompatible placements by holding both proposals for umpire relocation, never first-submission priority. An eligible blown corps without a legal return hex remains off-map until the next slot; it still competes under that slot's two-corps cap. If more than two are eligible, the opponent chooses up to two and the rest are eliminated. Final-day blows are eliminated. These placement-failure details are original policy.

For Hill, count deployed plus permanently eliminated Anglo-Allied detachments in both directions: three or more selects the lower rating; fewer selects the higher rating. A recalled available detachment does not count. Grand Battery/Old Guard continue to compete for Napoleon's one placement. Their actual tactical use, exhaustion, recall or loss is recorded explicitly.

## 3. Shared phase and private orders

Use lifecycle `preparation → planning → locked → resolving/awaiting-adjudication → checkpoint → complete`. Submission readiness is per side; selected UI side grants no earlier time slot.

1. Finish weather, command/organization steps and withdrawal adjudication. Save one phase-start snapshot.
2. Each side writes timed segments against that snapshot. Missing orders hold. Validate visible route facts without revealing a hidden obstruction through private previews; authoritative validation at resolution may stop an apparently legal route.
3. Save/lock each side independently. Their orders remain private. A submission references the phase-start revision, while the lock command also checks the current aggregate revision; the first lock does not invalidate the other's snapshot.
4. Before the other side locks, a side may reopen without seeing opposition orders. After both lock, reopening requires one recorded umpire reset of both submissions. No unilateral edit after disclosure.
5. Resolve both from the same snapshot and chart version. No alternating-side movement, first-player benefit or pass-die tail remains. The clock and three-segment limit replace unlimited activation/pass friction.
6. Commit progress to the next adjudication barrier or phase end. A battle/contact may require a reviewed command before dependent events resume. Preserve locked orders and the event cursor across restarts.
7. After all required dispositions/results/aftermath are reviewed, finalize once. Advance to the next slot; process scheduled return/recovery at the appropriate next preparation step.

For the historical June 15 congestion rules, replace die-counted actions with a recorded pre-submission segment budget per side: AM French d6+3, Coalition only Zeithen; PM French d6 plus available off-map French corps, Prussian d6, Anglo-Allied zero. A corps segment costs one budget unit; map entry counts as a segment. These are adaptation budgets, not a claim that a published unit/move distinction is identical. Draws are fixed before planning, stored with the phase, and cannot be rerolled by reopening.

### 3.1 Simultaneous withdrawal

Withdrawal is a separate shared pre-movement submission for corps starting in enemy control. Allow one declaration per eligible corps, without the published pass tail. Each proposes a three-hex retreat path. Resolve all declarations together, using 20 minutes per hex, beginning at the slot opening. Every hex must increase distance from the nominated hostile corps and avoid corps/enemy control. A contact with multiple hostiles must avoid their control too.

Version 0.8.0 makes this deterministic: an opposing destination conflict or blocked retreat makes the withdrawing corps blown. Same-side contenders use unique saved priorities; the lower value wins, and blocked losers become blown. No corps may enter a corps hex during the same step it is vacated. Friendly screens/HQs can be crossed. A trapped corps may explicitly accept blown after a search verifies no legal three-step retreat on the current board. Organization runs before withdrawal; holding infantry receive no second formation change when an enemy retreats. A corps that withdraws cannot march or be ordered as a reinforcement in that phase, even after completing its 60-minute withdrawal. Other corps prepare concurrently, so their first march can begin at minute 60 without another preparation charge. An empty withdrawal stage costs no time. These are original adaptation choices replacing the published alternating/pass tail.

## 4. Collision and contact semantics

Resolve in five-minute ticks. Use the same pre-tick state for all proposals; complete existing traversals, collect new requests, arbitrate them together, and update zones/contact as a batch. Every edge has a departure, duration and completion time. While traversing, a corps retains its origin occupancy and reserves its edge/destination; it does not project zones from a destination before arriving. Once the edge completes, release origin and reservations together. A corps may continue its own next edge immediately at its completion tick; a following corps must wait until the next tick to use the vacated origin. This conservative abstraction intentionally prevents corps from passing through one another.

| Situation                                         | Policy                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Friendly destination occupied or reserved         | Wait in origin; retry next tick if time remains                                                                                      |
| Friendly corps vacates this tick                  | Following corps can request that hex on the next tick                                                                                |
| Friendly swap/cycle                               | No simultaneous exchange; wait until a legal empty hex becomes available                                                             |
| Friendly simultaneous requests for one hex/bridge | Use the unique side-authored corps priority; scenario entry queues take precedence at their own entry hex; no implicit ID priority   |
| Opposing requests for same empty hex at same tick | Neither departs; create meeting contact at their origins with disputed destination recorded                                          |
| Opposing overlapping requests on same edge        | Stop/reject new traversal and create contact; preserve or restore the in-flight corps to its reserved origin and charge elapsed time |
| Enemy destination occupied or reserved            | Stop at origin and create contact; do not enter it                                                                                   |
| Enemy detachment at destination                   | Stop adjacent; screen contact can be fought, bypassed legally or manually settled                                                    |
| Unrelated edges cross visually on artwork         | No conflict unless they share an actual hex/edge/bridge resource                                                                     |

Different requests made at different times preserve the earlier legal reservation. Equal-time requests are arbitrated as a batch. The map may depict travel progress, but all contact approach positions remain legal hexes. Store elapsed failed-travel time so an interrupted traversal cannot become free movement.

After arrivals, recompute zones. If a new enemy zone intersects an in-flight route, cancel it back to its reserved origin at that tick, charge elapsed time and apply the relevant stopping rule; record the triggering enemy arrival. If origin positions also become adjacent, record that contact. This defines dynamic-zone handling without teleporting to the destination or ignoring new enemies.

Infantry crossing from outside enemy influence to inside stops ordinary movement for the rest of the phase. It stays in Advance unless enemy control applies. Infantry starting the phase inside influence may approach until it enters control. Cavalry uses the same influence rule only against enemy cavalry corps. Any corps entering control stops; infantry flips to Battle. Infantry starting in control holds unless it withdrew; cavalry starting in enemy cavalry control holds. Cavalry in infantry/detachment control may make one escape step to an empty hex outside all enemy control, then continue if otherwise eligible. New control reaching a stationary corps also stops its remaining ordinary movement.

### 4.1 Encounter grouping and optional battles

An influence stop at distance two is a screen/contact report, not an automatic battle. Adjacency/control, hostile contention and a declared approach to an existing battle create encounter candidates. Build a graph of direct hostile contacts and shared committed forces at the same event time; connected components form encounter groups. Merge a new contact into an existing unresolved group when it shares a force. Radius alone does not merge separate fights.

The umpire records battle, stand-off, legal withdrawal, or an agreed displacement/recall with reason. An optional attack requires a corps and a hostile adjacent unit; detachments alone do not initiate. A contact reached before adjacency requires an explicit reviewed approach and start time to become a battle. Such an approach reserves its route and consumes time using the same travel chart; it cannot cross another occupied hex.

One external battle represents all agreed assaults within its declared time interval. No same-phase rematch by a force in that battle: once settled it holds until the next slot. This replaces repeated printed attack opportunities, avoids incompatible tabletop schedules and is a deliberate adaptation. Supporting corps are not silently participants: the brief records which forces actually commit, initial forces and later arrivals.

On the first unresolved encounter, commit the global cursor to that timestamp and pause further publication. Adjudicate, reserve a battle interval and reinforcement instructions, then resume unrelated orders up to the next dependency. The engine may calculate forecasts beyond the cursor but labels them provisional. It cannot finalize a phase through an unrecorded result, or calculate routes through a battle as if its winner were known.

Battles crossing a slot boundary retain forces and occupied approach hexes until their recorded end. Subsequent slots cannot use these forces before then. If the actual end exceeds the estimate, invalidate dependent uncommitted forecasts and extend reservations before resuming; require dependency review if any affected event has already committed.

## 5. Reinforcement estimates and tactical entries

Search all own uncommitted corps reachable before the battle's planned end, not merely units within a fixed radius. Show potential arrivals to the umpire and appropriate own-side view. Shared briefs show only released commitments; enemy estimates must use authorized intelligence snapshots, never hidden live orders.

Classify candidates as initial force, potential, ordered, committed, delayed, arrived, cancelled or unavailable. Initial forces are available at battle start. Others require a departure/availability time, legal route and approach edge. An estimate does not itself change orders or reserve troops.

Orders locked for ordinary movement cannot be secretly rewritten when a battle appears. Following an already declared reinforcement branch costs no new preparation. A new umpire-approved diversion is journaled as an order amendment with a default 30-minute message/assembly delay from the current committed cursor, and becomes visible only as permitted by intelligence. Do not reset elapsed time or give opponents a new general planning round.

Compute all arrival timestamps on the absolute campaign clock:

`arrival = max(availableAt, orderedDepartureAt, cursorAt) + applicablePreparation + legalTravel + knownQueueDelay`

For a corps already marching, use its current traversal/remaining route and zero additional preparation. For a future departure forecast, `cursorAt` is the forecast's starting cursor, not the end of a later speculative resolution. The timestamp when it reaches an agreed unblocked entry edge is tactical availability; movement inside the tabletop battlefield is handled by the external game.

`delayAfterBattleStart = max(0, arrival − battleStart)`

Track segment time, remaining allowance and phase daylight along the route. If a next edge cannot finish before phase end, wait at the current hex; resume only under a committed next-slot continuation. Without that continuation show “next-phase orders required”, with a conditional estimate rather than a firm arrival. No implied overnight march. No ETA through hostile control unless a separately reviewed battle approach makes it legal. Scenario entry availability, entry queues and protected map entry happen before calculating travel to a battle.

### 5.1 Original uncertainty chart

These windows are planning bounds, not statistical confidence intervals. Keep the committed movement timeline deterministic; uncertainty summarizes assumptions for tactical players and can be manually adjudicated.

| Estimate              | Assembly for a new discretionary order | Travel                | Known queues   | Unknown delay |
| --------------------- | -------------------------------------- | --------------------- | -------------- | ------------- |
| Earliest              | 30 min                                 | Base route time       | Add known time | 0             |
| Likely                | 30 min                                 | Base route time       | Add known time | 15 min        |
| Latest planning bound | 45 min                                 | Base route time ×1.25 | Add known time | 30 min        |

For already committed marching use zero assembly in all three columns. Round the final travel bound upward to five minutes. Explicit uncertainty may be set to zero for an umpire-fixed arrival. Unknown hostile interference can make arrival unavailable: never present the latest bound as a guarantee. Display conditions such as “assuming bridge remains clear” and mark a route awaiting contact review as blocked/pending, not merely late.

After both sides' movement is adjudicated, a deterministic route time remains an estimate of tactical availability until confirmed by the umpire. The likely/latest columns do not create extra hidden movement rolls.

If tactical turns have length `m` minutes, display entry at the start of turn `1 + ceil(delayAfterBattleStart / m)`. Turn 1 starts at elapsed 0; a 10-minute-turn arrival at +95 minutes enters at turn 11 (+100), and +0 enters at turn 1. Show original minutes alongside the rounded turn; players may override the agreed entry turn with a reason.

Committing a reinforcement reserves the corps from the diversion/declared departure until the battle ends or the commitment is explicitly released. The first version reserves entire corps; partial detachments/tactical-unit allocations require an explicit later split/mapping feature. Reject overlapping battles, incompatible routes, expired segments, duplicate forces and deployments from unavailable rosters. An unused reinforcement retains its actual campaign position, spent time and readiness; it cannot snap back or march the same interval again.

## 6. Manual result and campaign effects

A battle revision stores the optional tactical game name/version, start/end times, agreed/actual arrivals, participating roster identities, free outcome label and notes. Optional external metrics never become mandatory cross-game fields. Separate campaign decisions specify each committed force's retained/retreated/blown/eliminated status, actual position, readiness and detachment disposition. A later arrival that did not fight must be recorded as unused or released.

Default retreat is three hexes strictly farther from the nominated victor, avoiding corps/enemy control; if impossible, propose blown. Use 20 minutes per retreat hex after battle end and keep the force unavailable during that retreat. Default pursuit occupies the defender's vacated hex if no other enemy control prevents it; use normal edge travel time after battle end. The first version ends further ordinary marching for both victor and retreating force for that slot. Neither winner nor defeated status applies this automatically: preview and confirm actual effects, with a reason for overrides.

Normal blown return is two slot indices later; final-day blows become elimination. Detachment recall/elimination and corps-versus-detachment protections follow the review unless explicitly overridden. Only actual recorded cavalry participation may exhaust it. No automatic conscript downgrade, Maurice morale, Epic Points or siege progression.

Drafts are freely editable. Confirmation adds a result revision. Before aftermath, a correction supersedes the active revision. After aftermath, the correction must preview a compensating delta against the applied revision; require unchanged dependent state, otherwise block application and list dependent events for explicit reconciliation. Version 0.1 does not automatically rewrite later movement/battles. Editing descriptive notes can supersede notes without changing campaign effects. Record original and new values, actor, reason and applied-result revision. Never apply a full loss set twice.

| Campaign scoring datum                              | Default           |
| --------------------------------------------------- | ----------------- |
| Ordinary corps eliminated                           | 3 VP to opponent  |
| Ordinary detachment eliminated                      | 1 VP to opponent  |
| Imperial Guard infantry or cavalry corps eliminated | 5 VP to Coalition |
| Old Guard or Grand Battery detachment eliminated    | 2 VP to Coalition |
| Valid French end-of-scenario communications path    | 5 VP to French    |
| Equal VP                                            | Coalition victory |
| Winning margin below 9                              | Tactical level    |
| Winning margin 9–11                                 | Campaign level    |
| Winning margin 12+                                  | Strategic level   |

The communications path uses passable hex adjacency from scenario-defined southern to northern endpoints and excludes Coalition units/control; it is not road-only. Empty enemy HQ markers do not count as units. Score once at the final checkpoint using final effective dispositions and preserve the scoring evidence.

## 7. Worked acceptance examples

These are designed paper checks, not executed application tests. Times use the charts above. Coordinates use axial neighbours `(q±1,r)`, `(q,r±1)`, `(q+1,r−1)`, `(q−1,r+1)`.

### A. Independent marches use the same clock

At 06:00 two opposing Advance infantry corps start far enough apart that their zones cannot interact. Both prepare until 06:30 and march four clear-road hexes, arriving 07:30. Neither waits for the other side to finish. Their segment limit is eight road hexes/120 minutes, so another four road hexes in that declared segment could finish at 08:30. An empty order holds; locking one side moves neither.

### B. Meeting and crossing contacts

Fresh cavalry of opposing sides at `(−1,0)` and `(1,0)` are already within enemy cavalry influence but outside control at phase start. Both declare a move to empty `(0,0)` at 06:30. Equal-time destination requests produce a meeting contact; both remain in their origins and no unit occupies `(0,0)`. It does not matter which submission was saved first.

For the edge-crossing arbiter, opposing simultaneous A→B and B→A requests never swap the pieces; the mechanical result is contact at A/B. An ordinary order from adjacent hostile infantry would already be illegal under control rules, so this lower-level collision case must not be used to bypass eligibility. It can apply to reviewed approach/withdrawal exceptions or dynamically changed occupancy.

### C. Friendly bridge congestion

Two friendly Advance infantry corps approach one bridge in column. Corps A is at the near bank and has a legal departure request at 08:00, with a 15-minute road edge plus 15-minute bridge surcharge, arriving at the far bank at 08:30. Corps B is one road hex behind the near bank and is ready at 08:05 but cannot enter A's reserved origin. A starts its next road edge immediately at 08:30 and clears the far bank at 08:45. B can start approaching the near bank at 08:35, arrives 08:50 and immediately crosses by 09:20, provided its segment still has time. B waited 30 minutes before beginning its 15-minute approach and 30-minute crossing. A tied request for a bridge approach uses the side's declared priority, not array order. A blocked 120-minute segment expires even while queued.

### D. Late reinforcement and tactical turn conversion

A battle begins at 09:00 and is expected to end at 13:00. At 09:00 an eligible Advance infantry corps is four clear-road hexes away on a legal unblocked approach. The umpire orders a diversion: preparation/message delay is 30 minutes and travel is 4 × 15 = 60 minutes. Earliest arrival is 10:30 (+90), likely is 10:45 (+105), latest planning bound is 11:30 (+150 = 45 assembly +75 travel +30 uncertainty). With ten-minute tactical turns these display as turns 10, 12 and 16. The brief states that the route must remain clear. Committing reserves the corps until battle release; another battle cannot use it concurrently.

### E. Nearby does not mean available

An Exhausted cavalry corps two hexes away is in enemy cavalry control. It is unavailable for ordinary reinforcement marching. A second corps reaching a hostile-held bridge has a pending blocking encounter and no reliable arrival window beyond that bridge. A third finishes a battle at 11:50 and is held for the slot: no fresh same-phase reinforcement order may spend its remaining ten minutes. An agreed next-slot continuation can produce a conditional later ETA.

### F. AM/PM boundaries and scenario entry

An Advance infantry reinforcement becomes available at 11:30 at a clear entry hex. It prepares until 12:00 and cannot enter during AM. PM entry begins at 12:00 under a committed continuation, without charging the completed assembly twice. If entry would be blocked by enemy units/control, apply the reviewed protected-entry retreat/recall before admitting it; if that disposition is unresolved, pause entry. Friendly blockage waits in the entry queue. A three-hex road approach after a 15-minute entry edge yields 13:00 arrival, before additional known delays. A forecast cannot claim it arrived at the battle before it entered the campaign map.

### G. Result correction conserves forces

Battle result r1 declares corps A blown, schedules return at slot N+2, and records reinforcement B unused at its actual approach hex. Applying aftermath once sets these states and releases B. Correction r2 says A retained its position. If A has no dependent committed events, preview removal of that scheduled return and restoration of readiness/position, then apply the delta referencing r1. If a later return/movement/battle has already used A, refuse automatic application and list those dependencies. Keep r1, r2 and both receipts. No replacement unit is created and B does not return to its earlier origin.

## 8. Source and implementation traceability

Source pages refer to the private rulebook reviewed in [WATERLOO_RULES_REVIEW.md](WATERLOO_RULES_REVIEW.md). Commands below are proposed names, not existing APIs. Every receipt carries profile/chart/scenario versions and relevant values.

For scenario transcription, use an explicit named unit's setup-table value ahead of a general opening-mode sentence or an example. Thus the June 16 Wellington and Blücher entries use their table's Battle mode. Normalize spelling variants to stable identities while retaining source labels in notes. Renumber duplicate June 15–18 special-rule labels in our original data without changing their content. Full historical dataset transcription/reconciliation remains W33; an unresolved material conflict must be an explicit scenario exception, never guessed from artwork. The original HQ chart above governs this profile even when sample-counter ratings differ.

| Clause                              | Source or original decision              | Treatment                                       | Proposed command/module                           | Acceptance                               |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| Profile and legacy boundary (§1)    | Repository review                        | Original architecture                           | Profile-discriminated schema/replay               | Legacy round trip unchanged              |
| Slot clock/finite activation (§2–3) | pp. 5–7 repeated moves/pass              | Adapted; six-hour clock, three segments         | `lock-movement`, `resolve-until-barrier`          | A, F                                     |
| Formation allowances (§2.1)         | pp. 2–3                                  | Retain allowance; original minutes              | Travel chart/route validator                      | A, D                                     |
| Terrain/bridges/zones (§2.1, §4)    | pp. 3, 5, 19; missing player aid         | Original chart with stated river exception      | Hex topology/zone projection                      | B, C, E                                  |
| Weather (§2.2)                      | pp. 8, 18                                | Formation effect retained; timing original      | `record-weather`                                  | Rain changes next edge before costing    |
| HQ command (§2.3)                   | pp. 3–5                                  | Affiliations retained; complete ranges original | `place-hqs`, command validator                    | Out-of-range step strictly closer        |
| Detachment deployment/recall (§2.3) | p. 4                                     | Retained with explicit stacking/Hill choices    | `place-detachments`, `recall-detachments`         | One Napoleon placement; next-slot recall |
| Blown returns (§2.3, §6)            | pp. 4, 7                                 | Retained cap; blocked return original           | `review-returns`                                  | Third eligible corps eliminated          |
| Withdrawal (§3.1)                   | p. 5                                     | Simultaneous, fixed duration and phase hold     | `lock-withdrawals`, `resolve-withdrawals`         | Conflicts cannot produce stacking        |
| First-day limits (§3)               | p. 18                                    | Explicit segment-budget adaptation              | Scenario budget receipt                           | Reopening cannot reroll budget           |
| Collisions/shared cursor (§4)       | Simultaneous user requirement            | Original reservation/tick policy                | Event resolver                                    | B, C                                     |
| Contact/battle grouping (§4.1)      | pp. 6–7                                  | Optional attacks retained; rematch adapted      | `adjudicate-contact`, `declare-battle`            | No overlapping commitment                |
| Map reinforcements (§5)             | pp. 5–6, 18                              | Entry retained; timing/queue explicit           | `adjudicate-entry`, arrival queue                 | F                                        |
| Tactical ETA/turns (§5.1)           | User requirement                         | Original charts and manual override             | `estimate-reinforcements`, `commit-reinforcement` | D, E                                     |
| Manual tactics/results (§6)         | User requirement replaces pp. 6–7 combat | External tactical; original neutral records     | `confirm-result`, `correct-result`                | G; two external games                    |
| Retreat/pursuit (§6)                | pp. 6–7                                  | Operational defaults; reviewed timing           | `preview-aftermath`, `apply-aftermath`            | Blocked retreat and held victor          |
| VP/communications (§6)              | p. 7                                     | Weights retained; passable-path policy explicit | `finalize-slot`                                   | Tie and 8/9/11/12 margins                |

## 9. Implementation gate and playtest targets

This specification supplies draft values for W01–W08. Their P0 drafting work can be marked complete; numerical calibration and human playtesting remain open. Implement P1 next: a versioned domain/profile, original hex fixture, clock/charts and persistence compatibility. Then implement and test shared submissions/resolution before connecting battle editors.

The first playtest should assess whether up to 22 road hexes in a six-hour phase is too permissive, whether origin reservations produce excessive road congestion, whether the influence boundary causes too much stopping, and whether 30-minute discretionary assembly and the ETA bounds are useful. Change chart versions after observations; preserve old receipts. Validate worked examples as executable domain tests during implementation, including faction/array permutation, privacy, restart and result-correction dependencies.
