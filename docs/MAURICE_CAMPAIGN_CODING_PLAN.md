# Maurice Campaign Companion — Codex Coding Plan

**Status:** v0.1 / proposed implementation backlog  
**Target:** Local-first Electron desktop application for Windows 11  
**First module:** *The Road to Fontenoy, 1745*  
**Goal:** Manage an operational mini-campaign and pass battle information to/from tabletop games of *Maurice*. **Do not automate the tabletop rules.**

> **Rules boundary:** *Maurice*'s tactical and Succession Wars rules are published rules; campaign movement, column limits, scouting, siege progression, attrition timing, and victory thresholds below are **provisional house rules** to be explicitly labeled as such. The source *Hundred Days* booklet is a structural inspiration, not a Maurice rules supplement. Avoid copying copyrighted prose, illustrations or card artwork into the distributable application. Allow users to enter their own card titles and effects as private personal data.

## 0. Definition of Done for the MVP

A player can create a Fontenoy campaign, assign historic-inspired initial forces to French and Allied columns, move columns on a regional square map, record scouting and engagements, open a battle worksheet, enter the outcome of a tabletop Maurice battle, apply traceable post-battle effects, update siege progress, save/close/reopen the campaign, and export a campaign JSON and readable journal. No login, cloud service, or internet is required.

## 1. Technical decisions

- [ ] Bootstrap Electron + Vite + React + TypeScript, strict TypeScript settings.
- [ ] UI: React Router (or simple route state), Zustand for UI/session state, Tailwind CSS or a small component library. Avoid business logic in React components.
- [ ] Persistence: SQLite via `better-sqlite3` in Electron main process (pin a compatible Electron/Node version; rebuild native modules); transactional DB migrations. Alternative if native compilation is painful: JSON persistence behind the same repository interface for a first spike.
- [ ] Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where compatible. Preload exposes a **narrow typed API**; validate all IPC inputs with Zod. No arbitrary file system access from renderer.
- [ ] Testing: Vitest (pure rules), React Testing Library (UI), Playwright Electron E2E or equivalent smoke suite. ESLint, Prettier, CI build.
- [ ] Packaging: electron-builder or Electron Forge for signed/unsigned local Windows builds; record unsigned-install warnings as expected for development.
- [ ] Assets: create original map art/data. Avoid embedding copyrighted scanned rules/cards. Data-driven modules and user-provided private assets.

## 2. Proposed directory structure

```text
maurice-campaign-companion/
  docs/
    RULES_PROVENANCE.md
    DOMAIN_GLOSSARY.md
    DESIGN_DECISIONS.md
    CAMPAIGN_SPEC_FONTENOY.md
    TEST_SCENARIOS.md
  src/
    main/             # Electron main, file dialogs, DB, IPC
    preload/          # contextBridge typed methods
    renderer/         # React views/components/state
    domain/           # pure, deterministic mechanics and types
    data/             # versioned initial campaign module JSON
    shared/           # validated IPC contracts and DTOs
  tests/
    unit/
    integration/
    e2e/
  assets/
    maps/
    icons/
  package.json
```

## 3. Core domain model (first cut)

- `Campaign`: id, moduleId, moduleVersion, title, status, date/turn, activeSide, settings, seed, created/updated timestamps.
- `CampaignModule`: geography/grid, historical background, start/end turn, factions, setups, reinforcement events, objective definitions, ruleset version.
- `Faction`: French/Allied (and optionally Allied subcontingent), owner/color/VPs/exhaustion counter.
- `Unit`: id, factionId, displayName, type (`regular_infantry|irregular_infantry|regular_cavalry|irregular_cavalry|artillery`), quality (`elite|trained|conscript|null`), currentStatus (`ready|recovering|lost`), homeFormationId, provenance.
- `Commander`: id, factionId, name, role, optional notableCardReference, assignment, status; retain existing card text by reference/user entry, not embedded copyrighted transcription.
- `Column`: id, factionId, displayName, squareId, unitIds, commanderIds, movementStatus, concealment; validated capacity, formation compatibility and fog-of-war.
- `MapSquare`: id, grid row/column, terrainTags, roadEdges, riverEdges, locationName, objectiveIds, supply tags, possible deployment modifiers.
- `Battle`: id, turn, location(s), attacker/defender, committed unit IDs, reinforcement eligibility, stage (`pending|in_progress|resolved`), result (`french_decisive|french_marginal|draw|allied_marginal|allied_decisive`), chronology, notes.
- `BattleUnitResult`: unitId, broken/retired/survived, disrupted at end (optional), outcome notes; **do not assume disruption is permanent**.
- `SiegeState`: target, progress, siegeStatus, supplyRouteStatus, blockade/relief flags.
- `CampaignEvent`: event id, turn, category, actor, payload, before/after snapshots or reversible command metadata, rulesetVersion, timestamp.
- `TurnOrder`: faction orders, sealed/unsealed flag, validity, resolution status.

