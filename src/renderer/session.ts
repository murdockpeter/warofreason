import { create } from 'zustand';

export const screens = [
  'Dashboard',
  'Campaign Map',
  'Armies/Columns',
  'Turn Orders',
  'Battle Log',
  'Siege & Victory',
  'Settings',
] as const;
export type Screen = (typeof screens)[number];
interface Session {
  screen: Screen;
  notice: string | null;
  navigate: (screen: Screen) => void;
  setNotice: (notice: string | null) => void;
}
export const useSession = create<Session>((set) => ({
  screen: 'Dashboard',
  notice: null,
  navigate: (screen) => set({ screen }),
  setNotice: (notice) => set({ notice }),
}));
