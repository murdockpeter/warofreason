import type { AftermathRules } from './aftermath-schema';

export function siegeVictory(
  progress: number,
  conditions: { invested: boolean; supplied: boolean; relieved: boolean },
  exhaustion: { french: number; allied: number },
  rules: Pick<
    AftermathRules,
    | 'siegeThreshold'
    | 'exhaustionThreshold'
    | 'deadlineOutcome'
    | 'conflictOutcome'
  >,
  deadlineReached: boolean,
) {
  const french: string[] = [],
    allied: string[] = [];
  if (
    progress >= rules.siegeThreshold &&
    conditions.invested &&
    conditions.supplied
  )
    french.push('Siege threshold reached with verified investment and supply.');
  if (conditions.relieved) allied.push('Umpire-confirmed relief achieved.');
  if (rules.exhaustionThreshold !== null) {
    if (exhaustion.allied >= rules.exhaustionThreshold)
      french.push(
        'Allied campaign exhaustion reached the configured threshold.',
      );
    if (exhaustion.french >= rules.exhaustionThreshold)
      allied.push(
        'French campaign exhaustion reached the configured threshold.',
      );
  }
  if (!french.length && !allied.length && !deadlineReached) return null;
  const winner =
    french.length && allied.length
      ? rules.conflictOutcome
      : french.length
        ? ('french' as const)
        : allied.length
          ? ('allied' as const)
          : rules.deadlineOutcome;
  const reasons = [...french, ...allied];
  if (french.length && allied.length)
    reasons.push(
      `Conflicting conditions: configured outcome ${rules.conflictOutcome}.`,
    );
  if (!reasons.length)
    reasons.push(
      `Campaign deadline reached without another condition; configured outcome ${rules.deadlineOutcome}.`,
    );
  return { winner, reasons };
}