**Important:** A `MauriceUnit` is not a Napoleonic brigade/corps. Maintain *Maurice* type/quality terminology and treat historical battalions as abstracted into game units according to the scenario scale. Store tactical **Army Morale** per battle, not as an interchangeable persistent campaign exhaustion counter.

## 4. Implementation backlog — build in this order

### Milestone A — Foundation and UX skeleton
- [ ] A01 Create repo, README, license and basic scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `package`).
- [ ] A02 Scaffold secure Electron/React/TypeScript app and typed preload IPC.
- [ ] A03 Create app navigation: Dashboard, Campaign Map, Armies/Columns, Turn Orders, Battle Log, Siege & Victory, Settings.
- [ ] A04 Add a visual status strip: campaign day, faction, siege status, objectives, unsaved changes.
- [ ] A05 Set up error handling, logging, empty states and confirmation dialogs.
- [ ] A06 Add unit tests for the initial domain types and validation.

**Acceptance:** `npm run dev` works offline; packaged app launches; UI never accesses Node directly; TypeScript and test suite pass.

### Milestone B — Campaign state and persistence
- [ ] B01 Define schema + Zod validators, stable UUIDs and reference integrity rules.
- [ ] B02 Implement SQLite migration 001 and repository interface.
- [ ] B03 Add Create / Rename / Clone / Archive campaign.
- [ ] B04 Implement autosave on committed actions and recover last active campaign after restart.
- [ ] B05 Implement atomic export/import to versioned `.json`; reject invalid/mismatched imports with actionable errors.
- [ ] B06 Implement event log with who/what/when/why, before/after state and undo for uncommitted actions.

**Acceptance:** All data survives multiple app restarts; invalid files do not corrupt active saves; imports do not silently overwrite existing campaign IDs.

### Milestone C — Fontenoy module data
- [ ] C01 Write `CAMPAIGN_SPEC_FONTENOY.md` distinguishing sourced history, published Maurice facts, and invented campaign rules.
- [ ] C02 Build a **schematic placeholder** 12-column × 8-row square map; later replace with verified geographic data. Map scale and road adjacency must be adjustable without data loss.
- [ ] C03 Add labeled locations: Tournai, Fontenoy, Antoing, Leuze, Ath, Soignies, Lille and Valenciennes. Check geography and routes before marking road/river edges.
- [ ] C04 Seed French 20 and Allied 18 **scenario-scale** units from Maurice Fontenoy totals: French 3 elite RI, 8 trained RI, 2 elite RC, 4 trained RC, 3 ART; Allies 2 elite RI, 9 trained RI, 2 elite RC, 2 trained RC, 3 ART.
- [ ] C05 Store Allied provenance by contingent (Dutch and Anglo-Allied), not just totals.
- [ ] C06 Add configurable opening assignments, hidden columns, commanders, turn schedule, and siege status. **Do not freeze speculative historical column deployments as fact.**
- [ ] C07 Provide a setup review screen with validation and a 'Start Campaign' action.

**Acceptance:** New campaign loads the correct 20/18 game units and lets the players change provisional column splits before starting.

### Milestone D — Map and operational orders
- [ ] D01 Render zoom/pan square grid, roads/rivers, locations, objectives, column markers and selected-square details.
- [ ] D02 Click a column → inspector: composition (own side), commander, movement points, operational orders.
- [ ] D03 Validate path connectivity and costs using data-driven movement rules. **Initial placeholder only:** mixed column 3 road squares per turn, off-road penalty adjustable.
- [ ] D04 Add separate planning and resolution phases; preserve issued orders before resolution.
- [ ] D05 Add campaign day advancement (proposed two-day turns), with history and undo until resolution commitment.
- [ ] D06 Add side-specific fog-of-war views and a neutral umpire view; hidden composition remains masked to opposing player.
- [ ] D07 Add roadblock/occupancy checks, encounter detection and a deterministic 'engagement candidate' list.

