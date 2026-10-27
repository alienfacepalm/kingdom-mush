import type { BarracksTier, Bonuses, Branch, EnemyDef, Family, RangedTier } from "./types";

export const NEUTRAL_BONUSES: Bonuses = {
  archerRange: 1,
  barracksHp: 1,
  mageDamage: 1,
  artillerySplash: 1,
  earlyGold: 1,
  reinforcementHp: 0,
  reinforcementDuration: 0,
};

const noSpecial = {
  splash: 0,
  poisonDps: 0,
  poisonTime: 0,
  chain: 0,
  shred: 0,
  teleport: 0,
  teleportEvery: 0,
};

function ranged(
  partial: Pick<RangedTier, "name" | "cost" | "range" | "min" | "max" | "interval" | "damageType" | "air"> &
    Partial<RangedTier>,
): RangedTier {
  return { ...noSpecial, ...partial };
}

export interface RangedLine {
  blurb: string;
  tint: number;
  tiers: [RangedTier, RangedTier, RangedTier];
  branchA: RangedTier;
  branchB: RangedTier;
  branchABlurb: string;
  branchBBlurb: string;
}

export const ARCHER: RangedLine = {
  blurb: "Fast physical shots. Hits flying foes.",
  tint: 0x7dce6a,
  tiers: [
    ranged({ name: "Sporebow", cost: 70, range: 165, min: 7, max: 10, interval: 0.5, damageType: "physical", air: true }),
    ranged({ name: "Longcap", cost: 100, range: 180, min: 11, max: 16, interval: 0.46, damageType: "physical", air: true }),
    ranged({ name: "Sharpcap", cost: 140, range: 195, min: 15, max: 22, interval: 0.42, damageType: "physical", air: true }),
  ],
  branchA: ranged({
    name: "Toxcap Nest",
    cost: 210,
    range: 200,
    min: 12,
    max: 18,
    interval: 0.48,
    damageType: "physical",
    air: true,
    poisonDps: 6,
    poisonTime: 4,
  }),
  branchB: ranged({
    name: "Musket Cap",
    cost: 210,
    range: 215,
    min: 28,
    max: 42,
    interval: 1.3,
    damageType: "physical",
    air: true,
    splash: 52,
  }),
  branchABlurb: "Poison that ignores armor.",
  branchBBlurb: "Slow, heavy shots with a small blast. Still hits air.",
};

export const MAGE: RangedLine = {
  blurb: "Magic ignores armor. Cannot hit flying foes.",
  tint: 0xb07ad4,
  tiers: [
    ranged({ name: "Gloomspire", cost: 100, range: 155, min: 16, max: 24, interval: 1.2, damageType: "magic", air: false }),
    ranged({ name: "Adept Cap", cost: 125, range: 170, min: 26, max: 38, interval: 1.15, damageType: "magic", air: false }),
    ranged({ name: "Witchcap", cost: 165, range: 185, min: 36, max: 52, interval: 1.1, damageType: "magic", air: false }),
  ],
  branchA: ranged({
    name: "Warp Witch",
    cost: 250,
    range: 200,
    min: 40,
    max: 58,
    interval: 1.15,
    damageType: "magic",
    air: false,
    teleport: 200,
    teleportEvery: 4,
  }),
  branchB: ranged({
    name: "Mycomancer",
    cost: 250,
    range: 190,
    min: 32,
    max: 46,
    interval: 1.1,
    damageType: "magic",
    air: false,
    shred: 0.06,
  }),
  branchABlurb: "Every fourth bolt shoves a foe back down the road.",
  branchBBlurb: "Shreds armor and raises a mushroom elemental that blocks.",
};

