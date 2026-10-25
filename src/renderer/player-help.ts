import type { Campaign } from '../domain/campaign';
import type { MapView } from '../domain/operations-schema';
import type { Screen } from './session';
import { battleReviewed, engagementSettled } from '../domain/aftermath-state';

export const helpTopics = [
  {
    id: 'start',
    title: 'Getting started',
    screen: 'Armies/Columns',
    steps: [
      'Open Campaign menu → Dashboard. Choose New campaign, give it a name, then Create and save. New campaigns include the Fontenoy setup.',
      'Open Campaign menu → Armies/Columns. Review the two armies, opening positions, commanders and proposed campaign settings. Use Edit setup to change them.',
      'Select both setup acknowledgements, Save setup, then Start Campaign and confirm. Starting alone does not enable movement.',
      'Open Campaign Map and choose Enable operational play. Review the movement house rules before issuing orders. Siege & Victory separately enables post-battle and siege rules when your group is ready.',
    ],
    notes: [
      'A formation/column is a group of game units. One soldier counter represents a whole formation, not a single infantry unit.',
      'Campaign menu contains the library, army setup, Turn Orders, Battle Log, Siege & Victory and Settings. The direct Campaign Map button returns to play.',
    ],
  },
  {
    id: 'map',
    title: 'Map & orders',
    screen: 'Campaign Map',
    steps: [
      'Check the active faction in the status strip. Only that faction can issue orders. Map options & campaign setup lets you choose French, Allied or umpire view.',
      'Right-click a formation and choose Move on map. Alternatively click its counter, then Formation actions. Shift+F10 or the menu key opens the same menu from a focused counter.',
      'Click adjacent squares, one step at a time. Diagonals are not allowed. The route bar shows movement cost or an error. Click the starting square to reset, or Undo route step to go back.',
      'Choose Add order to keep the route. This stages an order; it does not move the formation. Hold position stages a hold order. Formations without orders also hold.',
      'Choose Review & end phase to save and issue your orders. Review them under Orders, then Confirm phase resolution (or Resolve orders in Turn Orders) and accept the confirmation. Return to planning lets you revise issued orders before resolving.',
      'Resolution moves formations and passes to the other faction. After both faction phases the campaign turn advances. If aftermath rules are enabled, finish the turn review before planning more orders.',
    ],
    notes: [
      'Drag or scroll to pan; Zoom in/out changes scale. Deselect clears the current selection, not staged orders.',
      'The artwork is decorative. Only configured movement edges, blocks and agreed rules affect movement. Contact stops a formation before an occupied enemy square and requires a tabletop battle handoff.',
    ],
  },
  {
    id: 'inspect',
    title: 'Formation intelligence',
    screen: 'Campaign Map',
    steps: [
      'Right-click a visible formation and choose Inspect formation. A read-only dossier shows the information available in your current view.',
      'Your own forces and umpire view show the roster, current qualities, readiness, composition and commander names. Recovering and lost units remain in the roster; they are not ready for a new battle.',
      'Opposing forces reveal only permitted intelligence. Unknown composition is withheld. Located reports give an observed position, estimated reports add the umpire’s estimate, and identified reports may show an observed roster and commanders.',
      'Read the observation and expiry turn. Enemy intelligence is a dated snapshot, not live tracking. Expired reports no longer disclose hidden forces.',
    ],
    notes: [
      'Close or Escape returns to the map without changing orders or campaign state.',
      'Blue identifies French forces, red Allied. A gold dashed counter border marks concealment in your own/umpire view. A question mark means the count is not disclosed.',
    ],
  },
  {
    id: 'split',
    title: 'Split formations',
    screen: 'Campaign Map',
    steps: [
      'During your faction’s planning phase, right-click its formation and choose Split formation…. Save or discard staged order edits first; issued orders must return to planning and be cleared.',
      'Name the new formation. The left pane is the original formation and the right pane is the new one. Click a unit or commander to transfer it; click it in the other pane to move it back.',
      'Keep at least one unit in each formation, then Save split. Both formations stay in the same square. Their units retain identity, contingent, quality and readiness.',
      'Cancel split or Escape uses the discard confirmation. A cancelled/failed save does not alter the saved campaign. Unresolved contacts or battle commitments must be reviewed before splitting.',
    ],
    notes: [
      'Splitting is a player-agreed campaign reorganisation, not an official Maurice mechanic. It does not itself spend movement, advance time, rebuild units or generate tactical bonuses.',
    ],
  },
  {
    id: 'battle',
    title: 'Scouting & battles',
    screen: 'Battle Log',
    steps: [
      'Scouting is an umpire worksheet. Use Scout… from a formation menu in umpire view, or Battles & scouting → Record scouting. Choose an eligible active-side scout and target.',
      'Enter a physical d6 or roll in the app, record modifiers/reason, and let the umpire select what intelligence is released. Save the report. The app does not decide scouting success.',
      'After movement creates a contact, open Battle Log and Declare Battle. Select eligible forces, entry edges, agreed reinforcement instructions, objectives and terrain notes. Save the shared brief.',
      'Save printable PDF or Export brief HTML. Begin tabletop battle, then play Maurice using your own game materials. The app does not resolve tactical combat.',
      'Enter battle result: actual outcome, every unit’s result, commanders and optional final disruption/Army Morale. Review and confirm result. Cancellation preserves your draft.',
      'With aftermath rules enabled, choose Review post-battle campaign changes. Review losses/rebuilding, commander decisions and post-battle squares in Siege & Victory before releasing the formation hold.',
    ],
    notes: [
      'Scouting eligibility, range and attempt limits are configurable house rules. A committed formation cannot move, scout or split until its engagement/battle review is settled.',
      'Battle briefs contain both armies and are shared table/umpire documents. Faction exports are separate redacted views.',
    ],
  },
  {
    id: 'siege',
    title: 'Aftermath & turn end',
    screen: 'Siege & Victory',
    steps: [
      'Open Siege & Victory in umpire view and explicitly enable post-battle and siege rules. Review the campaign’s rebuilding, recovery, siege and victory policies.',
      'For each confirmed battle result, review its campaign aftermath. Enter Epic Points from your own materials, any separately agreed campaign exhaustion and notes. Preview and confirm the changes once.',
      'Record investment, supply and relief only when verified by the umpire. The decorative map does not calculate supply routes. Manage explicit commander arrivals, statuses and attachments here too.',
      'After both faction phases, choose Finish turn review on the map. Complete outstanding contacts, battles and aftermath reviews first, then Finalize turn N and confirm.',
      'Finalization processes due recovery, supplied siege progress and victory once. Victory uses agreed conditions and tie/deadline policies. A recorded campaign outcome ends further strategic play.',
    ],
    notes: [
      'Battle Army Morale and final disruption stay in the battle record. They are not automatically campaign exhaustion or permanent disruption.',
      'All campaign recovery, supply, siege and victory policies are provisional house rules. The manual explains app controls, not the published Maurice tactical rules.',
    ],
  },
  {
    id: 'save',
    title: 'Saves & unavailable actions',
    screen: 'Dashboard',
    steps: [
      'Committed actions save locally automatically. Unsaved forms and staged orders stay in memory across navigation, with a discard warning before closing or replacing them. Merely selecting a route does not stage it: choose Add order.',
      'Use Campaign menu → Dashboard → Export saved JSON for a complete campaign and journal backup. Import JSON restores into a library without that campaign ID; it never silently overwrites an existing campaign.',
      'Export faction view under Map options writes only the redacted player view. It cannot be imported as a campaign backup. Clone campaign makes a fresh setup with new identities, not a rewind of the current turn.',
      'If an action is unavailable, check: campaign started; operational play enabled; your faction active; correct view; no unfinished editor; orders in planning; no pending turn checkpoint; no battle hold; campaign not archived or concluded.',
      'Shared management pages require an explicit switch to umpire view. The app is designed for trusted local pass-and-play, not authenticated player access.',
    ],
    notes: [
      'Escape closes Help and formation inspection. F1 opens this manual when no other modal is open.',
      'Opening Help or an inspection never saves, discards, issues orders or changes a campaign.',
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  screen: Screen;
  steps: readonly string[];
  notes: readonly string[];
}[];
export type HelpTopic = (typeof helpTopics)[number]['id'];

export function nextPlayerStep(
  campaign: Campaign | null,
  view: MapView,
): { title: string; text: string; screen: Screen } {
  if (!campaign)
    return {
      title: 'Create or open a campaign',
      text: 'Use the Dashboard campaign library to start a new Fontenoy campaign or reopen a saved one.',
      screen: 'Dashboard',
    };
  if (campaign.status === 'archived')
    return {
      title: 'This campaign is archived',
      text: 'You can inspect or back it up. Clone it from Dashboard to prepare a fresh setup.',
      screen: 'Dashboard',
    };
  if (
    campaign.schemaVersion === 3 &&
    campaign.preparation &&
    !campaign.preparation.resolved
  )
    return {
      title: 'Complete screening and withdrawals',
      text: 'Deploy or recall screens before withdrawal planning. Each side then saves and locks its withdrawals, including an empty hold. The umpire reviews and confirms their simultaneous resolution before movement orders open.',
      screen: 'Campaign Map',
    };
  if (campaign.schemaVersion === 3)
    return {
      title:
        campaign.phase === 'adjudication'
          ? 'Review contacts and tactical battles'
          : campaign.phase === 'checkpoint'
            ? 'Finish the shared phase'
            : 'Plan and lock both sides’ orders',
      text:
        campaign.phase === 'adjudication'
          ? 'In umpire view, settle contacts or declare a battle, review likely reinforcements, enter the tactical result and approve campaign effects before resuming movement.'
          : campaign.phase === 'checkpoint'
            ? 'Movement and required battle reviews are complete. Finish the shared phase to open the next AM/PM planning window and process any due Maurice unit recoveries when enabled.'
            : 'Select a friendly corps and adjacent hexes, save up to three movement segments, then lock each side. Neither side moves before simultaneous resolution.',
      screen: 'Campaign Map',
    };
  if (campaign.schemaVersion !== 2 || campaign.status === 'draft')
    return {
      title: 'Review your campaign setup',
      text: 'Open Armies/Columns, review assignments and settings, save both acknowledgements, then Start Campaign.',
      screen: 'Armies/Columns',
    };
  if (campaign.aftermath?.victory)
    return {
      title: 'The campaign has concluded',
      text: 'Read the recorded outcome in Siege & Victory. Dashboard still offers backup, archive and a fresh setup clone.',
      screen: 'Siege & Victory',
    };
  if (!campaign.operations)
    return {
      title: 'Enable movement',
      text: 'On Campaign Map choose Enable operational play, then review the proposed movement house rules.',
      screen: 'Campaign Map',
    };
  if (campaign.aftermath?.pendingTurn != null)
    return {
      title: 'Finish the completed turn',
      text: 'Open Siege & Victory. Complete any outstanding contacts, battles and aftermath reviews, then Finalize turn. New orders wait for this checkpoint.',
      screen: 'Siege & Victory',
    };
  if (campaign.operations.phase === 'finished')
    return {
      title: 'The operational window has ended',
      text: 'Finish any final tabletop battles. Siege & Victory provides explicit aftermath and final-turn evaluation when enabled.',
      screen: 'Siege & Victory',
    };
  if (view !== 'umpire' && view !== campaign.activeSide)
    return {
      title: 'The other faction is active',
      text: 'Your current view cannot issue its orders. Use Map options & campaign setup to select the active faction or umpire view when the players are ready.',
      screen: 'Campaign Map',
    };
  if (campaign.operations.phase === 'resolution')
    return {
      title: 'Review and resolve issued orders',
      text: 'Orders are saved but formations have not moved yet. Review them in Turn Orders; resolve and confirm, or return to planning to revise them.',
      screen: 'Turn Orders',
    };
  const ownColumns = new Set(
    campaign.columns
      .filter(
        (column) =>
          view === 'umpire' ||
          campaign.factions.find((faction) => faction.id === column.factionId)
            ?.side === view,
      )
      .map((column) => column.id),
  );
  const battles = (campaign.tabletop?.battles ?? []).filter(
    (battle) =>
      battle.participants.some((participant) =>
        ownColumns.has(participant.columnId),
      ) && !battleReviewed(campaign, battle.id),
  );
  if (battles.some((battle) => battle.stage !== 'resolved'))
    return {
      title: 'Complete your tabletop battle',
      text: 'Open Battle Log to read the shared brief, play the battle at the table and confirm its result. Committed formations remain held until campaign review.',
      screen: 'Battle Log',
    };
  if (battles.length)
    return {
      title: 'Review post-battle campaign changes',
      text: 'The tabletop result is recorded. Open Siege & Victory, enable aftermath rules if needed, then review the campaign effects before releasing the formations.',
      screen: 'Siege & Victory',
    };
  if (
    campaign.operations.engagements.some(
      (engagement) =>
        (ownColumns.has(engagement.attackerId) ||
          ownColumns.has(engagement.defenderId)) &&
        !engagementSettled(campaign, engagement),
    )
  )
    return {
      title: 'Prepare your engagement',
      text: 'Open Battle Log and Declare Battle for the outstanding contact. The involved formations cannot move or split until their battle and campaign review are settled.',
      screen: 'Battle Log',
    };
  return {
    title: 'Plan your faction’s orders',
    text: 'Right-click a formation → Move on map. Click adjacent squares, then Add order. When ready, choose Review & end phase. Unordered formations hold.',
    screen: 'Campaign Map',
  };
}
