# Playing from the map

Started campaigns reopen on Campaign Map. The map and current faction/turn are the main play surface. Use **Campaign menu** for the library, army setup, Turn Orders, Battle Log, Siege & Victory and application settings. Campaign Map stays available as a direct button.

## Help and formation intelligence

The fixed **ⓘ Help** button opens the offline **Player manual** from any main screen; **F1** is its keyboard shortcut when no other modal is open. A **What to do now** card reflects setup, planning, issued orders, relevant engagements/reviews, turn checkpoints and concluded campaigns. Topic buttons cover first setup, map orders, formation intelligence, splitting, scouting/battles, aftermath and saves/unavailable actions. Reading or closing Help preserves all drafts and saved data. Explicit navigation buttons open the named screen with the normal umpire gates intact. Escape closes the manual.

**Inspect formation** now opens a read-only intelligence dossier rather than expanding the old details panel. Use the formation context menu or **ⓘ Inspect** above the map after selecting a formation. It shows position, ready/recovering/lost totals, composition, commanders and a scrollable roster with separate current quality/status. Your own/umpire records are current. Enemy inspections accept only the existing redacted faction projection: undisclosed rosters/counts remain withheld, while identified reports show explicitly labelled observed qualities/statuses and the report's date/expiry. Hidden expired forces remain absent from the map. **ⓘ How to read this dossier** explains the terms without supplying tactical rules or bonuses. Close/Escape returns without changing orders or campaign state.

## A normal faction phase

1. Right-click a visible formation. Choose **Move on map**, **Hold position**, **Split formation…**, **Inspect formation** or **Scout…**, when available. Keyboard users can focus its counter and press Shift+F10 or the menu key. Selecting a counter also exposes **Formation actions** above the map.
2. To move, click adjacent map squares. The route bar above the map shows its cost or validation error. **Add order** stages the route; **Undo route step** revises it. Nothing moves until resolution. **Deselect** leaves saved/staged orders intact.
3. **Review & end phase** saves issued orders and opens their review. Confirm phase resolution when ready, or return to planning through Orders. Native confirmation still defaults to cancellation. Unordered formations hold.
4. Use **Battles & scouting** for tabletop handoffs and results. After both factions finish, **Finish turn review** opens the required campaign aftermath/siege checkpoint when enabled.

**Orders**, **Formation & square details**, **Map options & campaign setup**, movement rules and **Rules & help** are collapsed until needed. Map options contain the faction/umpire view selector and redacted faction export. Unit composition remains under formation details. Shared management screens retain their explicit umpire gate; right-click menus never expose concealed enemy rosters or enable enemy orders.

## Splitting a formation

Split is an explicit player-agreed reorganisation under the campaign house rules, not an official Maurice mechanic. It is available to the active faction during operational planning, before issuing orders, with no pending draft and no unresolved contact/battle commitment. Save or discard order edits first.

The modal has two panes: original formation and new formation. Click a unit or commander to move it to the other pane; click again to move it back. Name the new formation, retain at least one unit in each pane, then **Save split**. Both formations remain in the original square, retain faction/concealment, and preserve all unit IDs, qualities, contingents, readiness and scheduled recovery. Commanders can transfer only from the original formation. No movement, battle or date advance occurs.

Cancellation changes no saved data. Closing the modal/app with edits uses the existing discard guard; failed validation or saving keeps the draft available. Successful splits append `formation_split` to the campaign journal. Restart and full JSON backup/import preserve the split; recovery/import reconstruct and validate it against the before/after snapshots. Existing saves need no destructive database migration. Use the updated application for saves containing these events.

This interface pass does not complete Milestone G's campaign overview, extra printable sheets, previous-turn forks or two-human playtesting. Those remain separate work.
