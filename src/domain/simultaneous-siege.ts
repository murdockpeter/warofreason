import { latestSiegeDeadline } from './simultaneous-siege-schema';
import data from '../data/aftermath.v0.1.json' with { type: 'json' };
import type { WaterlooCampaign, WaterlooCommand } from './waterloo-schema';
import type {
  SimultaneousSiegePolicy,
  SiegeReview,
} from './simultaneous-siege-schema';
import { siegeVictory } from './siege-victory';

export function defaultSimultaneousSiegePolicy(
  c: WaterlooCampaign,
): SimultaneousSiegePolicy {
  const schedule = c.fontenoy!.sourceSchedule;
  return {
    ruleId: 'maurice_siege_v0.1',
    rules: {
      siegeThreshold: data.siegeThreshold,
      siegeIncrement: data.siegeIncrement,
      exhaustionThreshold: data.exhaustionThreshold,
      deadlineOutcome: data.deadlineOutcome as 'allied',
      conflictOutcome: data.conflictOutcome as 'draw',
    },
    minutesPerSiegeTurn: schedule.daysPerTurn * 1440,
    deadlineAt: Math.min(
      latestSiegeDeadline,
      schedule.daysPerTurn * schedule.turnCount * 1440,
    ),
  };
}
export function defaultSiegeReview(c: WaterlooCampaign): SiegeReview {
  const last = c.fontenoy?.siege.campaign?.checkpoints.at(-1)?.review;
  return {
    conditions: last
      ? { ...last.conditions }
      : {
          invested: c.fontenoy?.siege.status === 'invested',
          supplied: false,
          relieved: c.fontenoy?.siege.status === 'relieved',
        },
    exhaustion: last ? { ...last.exhaustion } : { french: 0, allied: 0 },
    notes: '',
  };
}
export function applySiegeCommand(
  c: WaterlooCampaign,
  command: WaterlooCommand,
) {
  if (!c.fontenoy)
    throw new Error('Open a simultaneous Maurice Fontenoy campaign.');
  const siege = c.fontenoy.siege;
  if (command.kind === 'maurice-siege-policy') {
    if (
      c.phase !== 'planning' ||
      c.submissions.some((s) => s.locked || s.orders.length) ||
      c.encounters.some((e) => !e.settled) ||
      c.battles.some((b) => !b.appliedVersion)
    )
      throw new Error(
        'Review siege policies during clear planning before orders or unresolved battles.',
      );
    if (command.policy.deadlineAt <= c.cursor)
      throw new Error('Choose a campaign deadline after the current clock.');
    if (
      siege.campaign &&
      command.policy.minutesPerSiegeTurn !==
        siege.campaign.policy.minutesPerSiegeTurn &&
      siege.campaign.eligibleMinutes !== 0
    )
      throw new Error(
        'Keep the current siege cadence while eligible time is carried forward.',
      );
    siege.campaign = siege.campaign
      ? { ...siege.campaign, policy: structuredClone(command.policy) }
      : {
          policy: structuredClone(command.policy),
          enabledAt: c.cursor,
          lastCheckpointAt: c.cursor,
          eligibleMinutes: 0,
          pendingReview: null,
          checkpoints: [],
          victory: null,
        };
    c.log.push(
      `Reviewed provisional Tournai siege policy: ${command.policy.minutesPerSiegeTurn} calendar minutes per increment; deadline minute ${command.policy.deadlineAt}.`,
    );
  } else if (command.kind === 'maurice-siege-review') {
    if (
      !siege.campaign ||
      c.phase !== 'checkpoint' ||
      c.encounters.some((e) => !e.settled) ||
      c.battles.some((b) => !b.appliedVersion)
    )
      throw new Error(
        'Finish all movement, contact and battle reviews before reviewing the siege checkpoint.',
      );
    siege.campaign.pendingReview = {
      ...structuredClone(command.review),
      turn: c.turn,
      at: c.cursor,
    };
    c.log.push(
      `Tournai conditions and campaign exhaustion reviewed for phase ${c.turn}; effects await finalization.`,
    );
  }
  c.effectSerial++;
}
export function previewSiegeCheckpoint(
  c: WaterlooCampaign,
  review: SiegeReview,
) {
  const siege = c.fontenoy!.siege,
    state = siege.campaign!;
  const elapsed = c.cursor - state.lastCheckpointAt;
  const eligible =
    review.conditions.invested &&
    review.conditions.supplied &&
    !review.conditions.relieved;
  const total = state.eligibleMinutes + (eligible ? elapsed : 0);
  const increments = Math.floor(total / state.policy.minutesPerSiegeTurn);
  const progressAfter = Math.min(
    10000,
    siege.progress + increments * state.policy.rules.siegeIncrement,
  );
  const victory = siegeVictory(
    progressAfter,
    review.conditions,
    review.exhaustion,
    state.policy.rules,
    c.cursor >= state.policy.deadlineAt,
  );
  return {
    fromAt: state.lastCheckpointAt,
    at: c.cursor,
    policy: structuredClone(state.policy),
    review: structuredClone(review),
    progressBefore: siege.progress,
    progressAfter,
    eligibleMinutesBefore: state.eligibleMinutes,
    eligibleMinutesAfter: total % state.policy.minutesPerSiegeTurn,
    increments,
    victory,
  };
}
export function finalizeSiegeCheckpoint(
  c: WaterlooCampaign,
  timestamp: string,
) {
  const siege = c.fontenoy?.siege,
    state = siege?.campaign;
  if (!siege || !state) return;
  const review = state.pendingReview;
  if (!review || review.turn !== c.turn || review.at !== c.cursor)
    throw new Error(
      'Review Tournai conditions and campaign exhaustion for this checkpoint before finishing the shared phase.',
    );
  const checkpoint = {
    ...previewSiegeCheckpoint(c, {
      conditions: review.conditions,
      exhaustion: review.exhaustion,
      notes: review.notes,
    }),
    turn: c.turn,
    timestamp,
  };
  state.checkpoints.push(checkpoint);
  state.lastCheckpointAt = c.cursor;
  state.eligibleMinutes = checkpoint.eligibleMinutesAfter;
  state.pendingReview = null;
  siege.progress = checkpoint.progressAfter;
  siege.status = review.conditions.relieved
    ? 'relieved'
    : review.conditions.invested
      ? 'invested'
      : 'not_started';
  if (checkpoint.victory)
    state.victory = {
      ...checkpoint.victory,
      turn: c.turn,
      at: c.cursor,
      timestamp,
    };
  c.log.push(
    `Tournai checkpoint phase ${c.turn}: ${checkpoint.progressBefore} → ${checkpoint.progressAfter}; ${checkpoint.increments} calendar siege increments. ${state.victory ? `Campaign outcome: ${state.victory.winner}.` : 'No campaign outcome.'}`,
  );
}