**Acceptance:** A column cannot illegally move through a blocked square; each action logs the rule it used; faction view does not leak concealed compositions.

### Milestone E — Reconnaissance, engagements, tabletop bridge
- [ ] E01 Create scouting action workflow: choose scout, target, roll or enter physical dice result, show modifiers & reason.
- [ ] E02 Define contact intelligence states (`unknown|located|estimated|identified`) with time/date stamps and expiration.
- [ ] E03 Build 'Declare Battle' wizard: eligibility, participant selection, entry edges, reinforcements, objectives and terrain notes.
- [ ] E04 Export/print Battle Brief with list of unit types and qualities, commanders/Notables, map origin, attacker/defender, special setup instructions.
- [ ] E05 Create manual tabletop result entry; store decisive/marginal/draw using published Maurice results terminology, plus individual unit broken/retired/survived and commander changes.
- [ ] E06 Require battle result confirmation; do not auto-roll/resolve Maurice combat mechanics in campaign app.

**Acceptance:** Full battle round trip from map to printable brief to entered result to campaign log, with no hand-coded outcome assumptions.

### Milestone F — Post-battle state and siege
- [ ] F01 Implement **proposed** loss/recovery timing in a replaceable rules strategy; make it configurable by campaign module.
- [ ] F02 Make Chapter 12-compatible quality treatment explicit: broken regular units may be rebuilt at conscript quality (when allowed by campaign rules); irregular/artillery recovery must follow chosen variant; no undocumented permanent disruption carryover.
- [ ] F03 Use published Maurice Epic Point rules as manual data entry/summary rather than silently approximating the full official calculation.
- [ ] F04 Add Notable persistence and attachment management; include status events (lost/retired/arrived) only when explicitly resolved.
- [ ] F05 Implement **proposed** Tournai siege track with supply and relief actions, parameterized thresholds, and turn-end updates.
- [ ] F06 Add victory evaluator: siege success/relief, campaign deadline and campaign exhaustion. Distinguish battle Army Morale from operational exhaustion.
- [ ] F07 Add after-action summary and record of campaign-level changes.

**Acceptance:** Every strategic change has an auditable event; victory never triggers before its explicit condition; tests cover conflicting outcomes on the final turn.

### Milestone G — Polish and playtesting
- [ ] G01 Design campaign summary / AAR dashboard with timeline of movements, intelligence and battles.
- [ ] G02 Add printable turn checklist, army rosters, battle record sheet and campaign log.
- [ ] G03 Add game backup, restore, re-open previous turn as a **fork** (not silent history rewrite).
- [ ] G04 Test 1 no-battle siege outcome, Test 2 one major engagement, Test 3 broken units and recovery, Test 4 hidden intelligence, Test 5 final-turn victory tie-break.
- [ ] G05 Add Windows build instructions, installer smoke test, and data directory backup guidance.
- [ ] G06 Capture playtester feedback and log house-rule revisions by version.

**Acceptance:** Two humans can finish a short campaign with physical Maurice battles without manually reconciling unit lists or turn order.

## 5. Rules decisions requiring playtest before declaring v1.0

- [ ] R01 Historical starting dates and operating area: proposed 1–22 May 1745, 11 two-day turns. Confirm whether the scenario should instead run through Tournai's historical surrender date.
- [ ] R02 Strategic scale: exact map dimensions and movement-point costs by roads/terrain; column limit and maximum column size.
- [ ] R03 Intelligence: scout eligibility, dice tables, chance to identify units, intelligence decay and umpire mode.
- [ ] R04 Encounter: defender withdrawal, pursuit/overrun, declaration timing and multiple battles per turn.
- [ ] R05 Battle setup: convert operational squares to Maurice table terrain without contradicting official Battlefield cards.
- [ ] R06 Reinforcements: eligibility and how/when they arrive within standard Maurice round/activation sequence.
- [ ] R07 Losses: distinguish broken from eliminated/retired and determine how fast units may return; avoid excessive bookkeeping.
- [ ] R08 Siege: progress thresholds, supply lines, investment/relief, garrison abstraction, and French need to detach siege forces.
- [ ] R09 Victory: exhaustion thresholds, objective checks, whether final-turn tie-breaks favor besiegers or relief force.
- [ ] R10 Notables: official card effects apply at the tactical level; whether any campaign-only bonus is allowed and how to handle officers outside the battle.

All provisional rule constants should live in versioned **campaign module configuration**, never be scattered across UI code.

