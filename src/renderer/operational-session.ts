import { create } from 'zustand';
import type { MapView } from '../domain/operations-schema';

export const useOperationalSession = create<{
  view: MapView;
  setView(view: MapView): void;
}>((set) => ({ view: 'umpire', setView: (view) => set({ view }) }));
