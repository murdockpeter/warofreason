# Domain glossary

The entries below primarily describe the existing Fontenoy profile. The new simultaneous profile adds:

- **Shared phase:** an AM/PM planning window with separate side submissions and one campaign clock; there is no active-side movement advantage.
- **Activation segment:** a predeclared corps path with travel mode, HQ and earliest departure, bounded by movement allowance and a 120-minute window. Up to three per corps per phase.
- **Army versus side:** French opposes the Allied side. In Fontenoy, Dutch and Anglo-Allied formations retain distinct HQ affiliations; Prussian formations belong only to the earlier reference fixture.
- **Tactical reinforcement window:** conditional earliest/likely/latest times at an approach edge, expressed in campaign time and optionally external-game turns. Commitment reserves the whole corps; an estimate alone does not.
- **Manual result revision:** a neutral external-game record with explicit campaign decisions. Recording, approving and applying are distinct. Corrections supersede earlier revisions and compensate applied effects only without later dependencies.
- **Schema 3:** the simultaneous aggregate supports `maurice_operational_v0.1` for Fontenoy and the earlier `waterloo_simultaneous_v0.1` reference fixture. Fontenoy carries its actual Maurice unit/commander mappings and siege/objective context. Export format 2 supports aggregate schemas 1, 2 and 3. Existing Fontenoy histories retain their prior payloads and rules.
- **Ordinary screen:** a stationary detachment allocated from a named parent corps. It projects adjacent control, can be deployed by an associated HQ once per phase, and can return to reserve by recall. Recalled screens are available next phase; their actual tactical troops must not duplicate the parent roster.
- **Simultaneous withdrawal:** an independently locked three-step retreat before movement. A shared preview/confirmation resolves both sides together; blocked corps become blown and all withdrawing corps hold for the rest of the phase. Empty holds consume no time. This opt-in preparation state preserves earlier schema-3 journals without rewriting them.

See [the current simultaneous gameplay guide](MAURICE_FONTENOY_OPERATIONS.md).

- **Campaign aftermath:** a separate confirmed review of a frozen battle result, recording losses/rebuilding, scheduled rest, commander decisions, agreed squares, manual Epic Points and independent exhaustion additions. It releases the battle hold once and retains the original tactical record.
- **Opening/current quality:** `initialQuality` retains a rebuilt regular unit's opening elite/trained fact; `quality` is its current classification, including conscript. Scenario totals validate opening facts, while new briefs use current classification. Artillery/irregular quality remains null.
- **Completed-turn checkpoint:** an explicit pause after both faction phases; finalization processes due recoveries, verified supplied investment and victory once after all encounters/results/reviews are complete. An outcome locks further strategic play.
- **Epic Points:** manually entered per-side battle values, with nullable unrecorded entries and a summary; no official formula is inferred. **Campaign exhaustion** is a separate operational total, not per-battle Army Morale.
- **Commander campaign status:** active/lost/retired with explicit arrivals and friendly attachments; unavailable officers detach. Private Notable references do not execute tactical effects.

- **Scouting report / contact:** an umpire-adjudicated roll, modifier and reason, recorded with observer, campaign day/turn, audit timestamp, observed snapshot and expiry. Unknown releases nothing; located releases an observed square; estimated adds approved text; identified releases the observed roster/name/commanders. The latest report supersedes earlier reports; expiration does not revive old intelligence.
- **Battle declaration / brief:** a frozen shared record of an engagement's selected initial/reinforcement forces, unit types/qualities, commanders/Notable names, origins, entry edges and agreed setup notes. Participants are committed and cannot be used in another battle or movement order.
- **Manual battle result:** a confirmed, immutable played-tabletop outcome with one result per committed unit and commander, optional final disruption and battle Army Morale. It does not itself change campaign readiness/quality, commander state, siege or victory. Those effects belong to F.

- **Operational phase:** planning (unissued draft orders may be edited/undone), resolution (issued orders saved, movement not yet committed), or finished (the configured deadline has been reached). A return to planning preserves earlier issued snapshots in the journal.
- **Movement order:** one column's path including its origin and orthogonally adjacent steps. A one-square path means hold. Unordered columns also hold. Costs and blocks are versioned provisional house rules.
- **Engagement candidate:** deterministic hostile contact record, pending Milestone E. Movement stops before the occupied square; participants are held. It is not a declared battle or an automated tactical outcome.
- **Faction view:** allowlisted projection that omits concealed opponents and all opposing rosters, commanders and orders. Faction JSON excludes history and is not a backup. The umpire view/full backup retains everything on the shared local desktop.

- **Campaign draft:** a saved preparation record. Legacy schema-1 drafts are unconfigured; schema-2 drafts contain the Fontenoy forces and proposed operational setup. Turn remains zero, with no current campaign date or active faction, until Start Campaign. This is distinct from an uncommitted form/setup edit.
- **Uncommitted edit:** transient form input, retained across screen navigation and undoable until saved/discarded. It is not a campaign action and creates no journal event.
- **Revision:** a positive, increasing campaign snapshot number. Commands that edit an existing campaign specify the revision they observed; stale revisions fail without mutation.
- **Aggregate:** one campaign and its factions, units, commanders, columns and map squares. UUID references must resolve within this aggregate; IDs and map coordinates must be unique. Columns cannot contain another faction's units or commanders, nor assign an entity more than once.
- **Unit classification:** Maurice type/quality vocabulary from the supplied plan. Regular infantry/cavalry use elite/trained/conscript; irregular units and artillery use null quality. No historical forces or tactical effects are seeded in B.
- **Journal event:** an immutable committed change with actor, category, reason, timestamp, ruleset version and before/after campaign snapshots. Its after revision follows the previous snapshot. Imported history is structurally validated, not independently authenticated.
- **Archive:** a retained, read-only campaign record. It can still be opened, exported or cloned.
- **Clone:** an independent aggregate with new UUIDs, remapped references (including map edges and objectives), a new seed and a new journal recording the source campaign ID. Lifecycle returns to draft; the source record remains unchanged.
- **Portable campaign JSON:** format `maurice-campaign`, current format version 2, aggregate schema 1 or 2 and complete journal. Legacy format-1 imports remain supported. Unknown versions are rejected rather than guessed or silently coerced.
- **Module/ruleset version:** configured campaigns use module `0.1.0` and operational ruleset `house_rule_v0.1`; legacy records retain `unconfigured`. Published tactical rules/scenario facts, researched history and provisional operational choices remain separate provenance categories. Tactical Army Morale is never treated as campaign exhaustion.
- **Contingent:** a unit's retained source grouping (`french`, `dutch`, `anglo_allied`), independent of the player's editable column assignments.
- **Setup acknowledgement:** recorded player review of provisional operational choices and the unverified schematic. Both acknowledgements and complete assignments are required before starting; this does not certify historical accuracy or official campaign rules.
