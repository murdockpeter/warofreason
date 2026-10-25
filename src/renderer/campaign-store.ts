import { create } from 'zustand';
import { fontenoyCampaignSchema } from '../domain/campaign';
import type { CampaignLibrary, FontenoyCampaign } from '../domain/campaign';
import { editSetup } from '../domain/setup-editing';
import type { SetupCommand } from '../domain/setup-editing';
import {
  createCampaignSchema,
  renameCampaignSchema,
} from '../shared/campaign-contracts';
import type { LibraryResult } from '../shared/campaign-contracts';
import type {
  MovementOrder,
  OperationalCommand,
} from '../domain/operations-schema';
import { routeCost } from '../domain/operations';
import { operationalCommandSchema } from '../domain/operations-schema';
import type { TabletopDraft } from './tabletop-draft';
import { tabletopCommandSchema } from '../domain/tabletop-schema';
import type { TabletopCommand } from '../domain/tabletop-schema';
import { aftermathCommandSchema } from '../domain/aftermath-schema';
import type { AftermathCommand } from '../domain/aftermath-schema';
import type {
  WaterlooCommand,
  WaterlooResult,
} from '../domain/waterloo-schema';
import type { SimultaneousRecoveryPolicy } from '../domain/simultaneous-aftermath-schema';

export type WaterlooDraft =
  | { kind: 'recovery-policy'; policy: SimultaneousRecoveryPolicy }
  | {
      kind: 'withdrawal';
      corpsId: string;
      enemyId: string;
      path: string[];
      priority: number;
      blocked?: boolean;
    }
  | {
      kind: 'route';
      corpsId: string;
      path: string[];
      roadOnly: boolean;
      startAt: number;
      hqId: string;
    }
  | {
      kind: 'result';
      battleId: string;
      result: WaterlooResult;
      reason: string;
    };

type DraftFields = { title: string; actor: string; reason: string };
export type CampaignDraft = DraftFields & {
  kind: 'create' | 'rename' | 'clone';
  id: string | null;
  expectedRevision: number | null;
  history: DraftFields[];
};
interface CampaignSession {
  waterlooDraft: WaterlooDraft | null;
  createFontenoyOperations(): Promise<void>;
  copyFontenoyOperations(): Promise<void>;
  commitWaterloo(command: WaterlooCommand): Promise<void>;
  commitAftermath(command: AftermathCommand): Promise<void>;
  tabletopDraft: TabletopDraft | null;
  beginTabletop(draft: TabletopDraft): Promise<void>;
  editTabletop(draft: TabletopDraft): void;
  saveTabletop(): Promise<void>;
  commitTabletop(command: TabletopCommand): Promise<void>;
  planningDraft: MovementOrder[] | null;
  planningHistory: MovementOrder[][];
  planOrder(order: MovementOrder | null, columnId: string): void;
  undoOrder(): void;
  operate(command: OperationalCommand): Promise<void>;
  setupDraft: FontenoyCampaign | null;
  setupHistory: FontenoyCampaign[];
  beginSetup(): Promise<void>;
  changeSetup(command: SetupCommand): void;
  undoSetup(): void;
  saveSetup(): Promise<void>;
  loadScenario(): Promise<void>;
  start(): Promise<void>;
  library: CampaignLibrary | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  message: string | null;
  draft: CampaignDraft | null;
  initialize(): Promise<void>;
  begin(kind: CampaignDraft['kind']): Promise<void>;
  edit(field: keyof DraftFields, value: string): void;
  undo(): void;
  discard(): Promise<void>;
  save(): Promise<void>;
  open(id: string): Promise<void>;
  archive(): Promise<void>;
  importFile(): Promise<void>;
  exportFile(): Promise<void>;
}

