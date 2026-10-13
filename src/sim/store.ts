import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { markRead, prioritiseTruck, reorder, setForklift, step, toggleDockMaintenance } from './engine';
import { STATE_VERSION, createInitialState } from './seed';
import type { HubId, Selection, SimState } from './types';

export const SPEEDS = [0, 1, 5, 20] as const;
export type Speed = (typeof SPEEDS)[number];

export type OpsTab = 'docks' | 'forklifts' | 'trucks';
export type ZoomDir = 1 | -1 | 0 | 'panorama';

interface Store {
  sim: SimState;
  hubId: HubId;
  speed: Speed;
  selection: Selection;
  hovered: string | null;
  opsTab: OpsTab;
  showLabels: boolean;
  /** Panels hidden so the map fills the screen ("minimize"). Not persisted. */
  uiHidden: boolean;
  /** performance.now() of the last tick, so the 3D scene can interpolate between ticks. */
  lastTickPerf: number;
  /** Bumped to ask the camera to fly somewhere (see CameraRig). */
  focusNonce: number;
  /** Bumped by the map buttons: zoom in/out, back home (0) or the wide panorama. */
  zoomRequest: { nonce: number; dir: ZoomDir };

  tick: (realDt: number) => void;
  setHub: (id: HubId) => void;
  setSpeed: (s: Speed) => void;
  select: (sel: Selection, focus?: boolean) => void;
  setHovered: (id: string | null) => void;
  setOpsTab: (t: OpsTab) => void;
  toggleLabels: () => void;
  toggleUi: () => void;
  zoom: (dir: ZoomDir) => void;

  prioritise: (truckId: string) => void;
  reorder: (sku: string) => void;
  setForklift: (id: string, status: 'charging' | 'active') => void;
  toggleDock: (index: number) => void;
  markRead: () => void;
  reset: () => void;
}

/** localStorage that never throws (private mode, blocked storage, quota). */
const safeStorage: Storage = {
  get length() {
    try {
      return localStorage.length;
    } catch {
      return 0;
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  },
  key: (i) => {
    try {
      return localStorage.key(i);
    } catch {
      return null;
    }
  },
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      sim: createInitialState(Date.now()),
      hubId: 'riverside',
      speed: 1,
      selection: { kind: 'hub' },
      hovered: null,
      opsTab: 'docks',
      showLabels: true,
      uiHidden: false,
      lastTickPerf: performance.now(),
      focusNonce: 0,
      zoomRequest: { nonce: 0, dir: 0 },

      tick: (realDt) => {
        const { speed, sim } = get();
        const perf = performance.now();
        if (speed === 0) return set({ lastTickPerf: perf });
        set({ sim: step(sim, realDt * speed), lastTickPerf: perf });
      },
      setHub: (hubId) => set({ hubId, selection: { kind: 'hub' }, focusNonce: get().focusNonce + 1 }),
      setSpeed: (speed) => set({ speed, lastTickPerf: performance.now() }),
      select: (selection, focus = false) =>
        set((st) => ({ selection, focusNonce: focus ? st.focusNonce + 1 : st.focusNonce })),
      setHovered: (hovered) => set({ hovered }),
      setOpsTab: (opsTab) => set({ opsTab }),
      toggleLabels: () => set((st) => ({ showLabels: !st.showLabels })),
      toggleUi: () => set((st) => ({ uiHidden: !st.uiHidden })),
      zoom: (dir) => set((st) => ({ zoomRequest: { nonce: st.zoomRequest.nonce + 1, dir } })),

      prioritise: (id) => set((st) => ({ sim: prioritiseTruck(st.sim, id) })),
      reorder: (sku) => set((st) => ({ sim: reorder(st.sim, st.hubId, sku) })),
      setForklift: (id, status) => set((st) => ({ sim: setForklift(st.sim, id, status) })),
      toggleDock: (index) => set((st) => ({ sim: toggleDockMaintenance(st.sim, st.hubId, index) })),
      markRead: () => set((st) => ({ sim: markRead(st.sim, st.hubId) })),
      reset: () =>
        set((st) => ({
          sim: createInitialState(Date.now()),
          selection: { kind: 'hub' },
          speed: 1,
          focusNonce: st.focusNonce + 1,
        })),
    }),
    {
      name: 'hubline-wms',
      version: STATE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (st) => ({ sim: st.sim, hubId: st.hubId, speed: st.speed, opsTab: st.opsTab, showLabels: st.showLabels }),
      // An old or foreign save is dropped rather than migrated — it's demo data.
      migrate: () => ({ sim: createInitialState(Date.now()), hubId: 'riverside', speed: 1, opsTab: 'docks' }) as never,
      merge: (persisted, current) => {
        const p = persisted as Partial<Store> | undefined;
        if (!p?.sim || p.sim.version !== STATE_VERSION) return current;
        return { ...current, ...p, sim: catchUp(p.sim) };
      },
    },
  ),
);

/**
 * A saved yard resumes where it left off. If the tab was closed for a while, fast-forward
 * up to 30 minutes so trucks don't all sit frozen; longer gaps just resume.
 */
function catchUp(sim: SimState): SimState {
  const gap = Date.now() - sim.simNow;
  if (gap <= 0) return sim;
  return step(sim, Math.min(gap, 30 * 60 * 1000));
}

/* ------------------------------------------------------------ selectors */

export const useHub = () => useStore((st) => st.sim.hubs.find((h) => h.id === st.hubId)!);
