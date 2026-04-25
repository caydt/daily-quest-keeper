import type { GardenState } from "@/lib/garden-store";

export interface StorageAdapter {
  load(): Promise<GardenState | null>;
  save(state: GardenState): Promise<void>;
}

const STORAGE_KEY = "lumi-garden-v3";

export function createLocalAdapter(): StorageAdapter {
  return {
    async load() {
      if (typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as GardenState;
      } catch {
        return null;
      }
    },
    async save(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    },
  };
}
