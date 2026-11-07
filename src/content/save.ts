import { META_UPGRADES } from "./catalog";
import type { SaveData } from "./types";

export const SAVE_KEY = "capkeep-save-v1";

export function emptySave(): SaveData {
  return { best: {}, bought: [], autoWaves: true, heroId: "puff" };
}

export function setAutoWaves(save: SaveData, autoWaves: boolean): SaveData {
  return { ...save, best: { ...save.best }, bought: save.bought.slice(), autoWaves };
}

export function setHero(save: SaveData, heroId: string): SaveData {
  return { ...save, best: { ...save.best }, bought: save.bought.slice(), heroId };
}

export function starsEarned(save: SaveData): number {
  return Object.values(save.best).reduce((sum, value) => sum + value, 0);
}

export function starsAvailable(save: SaveData): number {
  return starsEarned(save) - save.bought.length;
}

export function applyClear(save: SaveData, levelId: string, stars: number): SaveData {
  const best = { ...save.best };
  best[levelId] = Math.max(best[levelId] ?? 0, stars);
  return { best, bought: save.bought.slice(), autoWaves: save.autoWaves, heroId: save.heroId };
}

export function buyUpgrade(save: SaveData, id: string): SaveData | null {
  if (!META_UPGRADES.some((upgrade) => upgrade.id === id)) return null;
  if (save.bought.includes(id)) return null;
  if (starsAvailable(save) < 1) return null;
  return { best: { ...save.best }, bought: [...save.bought, id], autoWaves: save.autoWaves, heroId: save.heroId };
}

export function resetUpgrades(save: SaveData): SaveData {
  return { best: { ...save.best }, bought: [], autoWaves: save.autoWaves, heroId: save.heroId };
}

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return emptySave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const best: Record<string, number> = {};
    if (parsed.best && typeof parsed.best === "object") {
      for (const [key, value] of Object.entries(parsed.best)) {
        if (typeof value === "number" && value >= 0 && value <= 3) best[key] = value;
      }
    }
    const bought = Array.isArray(parsed.bought) ? parsed.bought.filter((id) => typeof id === "string") : [];
    // Missing flag = pre-auto saves; keep call-yourself behavior. New empty saves still default true.
    const autoWaves = typeof parsed.autoWaves === "boolean" ? parsed.autoWaves : false;
    const heroId = typeof parsed.heroId === "string" ? parsed.heroId : "puff";
    return { best, bought, autoWaves, heroId };
  } catch {
    return emptySave();
  }
}

export function commitSave(save: SaveData): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}
