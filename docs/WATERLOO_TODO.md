# Waterloo adaptation TODO

Created 2026-10-25 from [the repository and rules review](WATERLOO_RULES_REVIEW.md). This is the new implementation backlog; all unchecked work is proposed, not implemented. Preserve the previous [task checklist](TASK_CHECKLIST.md) as completion history.

## Agreed scope

- [x] Review the current repository before studying the new source.
- [x] Review the supplied Waterloo rulebook, examples and design notes; identify reusable mechanics and source gaps.
- [x] Incorporate simultaneous movement, game-independent manual battle results, likely tactical reinforcement arrivals and original replacement charts into the design.
- [ ] Implement the adaptation. Existing application behavior remains unchanged by this planning pass.

## P0 — write the playable adaptation specification

- [ ] W01 Define named operational profile, scenario and tactical-result adapter boundaries. Keep Fontenoy saves playable through their existing rules profile.
- [ ] W02 Produce original, versioned terrain/road/river/bridge and HQ/formation charts. Include stacking rules, zone propagation, complete units of measurement and editable defaults.
- [ ] W03 Select AM/PM duration, minutes per slot, finite activation/time budget and repeated-corps-movement policy. Explicitly replace alternating movement/pass tails and adapt first-day congestion to this model.
- [ ] W04 Specify simultaneous withdrawal, friendly queues/vacating chains/swaps, hostile same-hex and opposite-edge contention, equal-time arrivals, zone changes and command checks. No ordering advantage from faction or array order.
- [ ] W05 Specify when contact becomes an optional attack/battle, how multi-corps encounters group, repeated attack opportunities and how ongoing battles block or admit later troops.
- [ ] W06 Author original mobilization/travel/delay charts and ETA uncertainty rules; choose default battle duration, time-to-tactical-turn conversion and rounding. Treat all these values as adaptation choices.
- [ ] W07 Specify the manual result contract, audited corrections and reconciliation after campaign effects have applied. Define ordinary Waterloo defaults and explicit umpire exceptions.
- [ ] W08 Make a clause-level traceability matrix: source page, retained/adapted/external-tactical status, chart/policy version, implementing command and acceptance example. Resolve source inconsistencies explicitly.

Acceptance: walk through two opposing marches, a crossing contact, a congested bridge, a late reinforcement and a corrected battle result on paper with no undefined timing or duplicate forces.

## P1 — versioned domain and original hex scenario

- [ ] W09 Add a discriminated, versioned campaign/profile aggregate and transfer support; retain legacy v1/v2 validation and unchanged historical snapshots. Determine whether SQL migration is actually needed rather than assuming it.
- [ ] W10 Introduce side versus army affiliation, corps/detachment/HQ identities, operational ratings, formation/readiness and optional external tactical roster mappings.
- [ ] W11 Add hex coordinates, six-neighbour adjacency, distances, terrain/road/river/bridge data and explicit stacking/empty-hex checks. Supply an original small map and fixtures; separate the decorative Fontenoy artwork from rules geography.
- [ ] W12 Add slot/date/minute time, availability windows, reinforcement queues and HQ affiliations/modes/ranges. Support two Coalition armies without cross-command.
- [ ] W13 Implement HQ placement, return eligibility/caps, cavalry recovery, detachment deployment/recall and organization/withdrawal through profile commands. Record special placement and failed-return policies from P0.
- [ ] W14 Make original charts independently configurable/versioned and store the effective rules on receipts for replay. Validate ranges and prevent mid-resolution retroactive rule changes.

Acceptance: create/save/reopen/clone/export/import a small hex campaign while old Fontenoy campaigns and journals still validate.

## P2 — simultaneous movement engine

- [ ] W15 Persist independent side drafts/submissions/readiness against a common snapshot, with revision checks, cancellation and coordinated reopening. A side locking alone must not advance troops or time.
- [ ] W16 Implement legal predeclared activation segments, road-only allowance, command approach/range, weather transitions, zone stopping and phase eligibility under the approved time budget.
- [ ] W17 Resolve equal-time movement events as batches, including occupancy conflicts, friendly congestion, crossing edges, zone changes, off-map entry order/protection and delays.
- [ ] W18 Produce an explainable preview and deterministic receipt with positions, spent time, stopped routes, queued arrivals and contacts; commit once transactionally after review.
- [ ] W19 Group overlapping encounters, reserve involved forces and pause affected movement. Settle contacts without requiring every adjacency to become a battle.
- [ ] W20 Advance the common slot once, after required encounters and aftermath; retain restart-safe locked orders and pending resolutions.

Acceptance: reversing entity order or swapping submission order produces equivalent outcomes; no teleporting, corps stacking, double spending, accidental unilateral resolution or premature date advance.

