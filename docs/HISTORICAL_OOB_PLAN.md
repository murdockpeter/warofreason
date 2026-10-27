# Historical Fontenoy/Tournai order of battle

Scope confirmed by the player on 2026-10-27: the full Fontenoy/Tournai campaign, including separately attested siege forces and arrivals, rather than only the army present at the battle on 11 May.

Status: the separate playable historical regimental profile is implemented in 0.16.0; full-campaign research and human scale playtesting remain pending. The current 38-unit Maurice scenario remains available. The Historical OOB drawer contains 181 organization records, including hierarchy containers, from the player-selected Wikipedia baseline; these are not 181 game units.

Implementation started on 2026-10-27. The player supplied WDS top-level organization trees, then selected Wikipedia as the working baseline instead of waiting for more images. The main battle article and subsequent WDS battlefield screenshot provide context. Use the pinned articles and attribution recorded in [Historical OOB sources](HISTORICAL_OOB_SOURCES.md). The offline drawer provides source-aware search, contingent filtering, hierarchy paths, reported complements and an approach timeline. Further WDS images are optional; retain any local copies under ignored `contextignore/historical-oob/`, never in the package. No WDS ratings become Maurice ratings.

The initial catalogue contract is in `src/domain/historical-oob-schema.ts`. It validates identities, organization/service hierarchy, dated aliases, source locators, unresolved dates and conflicting strength claims. It does not replace the current playable roster or silently assign ratings.

## Historical identities and campaign scope

Build a dated historical catalogue before assigning game ratings. Cover the field armies, Tournai investment/siege forces, detachments, reserves and arrivals where evidence supports their participation. Do not assume every unit appearing in an 11 May battle order was present on the proposed 1 May opening date. Campaign end date and the successive siege/citadel stages need explicit source review.

Record the contemporary designation, original-language spelling, searchable aliases, contingent, arm, parent regiment and subordinate battalion/squadron identifiers where attested. Separate the historical catalogue key from the existing campaign-instance UUID. Treat an application catalogue code as an application identifier, not an eighteenth-century official designation. Later regimental numbers and modern successor names belong in dated aliases unless their contemporary use is established.

Represent infantry battalions within regiments, cavalry regiments with squadron detail where supported, and artillery organizations/detachments at the level actually documented. Avoid inventing battery names, squadron numbers or precise strengths when sources give only aggregate totals. Keep historical establishments, reported strengths and scenario estimates as separate claims. Missing values remain unknown, with conflicting claims retained for review.

Separate coalition side from historical contingent. The current French/Dutch/Anglo-Allied grouping is too coarse for a detailed catalogue. Determine the actual participating contingents and organizations from sources; do not expand the roster by assuming that every contingent mentioned in a regional campaign map fought at Fontenoy.

## Initial source register

These catalogue descriptions were inspected on 2026-10-27. They establish useful source material; they are not a complete unit transcription or independent confirmation of every formation.

- Royal Collection Trust, RCIN 729003, François Hancko, map of Allied encampments in 1744/1745 with an Allied order of battle: https://militarymaps.rct.uk/war-of-the-austrian-succession-1740-8/map-of-the-netherlands-1744-5/order-of-battle-of-the-allied-army-at-fontenoy-1745-fontenoy-walloon . Its description/transcription contains different date references, including an Old Style inscription. Resolve the date context when transcribing; retain the original date notation alongside any normalized date.
- Royal Collection Trust, RCIN 729105, Morel's 1745 Fontenoy plan, whose catalogue describes a key to named French regiments: https://militarymaps.rct.uk/war-of-the-austrian-succession-1740-8/map-of-the-battle-of-fontenoy-1745-fontenoy-walloon-region-belgium-50deg3403n-03deg2824e-7 . Verify names against the actual document and other evidence before adding catalogue entries.

Next research, without blocking the working Wikipedia baseline: identify accessible French siege/field-army returns and Allied contingent returns, cross-check regimental/battalion identities and dated assignments, reconcile duplicate names and establish what is known at campaign opening. Attach a document/page/key reference to each accepted claim. A source image being accessible online does not authorize bundling that reproduction in the app; distribute original catalogue data and citations rather than copying scans or modern scenario sheets.

### Public-domain texts inspected during implementation