## 6. Critical user stories and tests

1. **Create:** Given a new campaign, opening the Fontenoy template seeds both sides' correct game units, locations and proposed objectives.
2. **Conceal:** Given French side active, Allied unrevealed column identities/qualities are not visible in UI or accidentally serialized into French-facing exports.
3. **Move:** Given a column with insufficient movement points or blocked path, attempting movement returns a human-readable validation failure and does not mutate state.
4. **Battle:** Given a legal engagement, creating a battle freezes participants so they cannot concurrently move elsewhere.
5. **Loss:** Given a regular infantry unit marked broken, the chosen post-battle recovery rule applies deterministically and is journaled; the tabletop Army Morale is not edited across battles.
6. **Siege:** Given progress meets the agreed threshold and the French supply condition holds, the campaign evaluates the right outcome after the designated turn-end phase.
7. **Persistence:** Given restart or crash, the last committed turn is restored without dangling unit/column references.
8. **Provenance:** Given a player clicks a campaign rule, the app displays whether it is `official_maurice`, `historical_scenario`, or `house_rule_v0.1` with a short citation/description.

## 7. First 6 Codex tasks (execute separately, commit after each)

**Prompt 1 — Scaffold**
> Create a local-first Electron + Vite + React + TypeScript project in this repository following `MAURICE_CAMPAIGN_CODING_PLAN.md`. Use strict TS, secure isolated preload, typed IPC interfaces, ESLint/Prettier/Vitest. Implement navigation with placeholder screens, README and scripts. Do not implement any campaign rules yet. Run lint/typecheck/tests/build and report results.

**Prompt 2 — Domain model**
> Implement pure domain types, Zod validators and a versioned Fontenoy scenario data schema from sections 3 and 4C. Add tests for unit quality compatibility (artillery and irregular units do not have regular quality), faction ownership and column unit uniqueness. Avoid React dependencies in the domain layer.

**Prompt 3 — Persistence**
> Implement a main-process persistence repository with SQLite and migrations, CRUD for campaigns, save/reopen, export/import validated versioned JSON, and end-to-end persistence smoke test. All renderer requests go through narrow validated IPC methods. No direct renderer file access.

**Prompt 4 — Setup wizard**
> Implement a New Campaign wizard that seeds Fontenoy's 20 French and 18 Allied game units, shows setup counts, allows editing proposed column splits, validates no duplicate assignments and then starts a campaign. Label operational dispositions provisional.

**Prompt 5 — Operational map**
> Implement an original configurable 12×8 schematic operational map with selectable squares/columns, zoom/pan, path preview and data-driven movement validation. Do not represent the schematic road/river geometry as historically verified.

**Prompt 6 — Battle bridge**
> Implement the map-to-tabletop Battle Brief and manual Battle Result workflows including individual unit outcomes, campaign journal events, and tests. Do not automate Maurice tactical combat or invent card effects.

## 8. Recommended workflow in local IDE

1. Save this file in repository root as `MAURICE_CAMPAIGN_CODING_PLAN.md`.
2. Have Codex read it, then first create `docs/ARCHITECTURE.md` and a milestone-by-milestone checklist.
3. Work in short vertical increments; keep each PR/commit reviewable. Verify scripts after each increment.
4. Provide the two legally obtained reference PDFs for **private research** in a non-distributed `reference/` directory excluded from package and Git if license conditions require it. Never commit them.
5. Update `docs/DESIGN_DECISIONS.md` whenever a provisional campaign rule changes; include test adjustments.
6. Do a manual tabletop-driven test with a paper Maurice action deck before investing in fancy map graphics.

## 9. Explicit non-goals for MVP

- No Maurice tactical engine or AI opponent.
- No automated legal card-effect interpretation or reproduced copyrighted card artwork.
- No online multiplayer, matchmaking, cloud sync or user accounts.
- No historically asserted exact OOB, geographic roads, or commander deployments until independently researched.
- No support for additional campaign modules until Fontenoy's data/rules interfaces are stable.

## 10. First prototype finish line

From the home screen: **New Campaign → Road to Fontenoy → Review Armies → Begin → Move French Column → Scout Allied Column → Declare Battle → Print Battle Brief → Play Maurice at table → Record Battle Outcome → Apply After-Battle Changes → Advance Turn → Save / Reopen**. Every step should be demonstrable in the application, with the official-vs-house-rule boundary visible to the player.
