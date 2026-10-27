export type DamageType = "physical" | "magic" | "explosive" | "electric" | "true" | "poison";

export type Family = "archer" | "barracks" | "mage" | "artillery";

export type Branch = "a" | "b";

export interface Pt {
  x: number;
  y: number;
}

export interface RangedTier {
  name: string;
  cost: number;
  range: number;
  min: number;
  max: number;
  interval: number;
  damageType: DamageType;
  air: boolean;
  splash: number;
  poisonDps: number;
  poisonTime: number;
  chain: number;
  shred: number;
  teleport: number;
  teleportEvery: number;
}

export interface BarracksTier {
  name: string;
  cost: number;
  soldiers: number;
  hp: number;
  armor: number;
  min: number;
  max: number;
  interval: number;
  respawn: number;
  regen: number;
  throwRange: number;
  aura: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  blurb: string;
  hp: number;
  speed: number;
  armor: number;
  magicResist: number;
  bounty: number;
  flying: boolean;
  damage: number;
  attackInterval: number;
  healPerSec: number;
  healRadius: number;
  boss: boolean;
  addEvery: number;
  addCount: number;
  addCap: number;
  tint: number;
}

export interface PathDef {
  id: string;
  name: string;
  points: Pt[];
}

export interface SlotDef {
  id: string;
  x: number;
  y: number;
}

export interface SpawnGroup {
  enemyId: string;
  count: number;
  interval: number;
  pathId: string;
}

export interface WaveDef {
  spawns: SpawnGroup[];
  gap: number;
}

export type Scenery = "meadow" | "fen" | "keep";

export interface LevelDef {
  id: string;
  name: string;
  index: number;
  briefing: string;
  startGold: number;
  lives: number;
  paths: PathDef[];
  slots: SlotDef[];
  waves: WaveDef[];
  maxTier: 3 | 4;
  hero: boolean;
  heroStart: Pt;
  heroHome: Pt;
  reinforcementFromWave: number;
  rainFromWave: number;
  scenery: Scenery;
}

export interface Bonuses {
  archerRange: number;
  barracksHp: number;
  mageDamage: number;
  artillerySplash: number;
  earlyGold: number;
  reinforcementHp: number;
  reinforcementDuration: number;
}

export interface SaveData {
  best: Record<string, number>;
  bought: string[];
}
