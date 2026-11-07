import { ENEMY_MAP, HERO } from "./catalog";
import type { EnemyDef, LevelDef, WaveDef } from "./types";

/** Launch variants, in the spirit of the genre: same road, different march. */

export type ModeId = "campaign" | "heroic" | "iron" | "endless";
export type DifficultyId = "casual" | "normal" | "veteran";

export interface ModeDef {
  id: ModeId;
  name: string;
  blurb: string;
  lives: number | null; // absolute override, null = keep level lives
  hpScale: number;
  goldScale: number;
  capTier4: boolean;
  forceManual: boolean;
}

export const MODES: ModeDef[] = [
  { id: "campaign", name: "Campaign", blurb: "The march as written.", lives: null, hpScale: 1, goldScale: 1, capTier4: false, forceManual: false },
  { id: "heroic", name: "Heroic", blurb: "One life. Foes are tougher. Hold perfectly.", lives: 1, hpScale: 1.25, goldScale: 1, capTier4: false, forceManual: false },
  { id: "iron", name: "Iron", blurb: "One life, lean purse, no tier-4 specialties, call every wave yourself.", lives: 1, hpScale: 1.15, goldScale: 0.85, capTier4: true, forceManual: true },
  { id: "endless", name: "Endless", blurb: "The written waves, then twelve more that keep growing.", lives: null, hpScale: 1.1, goldScale: 1, capTier4: false, forceManual: false },
];

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  blurb: string;
  livesDelta: number;
  hpScale: number;
  goldScale: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "casual", name: "Casual", blurb: "More lives and gold, softer foes.", livesDelta: 10, hpScale: 0.85, goldScale: 1.2 },
  { id: "normal", name: "Normal", blurb: "The intended march.", livesDelta: 0, hpScale: 1, goldScale: 1 },
  { id: "veteran", name: "Veteran", blurb: "Half the lives, harder foes, leaner purse.", livesDelta: -10, hpScale: 1.3, goldScale: 0.9 },
];

export type HeroDef = typeof HERO & { id: string; blurb: string; frame: string };

export const HEROES: HeroDef[] = [
  {
    ...HERO,
    id: "puff",
    name: "Warden Puff",
    blurb: "Balanced captain. Steady spear, steady burst.",
    frame: "hero",
  },
  {
    ...HERO,
    id: "bramble",
    name: "Bramble the Broad",
    blurb: "Slow and very hard to kill. His burst hits a wider ring.",
    hp: 260,
    armor: 0.3,
    min: 12,
    max: 17,
    interval: 0.9,
    speed: 105,
    regen: 7,
    abilityCd: 16,
    abilityRadius: 140,
    abilityDamage: 38,
    frame: "hero",
  },
  {
    ...HERO,
    id: "sable",
    name: "Sable Swiftcap",
    blurb: "Fast and fragile. Small burst, ready again quickly.",
    hp: 105,
    armor: 0.05,
    min: 8,
    max: 12,
    interval: 0.5,
    speed: 210,
    regen: 3,
    abilityCd: 9,
    abilityRadius: 90,
    abilityDamage: 24,
    frame: "hero",
  },
];

export function modeById(id: ModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

export function difficultyById(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

export function heroById(id: string): HeroDef {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export interface LaunchedMarch {
  level: LevelDef;
  enemyDefs: Record<string, EnemyDef>;
  hero: HeroDef;
  mode: ModeDef;
  difficulty: DifficultyDef;
}

function endlessWaves(base: WaveDef[]): WaveDef[] {
  const extra: WaveDef[] = [];
  for (let i = 0; i < 12; i++) {
    const src = base[i % base.length];
    const scale = 1 + Math.floor(i / base.length) * 0.5 + (i % base.length) * 0.05;
    extra.push({
      gap: 12,
      spawns: src.spawns.map((g) => ({ ...g, count: Math.max(1, Math.round(g.count * scale)) })),
    });
  }
  return [...base, ...extra];
}

/** Pure: builds the level/enemy/hero set a march actually launches with. */
export function launchMarch(base: LevelDef, modeId: ModeId, difficultyId: DifficultyId, heroId: string): LaunchedMarch {
  const mode = modeById(modeId);
  const difficulty = difficultyById(difficultyId);
  const hpScale = mode.hpScale * difficulty.hpScale;
  const goldScale = mode.goldScale * difficulty.goldScale;
  const lives = Math.max(1, (mode.lives ?? base.lives) + (mode.lives === null ? difficulty.livesDelta : 0));
  const level: LevelDef = {
    ...base,
    lives,
    startGold: Math.round(base.startGold * goldScale),
    maxTier: mode.capTier4 ? 3 : base.maxTier,
    waves: mode.id === "endless" ? endlessWaves(base.waves) : base.waves,
  };
  const enemyDefs: Record<string, EnemyDef> = {};
  for (const [id, def] of Object.entries(ENEMY_MAP)) {
    enemyDefs[id] = hpScale === 1 ? def : { ...def, hp: Math.round(def.hp * hpScale) };
  }
  return { level, enemyDefs, hero: heroById(heroId), mode, difficulty };
}
