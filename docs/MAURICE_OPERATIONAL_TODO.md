# Maurice / Fontenoy operational TODO

Scope corrected on 2026-10-25: Maurice is the default tactical game and Fontenoy/Tournai in 1745 is the campaign setting. Reuse/adapt C3i mechanics for simultaneous campaign play. Waterloo scenario data, Napoleonic commanders, Prussian formations and Waterloo-specific victory/special units are outside the product scope.

## Implemented

- [x] Keep existing Maurice Fontenoy creation, saves, setup, tabletop and aftermath/siege workflows available.
- [x] Create a simultaneous Fontenoy profile with the sourced 38-unit Maurice roster, opening qualities/types/contingents, French/Dutch/Anglo-Allied columns and 1745 calendar.
- [x] Carry over Fontenoy schematic locations, configured roads/rivers, unspecified scale, Maurice de Saxe/Cumberland and Tournai investment/relief objectives. No Waterloo force or map data is used for the new campaign.
- [x] Make an independently journaled operational copy from a saved Fontenoy setup without changing its source history. Operational clones remain Fontenoy.
- [x] Preserve actual unit/commander mappings in column inspection and frozen battle/reinforcement briefs. Default manual tactical results to Maurice while allowing other games.
- [x] Add simultaneous movement, conditional reinforcement windows, manual result corrections, ordinary screens, simultaneous withdrawals and own-side zone/HQ overlays.
- [x] Complete final validation and packaging of the corrected Maurice-centred workflow: 169 unit/integration tests, all 23 built/packaged desktop checks, development launch, typecheck, lint and formatting pass. Windows 0.8.0 package rebuilt; actual Fontenoy map/roster visually inspected and private reference exclusion verified.

## Next integration work

### Current increment: per-unit aftermath

- [x] Optional versioned loss policy and explicit calendar-time conversion; prospective enablement preserves earlier saves and battle snapshots.
- [x] Manual per-unit outcomes/disruption/notes and optional battle Army Morale, reviewed with existing result approval.
- [x] Shared loss/rebuild policy, timed recovery at explicit phase finalization, ready-only future briefs and safe result correction baselines.
- [x] Umpire policy/result/recovery controls, faction-safe roster status and journal/restart/import/clone validation.
- [x] Domain, persistence and built/packaged workflow checks; document policy defaults and limits before starting siege integration.

- [x] Connect per-unit manual Maurice battle observations and explicit unit loss/rebuilding/recovery to the simultaneous campaign, reusing the existing aftermath policies with reviewed time conversion. Keep tactical adjudication external.
- [ ] Integrate Tournai investment, supply, relief, siege progress and campaign victory into shared-phase checkpoints; preserve recorded conditions and explanations.
- [ ] Carry over commander/Notable management, optional Epic Points and scouting/intelligence without automating private card rules.
- [ ] Add explicit upgrade/reconciliation for ongoing Fontenoy campaigns if wanted; the current action deliberately creates a fresh operational setup copy.
- [ ] Add operational arrivals/entry queues and reinforce-battle scheduling across phase boundaries, including delayed/cancelled approaches and interception review.
- [ ] Add agreed battlefield objectives/terrain editors, configurable operational charts and structured detachment troop allocation without duplicating parent units.
- [ ] Playtest Fontenoy/Tournai with Maurice, tune provisional geography/time/command defaults and refine usability.

The earlier [C3i mechanics checklist](WATERLOO_TODO.md) is historical design/research context. Its Waterloo-specific scenario/special-rule items are superseded by this setting decision, not future commitments.

## 0.9.0 completion evidence — 2026-10-25

187 unit/integration tests and all 25 built/packaged Electron checks pass. This includes explicit policy enablement and calendar conversion, cancelled confirmations/draft retention, unit observations and previews, battle-end rebuilding, due recovery only at finalization, safe corrections/dependent-correction rejection, queue privacy, frozen roster conservation, ready-only future briefs, transaction rollback, restart/portable replay/tamper rejection and opening-quality clones. Typecheck, lint, whole-project formatting, production build and Windows packaging pass. The packaged after-action record was visually inspected. Tests used isolated profiles; no player saves were changed and no push/publish was performed. Two-human tabletop playtesting remains future work.

Next: Tournai investment, supply, relief, siege progress and campaign victory at shared-phase checkpoints. Commander/Notable/Epic Point/scouting integration and structured detachment troop allocation remain separate pending items.

Development launch/navigation/style validation also passes with external requests blocked. The running checklist records the complete acceptance evidence.
