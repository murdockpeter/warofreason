import defaults from '../data/tabletop.v0.1.json' with { type: 'json' };
import { battleReviewed, engagementSettled } from './aftermath-state';
import type { FontenoyCampaign } from './campaign';
import { scoutingRulesSchema, tabletopReceiptSchema } from './tabletop-schema';
import type { Battle, TabletopReceipt, Declaration } from './tabletop-schema';
import type { MapView } from './operations-schema';

export const defaultScoutingRules = scoutingRulesSchema.parse(defaults);
export const tabletopCategories = {
  'scouting-rules': 'scouting_rules_changed',
  scout: 'scouted',
  'declare-battle': 'battle_declared',
  'start-battle': 'battle_started',
  'record-result': 'battle_result_recorded',
} as const;
const sideOf = (campaign: FontenoyCampaign, factionId: string) =>
  campaign.factions.find((f) => f.id === factionId)?.side;
const sameCandidate = (
  a: Declaration['candidate'],
  b: Declaration['candidate'],
) =>
  a.attackerId === b.attackerId &&
  a.defenderId === b.defenderId &&
  a.squareId === b.squareId &&
  a.turn === b.turn;
export function candidateAssigned(
  campaign: FontenoyCampaign,
  candidate: Declaration['candidate'],
) {
  return (campaign.tabletop?.battles ?? []).some(
    (battle) =>
      battle.declaration.candidate.squareId === candidate.squareId &&
      battle.declaration.candidate.turn === candidate.turn &&
      battle.participants.some((p) => p.columnId === candidate.attackerId) &&
      battle.participants.some((p) => p.columnId === candidate.defenderId),
  );
}
export function battleHoldingColumn(
  campaign: FontenoyCampaign,
  columnId: string,
) {
  return campaign.tabletop?.battles.find(
    (b) =>
      !battleReviewed(campaign, b.id) &&
      b.participants.some((p) => p.columnId === columnId),
  );
}
function adjacent(campaign: FontenoyCampaign, from: string | null, to: string) {
  const a = campaign.squares.find((s) => s.id === from);
  const b = campaign.squares.find((s) => s.id === to);
  return a && b
    ? Math.abs(a.row - b.row) + Math.abs(a.column - b.column)
    : Infinity;
}
export function declarationIssues(
  campaign: FontenoyCampaign,
  declaration: Declaration,
) {
  const issues: string[] = [];
  const candidate = declaration.candidate;
  if (
    !campaign.operations?.engagements.some((e) =>
      sameCandidate(e, candidate),
    ) ||
    candidateAssigned(campaign, candidate)
  )
    issues.push('Choose an unassigned engagement candidate.');
  const attacker = campaign.columns.find((c) => c.id === candidate.attackerId);
  const defender = campaign.columns.find((c) => c.id === candidate.defenderId);
  if (!attacker || !defender || attacker.factionId === defender.factionId)
    return [...issues, 'Engagement requires opposing columns.'];
  if (
    new Set(declaration.participants.map((p) => p.columnId)).size !==
    declaration.participants.length
  )
    issues.push('A column can participate only once.');
  for (const primary of [attacker, defender])
    if (
      !declaration.participants.some(
        (p) => p.columnId === primary.id && !p.reinforcement,
      )
    )
      issues.push('Both primary columns must begin on the tabletop.');
  for (const p of declaration.participants) {
    const column = campaign.columns.find((c) => c.id === p.columnId);
    if (!column) {
      issues.push('Participant column does not exist.');
      continue;
    }
    if (
      column.factionId !==
      (p.role === 'attacker' ? attacker.factionId : defender.factionId)
    )
      issues.push('Participant role must match its faction.');
    if (
      adjacent(campaign, column.squareId, candidate.squareId) >
      (campaign.tabletop?.rules.battleJoinRange ??
        defaultScoutingRules.battleJoinRange)
    )
      issues.push(
        'Participants must be within the configured orthogonal joining range of the contact square.',
      );
    if (battleHoldingColumn(campaign, column.id))
      issues.push(
        'A participant is already committed to a battle or awaits post-battle review.',
      );
    if (
      !campaign.units.some(
        (u) => column.unitIds.includes(u.id) && u.currentStatus === 'ready',
      )
    )
      issues.push('Each participant needs at least one ready unit.');
    if (p.reinforcement && !p.arrivalNotes.trim())
      issues.push('Record agreed arrival instructions for reinforcements.');
  }
  return issues;
}
export function applyTabletopCommand(
  campaign: FontenoyCampaign,
  unparsed: TabletopReceipt,
): FontenoyCampaign {
  const receipt = tabletopReceiptSchema.parse(unparsed);
  const { command, recordId, timestamp } = receipt;
  if (campaign.status !== 'active' || !campaign.operations)
    throw new Error('Start the campaign and enable operational play first.');
  if (campaign.aftermath?.victory)
    throw new Error('The campaign has concluded.');
  if (
    campaign.aftermath?.pendingTurn !== null &&
    campaign.aftermath?.pendingTurn !== undefined &&
    (command.kind === 'scout' || command.kind === 'scouting-rules')
  )
    throw new Error('Finalize the completed campaign turn before scouting.');
  if (campaign.operations.phase === 'resolution')
    throw new Error('Resolve or reopen issued orders before tabletop actions.');
  const next = structuredClone(campaign);
  next.tabletop ??= {
    rules: structuredClone(defaultScoutingRules),
    contacts: [],
    battles: [],
  };
  const tabletop = next.tabletop;
  if (
    tabletop.contacts.some((c) => c.id === recordId) ||
    tabletop.battles.some((b) => b.id === recordId) ||
    [
      next.id,
      ...next.units.map((u) => u.id),
      ...next.columns.map((c) => c.id),
      ...next.commanders.map((c) => c.id),
      ...next.squares.map((s) => s.id),
      ...next.factions.map((f) => f.id),
      ...next.settings.objectives.map((o) => o.id),
    ].includes(recordId)
  )
    throw new Error('The new record identity must be unique.');
  if (Date.parse(timestamp) < Date.parse(campaign.updatedAt))
    throw new Error(
      'The recorded timestamp cannot precede the saved campaign.',
    );
  if (command.kind === 'scouting-rules') {
    if (next.operations!.phase === 'finished')
      throw new Error('The operational window has ended.');
    if (
      new Set(command.rules.eligibleTypes).size !==
      command.rules.eligibleTypes.length
    )
      throw new Error('Scout types must be unique.');
    tabletop.rules = structuredClone(command.rules);
  } else if (command.kind === 'scout') {
    if (next.operations!.phase !== 'planning')
      throw new Error('Scout during the active faction’s planning phase.');
    const input = command.input;
    const scout = next.columns.find((c) => c.id === input.scoutId);
    const target = next.columns.find((c) => c.id === input.targetColumnId);
    if (
      !scout ||
      !target ||
      scout.factionId === target.factionId ||
      sideOf(next, scout.factionId) !== next.activeSide
    )
      throw new Error('Choose an active-side scout and an opposing target.');
    if (
      battleHoldingColumn(next, scout.id) ||
      next.operations!.engagements.some(
        (e) =>
          !engagementSettled(next, e) &&
          (e.attackerId === scout.id || e.defenderId === scout.id),
      )
    )
      throw new Error('A column held for engagement cannot scout.');
    if (
      !next.units.some(
        (u) =>
          scout.unitIds.includes(u.id) &&
          u.currentStatus === 'ready' &&
          tabletop.rules.eligibleTypes.includes(u.type),
      )
    )
      throw new Error(
        'This column has no eligible ready scout unit under the selected house rules.',
      );
    if (
      adjacent(next, scout.squareId, target.squareId!) >
      tabletop.rules.rangeSquares
    )
      throw new Error('Target is beyond the configured scouting range.');
    if (
      tabletop.contacts.filter(
        (c) => c.turn === next.turn && c.input.scoutId === scout.id,
      ).length >= tabletop.rules.attemptsPerColumnPerTurn
    )
      throw new Error(
        'This column has used its scouting attempts for this turn.',
      );
    if (input.state === 'estimated' && !input.estimate.trim())
      throw new Error(
        'Enter an umpire-approved estimate for estimated intelligence.',
      );
    tabletop.contacts.push({
      id: recordId,
      observer: next.activeSide!,
      turn: next.turn,
      date: next.date!,
      timestamp,
      expiresAtTurn: next.turn + tabletop.rules.expiresAfterTurns,
      rules: structuredClone(tabletop.rules),
      input: structuredClone(input),
      snapshot: {
        squareId: target.squareId!,
        displayName: target.displayName,
        units: structuredClone(
          next.units.filter((u) => target.unitIds.includes(u.id)),
        ),
        commanders: structuredClone(
          next.commanders.filter((c) => target.commanderIds.includes(c.id)),
        ),
      },
    });
  } else if (command.kind === 'declare-battle') {
    const issues = declarationIssues(next, command.declaration);
    if (issues.length) throw new Error(issues.join(' '));
    const declaration = structuredClone(command.declaration);
    const date = new Date(`${next.settings.schedule.startDate}T00:00:00Z`);
    date.setUTCDate(
      date.getUTCDate() +
        (declaration.candidate.turn - 1) * next.settings.schedule.daysPerTurn,
    );
    tabletop.battles.push({
      id: recordId,
      declaration,
      stage: 'pending',
      createdAt: timestamp,
      startedAt: null,
      resolvedAt: null,
      ruleId: tabletop.rules.ruleId,
      turn: declaration.candidate.turn,
      date: date.toISOString().slice(0, 10),
      location: structuredClone(
        next.squares.find((s) => s.id === declaration.candidate.squareId)!,
      ),
      participants: declaration.participants.map((p) => {
        const column = next.columns.find((c) => c.id === p.columnId)!;
        return {
          ...p,
          displayName: column.displayName,
          side: sideOf(next, column.factionId)!,
          origin: structuredClone(
            next.squares.find((s) => s.id === column.squareId)!,
          ),
          units: structuredClone(
            next.units.filter(
              (u) =>
                column.unitIds.includes(u.id) && u.currentStatus === 'ready',
            ),
          ),
          commanders: structuredClone(
            next.commanders.filter(
              (c) =>
                column.commanderIds.includes(c.id) &&
                (c.campaignStatus ?? 'active') === 'active',
            ),
          ),
        };
      }),
      result: null,
    });
  } else {
    const battle = tabletop.battles.find((b) => b.id === command.battleId);
    if (!battle) throw new Error('Battle does not exist.');
    if (command.kind === 'start-battle') {
      if (battle.stage !== 'pending')
        throw new Error('Only a pending battle can begin.');
      battle.stage = 'in_progress';
      battle.startedAt = timestamp;
    } else {
      if (battle.stage !== 'in_progress')
        throw new Error(
          'Begin the tabletop battle before recording its result. Confirmed results are read-only.',
        );
      const unitIds = battle.participants.flatMap((p) =>
        p.units.map((u) => u.id),
      );
      const commanderIds = battle.participants.flatMap((p) =>
        p.commanders.map((c) => c.id),
      );
      if (
        command.result.units.length !== unitIds.length ||
        new Set(command.result.units.map((u) => u.unitId)).size !==
          unitIds.length ||
        command.result.units.some((u) => !unitIds.includes(u.unitId))
      )
        throw new Error('Record exactly one outcome for every committed unit.');
      if (
        command.result.commanders.length !== commanderIds.length ||
        new Set(command.result.commanders.map((c) => c.commanderId)).size !==
          commanderIds.length ||
        command.result.commanders.some(
          (c) => !commanderIds.includes(c.commanderId),
        )
      )
        throw new Error(
          'Record exactly one status for every committed commander.',
        );
      battle.result = structuredClone(command.result);
      battle.stage = 'resolved';
      battle.resolvedAt = timestamp;
      // E records tabletop facts only. F applies explicitly chosen campaign effects.
    }
  }
  return next;
}
export function tabletopIssues(campaign: FontenoyCampaign) {
  const tabletop = campaign.tabletop;
  if (!tabletop) return [];
  const issues: string[] = [];
  if (!campaign.operations || campaign.turn === 0)
    issues.push('Tabletop records require operational play.');
  if (
    new Set(tabletop.rules.eligibleTypes).size !==
    tabletop.rules.eligibleTypes.length
  )
    issues.push('Scout types must be unique.');
  const ids = new Set([
    campaign.id,
    ...campaign.factions.map((f) => f.id),
    ...campaign.units.map((u) => u.id),
    ...campaign.columns.map((c) => c.id),
    ...campaign.commanders.map((c) => c.id),
    ...campaign.squares.map((s) => s.id),
    ...campaign.settings.objectives.map((o) => o.id),
  ]);
  for (const record of [...tabletop.contacts, ...tabletop.battles]) {
    if (ids.has(record.id))
      issues.push('Tabletop record identities must be unique.');
    ids.add(record.id);
  }
  for (const contact of tabletop.contacts) {
    const scout = campaign.columns.find((c) => c.id === contact.input.scoutId);
    const target = campaign.columns.find(
      (c) => c.id === contact.input.targetColumnId,
    );
    if (
      !scout ||
      !target ||
      scout.factionId === target.factionId ||
      sideOf(campaign, scout.factionId) !== contact.observer ||
      new Set(contact.snapshot.units.map((u) => u.id)).size !==
        contact.snapshot.units.length ||
      contact.snapshot.units.some(
        (u) =>
          u.factionId !== target.factionId ||
          !campaign.units.some((current) => current.id === u.id),
      ) ||
      contact.snapshot.commanders.some(
        (c) =>
          c.factionId !== target.factionId ||
          !campaign.commanders.some((current) => current.id === c.id),
      )
    )
      issues.push('Invalid intelligence ownership or snapshot references.');
    if (
      contact.turn > campaign.turn ||
      contact.date !== dateForTurn(campaign, contact.turn) ||
      contact.expiresAtTurn !==
        contact.turn + contact.rules.expiresAfterTurns ||
      !campaign.columns.some((c) => c.id === contact.input.targetColumnId) ||
      !campaign.columns.some((c) => c.id === contact.input.scoutId) ||
      !campaign.squares.some((s) => s.id === contact.snapshot.squareId) ||
      Date.parse(contact.timestamp) > Date.parse(campaign.updatedAt)
    )
      issues.push('Invalid intelligence references or chronology.');
  }
  const committed = new Set<string>();
  for (const battle of tabletop.battles) {
    if (
      battle.turn > campaign.turn ||
      battle.date !== dateForTurn(campaign, battle.turn) ||
      !campaign.squares.some((s) => s.id === battle.location.id) ||
      Date.parse(battle.createdAt) > Date.parse(campaign.updatedAt) ||
      (battle.stage === 'pending') !== (battle.startedAt === null) ||
      (battle.stage === 'resolved') !==
        (battle.result !== null && battle.resolvedAt !== null) ||
      (battle.stage !== 'resolved' &&
        (battle.result !== null || battle.resolvedAt !== null)) ||
      (battle.startedAt &&
        Date.parse(battle.startedAt) > Date.parse(campaign.updatedAt)) ||
      (battle.resolvedAt &&
        Date.parse(battle.resolvedAt) > Date.parse(campaign.updatedAt)) ||
      (battle.startedAt &&
        Date.parse(battle.startedAt) < Date.parse(battle.createdAt)) ||
      (battle.resolvedAt &&
        Date.parse(battle.resolvedAt) < Date.parse(battle.startedAt!))
    )
      issues.push('Invalid battle stage, references or chronology.');
    if (
      battle.location.id !== battle.declaration.candidate.squareId ||
      !campaign.operations?.engagements.some((e) =>
        sameCandidate(e, battle.declaration.candidate),
      )
    )
      issues.push('Battle must reference an existing engagement.');
    const unitIds = battle.participants.flatMap((p) =>
      p.units.map((u) => u.id),
    );
    const commanderIds = battle.participants.flatMap((p) =>
      p.commanders.map((c) => c.id),
    );
    if (
      new Set(unitIds).size !== unitIds.length ||
      new Set(commanderIds).size !== commanderIds.length
    )
      issues.push('Duplicate frozen battle forces.');
    if (
      battle.result &&
      (battle.result.units.length !== unitIds.length ||
        new Set(battle.result.units.map((u) => u.unitId)).size !==
          unitIds.length ||
        battle.result.units.some((u) => !unitIds.includes(u.unitId)) ||
        battle.result.commanders.length !== commanderIds.length ||
        new Set(battle.result.commanders.map((c) => c.commanderId)).size !==
          commanderIds.length ||
        battle.result.commanders.some(
          (c) => !commanderIds.includes(c.commanderId),
        ))
    )
      issues.push('Battle results must cover the frozen forces exactly.');
    for (const p of battle.participants) {
      const column = campaign.columns.find((c) => c.id === p.columnId);
      const declared = battle.declaration.participants.find(
        (record) => record.columnId === p.columnId,
      );
      if (
        !declared ||
        declared.role !== p.role ||
        declared.entryEdge !== p.entryEdge ||
        declared.reinforcement !== p.reinforcement ||
        declared.arrivalNotes !== p.arrivalNotes ||
        p.side !== sideOf(campaign, column?.factionId ?? '') ||
        !campaign.squares.some((s) => s.id === p.origin.id) ||
        p.units.some((u) => u.factionId !== column?.factionId) ||
        p.commanders.some((c) => c.factionId !== column?.factionId)
      )
        issues.push('Battle snapshot must match the declared participants.');
      if (
        (!battleReviewed(campaign, battle.id) && committed.has(p.columnId)) ||
        !campaign.columns.some((c) => c.id === p.columnId) ||
        p.units.some(
          (u) => !campaign.units.some((current) => current.id === u.id),
        ) ||
        p.commanders.some(
          (c) => !campaign.commanders.some((current) => current.id === c.id),
        )
      )
        issues.push('Invalid or overlapping committed forces.');
      if (!battleReviewed(campaign, battle.id)) committed.add(p.columnId);
    }
  }
  return issues;
}
function dateForTurn(campaign: FontenoyCampaign, turn: number) {
  const date = new Date(`${campaign.settings.schedule.startDate}T00:00:00Z`);
  date.setUTCDate(
    date.getUTCDate() + (turn - 1) * campaign.settings.schedule.daysPerTurn,
  );
  return date.toISOString().slice(0, 10);
}
export function activeContacts(campaign: FontenoyCampaign, view: MapView) {
  const latest = new Map<
    string,
    NonNullable<FontenoyCampaign['tabletop']>['contacts'][number]
  >();
  for (const contact of campaign.tabletop?.contacts ?? [])
    if (view === 'umpire' || contact.observer === view)
      latest.set(
        `${contact.observer}:${contact.input.targetColumnId}`,
        contact,
      );
  return [...latest.values()].filter(
    (c) => campaign.turn < c.expiresAtTurn && c.input.state !== 'unknown',
  );
}
export function battleResultDraft(battle: Battle) {
  return {
    outcome: '' as '' | NonNullable<Battle['result']>['outcome'],
    units: battle.participants.flatMap((p) =>
      p.units.map((u) => ({
        unitId: u.id,
        outcome: '' as
          '' | NonNullable<Battle['result']>['units'][number]['outcome'],
        disruptedAtEnd: null as boolean | null,
        notes: '',
      })),
    ),
    commanders: battle.participants.flatMap((p) =>
      p.commanders.map((c) => ({
        commanderId: c.id,
        status: 'unchanged' as NonNullable<
          Battle['result']
        >['commanders'][number]['status'],
        notes: '',
      })),
    ),
    armyMorale: {
      french: null as number | null,
      allied: null as number | null,
    },
    notes: '',
  };
}
