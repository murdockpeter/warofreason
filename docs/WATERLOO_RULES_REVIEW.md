# Waterloo operational adaptation: repository and rules review

Review date: 2026-10-25. Status: research and implementation proposal; no gameplay changes implemented.

## Requested direction

Use C3i's Waterloo Campaign, 1815 as the principal operational framework, retaining its mechanics wherever practical, with these explicit requirements:

- Both sides submit movement for the same phase and resolve it simultaneously.
- Tactical battles can use any external game. Enter and edit results manually, then review their campaign effects.
- Show likely arrival times for nearby potential reinforcements, including troops arriving after a tactical battle starts.
- Create our own versions of needed charts, including terrain, movement and timing. Missing published aids do not block this design work.

This is a substantial replacement of the current operational model, with a reusable tactical handoff. It does not require every future campaign to depict Waterloo or use Napoleonic tactical rules. Scenario content and operational rules should be independent choices.

## Repository findings

The app is an offline Electron/React/TypeScript desktop application. Main owns SQLite and files; validated IPC connects it to the sandboxed renderer. Pure domain commands, optimistic revisions, transactional journal snapshots, replay validation and isolated-profile tests are valuable foundations to retain.

| Area               | Existing implementation                                                                                     | Implication                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Campaign aggregate | `src/domain/campaign.ts` requires Fontenoy, 38 units and 96 squares                                         | Introduce a separate versioned aggregate/profile; changing constants would break historical validation     |
| Geography          | `fontenoy-schema.ts`, `operations.ts`, `OperationalMap.tsx`: 12 × 8 squares and orthogonal routes           | Waterloo needs six-neighbour hex geometry, explicit terrain/roads/bridges and map distances                |
| Clock and phases   | `scheduleSchema` uses whole days per turn; `activeSide` controls sequential faction resolution              | Add AM/PM slots and a shared simultaneous phase clock; an editor's selected side is not strategic time     |
| Orders             | `operations-schema.ts` stores one side's orders; `routeCost` validates against the current static board     | Persist separate submissions against one common snapshot and resolve both together                         |
| Forces             | Maurice classifications/qualities, Fontenoy contingents, columns and attached commanders                    | Distinguish operational corps, stationary detachments, abstract HQ markers and optional tactical rosters   |
| Contact            | Movement into an occupied hostile square stops in the preceding square                                      | Detect adjacency, influence, same-cell contention and crossing routes at the correct time                  |
| Battle bridge      | `tabletop.ts`, `tabletop-schema.ts`, `battle-brief.ts`: frozen participants, printable briefs, result entry | Reuse lifecycle and document infrastructure; generalize payloads and commitment rules                      |
| Results            | Maurice outcome/disruption/Army Morale fields; confirmed results become read-only                           | Add neutral campaign effects and optional game-specific observations; support audited corrections          |
| Reinforcements     | Declarations already accept agreed arrival instructions                                                     | Replace text-only scheduling with calculated, explainable arrival windows plus manual overrides            |
| Aftermath          | `aftermath.ts`: conscript rebuilding, siege, Epic Points, exhaustion                                        | Use a Waterloo strategy rather than importing these Maurice house rules                                    |
| Information        | `projectOperationalView`, redacted exports and dated scouting snapshots                                     | Extend allowlists to orders and reinforcement estimates; existing pass-and-play privacy limits still apply |
| Persistence        | `repository.ts`, receipts, import/recovery replay and clone reset                                           | New commands need corresponding replay, transfer, clone and migration/version handling                     |

The existing formation split command is an original campaign policy. It should not automatically become a way to generate unlimited Waterloo detachments. Likewise existing siege, scouting and concealment are optional extensions, not mechanics established by this Waterloo PDF.

The review inspected the README, architecture, running checklist, provenance documentation, aggregate/contracts, operational/tabletop/aftermath schemas and relevant command, repository and map code. This was a source review, not a fresh runtime verification of the current build.

## Source and evidence boundary

Primary source: private `contextonly/WaterlooRulebook-15DecFinal-C3i-Nr33wRSrP7Ef9Q16X.pdf`, 24 PDF pages, Mark Herman, C3i Magazine Nr33, 2019. Page references below use PDF page numbers, which match the printed rule pages. All text-bearing pages were examined, including examples and designer notes; the back-page sample counters were also viewed visually. Research extraction and rendered reference images remain in ignored `contextonly/`.

Core procedures are on pp. 2–7; the June 16–18 scenario is on p. 8; examples span pp. 8–17; the June 15–18 scenario is on p. 18 with examples on pp. 19–21; design intent is on pp. 22–23. Page 24 gives sample counters and a nominal one-mile hex scale. The separate player aid/Terrain Effects Chart and full counter data are not supplied as complete usable datasets in this rulebook.

