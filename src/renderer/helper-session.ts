import { create } from 'zustand';
const key = 'maurice.helper-mode';
function initialPreference() {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}
export const useHelperSession = create<{
  enabled: boolean;
  setEnabled(value: boolean): void;
}>((set) => ({
  enabled: initialPreference(),
  setEnabled(value) {
    try {
      localStorage.setItem(key, value ? 'on' : 'off');
    } catch {
      /* Guidance still works when preference storage is unavailable. */
    }
    set({ enabled: value });
  },
}));
