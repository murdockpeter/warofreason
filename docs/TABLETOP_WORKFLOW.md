# Scouting and tabletop bridge (Milestone E)

This increment records reconnaissance decisions and physical Maurice battles. All campaign eligibility, scouting ranges/lifetimes, entry edges and reinforcement arrangements are provisional house rules. There is no automatic Maurice combat engine, scouting success table or card-effect interpreter.

## Scouting

1. Start a reviewed campaign and enable operational play. Use **Battle Log** in umpire view during the active faction's planning phase.
2. Choose **Record scouting**, select an active-side scout and an opposing column. The umpire can see hidden targets; faction views cannot use the form to enumerate them.
3. Enter a physical d6 or choose **Roll scouting die**. Record any agreed modifier and its reason. The modified total is shown for reference only; the umpire selects the released intelligence.
4. Choose **unknown**, **located**, **estimated**, or **identified**. An estimate requires approved free text. Save the report.
5. Check Campaign Map in the observer's faction view. Located reports disclose only the observed square; estimated adds the approved estimate; identified discloses the observed roster/commanders/name. Hidden positions and composition come from the dated snapshot, not the target's live state.

Defaults in `src/data/tabletop.v0.1.json` are range 1 orthogonal square, lifetime 1 campaign turn, one attempt per column per turn, and ready regular cavalry/irregular cavalry/irregular infantry as eligible scouts. **Review scouting rules** changes these values without rewriting existing reports. No movement points are automatically charged for scouting. A column held for an engagement/battle cannot scout. Failed/unknown reports also consume an attempt.

A report is current while `campaign.turn < expiresAtTurn`. The newest report for an observer/target supersedes earlier reports, including an unknown result; expired reports never revive older intelligence. Full reports remain in the umpire record and journal. Opposing reports, raw snapshots and expired intelligence are not included in faction exports.

## Declare a battle

1. Resolve a legal route into an opposing occupied square. Movement stops before contact and records an engagement candidate. Existing co-located opposing setup columns also create candidates when operational play is enabled.
2. Open **Scouting & battle briefs**, then **Declare Battle** for the candidate.
3. Step 1 selects participants and entry edges. Both primary columns begin on the table. Participants must be within the configured orthogonal joining range (default 1 square), have ready units and belong to the corresponding faction. The joining range is adjustable alongside the scouting rules. A column cannot be committed to more than one battle. Reinforcements need explicit player-agreed arrival notes; no standard Maurice arrival timing is invented.
4. Step 2 records the title, objectives, terrain notes and special instructions. The decorative campaign map never determines tactical terrain automatically. Private card titles/effects may be entered by players in their own notes; no rules/card text is supplied.
5. Step 3 reviews the declaration. Saving freezes ready-unit types/qualities/contingents, commanders/Notable names, column origins, sides, entry edges and instructions. All selected columns are held.

Declarations/results are allowed after the operational deadline so a final contact can still be played. Reopen or resolve issued orders before tabletop actions. Declaration does not change the active faction, campaign day or positions.

## Print, play and record

1. **Save printable PDF** creates an A4 document. **Export brief HTML** creates an offline printable page. Open either file in your normal reader/browser to print. These are shared umpire/tabletop documents containing both sides' committed forces, not fog-of-war exports.
2. Choose **Begin tabletop battle**, then play Maurice with your physical game materials.
3. Choose **Enter battle result**. Select French decisive/marginal, draw or Allied marginal/decisive based on the actual tabletop result. The app does not compute the winner.
4. Enter an outcome for every committed unit: broken, retired, survived, or not engaged (for a force that did not take part). **Mark remaining units survived** is an explicit user action, never a default assumption. Optionally record final disruption and notes. Record commander/Notable status changes and optional final Army Morale for this battle.
5. **Review and confirm result** opens a native confirmation defaulting to **Keep editing**. Cancellation and validation/storage failures preserve the draft. Navigation retains it; replacing it or closing the app requires the existing discard confirmation.
6. Confirmation saves a read-only battle result and immutable journal receipt/snapshots. Restart or export/import a full campaign backup to retain all records.

## Boundary with Milestone F

Results do not themselves change campaign unit readiness, quality, commander status, siege progress, exhaustion or victory. Final tactical disruption is an observation, not a permanent campaign status. Battle Army Morale is separate from campaign exhaustion. Milestone F now provides a separate **Siege & Victory** review to apply explicitly agreed campaign changes and release participants. See [CAMPAIGN_AFTERMATH.md](CAMPAIGN_AFTERMATH.md). The app does not infer retreat or pursuit.

Existing campaign histories are preserved. Aggregate v2 gains an optional tabletop extension only when a tabletop action is committed. Full format-2 backups include its records and auditable commands; clones reset both operational and tabletop history into an independent setup draft. Do not reopen updated saves with older application versions.
