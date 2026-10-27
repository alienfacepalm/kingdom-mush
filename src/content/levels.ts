import type { LevelDef, SpawnGroup, WaveDef } from "./types";

function wave(gap: number, spawns: SpawnGroup[]): WaveDef {
  return { gap, spawns };
}

function pack(pathId: string, enemyId: string, count: number, interval = 0.65): SpawnGroup {
  return { pathId, enemyId, count, interval };
}

export const LEVELS: LevelDef[] = [
  {
    id: "dewcap",
    name: "Dewcap Road",
    index: 1,
    briefing: "Sproutlings are marching Dewcap Road. Barracks hold the lane, archers thin the crowd, and a gloomspire cracks beetle shells.",
    startGold: 250,
    lives: 20,
    scenery: "meadow",
    maxTier: 3,
    hero: false,
    heroStart: { x: 520, y: 400 },
    heroHome: { x: 420, y: 140 },
    reinforcementFromWave: 3,
    rainFromWave: 6,
    paths: [
      {
        id: "main",
        name: "The road",
        points: [
          { x: 200, y: 560 },
          { x: 200, y: 500 },
          { x: 380, y: 430 },
          { x: 620, y: 500 },
          { x: 860, y: 420 },
          { x: 1040, y: 300 },
          { x: 860, y: 180 },
          { x: 560, y: 130 },
          { x: 300, y: 110 },
        ],
      },
    ],
    slots: [
      { id: "a", x: 310, y: 560 },
      { id: "b", x: 300, y: 390 },
      { id: "c", x: 520, y: 390 },
      { id: "d", x: 740, y: 570 },
      { id: "e", x: 990, y: 400 },
      { id: "f", x: 720, y: 230 },
    ],
    waves: [
      wave(16, [pack("main", "sprout", 4, 1)]),
      wave(16, [pack("main", "sprout", 7, 0.7)]),
      wave(16, [pack("main", "sprout", 9, 0.55)]),
      wave(18, [pack("main", "sprout", 4, 0.6), pack("main", "beetle", 2, 1.1)]),
      wave(18, [pack("main", "beetle", 4, 1.2)]),
      wave(18, [pack("main", "sprout", 6, 0.45), pack("main", "beetle", 3, 1)]),
      wave(0, [pack("main", "sprout", 10, 0.4), pack("main", "beetle", 3, 1)]),
    ],
  },
  {
    id: "forkfen",
    name: "Forkfen",
    index: 2,
    briefing: "The fen splits. Runners take both banks, shades drink magic, and gnats sail over your soldiers. Warden Puff marches with you.",
    startGold: 360,
    lives: 20,
    scenery: "fen",
    maxTier: 4,
    hero: true,
    heroStart: { x: 640, y: 420 },
    heroHome: { x: 1040, y: 240 },
    reinforcementFromWave: 1,
    rainFromWave: 1,
    paths: [
      {
        id: "south",
        name: "South bank",
        points: [
          { x: 150, y: 560 },
          { x: 150, y: 470 },
          { x: 400, y: 410 },
          { x: 640, y: 350 },
          { x: 920, y: 310 },
          { x: 1140, y: 190 },
        ],
      },
      {
        id: "north",
        name: "North bank",
        points: [
          { x: 150, y: 130 },
          { x: 400, y: 190 },
          { x: 640, y: 350 },
          { x: 920, y: 310 },
          { x: 1140, y: 190 },
        ],
      },
    ],
    slots: [
      { id: "a1", x: 260, y: 560 },
      { id: "a2", x: 330, y: 500 },
      { id: "a3", x: 760, y: 440 },
      { id: "b1", x: 270, y: 250 },
      { id: "b2", x: 500, y: 150 },
      { id: "m1", x: 800, y: 230 },
      { id: "m2", x: 1040, y: 340 },
      { id: "m3", x: 700, y: 250 },
    ],
    waves: [
      wave(14, [pack("south", "sprout", 6, 0.6)]),
      wave(14, [pack("north", "runner", 5, 0.7)]),
      wave(15, [pack("south", "shade", 3, 1.1)]),
      wave(15, [pack("south", "gnat", 5, 0.55), pack("north", "gnat", 3, 0.6)]),
      wave(16, [pack("north", "runner", 6, 0.55), pack("south", "beetle", 2, 1.2)]),
      wave(16, [pack("north", "shade", 4, 0.9), pack("south", "sprout", 6, 0.45)]),
      wave(16, [pack("south", "gnat", 6, 0.45), pack("north", "runner", 4, 0.6)]),
      wave(16, [pack("south", "shade", 3, 0.8), pack("north", "beetle", 2, 1), pack("south", "gnat", 4, 0.5)]),
      wave(0, [pack("south", "runner", 6, 0.45), pack("north", "shade", 3, 0.8), pack("south", "gnat", 5, 0.4), pack("north", "sprout", 6, 0.4)]),
    ],
  },
  {
    id: "blackcap",
    name: "Blackcap Keep",
    index: 3,
    briefing: "The Rot King is awake under the keep. Stall the brutes in the bend, silence the shamans, and do not leave the sky empty.",
    startGold: 480,
    lives: 20,
    scenery: "keep",
    maxTier: 4,
    hero: true,
    heroStart: { x: 480, y: 450 },
    heroHome: { x: 860, y: 230 },
    reinforcementFromWave: 1,
    rainFromWave: 1,
    paths: [
      {
        id: "bend",
        name: "The bend",
        points: [
          { x: 180, y: 170 },
          { x: 180, y: 520 },
          { x: 480, y: 560 },
          { x: 780, y: 520 },
          { x: 1000, y: 400 },
          { x: 1000, y: 170 },
        ],
      },
    ],
    slots: [
      { id: "p1", x: 300, y: 440 },
      { id: "p2", x: 480, y: 440 },
      { id: "p3", x: 660, y: 440 },
      { id: "p4", x: 300, y: 600 },
      { id: "p5", x: 660, y: 600 },
      { id: "p6", x: 860, y: 400 },
      { id: "p7", x: 880, y: 250 },
      { id: "p8", x: 1080, y: 280 },
    ],
    waves: [
      wave(14, [pack("bend", "sprout", 6, 0.55), pack("bend", "beetle", 1, 1)]),
      wave(14, [pack("bend", "sprout", 8, 0.45), pack("bend", "beetle", 2, 1)]),
      wave(16, [pack("bend", "brute", 2, 1.6), pack("bend", "sprout", 4, 0.5)]),
      wave(16, [pack("bend", "shaman", 1, 1), pack("bend", "sprout", 8, 0.4), pack("bend", "beetle", 2, 1)]),
      wave(16, [pack("bend", "gnat", 6, 0.45), pack("bend", "brute", 1, 1)]),
      wave(16, [pack("bend", "shade", 4, 0.7), pack("bend", "brute", 2, 1.4)]),
      wave(16, [pack("bend", "shaman", 2, 1.2), pack("bend", "runner", 5, 0.5), pack("bend", "beetle", 2, 1)]),
      wave(18, [pack("bend", "gnat", 6, 0.4), pack("bend", "brute", 2, 1.5), pack("bend", "sprout", 6, 0.35)]),
      wave(18, [pack("bend", "shaman", 1, 1), pack("bend", "brute", 2, 1.3), pack("bend", "shade", 3, 0.7)]),
      wave(0, [pack("bend", "rotking", 1, 1), pack("bend", "beetle", 2, 1.2), pack("bend", "gnat", 4, 0.55)]),
    ],
  },
];

export function levelById(id: string): LevelDef {
  const level = LEVELS.find((entry) => entry.id === id);
  if (!level) throw new Error(`Unknown level ${id}`);
  return level;
}

export function isUnlocked(cleared: Record<string, number>, level: LevelDef): boolean {
  if (level.index === 1) return true;
  const previous = LEVELS.find((entry) => entry.index === level.index - 1);
  if (!previous) return false;
  return (cleared[previous.id] ?? 0) >= 1;
}
