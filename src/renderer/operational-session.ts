import { create } from 'zustand';
import type { MapView } from '../domain/operations-schema';

export const useOperationalSession = create<{
  view: MapView;
  planningSide: 'french' | 'allied';
  setPlanningSide(side: 'french' | 'allied'): void;
  setView(view: MapView): void;
}>((set) => ({
  view: 'umpire',
  planningSide: 'french',
  setPlanningSide: (planningSide) => set({ planningSide }),
  setView: (view) => set({ view }),
}));
