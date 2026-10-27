# Manual adjudication (0.15.0)

This is a shared outcome-recording layer for the simultaneous Fontenoy campaign. Rules-assisted orders remain available; the umpire can instead record an agreed manual outcome during clear planning or a settled checkpoint. It implements no official Maurice rule, AI adjudicator or online authorization system.

## Use

1. Select **Umpire** map view. Right-click a formation and choose **Adjudicate manually…**, or open the **Adjudication** bottom drawer and choose **New manual ruling**.
2. Choose a formation, then click its destination hex or choose its position. Add further formations to adjudicate several moves or a position swap atomically. Record posture, ready/off-map/eliminated status and optional descriptive strength. Headquarters positions are under a separate disclosure.
3. Expand **Unit availability** to mark existing game units ready or lost. Preserve historical identity and game quality. Scheduled recovering units retain the existing recovery workflow. Removing a formation does not silently kill its units: an eliminated formation requires all units explicitly lost; an on-map formation requires a ready unit.
4. Optionally record elapsed minutes in five-minute increments within the current phase. **Finish movement manually at phase end** advances to that phase's end and checkpoint review without resolving marches or generating contacts. Finish shared phase then uses the existing explicit finalization workflow.
5. Explain the ruling, review all changes, and confirm. The native confirmation defaults to keeping the draft. Closing the drawer, opening Help and navigating between screens retain it. **Discard ruling draft** uses the normal discard confirmation.
6. Read **Manual ruling history**. **Record correction to this ruling** starts a new change against the current situation, linked to the earlier record. It does not roll back time or erase dependent events.

## Outcomes and boundaries

- Placement bypasses route connectivity, movement cost, terrain restrictions, HQ distance and automatic contact detection. Adjudicate those matters outside the app. A formation can be placed directly on any existing hex, including terrain the automated movement system would reject.
- Existing entity identities, contingent ownership, posture compatibility, non-stacking and unit conservation remain enforced. Managed screens retain their preparation workflow. This increment does not create extra historical units or split the same troops between formations.
- A changed formation position/status sets availability to the ruling's end time and clears its automatic formation-return slot. Changing only posture or reported strength preserves that slot. Pending **unit** recoveries cannot be cancelled through this editor.
- Reported strength is free text, visibly labelled as an umpire estimate. It does not convert men into Maurice units or affect automatic calculations. Inspection and newly frozen battle briefs carry it; earlier battle snapshots retain their original data.
- Rulings do not run combat, recovery, siege progress or victory calculations. Existing enabled recovery/siege policies still apply at **Finish shared phase**, which also resets next-phase postures. The preview explains this. Siege-enabled games still require the ordinary checkpoint review.
- Saved/locked orders, submitted preparation, unresolved encounters/battles, pending siege review, archived campaigns and concluded campaigns block conflicting manual changes. A ruling may waive an otherwise empty preparation phase; it cannot bypass submitted withdrawals. Clear saved orders through their existing editor before adjudicating.
- Drafts bind to the campaign revision they started from. A changed campaign requires discarding/reviewing the draft, in addition to the repository's ordinary optimistic revision guard.
- Rationale, corrections and before/after history are umpire-only in the UI. Friendly position/status/strength follow the existing faction projection. Full campaign JSON and journals are private umpire backups; local views are pass-and-play filters, not online permissions.
- Each ruling is an immutable replayable command in the same SQLite transaction as its resulting campaign state. Later rulings advance the effect dependency serial, protecting earlier applied battle results from silent rewrites. Fresh setup clones omit rulings and reported strengths and reset game-unit availability.

## Larger maps and regions

Manual placement removes the requirement to encode a movement table for every terrain feature. It therefore supports the intended move toward more detailed maps, but **this increment does not enlarge the map**. The present schematic coordinates, geography and storage limits remain in use, and the decorative backdrop is not geographic evidence.

A regional-map increment needs stable region/location identifiers, calibrated scale and coordinates, connected entry/exit points, pan/zoom and level-of-detail rendering. Road width, terrain and distance should be explicit map annotations if players will use them to adjudicate movement. Saved formations, intelligence and frozen battle briefs must retain their original region/location references when map data changes. Online permissions and discussion-driven AI proposals are separate work.