export const useCampaigns = create<CampaignSession>((set, get) => {
  async function allowDiscard(): Promise<boolean> {
    if (
      !get().draft &&
      !get().waterlooDraft &&
      !get().setupDraft &&
      !get().planningDraft &&
      !get().tabletopDraft
    )
      return true;
    set({ pending: true });
    try {
      if (!(await window.desktop.confirmDiscardDraft())) return false;
      set({
        draft: null,
        waterlooDraft: null,
        setupDraft: null,
        setupHistory: [],
        planningDraft: null,
        planningHistory: [],
        tabletopDraft: null,
      });
      return true;
    } finally {
      set({ pending: false });
    }
  }
  async function perform(
    operation: () => Promise<LibraryResult>,
    clearDraft = false,
  ) {
    if (get().pending || get().loading) return;
    set({ pending: true, error: null, message: null });
    try {
      const result = await operation();
      if (result.ok)
        set({
          library: result.value,
          ...(clearDraft
            ? {
                draft: null,
                waterlooDraft: null,
                setupDraft: null,
                setupHistory: [],
                planningDraft: null,
                planningHistory: [],
                tabletopDraft: null,
              }
            : {}),
          message: 'Committed data is saved locally.',
        });
      else set({ error: result.error.message });
    } catch {
      set({
        error:
          'The desktop connection failed. Your draft is still available. Reload the library before retrying.',
      });
    } finally {
      set({ pending: false });
    }
  }
  async function guarded(operation: () => Promise<LibraryResult>) {
    if (get().pending || get().loading) return;
    try {
      if (await allowDiscard()) await perform(operation);
    } catch {
      set({
        error: 'The confirmation dialog could not open. No changes were made.',
      });
    }
  }
  return {
    waterlooDraft: null,
    async createFontenoyOperations() {
      await guarded(() =>
        window.desktop.createCampaign({
          title: 'The Road to Fontenoy, 1745 — simultaneous operations',
          profile: 'simultaneous_fontenoy',
          actor: 'Local player',
          reason:
            'Created a Maurice Fontenoy campaign with simultaneous operational play and manually adjudicated battles.',
        }),
      );
    },
    async copyFontenoyOperations() {
      const active = get().library?.active;
      if (active?.schemaVersion !== 2) return;
      await guarded(() =>
        window.desktop.cloneCampaign({
          id: active.id,
          expectedRevision: active.revision,
          title: `${active.title.slice(0, 90)} — simultaneous`,
          profile: 'simultaneous_fontenoy',
          actor: 'Local player',
          reason:
            'Created a fresh simultaneous Maurice campaign from the saved Fontenoy forces, geography and objectives; the source campaign is unchanged.',
        }),
      );
    },
    async commitWaterloo(command) {
      const active = get().library?.active;
      if (active?.schemaVersion !== 3) return;
      const revision = active.revision;
      await perform(() =>
        window.desktop.commitWaterlooAction({
          id: active.id,
          expectedRevision: revision,
          actor: 'Local umpire',
          reason: `Reviewed ${command.kind} under simultaneous campaign rules.`,
          command,
        }),
      );
      if (get().library?.active?.revision !== revision)
        set({ waterlooDraft: null });
    },
    tabletopDraft: null,
    async beginTabletop(draft) {
      if (get().pending || get().loading) return;
      try {
        if (await allowDiscard())
          set({
            tabletopDraft: structuredClone(draft),
            error: null,
            message: null,
          });
      } catch {
        set({ error: 'The editor could not open; saved state is unchanged.' });
      }
    },
    editTabletop(draft) {
      if (!get().pending)
        set({ tabletopDraft: draft, error: null, message: null });
    },
    async saveTabletop() {
      const draft = get().tabletopDraft;
      if (!draft) return;
      if (draft.kind === 'formation') {
        const active = get().library?.active;
        const parsed = operationalCommandSchema.safeParse(draft.command);
        if (!active || get().pending || !parsed.success) {
          set({
            error: 'Name the new formation and move at least one unit into it.',
          });
          return;
        }
        await perform(() =>
          window.desktop.commitOperationalAction({
            id: active.id,
            expectedRevision: active.revision,
            actor: 'Local player',
            reason:
              'Split a formation at its existing position; no movement or unit state change.',
            command: parsed.data,
          }),
        );
        if (get().library?.active?.revision !== active.revision && !get().error)
          set({ tabletopDraft: null });
        return;
      }
      if (draft.kind === 'aftermath') {
        const parsed = aftermathCommandSchema.safeParse(draft.command);
        if (!parsed.success) {
          set({
            error: `Complete the required fields: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join(' ')}`.slice(0, 1900),
          });
          return;
        }
        await get().commitAftermath(parsed.data);
        return;
      }
      const command =
        draft.kind === 'scout'
          ? { kind: 'scout', input: draft.input }
          : draft.kind === 'declaration'
            ? { kind: 'declare-battle', declaration: draft.declaration }
            : draft.kind === 'result'
              ? {
                  kind: 'record-result',
                  battleId: draft.battleId,
                  result: draft.result,
                }
              : { kind: 'scouting-rules', rules: draft.rules };
      const parsed = tabletopCommandSchema.safeParse(command);
      if (!parsed.success) {
        set({
          error: `Complete the required fields: ${parsed.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(' ')}`.slice(0, 1900),
        });
        return;
      }
      await get().commitTabletop(parsed.data);
    },
    async commitTabletop(command) {
      const active = get().library?.active;
      if (!active || get().pending || get().loading) return;
      if (
        get().draft ||
        get().setupDraft ||
        get().planningDraft ||
        (get().tabletopDraft && command.kind === 'start-battle')
      ) {
        set({ error: 'Save or discard your current draft first.' });
        return;
      }
      await perform(() =>
        window.desktop.commitTabletopAction({
          id: active.id,
          expectedRevision: active.revision,
          actor: 'Local umpire',
          reason: `Recorded ${command.kind} under player-reviewed tabletop procedures.`,
          command,
        }),
      );
      const saved = get().library?.active;
      if (saved?.id === active.id && saved.revision !== active.revision)
        set({ tabletopDraft: null });
      else if (!get().error)
        set({
          message: 'No changes committed. Your draft is still available.',
        });
    },
    async commitAftermath(command) {
      const active = get().library?.active;
      if (!active || get().pending || get().loading) return;
      if (
        get().draft ||
        get().setupDraft ||
        get().planningDraft ||
        (get().tabletopDraft && get().tabletopDraft?.kind !== 'aftermath')
      ) {
        set({ error: 'Save or discard your current draft first.' });
        return;
      }
      await perform(() =>
        window.desktop.commitAftermathAction({
          id: active.id,
          expectedRevision: active.revision,
          actor: 'Local umpire',
          reason: `Reviewed campaign ${command.kind}.`,
          command,
        }),
      );
      const saved = get().library?.active;
      if (saved?.id === active.id && saved.revision !== active.revision)
        set({ tabletopDraft: null });
      else if (!get().error)
        set({
          message: 'No changes committed. Your draft is still available.',
        });
    },
    planningDraft: null,
    planningHistory: [],
    planOrder(order, columnId) {
      const campaign = get().library?.active;
      if (
        campaign?.schemaVersion !== 2 ||
        campaign.status !== 'active' ||
        campaign.operations?.phase !== 'planning' ||
        get().pending
      )
        return;
      try {
        if (order) routeCost(campaign, order);
        const before = get().planningDraft ?? campaign.operations.orders;
        const orders = before.filter((o) => o.columnId !== columnId);
        if (order) orders.push(order);
        set({
          planningDraft: orders,
          planningHistory: [...get().planningHistory.slice(-49), before],
          error: null,
          message: null,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Order rejected.',
        });
      }
    },
    undoOrder() {
      if (get().pending) return;
      const previous = get().planningHistory.at(-1);
      if (previous)
        set({
          planningDraft: previous,
          planningHistory: get().planningHistory.slice(0, -1),
          error: null,
        });
    },
    async operate(command) {
      const active = get().library?.active;
      if (!active || get().pending || get().loading) return;
      if (
        get().draft ||
        get().setupDraft ||
        get().tabletopDraft ||
        (get().planningDraft && command.kind !== 'issue')
      ) {
        set({
          error: 'Save or discard your current draft before this action.',
        });
        return;
      }
      await perform(
        () =>
          window.desktop.commitOperationalAction({
            id: active.id,
            expectedRevision: active.revision,
            actor: 'Local player',
            reason: `Operational ${command.kind}.`,
            command,
          }),
        true,
      );
    },
    setupDraft: null,
    setupHistory: [],
    async beginSetup() {
      if (get().pending || get().loading) return;
      try {
        if (!(await allowDiscard())) return;
        const campaign = get().library?.active;
        if (campaign?.schemaVersion === 2 && campaign.status === 'draft')
          set({
            setupDraft: structuredClone(campaign),
            setupHistory: [],
            error: null,
            message: null,
          });
      } catch {
        set({
          error:
            'The setup editor could not open. Your saved data is unchanged.',
        });
      }
    },
    changeSetup(command) {
      const draft = get().setupDraft;
      if (!draft || get().pending) return;
      try {
        set({
          setupDraft: editSetup(draft, command, () => crypto.randomUUID()),
          setupHistory: [...get().setupHistory.slice(-49), draft],
          error: null,
          message: null,
        });
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : 'Setup edit was rejected.',
        });
      }
    },
    undoSetup() {
      const history = get().setupHistory;
      if (get().pending) return;
      const previous = history.at(-1);
      if (previous)
        set({
          setupDraft: previous,
          setupHistory: history.slice(0, -1),
          error: null,
        });
    },
    async saveSetup() {
      const draft = get().setupDraft;
      if (!draft || get().pending) return;
      const parsed = fontenoyCampaignSchema.safeParse(draft);
      if (!parsed.success) {
        set({
          error: parsed.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(' ')
            .slice(0, 1900),
        });
        return;
      }
      await perform(
        () =>
          window.desktop.saveCampaignSetup({
            id: draft.id,
            expectedRevision: draft.revision,
            actor: 'Local player',
            reason: 'Reviewed and saved provisional Fontenoy setup.',
            settings: parsed.data.settings,
            columns: parsed.data.columns,
            commanders: parsed.data.commanders,
          }),
        true,
      );
    },
    async loadScenario() {
      const active = get().library?.active;
      if (!active) return;
      await guarded(() =>
        window.desktop.initializeScenario({
          id: active.id,
          expectedRevision: active.revision,
          actor: 'Local player',
          reason:
            'Loaded the versioned Fontenoy module into an existing draft.',
        }),
      );
    },
    async start() {
      const active = get().library?.active;
      if (!active || get().setupDraft || get().draft) return;
      await perform(() =>
        window.desktop.startCampaign({
          id: active.id,
          expectedRevision: active.revision,
          actor: 'Local player',
          reason:
            'Confirmed reviewed schematic map and provisional operational setup; started turn 1.',
        }),
      );
    },
    library: null,
    loading: false,
    pending: false,
    error: null,
    message: null,
    draft: null,
    async initialize() {
      if (get().loading || get().pending) return;
      set({ loading: true, error: null });
      try {
        const result = await window.desktop.getCampaignLibrary();
        if (result.ok) set({ library: result.value });
        else set({ error: result.error.message });
      } catch {
        set({
          error:
            'Campaign storage could not be reached. Retry loading the library; no saved data has been reset.',
        });
      } finally {
        set({ loading: false });
      }
    },
    async begin(kind) {
      if (get().pending || get().loading || !get().library) return;
      try {
        if (!(await allowDiscard())) return;
        const active = get().library?.active;
        if (kind !== 'create' && !active) return;
        set({
          error: null,
          message: null,
          draft: {
            kind,
            title:
              kind === 'create'
                ? ''
                : kind === 'clone'
                  ? `${active!.title.slice(0, 110)} (copy)`
                  : active!.title,
            actor: 'Local player',
            reason:
              kind === 'create'
                ? 'Created a campaign draft.'
                : kind === 'clone'
                  ? 'Created an independent campaign copy.'
                  : 'Updated the campaign title.',
            id: kind === 'create' ? null : active!.id,
            expectedRevision: kind === 'create' ? null : active!.revision,
            history: [],
          },
        });
      } catch {
        set({
          error:
            'The confirmation dialog could not open. Your edits were kept.',
        });
      }
    },
    edit(field, value) {
      const draft = get().draft;
      if (!draft || get().pending || draft[field] === value) return;
      const previous = {
        title: draft.title,
        actor: draft.actor,
        reason: draft.reason,
      };
      set({
        draft: {
          ...draft,
          [field]: value,
          history: [...draft.history.slice(-99), previous],
        },
        error: null,
      });
    },
    undo() {
      const draft = get().draft;
      if (!draft || get().pending) return;
      const previous = draft.history.at(-1);
      if (previous)
        set({
          draft: { ...draft, ...previous, history: draft.history.slice(0, -1) },
          error: null,
        });
    },
    async discard() {
      if (get().pending) return;
      try {
        await allowDiscard();
      } catch {
        set({
          error:
            'The confirmation dialog could not open. Your edits were kept.',
        });
      }
    },
    async save() {
      const draft = get().draft;
      if (!draft || get().pending) return;
      const fields = {
        title: draft.title,
        actor: draft.actor,
        reason: draft.reason,
      };
      if (draft.kind === 'create') {
        const input = createCampaignSchema.safeParse(fields);
        if (!input.success) {
          set({
            error:
              'Enter a title (1–120 characters), an actor (1–120), and a reason (1–500).',
          });
          return;
        }
        await perform(() => window.desktop.createCampaign(input.data), true);
      } else {
        const input = renameCampaignSchema.safeParse({
          ...fields,
          id: draft.id,
          expectedRevision: draft.expectedRevision,
        });
        if (!input.success) {
          set({
            error:
              'Enter a valid title, actor and reason. Reopen the campaign if its reference is invalid.',
          });
          return;
        }
        await perform(
          () =>
            draft.kind === 'rename'
              ? window.desktop.renameCampaign(input.data)
              : window.desktop.cloneCampaign(input.data),
          true,
        );
      }
    },
    async open(id) {
      await guarded(() => window.desktop.openCampaign({ id }));
    },
    async archive() {
      const active = get().library?.active;
      if (!active) return;
      await guarded(() =>
        window.desktop.archiveCampaign({
          id: active.id,
          expectedRevision: active.revision,
          actor: 'Local player',
          reason: 'Archived the campaign as a read-only record.',
        }),
      );
    },
    async importFile() {
      await guarded(() => window.desktop.importCampaign());
    },
    async exportFile() {
      const active = get().library?.active;
      if (!active || get().pending || get().loading) return;
      set({ pending: true, error: null, message: null });
      try {
        const result = await window.desktop.exportCampaign({
          id: active.id,
          expectedRevision: active.revision,
        });
        if (!result.ok) set({ error: result.error.message });
        else
          set({
            message: result.value.cancelled
              ? 'Export cancelled.'
              : 'Saved campaign and journal exported.',
          });
      } catch {
        set({
          error:
            'Export could not complete. Existing exports and your draft were preserved.',
        });
      } finally {
        set({ pending: false });
      }
    },
  };
});
