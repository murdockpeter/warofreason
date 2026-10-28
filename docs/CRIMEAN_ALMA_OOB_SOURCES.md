# Alma deployment roster — 20 September 1854

Application 0.19.0 supplies a dated **field-army baseline**, not a certified return of every soldier who fought. The catalogue contains **120 source records**: Britain 45, France 40, Russia 34, Ottoman Empire 1. Thirty-six records carry uncertainty, detachment or aggregate flags. These counts describe records of different sizes, not equal combat units or army strengths.

The source catalogue is `src/domain/alma-roster.ts`. Historical designations, organization and reported battalion/squadron counts have been transcribed into an original structured catalogue with editorial notes. Modern source prose and PDFs are not bundled. No speculative headcounts, tactical ratings, starting coordinates or subordinate identifiers have been added.

## References

- [George Nafziger, 854IAB: Battle of Alma, 20 September 1854](https://www.generalstaff.org/NAF/Pt_I_1816-1900/854iab.pdf): principal organization, named regiments, artillery and support records. [Collection provenance at the Combined Arms Research Library](https://cgsc.contentdm.oclc.org/digital/collection/p15040coll6/custom/NafzigerLandingCDM-en_EN.en_EN).
- [William Howard Russell, The British Expedition to the Crimea](https://www.gutenberg.org/files/46242/46242-h/46242-h.htm): public-domain eyewitness history; corroborates the 1st and 9th French Chasseurs in Canrobert's attack.
- [British brigade cross-check](https://www.roll-of-honour.org/Regiments/CrimeanOrderofBattle.html): organization and the expressly disputed Fourth Division arrangements and absent detachments.
- [War Medals and Their History](https://www.gutenberg.org/files/49986/old/49986-h/49986-h.htm): public-domain regimental cross-check, including the 68th Foot and 17th Lancers.
- [Contemporary official dispatches, 14 October 1854](https://archive.spectator.co.uk/article/14th-october-1854/5/english-official-documents): Saint-Arnaud reports the absence of his African cavalry.
- [Contemporary campaign account, 14 October 1854](https://archive.spectator.co.uk/article/14th-october-1854/4/furtign-nut-tannin): Suleiman Pasha's Ottoman contingent.

## Corrections and unresolved coverage

- The British reserve infantry under England is the Third Division; Cathcart commands the Fourth. The cavalry designation is 17th Lancers. The 93rd uses its period Sutherland Highlanders designation. The 68th is supplemented from the regimental cross-check. Fourth Division brigade assignments and detached troops remain flagged; inclusion is not proof of participation.
- French African cavalry in the compilation remains available as explicitly detached/uncertain material. Its battle presence is not asserted. The 19th Chasseurs and 22nd light infantry retain source doubts. The catalogue follows Russell and the principal compilation for the 1st Chasseurs rather than silently substituting the 4th from later gaming lists.
- British artillery battery gun returns require reconciliation. Reported numbers are labelled source claims, not validated totals. Artillery/support aggregates remain aggregates where identities cannot be resolved.
- Repeated Russian 17th Artillery Brigade light batteries are represented once, with assignment doubts retained. Minsk's Ulukol battalion is noted within its regimental record. Brest/Białystok reserve battalions are not duplicated in both organizational listings. Don Cossack gun and marine/naval entries carry possible-overlap notes. Unnamed gun detachments are not assigned invented battery names. Boutirsk at Anapa is explicitly detached from the battle area.
- Ottoman subordinate regimental and battalion identities remain unresolved. The contingent therefore has **one labelled aggregate record**, with no invented battalion ordinals or definitive strength. The catalogue is incomplete at that subordinate level. Sardinian forces are not included in this September 1854 roster.

Users should review each flagged entry before deploying it. No total manpower or gun comparison is calculated from these heterogeneous and partly overlapping source records. Further archival reconciliation can support a separately versioned catalogue; this version's identities must remain stable for saved journals.

## Deployment and save boundaries

Loading the catalogue creates off-map staged records only. Existing manually entered forces are retained, so the umpire must check for conceptual duplicates with their own records. Loading the same catalogue twice is rejected. Each source record has one persistent force UUID and a read-only catalogue identity.

Selection supports an individual record, organizational group or search result set. Place selected enters preview mode; clicking a map chooses a schematic counter layout. Changing sheets clears the preview. Confirm deployment records one atomic journal event, transferring the selected identities to that sheet and removing them from the tray. Cancel changes no saved state. This is a setup choice, not a claim of historical deployment or movement adjudication.

Staged/deployed identities are conserved across edits, retirement, restart and validated JSON export/import. Historical identity cannot be removed or swapped through force editing. Display names, composition, strength and condition remain freely adjudicable. Prior saves without a deployment area continue to replay unchanged. The catalogue uses the existing KS commit IPC and separate KS database; Maurice rules and saves are unaffected.
