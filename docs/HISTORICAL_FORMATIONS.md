# Playable historical Fontenoy formations (0.16.1)

The historical profile connects the pinned catalogue to actual operational formations and persistent roster records. It is a separate campaign profile alongside the original French 20 / Allied 18 Maurice scenario.

## Start a historical campaign

1. Open **Dashboard → New historical Fontenoy campaign**. Alternatively, open **Historical OOB → Create historical campaign** in an existing simultaneous game, or expand **Where are the historical unit names?** in its formation inspector.
2. The app creates a new campaign and opens umpire setup. Your original campaign, including orders, losses and history, remains in the library. No automatic conversion of an ongoing 38-unit game occurs.
3. Choose **Review historical setup** in Historical OOB. Inspect the roster, source gaps, proposed ratings and provisional deployment. Regular records initially propose **trained**; change any proposed regular ratings under the expandable rating controls. No elite ratings are inferred from reputation.
4. Acknowledge regimental scale, deployment and source coverage, add review notes and confirm. The native dialog defaults to keeping the draft. Orders and other campaign commands remain blocked until this explicit review is saved.
5. Inspect a formation to see historical names and reported complements. **Find regiment in formation** narrows the roster; selecting a name opens its historical record with service, source hierarchy, aliases and evidence. Searching Historical OOB also shows its current formation assignment; **Inspect assigned formation** opens that formation with the selected regiment filtered.

## Representation

- All **143 regimental/aggregate records** in catalogue version 0.1.0 are assigned exactly once to **28 campaign formations (15 French / 13 Allied)**, grouped on a common provisional basis: targets of 12 reported battalions or 24 reported squadrons, with source-listed brigades kept whole and uncertain complements separate. These groupings and their map positions are operational conveniences, not verified historical brigade deployments.
- Each record represents its named historical organization. For example, **Gardes Françaises — 4 battalions** and **Carabiniers — 10 squadrons** retain those reported complements. A four-battalion regiment is not silently converted into four Maurice units. Tactical representation must be agreed at the table.
- A named source battalion or troop retains its own identity. Where the source gives only a count, individual battalion/squadron identifiers are left unspecified. Unnamed aggregates and disputed strengths remain visibly unresolved. No certified combined army headcount is asserted, and possible source overlaps are retained as gaps.
- Historical service remains separate from the operational army grouping. British, Hanoverian and Austrian records use the existing Anglo-Allied operational command framework while inspection shows their actual service; Swiss/Irish origin labels remain source attributes, not coalition changes.
- Operational type and tabletop quality are scenario adaptations. Historical records carry `house_rule_v0.1` provenance and a separate catalogue identity. Regular ratings remain labelled proposed until review and scenario ratings afterward. Rebuilding may subsequently change current quality through the explicitly enabled house recovery policy.
- Opening date is **11 May 1745**, matching the battle roster. This does not reconstruct the 1 May campaign opening or establish the siege army, Tournai garrison or arrival dates. Map geography and deployment remain provisional. Existing siege/recovery policies remain optional and require their ordinary reviews.

## Persistence and tabletop handoff

Catalogue keys are distinct from campaign UUIDs. Each operational unit stores its catalogue/version/organization reference, and the formation stores the actual unit UUIDs. Source hierarchy and complements resolve against the pinned immutable catalogue. See [source attribution](HISTORICAL_OOB_SOURCES.md).

Orders act on the named campaign formation. Its historical roster can be reviewed from the order. Formation inspection, manual availability and frozen battle rosters use the same unit identities. Battle briefs include source names, service, complements and catalogue hierarchy. Regular quality is an agreed scenario rating, never a claim that the source supplies an official Maurice classification.

The historical profile validates its complete catalogue membership, ownership, types, opening ratings and unique assignments. The original profile retains its exact 38-unit and contingent/composition checks. Expanded result/recovery arrays support engagements with more than 38 records; immutable earlier briefs and downstream-effect correction guards remain intact.

Review and outcomes save atomically with replayable command receipts. Restart/import/export preserve the mappings. A fresh setup clone remaps campaign UUIDs while retaining catalogue identities and agreed opening ratings, resets availability/losses/history and requires a new setup review. It does not rewrite its source campaign.

## Remaining work

Independently reconcile full siege/garrison returns, earlier campaign dispositions and arrivals; implement structured splitting/allocation where troops can be conserved without duplication; and playtest tactical scale and grades with humans. This profile delivers the linked battle-roster baseline, not a certified full-campaign return or automatic Maurice tactical engine.

## Revised map grouping (0.16.1)

Earlier historical setups used three French and eleven Allied formations, pooling French arms while splitting Allied services. Counter counts therefore gave a misleading picture and formation-level orders treated very different packets alike.

New setups use the common grouping above. Counter badges show reported battalions (`b`), squadrons (`s`), unknown additions (`+?`) or artillery records (`rec`); artillery counters read `ART`. Artillery battalion returns and gun totals are not equated. These source complements are not current headcounts or combat-power ratings. Map positions remain provisional and require review.

For an untouched, unreviewed older setup, select **Umpire ? Historical OOB ? Regroup this historical setup**. Read the count preview and confirm: this preserves regiment identities and proposed ratings but replaces formations and resets provisional formation/HQ positions. It is journalled and survives export/replay. Reviewed or progressed games retain their grouping; create a separate historical campaign for the revised setup. No player save is silently rewritten.
