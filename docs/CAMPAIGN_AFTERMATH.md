# Campaign aftermath, siege and victory (Milestone F)

All policies below are **campaign house rules**, identified as `house_rule_v0.1/aftermath-1`. They are not official Maurice campaign mechanics. Play tactical battles with your own Maurice materials; enter Epic Points from those materials manually. The companion supplies no official Epic Point formula, card effects, retreat or pursuit procedure.

## Start using F

Restart development with `npm run dev`, or launch the rebuilt executable. Open a started campaign with operational play enabled. In umpire view, open **Siege & Victory → Enable post-battle and siege rules**. This is prospective: earlier saves, journal snapshots, movements and results are retained, without replaying past siege turns. If the operational deadline has already been reached, its final turn becomes available for review.

Use **Review campaign house rules** before applying effects. Defaults live in `src/data/aftermath.v0.1.json`, parsed by the domain rules schema. Two replaceable pure strategies are available: `conscript_rebuild_v1` follows the chosen recovery policy for every broken unit; `manual_review_v1` permits individual loss/rebuild decisions within the allowed variant.

| Setting                                    | Initial proposal                            |
| ------------------------------------------ | ------------------------------------------- |
| Broken regular infantry/cavalry            | Rebuild at conscript quality                |
| Broken irregulars/artillery                | Lost; optional same-classification recovery |
| Rebuilding delay                           | 1 campaign turn                             |
| Retired-unit rest                          | 0 turns; no readiness/quality change        |
| Supplied investment                        | +1 siege progress per finalized turn        |
| Siege threshold                            | 6                                           |
| Campaign exhaustion threshold              | 10; can be disabled                         |
| Deadline without another winning condition | Allied                                      |
| Simultaneous opposing winning conditions   | Draw                                        |

Players must agree these proposals. Changing settings affects subsequent reviews/checkpoints; recorded rules snapshots and already scheduled recovery dates remain unchanged.

## Review a played battle

1. Confirm the manual result in Battle Log, then choose **Review post-battle campaign changes**. Alternatively open the battle's review in Siege & Victory.
2. Review each broken-unit action and commander status. Regular rebuilding sets current quality to conscript, preserves opening quality separately and schedules recovery. Lost units remain in the roster as lost. Artillery/irregulars never gain regular quality. Optional rest for retired units preserves their quality. Survived/not-engaged units retain readiness and quality. Final tactical disruption is retained only as a battle observation.
3. Agree post-battle squares for every participant. Opposing columns must be separated before the hold is released. No automatic withdrawal distance, route, pursuit or winner placement is inferred.
4. Enter Epic Points separately for each side, or leave blank if not yet recorded. Blank is distinct from zero. The summary adds only entered values and reports reviewed battles with missing values. No points are derived from decisive/marginal/draw labels or Army Morale.
5. Enter any agreed campaign exhaustion increases, independently of tactical Army Morale. Add review notes and inspect the preview, then **Review and apply battle changes**. The native confirmation defaults to cancellation; cancellation/error preserves the draft. Confirmation commits one immutable review and journal event. A battle can be applied only once.

Reviewed columns become available for later operations and battles. Only ready units enter a new brief; only columns containing ready units block movement or create fresh hostile contacts. Recovering/lost units retain their column assignment. A new brief uses current qualities, while earlier briefs retain their frozen original values. Opening generic unit names remain stable; inspect current quality/readiness separately.

## Commanders and Notables

Record arrivals explicitly with a name, faction, private reference and reason. Attach active officers only to friendly columns, or leave them unattached. Explicit lost/retired status detaches the officer. Committed commanders must first be reviewed through their battle aftermath; attachments on committed columns cannot change. No officer disappears, arrives, retires or receives a card bonus automatically.

## Complete a campaign turn

Record **investment, supply and relief** as umpire-verified conditions with a reason. The application does not infer supply lines from the decorative map, French presence or town ownership. These conditions persist until explicitly revised. Campaign exhaustion can also be recorded independently with a reason; it is never copied from battle Army Morale.

After the second faction resolves its phase, operations pause at a completed-turn checkpoint. The displayed day advances as before, but no new orders/scouting can begin until the checkpoint is finalized. Finish any outstanding contacts, battles and campaign reviews, then select **Finalize turn N** and confirm. This single transaction:

1. Returns due recovering units to ready, retaining their rebuilt quality.
2. Adds siege progress only when investment and supply are verified and relief is absent.
3. Evaluates victory and records the complete checkpoint with its rules, conditions, exhaustion and changes.

Recovery due dates use the campaign turn when the review is applied plus the selected delay. Checkpoints process units due by the current displayed turn. For example, a turn-1 review with delay 1 is due at turn 2 and returns at the turn-1 checkpoint after the date advances. A review entered after that advance is dated turn 2 and becomes due turn 3. At the final deadline there is no extra turn advance or recovery beyond the configured campaign window.

## Victory precedence

Victory is evaluated only during explicit finalization, never immediately after editing a setting or condition. French claims arise from reaching the siege threshold with verified investment and supply, or Allied campaign exhaustion. Allied claims arise from verified relief or French campaign exhaustion. If both sides have a claim, the configured conflict result applies. This deliberately supports disputed simultaneous siege/relief claims without silently choosing a precedence.

A single substantive claim wins, including on the final turn. The configured deadline result is used only when no substantive condition holds and the configured last turn has completed. Earlier checkpoints with no claim keep the campaign open. The outcome stores its reasons and turn; subsequent operational/tabletop/strategic changes are blocked. Rename, backup, archive and fresh setup cloning remain available.

## Persistence and audit

Every committed F action has actor/reason, timestamp, before/after state and a replayable command receipt. The after-action screen lists quality/readiness changes, recovery dates, commander decisions, agreed squares, manual points and checkpoint history. Full JSON backups include all of it; faction exports remain redacted player views rather than backups.

F is an optional extension to aggregate 2, retaining SQL migration 001 and export format 2. Existing histories are not rewritten. Restart/import validate journal continuity and command replay. Cloning creates an independent setup draft, removes operational/tabletop/aftermath history, restores opening unit quality/readiness and active commander statuses, and remaps references. Do not reopen updated campaigns in older application versions.

Physical tabletop playtesting, printing beyond battle briefs, the campaign overview and previous-turn forks belong to Milestone G. A dedicated interface simplification pass follows the functional milestones.