Implement mechanics and independently authored summaries/data. Do not bundle the private PDF, extracted text, maps or counter art. Original replacement charts are authorized by the user; give them their own versions and provenance instead of presenting inferred values as verified published values. No external errata search was performed; possible inconsistencies below are observations about the supplied PDF.

## Rules deep dive

### Force scale and affiliations — pp. 2–3, 22–24

The main manoeuvre pieces are infantry and cavalry corps. Detachments screen, hold flanks and delay enemies, but do not manoeuvre like corps. HQs express command intent rather than a general's literal location: they are markers, cannot be eliminated or displaced by an enemy, and can coexist with enemy units after placement.

Two opposing sides contain three distinct armies: French, Anglo-Allied and Prussian. The French have Napoleon, Ney and Grouchy HQs; Wellington and Blücher command their respective Coalition armies and cannot command each other's units. A two-side ownership model alone cannot enforce these affiliations.

Infantry has Advance/Battle states with movement allowances 4/1. Cavalry has Fresh/Exhausted states with allowances 6/4. Combat stars are separate from movement and should not be translated automatically into Maurice quality. Most artillery is abstracted inside corps. The Grand Battery and Old Guard are special detachments.

### Geography, stacking and influence — pp. 3–6, 19

Units project control to adjacent hexes; corps also project influence to distance two. Detachments have control but no two-hex influence. Overlapping zones do not accumulate extra effects. Influence generally extends through pieces. An example on p. 19 specifies that major rivers block control/influence except at bridges: the final geometry policy must incorporate that exception explicitly.

Corps cannot share a hex or move through another corps, even a friendly one. They can coexist with friendly detachments and HQs. The wording about no more than one HQ marker or detachment in a hex should be turned into an explicit stacking matrix before coding rather than assumed to permit arbitrary marker combinations.

An entirely connected-road move doubles the allowance, except for Battle infantry. Combining road and off-road travel does not earn that bonus. Terrain effects beyond the rules' explicit statements need original replacement charts.

### Command phase A–E — pp. 3–4

**A: HQ placement.** Each HQ is removed and placed anew within three hexes of an associated unit, outside enemy control/influence. If no associated units exist, the rules give a special placement near the Brussels–Couillet road. HQs remain fixed for that turn. Normal mode gives reach; Battle mode exchanges reach for combat support. Normal HQ road tracing can double range, but ordinary corps command checks are described separately as ignoring terrain: keep the two tracing purposes distinct until the adaptation defines them.

**B: return of blown corps.** Corps become eligible two turns after removal. Each side can return at most two at this step, adjacent to an associated HQ in a genuinely empty hex outside enemy control/influence. If more than two are eligible, the opponent selects the two and the others are eliminated. Specify what happens when eligible corps have no legal return hex; the supplied procedure does not settle every placement failure.

**C: cavalry recovery.** Exhausted cavalry refreshes only outside enemy control and influence. Detachment control therefore matters even without an enemy corps nearby.

**D: detachment placement.** Each HQ may place one associated detachment. Trace from that HQ within command range, or from its parent corps within four hexes. The path avoids enemy control/influence; an ordinary destination avoids both friendly and enemy control/influence. HQ deployment can still use a detachment whose parent has been eliminated. Detachments then remain stationary.

Napoleon in Battle mode may instead place the Grand Battery with a friendly unit in range, ignoring the usual enemy-zone placement restrictions; its combat contribution is offensive. The Old Guard instead uses an empty hex in range outside enemy control, but may enter influence. These compete for Napoleon's one placement. Grand Battery handling depends on whether its attached corps advances or leaves through an adverse result, and it recalls at turn end.

**E: recall.** Detachments can be recalled without a route, including from encirclement, and become available next turn. Record availability by turn rather than interpreting recall as permanent loss. The Anglo-Allied communications rule changes Hill's star rating according to detachments deployed/eliminated; the forward and reverse wording use different counts, so our chart must define this deliberately.

### Organization F–H — p. 5

Advance infantry outside enemy control; switch infantry inside enemy control to Battle. Influence alone does not prevent the first change. Cavalry recovery belongs to C, not F.

Withdrawal allows corps in enemy control to use the retreat procedure. Published withdrawals alternate; after a pass the other side has up to three more. Simultaneous movement does not by itself specify simultaneous withdrawal. Define the adapted withdrawal timing and resolve conflicting retreats before movement submissions lock.

### Movement — pp. 5–6

Published movement alternates one corps activation at a time, French first. A corps may activate repeatedly. Its printed allowance is **per activation**, not a total per phase. This repeated movement plus the pass mechanism is central to operational tempo; simply allowing one route of four or six hexes per AM/PM phase would materially change the game.

Each French activation names the HQ used for its command check. Movement normally stays within the associated HQ's command range. A corps initially outside range must move strictly closer until it reaches range, then remain within range.