export const ARTILLERY: RangedLine = {
  blurb: "Explosive splash. Aims at the ground. The blast still hits fliers.",
  tint: 0xe09a4a,
  tiers: [
    ranged({
      name: "Puffmortar",
      cost: 125,
      range: 175,
      min: 26,
      max: 26,
      interval: 2.25,
      damageType: "explosive",
      air: false,
      splash: 74,
    }),
    ranged({
      name: "Boomcap",
      cost: 155,
      range: 195,
      min: 38,
      max: 38,
      interval: 2.15,
      damageType: "explosive",
      air: false,
      splash: 82,
    }),
    ranged({
      name: "Howlcap",
      cost: 200,
      range: 210,
      min: 52,
      max: 52,
      interval: 2.05,
      damageType: "explosive",
      air: false,
      splash: 90,
    }),
  ],
  branchA: ranged({
    name: "Cluster Puff",
    cost: 280,
    range: 220,
    min: 58,
    max: 58,
    interval: 2.1,
    damageType: "explosive",
    air: false,
    splash: 124,
  }),
  branchB: ranged({
    name: "Sparkcap",
    cost: 270,
    range: 210,
    min: 34,
    max: 48,
    interval: 1.85,
    damageType: "electric",
    air: true,
    chain: 4,
  }),
  branchABlurb: "A wider blast for packed roads.",
  branchBBlurb: "Chain lightning. It can pick fliers out of the sky.",
};

export const RANGED: Record<"archer" | "mage" | "artillery", RangedLine> = {
  archer: ARCHER,
  mage: MAGE,
  artillery: ARTILLERY,
};

export interface BarracksLine {
  blurb: string;
  tint: number;
  tiers: [BarracksTier, BarracksTier, BarracksTier];
  branchA: BarracksTier;
  branchB: BarracksTier;
  branchABlurb: string;
  branchBBlurb: string;
}

function barracks(partial: Omit<BarracksTier, "throwRange" | "aura"> & Partial<BarracksTier>): BarracksTier {
  return { throwRange: 0, aura: 0, ...partial };
}

export const BARRACKS: BarracksLine = {
  blurb: "Three soldiers stand on the road and stop ground foes. One each.",
  tint: 0x6aa6e0,
  tiers: [
    barracks({ name: "Cap Barracks", cost: 70, soldiers: 3, hp: 58, armor: 0, min: 4, max: 6, interval: 0.9, respawn: 8, regen: 5 }),
    barracks({ name: "Footcaps", cost: 110, soldiers: 3, hp: 96, armor: 0.15, min: 6, max: 9, interval: 0.85, respawn: 8, regen: 6 }),
    barracks({ name: "Knightcaps", cost: 150, soldiers: 3, hp: 136, armor: 0.28, min: 8, max: 12, interval: 0.8, respawn: 7, regen: 8 }),
  ],
  branchA: barracks({
    name: "Paladin Ring",
    cost: 230,
    soldiers: 3,
    hp: 190,
    armor: 0.42,
    min: 9,
    max: 13,
    interval: 0.85,
    respawn: 8,
    regen: 8,
    aura: 4,
  }),
  branchB: barracks({
    name: "Axe Lodge",
    cost: 230,
    soldiers: 3,
    hp: 160,
    armor: 0.08,
    min: 11,
    max: 16,
    interval: 0.7,
    respawn: 7,
    regen: 6,
    throwRange: 140,
  }),
  branchABlurb: "Tough soldiers who mend nearby allies.",
  branchBBlurb: "Thrown axes reach flying foes.",
};

export const ELEMENTAL = {
  hp: 240,
  armor: 0.2,
  min: 8,
  max: 12,
  interval: 1,
  respawn: 12,
  regen: 6,
};

export const HERO = {
  name: "Warden Puff",
  hp: 150,
  armor: 0.12,
  min: 9,
  max: 13,
  interval: 0.7,
  speed: 155,
  regen: 4,
  abilityCd: 14,
  abilityRadius: 110,
  abilityDamage: 30,
  abilitySlow: 2.5,
};

