# Historical reference data and attribution

The player selected Wikipedia as the working baseline on 27 October 2026. Further WDS screenshots are optional supporting references; implementation does not await them.

## Distributed catalogue

`src/domain/fontenoy-historical-catalogue.json` adapts factual designations, organizational complements and selected explicit hierarchy from **Wikipedia contributors, Battle of Fontenoy order of battle**, revision 1380852910, accessed 27 October 2026:

https://en.wikipedia.org/w/index.php?title=Battle_of_Fontenoy_order_of_battle&oldid=1380852910

Contributors/history: https://en.wikipedia.org/w/index.php?title=Battle_of_Fontenoy_order_of_battle&action=history

The approach timeline in `src/domain/fontenoy-historical.ts` paraphrases **Wikipedia contributors, Battle of Fontenoy**, revision 1382120601, accessed the same day:

https://en.wikipedia.org/w/index.php?title=Battle_of_Fontenoy&oldid=1382120601

Contributors/history: https://en.wikipedia.org/w/index.php?title=Battle_of_Fontenoy&action=history

These catalogue/timeline adaptations are distributed under **Creative Commons Attribution-ShareAlike 4.0 International**: https://creativecommons.org/licenses/by-sa/4.0/ . This data-specific license does not change the license of application code. Attribution, revision links and licensing are also bundled in the catalogue and visible in the offline OOB drawer. No article images, scans or casualty tables are bundled.

Changes: shortened labels; explicit service/arm grouping; application identifiers; retained source aliases; separate strength claims; unknown allocations; search hierarchy and a brief approach timeline. Later numbered British labels remain undated lookup aliases, not verified contemporary designations. Two Howard regiments are distinguished by their source brigade.

## Interpretation and unresolved evidence

The catalogue has 181 organization records **including army and formation containers**, not 181 regiments or game units. Do not sum container and subordinate complements. It is an 11 May battle reference, not a complete 1 May campaign return. Missing strengths are unknown, not zero. No headcount is inferred by multiplying battalions or squadrons by a standard establishment.

French d'Eu/redoubt allocations, the Royal Artillerie row versus named artillery battalions, British artillery alternatives and the Dutch unnamed grenadier aggregate need reconciliation. Royal Artillerie is not seeded as an additional regiment alongside its three named battalions. The Dutch unnamed grenadiers remain one unresolved aggregate. Source row locators count parsed table rows from zero and include the original row label.

The main battle article helps distinguish the Mons diversion, siege investment, field/siege separation and contact before battle. Its aggregate siege estimate does not identify the besieging regiments. Do not assign individual troops, hex coordinates, march rates or scenario orders from those aggregate statements. The campaign calendar must distinguish the town and citadel stages before extending the present scenario end date.

The supplied WDS organizational trees and battlefield screenshot are **game-scenario evidence**. The screenshot shows useful relative battlefield landmarks, but its scenario date, map scale and counter identities have not been supplied. It cannot establish campaign-opening coordinates. It is not bundled, traced or used as the application backdrop. Any local copies belong in ignored `contextignore/historical-oob/`.

The current playable 38-unit profile remains separate. Historical-to-Maurice scaling, ratings, deployments, detachments and arrivals still require an explicit adaptation; none are official Maurice mechanics.