Infantry stops when entering enemy influence, retaining its formation, and stops/flips on entering enemy control. Cavalry stops on entering enemy cavalry influence, and any corps stops on entering enemy control. Infantry starting inside enemy control cannot manoeuvre out; cavalry starting in enemy cavalry control is similarly held. Cavalry starting in infantry control has a limited escape to an empty adjacent hex outside enemy control. An explicit phase eligibility state is needed: the examples say movement finishes after entering relevant control/influence, not merely that one path segment ends.

Once a player passes, that side is finished moving. The opponent receives a finite tail of moves based on a d6 plus eligible friendly units outside enemy control/influence, including available off-map reinforcements. After the pass, those reinforcements enter before existing map units move. Published entry protection forces interfering enemies to retreat or detachments to recall; friendly congestion may delay entry, with the designated entry location retained. These are separate rules from tactical reinforcements arriving at a battle.

### Attacks and the external tactical boundary — pp. 6–7

Attacks are voluntary adjacent engagements, alternating French first; the same corps can fight repeatedly. Ordinary detachments cannot initiate attacks or support them. Infantry attack support depends on adjacency to the defender; cavalry support depends on adjacency to the principal attacker/defender. Fresh cavalry participation can expend freshness. HQ Battle mode, stars, terrain and the special detachments influence the published opposed-die resolution.

The printed combat outcomes range from no displacement through retreat, temporary removal and elimination. Retreat is three hexes, each farther from the victorious enemy, avoiding corps and enemy control; an impossible retreat escalates. Blown corps normally return two turns later, but final-day blows become eliminations. Detachments have different recall/elimination rules. A corps attacking a detachment is protected from the harsher removal results. An attacker must occupy a defender's vacated hex when free of other enemy control.

For this application, retain engagement eligibility and useful operational consequences, but **replace dice, modifiers and the combat table with external tactical adjudication**. Supply command, terrain, readiness and possible support as briefing facts; do not automatically turn stars into tactical bonuses, exhaust nearby cavalry, remove supports or infer losses from a declared winner. Record actual participation and reviewed consequences. Combining several printed attacks into one tabletop battle is an adaptation and must consume/reserve those forces explicitly.

### End phase, victory and scenarios — pp. 7–8, 18

After attacks, recall the Grand Battery, end the turn and either begin the next AM/PM slot or score the campaign. Standard eliminated corps/detachments award 3/1 VP; Imperial Guard infantry/cavalry corps award 5, and Old Guard/Grand Battery detachments award 2. The French can earn a final 5 VP for an unblocked south-to-north communication path between designated entry hexes. Coalition wins a tied total. Victory margins 9–11 and 12+ distinguish campaign and strategic levels from lesser tactical victories. The communications path is not described as road-only: do not invent that constraint.

The June 16–18 scenario has six slots, numbered 3–8, and starts at detachment placement, skipping A–C. The June 15–18 scenario has eight slots and starts with movement, skipping Command/Organization. It adds restricted Coalition reactions, French congestion/action budgets, reinforcement queues and delayed French HQ arrivals. June 17 AM and PM each test rain; rain changes off-road formation/readiness and subsequent soft ground affects artillery. Retain weather's operational effects; provide soft-ground information to tactical players rather than applying an external game's combat modifier automatically.

Scenario tables and examples have occasional naming/mode inconsistencies, and the longer scenario repeats a special-rule number. Store a reviewed source note and explicit scenario value instead of silently deriving data from contradictory prose.

## Proposed simultaneous movement design

The following is an adaptation proposal, not published Waterloo procedure. Only the requirement for simultaneous movement is settled; numerical budgets and collision policies remain to be selected.

1. Complete shared start-of-turn procedures, weather and withdrawals; produce a stable phase-start snapshot.
2. Both sides plan private orders against that snapshot. Support several ordered activation segments per corps so repeated movement can survive the adaptation. A finite phase budget and a common time model must be agreed before implementation; the published pass rule cannot be retained literally.
3. Save and lock each side's submission independently. Missing orders hold. One submission neither moves troops nor advances the clock. Reopening after the opponent has locked requires an explicit coordinated reset; it must not expose orders for unilateral revision.
4. After both lock, calculate all paths on one common timeline, processing equal-time events together. Do not mutate French first and then Coalition, or use entity-array order as priority.
5. At each event, evaluate occupancy, zones, formation changes, crossings, queues and command limits from that event's shared state. Resolve same-destination conflicts and opposite-direction traversal of the same edge before applying positions. Friendly vacating chains require an explicit rule; cycles/swaps must not bypass corps blocking.
6. Record contacts and stop affected routes at legal approach positions. A contact is not automatically a mandatory battle. Freeze involved forces and offer battle, delay, withdrawal or umpire disposition as permitted by the selected policy.
7. Build simultaneous encounter groups so one corps cannot fight in two overlapping battles. Review dependent encounter/reinforcement effects before completing the shared phase.
8. Publish and confirm one deterministic resolution receipt, then advance the shared clock once after the appropriate battle/checkpoint work.