export const REINFORCEMENT = {
  hp: 72,
  armor: 0.1,
  min: 4,
  max: 7,
  interval: 0.8,
  duration: 10,
  cooldown: 16,
};

export const RAIN = {
  cooldown: 32,
  hits: 3,
  gap: 0.38,
  min: 18,
  max: 32,
  radius: 88,
};

export const ENEMIES: EnemyDef[] = [
  {
    id: "sprout",
    name: "Sproutling",
    blurb: "A soft, numerous marcher. No armor, no tricks.",
    hp: 44,
    speed: 48,
    armor: 0,
    magicResist: 0,
    bounty: 4,
    flying: false,
    damage: 4,
    attackInterval: 1,
    healPerSec: 0,
    healRadius: 0,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0x8fd86a,
  },
  {
    id: "runner",
    name: "Morel Runner",
    blurb: "Very fast. Barracks and a choke are how you catch them.",
    hp: 38,
    speed: 96,
    armor: 0,
    magicResist: 0.08,
    bounty: 5,
    flying: false,
    damage: 5,
    attackInterval: 0.75,
    healPerSec: 0,
    healRadius: 0,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0xe6a15a,
  },
  {
    id: "beetle",
    name: "Beetlecap",
    blurb: "A shell that shrugs off arrows and bombs. Magic ignores it.",
    hp: 150,
    speed: 32,
    armor: 0.62,
    magicResist: 0,
    bounty: 9,
    flying: false,
    damage: 11,
    attackInterval: 1.05,
    healPerSec: 0,
    healRadius: 0,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0xb07a3a,
  },
  {
    id: "shade",
    name: "Shade",
    blurb: "Soaks up spells. Arrows, axes, and soldiers still land.",
    hp: 82,
    speed: 46,
    armor: 0.05,
    magicResist: 0.65,
    bounty: 10,
    flying: false,
    damage: 7,
    attackInterval: 1,
    healPerSec: 0,
    healRadius: 0,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0x8a6ad4,
  },
  {
    id: "gnat",
    name: "Gnat",
    blurb: "Flies over soldiers. Archers and spark-lightning can hit it. Blasts catch it only if they were aimed nearby.",
    hp: 40,
    speed: 72,
    armor: 0,
    magicResist: 0.12,
    bounty: 7,
    flying: true,
    damage: 0,
    attackInterval: 1,
    healPerSec: 0,
    healRadius: 0,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0xf0d35a,
  },
  {
    id: "brute",
    name: "Stump Brute",
    blurb: "Slow, armored, and mean to lone soldiers. Stall it where your towers overlap.",
    hp: 300,
    speed: 30,
    armor: 0.32,
    magicResist: 0.1,
    bounty: 22,
    flying: false,
    damage: 18,
    attackInterval: 1,
    healPerSec: 0,
    healRadius: 0,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0x6b4a32,
  },
  {
    id: "shaman",
    name: "Moss Shaman",
    blurb: "Heals nearby marchers. Walk the warden onto it or drop Spore Rain.",
    hp: 96,
    speed: 40,
    armor: 0,
    magicResist: 0.22,
    bounty: 16,
    flying: false,
    damage: 5,
    attackInterval: 1.1,
    healPerSec: 8,
    healRadius: 100,
    boss: false,
    addEvery: 0,
    addCount: 0,
    addCap: 0,
    tint: 0x3cb8a0,
  },
  {
    id: "rotking",
    name: "The Rot King",
    blurb: "A walking stump of armor and spite. He sheds sproutlings until the cap comes off.",
    hp: 1400,
    speed: 22,
    armor: 0.38,
    magicResist: 0.22,
    bounty: 120,
    flying: false,
    damage: 20,
    attackInterval: 0.95,
    healPerSec: 0,
    healRadius: 0,
    boss: true,
    addEvery: 7,
    addCount: 2,
    addCap: 10,
    tint: 0x8c2f3b,
  },
];

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export interface MetaUpgrade {
  id: string;
  name: string;
  desc: string;
}

