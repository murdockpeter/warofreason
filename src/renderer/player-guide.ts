import type { Campaign } from '../domain/campaign';
import type { MapView } from '../domain/operations-schema';
import type { Screen } from './session';
import { nextPlayerStep } from './player-help';

export type GuideChoice = {
  label: string;
  detail: string;
  target: string;
  screen: Screen;
};
export type PlayerGuide = {
  title: string;
  text: string;
  stage?: number;
  choices: GuideChoice[];
};
const choice = (
  label: string,
  detail: string,
  target: string,
  screen: Screen = 'Campaign Map',
): GuideChoice => ({ label, detail, target, screen });
export function playerGuide(
  c: Campaign | null,
  view: MapView,
  planningSide: 'french' | 'allied',
  draft: { target: string; screen: Screen } | null,
): PlayerGuide {
  if (draft)
    return {
      title:
        draft.target === 'route'
          ? 'Draw and save your route'
          : 'Finish your open edit',
      text:
        draft.target === 'route'
          ? 'Click adjacent hexes to extend the selected formation’s route, then Save movement segment. Cancel route leaves the saved orders unchanged.'
          : 'Your changes are not committed yet. Review and save them, or use the editor’s cancel/discard control. Opening Help keeps your work.',
      choices: [
        choice(
          'Return to your edit',
          'Continue where you left off; nothing is submitted for you.',
          draft.target,
          draft.screen,
        ),
      ],
    };
  if (!c)
    return {
      title: 'Start here: choose your campaign',
      text: 'Create a simultaneous Fontenoy campaign for shared AM/PM turns, or open/import a saved campaign. Creating a campaign saves it locally.',
      choices: [
        choice(
          'Choose a campaign',
          'The library offers new campaigns, saved games and JSON import.',
          'library',
          'Dashboard',
        ),
      ],
    };
  if (
    c.status === 'archived' ||
    (c.schemaVersion === 3 && c.fontenoy?.siege.campaign?.victory) ||
    (c.schemaVersion === 2 && c.aftermath?.victory)
  )
    return {
      title:
        c.status === 'archived'
          ? 'This campaign is archived'
          : 'Your campaign has concluded',
      text: 'Review the recorded outcome or keep a full backup. Clone from Dashboard to begin a fresh setup.',
      choices: [
        choice(
          'Review your campaign',
          'Read the outcome and history.',
          c.schemaVersion === 3 ? 'siege' : 'screen',
          c.schemaVersion === 3 ? 'Campaign Map' : 'Siege & Victory',
        ),
        choice(
          'Back up or clone',
          'Export saved JSON or create a fresh setup; your history stays intact.',
          'library',
          'Dashboard',
        ),
      ],
    };
  if (c.schemaVersion !== 3) {
    const next = nextPlayerStep(c, view);
    const target =
      next.screen === 'Armies/Columns'
        ? 'setup'
        : next.screen === 'Battle Log'
          ? 'legacy-battles'
          : next.screen === 'Siege & Victory'
            ? 'legacy-siege'
            : next.title === 'Enable movement'
              ? view === 'umpire'
                ? 'legacy-enable'
                : 'view'
              : next.screen === 'Turn Orders'
                ? 'legacy-orders'
                : next.title === 'The other faction is active'
                  ? 'view'
                  : 'legacy-map';
    return {
      ...next,
      choices: [choice('Find the next step', next.text, target, next.screen)],
    };
  }
  const umpire = view === 'umpire';
  const side = umpire ? planningSide : view;
  const mine = c.submissions.find((s) => s.side === side)!;
  const label = side === 'french' ? 'French' : 'Allied';
  const waiting = (text: string, stage: number): PlayerGuide => ({
    title: 'Waiting for umpire review',
    text,
    stage,
    choices: [
      choice(
        'Find the view controls',
        'When both players are ready, the umpire can switch views to review shared information.',
        'view',
      ),
    ],
  });
  if (c.preparation && !c.preparation.resolved) {
    const submission = c.preparation.submissions.find((s) => s.side === side)!;
    if (c.preparation.submissions.every((s) => s.locked))
      return umpire
        ? {
            title: 'Resolve the shared preparation',
            text: 'Both sides have locked withdrawals. Review the preview, then confirm their simultaneous resolution to open movement.',
            stage: 0,
            choices: [
              choice(
                'Review preparation',
                'No movement planning opens until this review is resolved.',
                'preparation',
              ),
            ],
          }
        : waiting(
            'Both withdrawal submissions are ready. The umpire reviews their simultaneous resolution.',
            0,
          );
    return {
      title: submission.locked
        ? `${label} preparation is locked`
        : 'First: complete preparation',
      text: submission.locked
        ? 'Your preparation is saved. The other side must finish before the umpire resolves it.'
        : 'Screening and withdrawal happen before movement. Screens are optional. Save and lock withdrawals even when choosing an empty hold.',
      stage: 0,
      choices: [
        choice(
          'Review screening and withdrawals',
          'Use your side’s preparation controls, then lock its submission.',
          'preparation',
        ),
        ...(umpire
          ? [
              choice(
                'Choose the planning side',
                'Switch sides for local pass-and-play; review each side separately.',
                'planning-side',
              ),
            ]
          : []),
      ],
    };
  }
  if (c.phase === 'checkpoint') {
    if (!umpire)
      return waiting(
        'Movement and battle reviews are complete. The umpire handles the shared checkpoint; no new routes can be issued yet.',
        4,
      );
    const epicChoices =
      c.fontenoy && (c.fontenoy.epic || c.battles.some((b) => b.appliedVersion))
        ? [
            choice(
              'Review optional Epic Points',
              'Enter agreed points or leave them unrecorded; the app does not calculate Maurice scoring.',
              'epic',
            ),
          ]
        : [];
    const siege = c.fontenoy?.siege.campaign;
    const officerChoices = c.fontenoy?.officers
      ? [
          choice(
            'Review commander outcomes',
            'Optional: record agreed officer arrivals, losses or retirement before the siege review or phase end.',
            'officers',
          ),
        ]
      : [];
    if (siege && !siege.pendingReview)
      return {
        title: 'Review Tournai before ending the phase',
        text: 'Confirm investment, supply, relief and separate campaign exhaustion for the displayed interval. Add an explanation and review the preview.',
        stage: 4,
        choices: [
          choice(
            'Find the siege review',
            'Confirming conditions records the review; finishing the shared phase applies it.',
            'siege-review',
          ),
          ...officerChoices,
          ...epicChoices,
        ],
      };
    return {
      title: 'Ready to finish this shared phase',
      text: siege
        ? 'The siege review is recorded. Finish the phase to apply the previewed siege/victory effects and due recovery.'
        : 'Movement and battles are settled. Finish the phase to process due recovery and open the next AM/PM planning window.',
      stage: 4,
      choices: [
        choice(
          'Find Finish shared phase',
          'Review the native confirmation before the campaign advances.',
          'finalize',
        ),
        ...(siege
          ? [
              choice(
                'Review the siege preview',
                'You can revise recorded conditions before finalization.',
                'siege',
              ),
            ]
          : officerChoices),
        ...epicChoices,
      ],
    };
  }
  if (c.phase === 'adjudication' || c.phase === 'resolving') {
    if (!umpire)
      return waiting(
        'The umpire must settle contacts, record any tabletop result and resume the shared movement clock. Opposing orders and rosters remain private.',
        3,
      );
    const contact = c.encounters.some((e) => !e.settled && !e.battleId);
    const unrecorded = c.battles.some(
      (b) => !b.appliedVersion && !b.results.length,
    );
    const unapproved = c.battles.some(
      (b) => !b.appliedVersion && b.results.length && !b.approved,
    );
    return {
      title: contact
        ? 'Choose how to settle the contact'
        : unrecorded
          ? 'Take the battle to the tabletop'
          : unapproved
            ? 'Review the recorded battle effects'
            : 'Resume the shared movement clock',
      text: contact
        ? 'Review the contact, then declare a tabletop battle or record an agreed stand-off. The app does not resolve Maurice combat.'
        : unrecorded
          ? 'Review the brief and reinforcements, play with your own game materials, then enter the actual result.'
          : unapproved
            ? 'Recording a result does not apply it. Review the unit/formation effects, then approve them before resuming resolution.'
            : 'Approved effects apply at battle end when resolution resumes. Further contacts may pause the clock again.',
      stage: 3,
      choices: [
        choice(
          contact
            ? 'Find the contact choices'
            : unrecorded
              ? 'Find the battle worksheet'
              : unapproved
                ? 'Find the result approval'
                : 'Find Resume resolution',
          'Review the actual controls and any confirmation; nothing is chosen automatically.',
          contact || unrecorded || unapproved ? 'battles' : 'resolve',
        ),
      ],
    };
  }
  if (c.submissions.every((s) => s.locked))
    return umpire
      ? {
          title: 'Both sides are ready: resolve movement',
          text: 'Orders are saved and locked. Review and confirm simultaneous resolution to move both sides on the shared clock.',
          stage: 2,
          choices: [
            choice(
              'Find Resolve movement',
              'Contacts will pause for umpire review.',
              'resolve',
            ),
            choice(
              'Reopen to change orders',
              'Reopen both submissions before editing; existing orders are retained.',
              'reopen',
            ),
          ],
        }
      : waiting(
          'Both sides have locked orders. The umpire confirms simultaneous movement. Your formations have not moved yet.',
          2,
        );
  if (mine.locked)
    return {
      title: `${label} orders are locked`,
      text: 'Your orders are saved. Wait for the other side to lock its orders; movement starts only after umpire confirmation.',
      stage: 1,
      choices: [
        choice(
          'Review your saved orders',
          'Read your routes while waiting. Unordered formations hold.',
          'orders',
        ),
        ...(umpire
          ? [
              choice(
                'Plan for the other side',
                'Use Planning side to switch to the side that has not locked yet.',
                'planning-side',
              ),
            ]
          : []),
      ],
    };
  const canMove = c.corps.some(
    (f) =>
      f.side === side &&
      f.status === 'ready' &&
      f.hexId &&
      f.kind !== 'detachment' &&
      !c.preparation?.withdrawnCorpsIds.includes(f.id),
  );
  return {
    title: `Choose ${label} orders`,
    text: canMove
      ? 'Select a friendly formation, then click adjacent hexes to draw a route. Save each movement segment. Formations without orders hold their positions.'
      : 'No formation is available to move in this phase. Review saved orders and lock an empty submission to hold. The umpire can review due formation returns before orders are saved.',
    stage: 1,
    choices: [
      ...(canMove
        ? [
            choice(
              'Plan a move',
              'Select a friendly counter on the map, then choose adjacent hexes.',
              'map',
            ),
          ]
        : []),
      choice(
        mine.orders.length
          ? 'Review routes and lock orders'
          : 'Hold positions and lock orders',
        'Lock when ready. Locking saves your choices; it does not move troops. An empty submission means hold.',
        'lock',
      ),
      ...(umpire &&
      c.fontenoy &&
      !c.submissions.some((s) => s.locked || s.orders.length)
        ? [
            choice(
              'Review commanders and Notables',
              'Optional: inspect officers or record an agreed change before orders.',
              'officers',
            ),
          ]
        : []),
      ...(umpire
        ? [
            choice(
              'Choose the planning side',
              'French and Allied each submit orders separately.',
              'planning-side',
            ),
          ]
        : []),
    ],
  };
}