Recommended starting policy: preserve per-activation allowances with a finite shared phase duration and predeclared activation sequences. Derive available movement from that duration and original time charts, rather than adding an arbitrary unlimited loop. Keep this recommendation distinct from the user's settled requirements. Published pass tails and first-day congestion need explicit replacements in the same budget model.

## Tactical reinforcement timing

There are two different arrivals: scenario reinforcements entering the campaign map, and on-map formations approaching a tactical battle. Both need availability times; only the second directly supplies a tactical entry estimate.

For each encounter, find nearby eligible forces using reachable routes and available time, not just a hex-radius check. Account for formation, cavalry freshness, roads, terrain, bridges, command restrictions, earlier movement, weather, blockages, existing commitments and activation/congestion limits. A nearby corps in an enemy zone or another battle may be unavailable. Delayed scenario entrants can be candidates only after their legal map entry and subsequent travel.

Use a configurable minutes-per-AM/PM-slot model and original travel/mobilization charts. Give a battle its own start timestamp within the slot; compute arrival relative to that timestamp. Conceptually: arrival delay = remaining mobilization/availability delay + legal journey time − time already elapsed since battle start. Use the actual timeline rather than subtracting already-spent movement twice. Report a range when departure, battle start or congestion is uncertain; never imply that a printed four-hex allowance establishes an hourly marching speed.

Each estimate should include:

- Formation identity, army, eligible forces, origin and observation timestamp.
- Earliest/likely/latest arrival in campaign time and minutes after battle start.
- Route, entry edge, travel assumptions, delay reasons and whether arrival is feasible within the agreed battle duration.
- Status: potential, ordered, committed, delayed, arrived, cancelled or unavailable; a likely ETA alone does not promise entry.
- Optional conversion into the chosen tactical game's turns, using player-entered minutes per tactical turn; show a rounding policy and preserve the underlying time.
- Umpire overrides of departure, arrival, entry edge and actual participation with reasons, without requiring tactical combat automation.

Potential candidates are advisory; committing an arrival reserves only the agreed force and arrival interval. Opposing routes may delay, block or create another encounter before arrival. Contact with an existing battle should offer reinforcement joining rather than automatically create a second fight. Shared battle briefs include only agreed released reinforcements; full candidate lists and enemy plans remain umpire information. Player estimates may use dated intelligence and must not read hidden live enemy orders.

Freeze briefing estimates at declaration, retain later amendments with reasons, and record actual arrivals and unused reservations in the result. Applied campaign effects must conserve troops and travel time and release unused commitments explicitly.

## Manual results and correction policy

Use a neutral result envelope: game name/version (optional), battle start/end, participating forces, actual reinforcement arrivals, player outcome/notes and attachments or references if later supported. Campaign-facing entries specify retained/retreated/blown/eliminated states, post-battle locations, optional agreed strengths, cavalry readiness and detachment dispositions. Detailed external game observations can remain optional notes or a versioned extension; no game-specific field is mandatory for every ruleset.

Drafts are freely editable. Confirmation preserves a historical revision. A later correction creates a superseding result with actor, reason and a preview of differences. If aftermath has already applied, it must be reconciled through a compensating transaction or blocked for explicit dependent-event review; never overwrite historical snapshots or reapply the same losses twice. Current confirmed-result immutability is therefore insufficient for the requested manual editing workflow.

Keep result recording separate from campaign application. Offer Waterloo defaults for retreat, blown recovery and final-day elimination, with an explicit reviewed override for arbitrary tactical outcomes. Preserve the distinction between default rules and umpire exceptions in the journal.

## Original charts and outstanding design choices

Create independently authored, versioned charts for terrain movement/passability, road-only travel, river/bridge zone propagation, HQ range by mode, formation/readiness, phase time/activation budgets, mobilization/travel/ETA ranges, retreat/return placement and VP weights. Combat charts are unnecessary for the default manual tactical workflow. Charts need editable values, units, concise explanations and provenance; some encode original choices rather than missing published facts.

Before implementation, settle the phase duration and repeated-activation budget, simultaneous withdrawal policy, friendly queues/swaps, hostile crossing/contact timing, encounter grouping, attack opportunity limits, battle duration/turn conversion and override boundaries. Original charts resolve missing data; they cannot by themselves resolve all timing and concurrency semantics.

Recommended first playable slice: generic profile + small original hex scenario → simultaneous submissions → contact → external battle brief with reinforcement windows → manual result/correction → reviewed aftermath → next shared slot. Add full historical scenarios and detailed special rules after this slice proves coherent. See [the new implementation TODO](WATERLOO_TODO.md).
