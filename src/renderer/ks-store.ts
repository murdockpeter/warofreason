import { create } from 'zustand';
import type { KsCommand, KsLibrary } from '../domain/crimean-ks';
import type { KsResult } from '../shared/ks-contracts';
interface KsStore {
  library: KsLibrary | null;
  pending: boolean;
  error: string | null;
  load(): Promise<boolean>;
  createCampaign(title: string): Promise<boolean>;
  open(id: string): Promise<boolean>;
  commit(command: KsCommand, reason: string): Promise<boolean>;
  importCampaign(): Promise<boolean>;
  exportCampaign(): Promise<boolean>;
}
export const useKs = create<KsStore>((set, get) => {
  async function perform(action: () => Promise<KsResult>) {
    if (get().pending) return false;
    set({ pending: true, error: null });
    try {
      const result = await action();
      if (!result.ok) {
        set({ error: result.error.message });
        return false;
      }
      set({ library: result.value });
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to access Free KS storage.',
      });
      return false;
    } finally {
      set({ pending: false });
    }
  }
  return {
    library: null,
    pending: false,
    error: null,
    load: () => perform(() => window.desktop.getKsLibrary()),
    createCampaign: (title) =>
      perform(() =>
        window.desktop.createKsCampaign({
          title,
          actor: 'Local umpire',
          reason:
            'Created a separate Crimean War free-form Kriegsspiel campaign; no forces or rules assumed.',
        }),
      ),
    open: (id) => perform(() => window.desktop.openKsCampaign({ id })),
    commit: (command, reason) => {
      const c = get().library?.active;
      if (!c) return Promise.resolve(false);
      return perform(() =>
        window.desktop.commitKsRuling({
          id: c.id,
          expectedRevision: c.revision,
          actor: 'Local umpire',
          reason,
          command,
        }),
      );
    },
    importCampaign: () => perform(() => window.desktop.importKsCampaign()),
    async exportCampaign() {
      const c = get().library?.active;
      if (!c || get().pending) return false;
      set({ pending: true, error: null });
      try {
        const result = await window.desktop.exportKsCampaign({
          id: c.id,
          expectedRevision: c.revision,
        });
        if (!result.ok) {
          set({ error: result.error.message });
          return false;
        }
        return !result.value.cancelled;
      } catch (error) {
        set({ error: String(error) });
        return false;
      } finally {
        set({ pending: false });
      }
    },
  };
});