export const META_UPGRADES: MetaUpgrade[] = [
  { id: "eagle", name: "Eagle Caps", desc: "Archer range +12%." },
  { id: "thick", name: "Thick Caps", desc: "Barracks health +18%." },
  { id: "arcane", name: "Arcane Study", desc: "Mage damage +12%." },
  { id: "wide", name: "Wide Puffs", desc: "Artillery blast radius +15%." },
  { id: "blitz", name: "Blitz Spores", desc: "Early-wave gold +50%." },
  { id: "veterans", name: "Veterans", desc: "Reinforcements last 4s longer and have +20 health." },
];

export function bonusesFrom(bought: readonly string[]): Bonuses {
  const b: Bonuses = { ...NEUTRAL_BONUSES };
  if (bought.includes("eagle")) b.archerRange = 1.12;
  if (bought.includes("thick")) b.barracksHp = 1.18;
  if (bought.includes("arcane")) b.mageDamage = 1.12;
  if (bought.includes("wide")) b.artillerySplash = 1.15;
  if (bought.includes("blitz")) b.earlyGold = 1.5;
  if (bought.includes("veterans")) {
    b.reinforcementDuration = 4;
    b.reinforcementHp = 20;
  }
  return b;
}

export function rangedLine(family: "archer" | "mage" | "artillery"): RangedLine {
  return RANGED[family];
}

export function rangedStats(family: "archer" | "mage" | "artillery", tier: 1 | 2 | 3 | 4, branch: Branch | null, bonuses: Bonuses): RangedTier {
  const line = RANGED[family];
  const base = tier <= 3 ? line.tiers[tier - 1] : branch === "b" ? line.branchB : line.branchA;
  const copy: RangedTier = { ...base };
  if (family === "archer") copy.range = Math.round(copy.range * bonuses.archerRange);
  if (family === "mage") {
    copy.min = Math.max(1, Math.round(copy.min * bonuses.mageDamage));
    copy.max = Math.max(copy.min, Math.round(copy.max * bonuses.mageDamage));
  }
  if (family === "artillery" && copy.splash > 0) copy.splash = Math.round(copy.splash * bonuses.artillerySplash);
  return copy;
}

export function barracksStats(tier: 1 | 2 | 3 | 4, branch: Branch | null, bonuses: Bonuses): BarracksTier {
  const base = tier <= 3 ? BARRACKS.tiers[tier - 1] : branch === "b" ? BARRACKS.branchB : BARRACKS.branchA;
  return { ...base, hp: Math.round(base.hp * bonuses.barracksHp) };
}

export function buildCost(family: Family): number {
  if (family === "barracks") return BARRACKS.tiers[0].cost;
  return RANGED[family].tiers[0].cost;
}

export function towerDisplayName(family: Family, tier: 1 | 2 | 3 | 4, branch: Branch | null): string {
  if (family === "barracks") return barracksStats(tier, branch, NEUTRAL_BONUSES).name;
  return rangedStats(family, tier, branch, NEUTRAL_BONUSES).name;
}

export function branchCost(family: Family, branch: Branch): number {
  if (family === "barracks") return branch === "a" ? BARRACKS.branchA.cost : BARRACKS.branchB.cost;
  const line = RANGED[family];
  return branch === "a" ? line.branchA.cost : line.branchB.cost;
}

export function familyBlurb(family: Family): string {
  if (family === "barracks") return BARRACKS.blurb;
  return RANGED[family].blurb;
}

export function familyTint(family: Family): number {
  if (family === "barracks") return BARRACKS.tint;
  return RANGED[family].tint;
}

export const FAMILY_ORDER: Family[] = ["archer", "barracks", "mage", "artillery"];

export const FAMILY_SHORT: Record<Family, string> = {
  archer: "Bow",
  barracks: "Den",
  mage: "Hex",
  artillery: "Bomb",
};