- F. H. B. Skrine, _Fontenoy and Great Britain's share in the War of the Austrian Succession_ (1906), Internet Archive `cu31924027889686`: https://archive.org/details/cu31924027889686 . Chapters covering pp. 142–146 distinguish the Allied approach and reinforcements from the final battle army. Appendix II, pp. 368–370, prints period British corps names alongside later successor names; Appendix I explicitly lists regiments existing at the author's time and must not supply unqualified 1745 display names. Appendix III, pp. 371–372, gives French plan keys and distinguishes bridge/redoubt detachments and late arrivals.
- Charles Pierre Victor Pajol, _Les guerres sous Louis XV_, volume III, Internet Archive `guerressouslouis03pajo`: https://archive.org/details/guerressouslouis03pajo . Page 367 lists the French forces for the 1745 Flanders campaign, including troops whose opening-day participation remains to be established. This annual list cannot be seeded wholesale as the force present at Tournai on 1 May. The chronology on p. 364 and siege-force footnote on p. 377 give different counts; retain those as distinct unresolved source claims instead of manufacturing a reconciled number.

OCR text is cached only in ignored `test-results/oob-research/` and is not distributable app content. Check original page images where names/counts are ambiguous. The historical catalogue is a battle reference. The 143-record playable profile carries those identities/complements with an explicit representation review; it does not certify complete physical troop totals or siege allocations.

## Keep historical organization and tabletop representation distinct

Keep map counters grouped into manageable campaign formations. Inspection should expand formation → regiment → battalion/squadron detail, with search, totals and clear readiness. A full historical roster does not require a counter for every subordinate unit on the campaign map.

Store explicit mappings between historical organizations and the game's playable units. A historical battalion must not silently become one Maurice game unit; the scale, grouping and ratings require a reviewed scenario adaptation. Historical identities can be verified while game quality, starting strength and campaign deployment remain provisional. Neither regiment fame nor a later reputation automatically determines Maurice quality or Notable/card effects.

The existing 20 French / 18 Allied scenario is a separate supported profile. An enlarged historical campaign profile needs module-driven roster validation and reviewed tabletop scaling, not a renaming of its 38 abstract units.

## Architecture and compatibility

Current constraints include exact 38-unit checks in `fontenoy.ts`, `fontenoy-operational.ts` and `waterloo-schema.ts`, plus fixed contingent/composition checks. Replace assumptions with profile-specific validation while retaining the existing profile's exact checks and portable replay. Review every frozen battle roster, clone baseline, recovery decision and intelligence snapshot against the new identity/mapping model.

Proposed records:

- Historical organization: stable catalogue key, contemporary display designation, dated aliases, arm/contingent, parent and subordinate identifiers.
- Evidence claim: source identifier, page/key, date notation, normalized date when established, asserted strength/assignment, verification status and explanatory notes.
- Campaign instance: existing UUID, historical catalogue reference, current formation/location/status and explicit arrival/departure record.
- Tabletop mapping: historical membership, game-unit identity, reviewed scale/grouping, classification/quality provenance and adaptation version.

Do not silently rewrite existing campaigns or infer detailed historical losses from an old abstract-unit result. Start the new profile as a separately reviewed campaign. Any later reconciliation of an ongoing save requires an explicit mapping and review, preserving original journals and earlier battle briefs.

## Delivery checklist

- [x] Confirm full campaign scope with the player.
- [x] Inspect current roster constraints and identify initial contemporary source collections.
- [x] Transcribe the player-selected battle OOB baseline with pinned source revisions, attribution, unknowns and conflicts.
- [x] Add the searchable reference OOB drawer and approach timeline.
- [ ] Reconcile the battle roster with the siege army and dated full-campaign dispositions.
- [x] Review the hierarchy, identity model and service vocabulary; implement explicit regimental-record scale and house-rating acknowledgement.
- [x] Add a separate 143-record historical profile with profile-specific validation and safe persistence/clone/replay behavior.
- [x] Link historical organizations/complements to 14 reviewed campaign formations, inspection, orders and frozen battle briefs, keeping map counters grouped.
- [ ] Add arrivals and structured detachment allocations without duplicate troops.
- [x] Validate linked record conservation, source identities, faction filtering, frozen briefs, recovery, imports and original-profile compatibility. Physical source overlaps remain unresolved historical research.
- [ ] Conduct a human turn/tabletop walkthrough before treating game scaling or campaign dispositions as settled.

## Delivered linkage

See [Playable historical formations](HISTORICAL_FORMATIONS.md). Choose New historical Fontenoy campaign on Dashboard, or Create historical campaign from the existing formation/reference drawer. The previous campaign is preserved. The new profile begins on 11 May, assigns all catalogue leaf records, displays real names and reported complements, and requires explicit review of representation, proposed grades, provisional deployment and source gaps before play.
