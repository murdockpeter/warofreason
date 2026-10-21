import type {
  Declaration,
  ScoutInput,
  ScoutingRules,
} from '../domain/tabletop-schema';
import type { battleResultDraft } from '../domain/tabletop';
import type { AftermathCommand } from '../domain/aftermath-schema';
import type { OperationalCommand } from '../domain/operations-schema';

export type TabletopDraft =
  | {
      kind: 'formation';
      command: Extract<OperationalCommand, { kind: 'split' }>;
    }
  | { kind: 'aftermath'; command: AftermathCommand }
  | { kind: 'scout'; input: Omit<ScoutInput, 'roll'> & { roll: number | null } }
  | { kind: 'declaration'; declaration: Declaration }
  | {
      kind: 'result';
      battleId: string;
      result: ReturnType<typeof battleResultDraft>;
    }
  | { kind: 'scouting-rules'; rules: ScoutingRules };