## P3 — reinforcement estimates and tactical handoff

- [ ] W21 Implement reachability/availability-based candidate discovery from the encounter timestamp, including available scenario entrants. Respect command, zones, weather, roads, bridges, congestion and other commitments.
- [ ] W22 Calculate earliest/likely/latest arrival, travel/mobilization breakdown and entry edge. Explain unreachable/late candidates and retain assumptions; no precise ETA from an unspecified scale or clock.
- [ ] W23 Add departure/route/arrival/entry overrides with reasons, optional tactical minutes-per-turn conversion and actual-arrival recording.
- [ ] W24 Add advisory versus ordered/committed/delayed/arrived/cancelled states; reserve forces/time on commitment and release unused reservations explicitly. Prevent the same troops reinforcing overlapping battles.
- [ ] W25 Update estimates when approach routes meet opposition or an existing battle. Require reviewed amendments to frozen briefs rather than silently replacing published arrivals.
- [ ] W26 Generalize the battle brief and HTML/PDF export: neutral rosters, command/terrain/weather facts, initial forces, arrival windows/edges and agreed objectives. Make Maurice-specific data optional.
- [ ] W27 Apply intelligence allowlists to candidate lists, routes and ETAs. Shared briefs expose agreed releases; side views never derive enemy predictions from hidden live orders.

Acceptance: nearby blocked cavalry is unavailable; a road column arrives later with an explained window; a delayed map entrant cannot reinforce before entry; a reserved corps cannot join two battles; override and actual arrival survive restart/export/import.

## P4 — manual results and Waterloo aftermath

- [ ] W28 Replace mandatory Maurice outcome/morale/disruption fields with a neutral result envelope and optional ruleset observations. Support force mappings without requiring a dedicated adapter for each tactical game.
- [ ] W29 Provide draft editing, confirmation, superseding corrections and previewed reconciliation of already-applied aftermath. Preserve previous revisions and prevent duplicate effects or invalid downstream state.
- [ ] W30 Implement reviewed positions, legal retreats/pursuit, blown return schedules, final-day elimination, cavalry participation/readiness and detachment-specific consequences. Do not infer these solely from who won.
- [ ] W31 Preserve and enforce Waterloo return caps/opponent choices and original decisions for unavailable return hexes. Avoid Maurice conscript rebuilding, Epic Points or siege defaults in this profile.
- [ ] W32 Score elimination weights, the final communications path, Coalition ties and victory levels from versioned original data. Record any manual exceptions and reasons.

Acceptance: resolve the same strategic encounter using two differently structured external game records, apply effects once, correct an arrival/loss and reconcile it without rewriting history or creating troops.

## P5 — scenarios, interface and documentation

- [ ] W33 Encode both June 15–18 and June 16–18 scenarios, opening phase skips, affiliation-specific restrictions, entry queues/locations, HQ arrivals and rain/soft-ground state. Use reviewed original datasets with source notes.
- [ ] W34 Add Grand Battery/Old Guard deployment, recall/loss behavior and the reviewed Hill communications policy. Tactical bonuses remain briefing context for external adjudication.
- [ ] W35 Build map controls for hex routes, formation/readiness, HQ ranges and optional zone overlays; retain keyboard access and readable faction projections.
- [ ] W36 Replace active-faction prompts with shared-phase submission/readiness and resolution review. Show reinforcement windows in the encounter view, brief and result editor.
- [ ] W37 Update offline Help, glossary, README, architecture, design decisions and provenance. Separate operational rules from scenario facts, original adaptations and optional tactical game conventions.

## P6 — verification and playable release

- [ ] W38 Add focused domain tests for command/geometry, zones/bridges, simultaneous collisions and queues, repeated activations/budgets, entries, ETA uncertainty/reservations, result corrections, recovery and VP.
- [ ] W39 Extend replay/import validation and tests for forged receipts, stale submissions, duplicate commits/effects, privacy leaks, clone reset and original/legacy save compatibility.
- [ ] W40 Add integration/Electron coverage for two-side lock/restart, cancel/confirm resolution, brief export with later arrivals, manual result correction/reconciliation and backup round trip in isolated profiles.
- [ ] W41 Run typecheck, lint, formatting, unit/integration tests, production build, Windows packaging and relevant built/packaged/development checks. Inspect original map/brief rendering and ensure private references stay outside the package.
- [ ] W42 Playtest at least a meeting engagement, attack with late reinforcements, road congestion, screening withdrawal, rain and final-day recovery/scoring. Tune original charts from observed play and record their versions.

Implementation order: P0 → P1 → P2 → P3 → P4 produces the first end-to-end playable slice; then complete P5 and release checks in P6. Add relevant tests alongside each stage rather than deferring all verification to P6. The earlier Milestone G remains a separate backlog.
