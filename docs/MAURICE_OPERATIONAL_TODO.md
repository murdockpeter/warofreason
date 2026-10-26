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

### Completed increment: per-unit aftermath

- [x] Optional versioned loss policy and explicit calendar-time conversion; prospective enablement preserves earlier saves and battle snapshots.
- [x] Manual per-unit outcomes/disruption/notes and optional battle Army Morale, reviewed with existing result approval.
- [x] Shared loss/rebuild policy, timed recovery at explicit phase finalization, ready-only future briefs and safe result correction baselines.
- [x] Umpire policy/result/recovery controls, faction-safe roster status and journal/restart/import/clone validation.
- [x] Domain, persistence and built/packaged workflow checks; document policy defaults and limits before starting siege integration.

- [x] Connect per-unit manual Maurice battle observations and explicit unit loss/rebuilding/recovery to the simultaneous campaign, reusing the existing aftermath policies with reviewed time conversion. Keep tactical adjudication external.

### Completed increment: Tournai siege and victory

- [x] Explicit opt-in versioned policy and calendar cadence/deadline; no retrospective time credit or inferred map supply/relief.
- [x] Explained umpire conditions/exhaustion review at a fully settled checkpoint, preview and confirmation/draft guards.
- [x] Eligible calendar accumulation, shared victory evaluator, immutable checkpoint history and read-only concluded campaigns.
- [x] Compact Tournai panel, contextual Help, compatibility/provenance documentation and fresh-setup cloning.
- [x] Complete domain/repository/UI and built/packaged acceptance; record final evidence.

- [x] Integrate Tournai investment, supply, relief, siege progress and campaign victory into shared-phase checkpoints; preserve recorded conditions and explanations.

### Remaining integration work

- [x] Carry over commander/Notable management without automating private card rules: opt-in baseline, manual arrivals/details/status/attachments, faction-safe history, frozen briefs and baseline clones.
- [ ] Add optional Epic Points and scouting/intelligence to simultaneous campaigns without automating private card rules.
- [ ] Add explicit upgrade/reconciliation for ongoing Fontenoy campaigns if wanted; the current action deliberately creates a fresh operational setup copy.
- [ ] Add operational arrivals/entry queues and reinforce-battle scheduling across phase boundaries, including delayed/cancelled approaches and interception review.
- [ ] Add agreed battlefield objectives/terrain editors, configurable operational charts and structured detachment troop allocation without duplicating parent units.
- [ ] Playtest Fontenoy/Tournai with Maurice, tune provisional geography/time/command defaults and refine usability.

The earlier [C3i mechanics checklist](WATERLOO_TODO.md) is historical design/research context. Its Waterloo-specific scenario/special-rule items are superseded by this setting decision, not future commitments.

## 0.9.0 completion evidence — 2026-10-25

187 unit/integration tests and all 25 built/packaged Electron checks pass. This includes explicit policy enablement and calendar conversion, cancelled confirmations/draft retention, unit observations and previews, battle-end rebuilding, due recovery only at finalization, safe corrections/dependent-correction rejection, queue privacy, frozen roster conservation, ready-only future briefs, transaction rollback, restart/portable replay/tamper rejection and opening-quality clones. Typecheck, lint, whole-project formatting, production build and Windows packaging pass. The packaged after-action record was visually inspected. Tests used isolated profiles; no player saves were changed and no push/publish was performed. Two-human tabletop playtesting remains future work.

Next: Tournai investment, supply, relief, siege progress and campaign victory at shared-phase checkpoints. Commander/Notable/Epic Point/scouting integration and structured detachment troop allocation remain separate pending items.

Development launch/navigation/style validation also passes with external requests blocked. The running checklist records the complete acceptance evidence.

## 0.10.0 completion evidence - 2026-10-26

209 unit/integration tests and all 27 built/packaged Electron checks pass. New coverage includes prospective enablement, source calendar cadence/overnight intervals, paused supply, relief, separate exhaustion, deadline/conflicting conditions, checkpoint-only effects, frozen policies/explanations, correction dependencies, concluded campaign locking, recovery at the final clock, schema/replay tamper rejection, transaction rollback, restart/import and fresh-setup cloning. Both new built/packaged walkthroughs pass again after the final scoped presentation change. The packaged Tournai outcome panel was visually inspected. Development startup/navigation/style validation passes with external requests blocked; typecheck, lint, whole-project formatting, production build and Windows packaging pass. Tests used isolated profiles; no player saves were changed and no commit/push/publish was performed.

Next: commander/Notable management, optional Epic Points and scouting/intelligence integration. Human tabletop playtesting, calibration of these provisional campaign rules and the remaining integration items above are still pending.

## Player helper mode - 0.10.1 / 2026-10-26

The usability increment adds on-by-default contextual choices, stage guidance, visible control highlights and explicit Show me navigation/focus. It covers setup/library, current planning side, move/hold, locks and waiting, preparation, battle entry/approval/resolution, siege checkpoints, completion and unfinished drafts. The top-bar toggle remembers a local UI preference; no campaign action or view switch is automatic. Opposing routes/rosters remain withheld. All 217 unit/integration tests, all 29 desktop checks and development startup pass, together with typecheck, lint, formatting, build and Windows packaging. The packaged helper panel was visually inspected. This does not complete any remaining mechanics block; commander/Notable, Epic Point and scouting integration remains next.

## Commander/Notable increment - 0.11.0 / 2026-10-26

Commander management is complete as a focused increment: explicit opt-in reviewed roster/attachment baseline; manual arrivals, private references, status and own-side attachments; inactive detachment, frozen briefs, guarded dependent corrections, faction-safe history and baseline clones. The collapsed panel and Helper planning/checkpoint choices keep this optional administration out of the normal turn path. No card effects, tactical officer losses or HQ bonuses are automated.

All 235 unit/integration tests and the full 31-check built/packaged desktop suite pass. Commander and helper pairs pass again after final adjustments. Offline development startup, typecheck, lint, whole-project formatting, production build and Windows unpacked packaging pass; packaged commander controls were visually inspected. Persistence coverage includes rollback, restart, portable replay/tamper rejection and baseline cloning. Tests used isolated profiles; no player saves changed and no commit/push/publish occurred.

Next: optional manual Epic Points, followed by simultaneous scouting/intelligence integration. Ongoing-save reconciliation, operational arrivals, structured detachment allocation and human playtesting remain pending.
