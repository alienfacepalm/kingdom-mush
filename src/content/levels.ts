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
    name: "Dust Basin",
    index: 1,
    briefing: "Sproutlings are crossing the Dust Basin. Barracks hold the lane, archers thin the crowd, and a gloomspire cracks beetle shells.",
    startGold: 250,
    lives: 20,
    scenery: "meadow",
    maxTier: 3,
    hero: false,
    heroStart: { x: 520, y: 500 },
    heroHome: { x: 1000, y: 400 },
    // Keep the sign clear of pad a (80,520) and the entrance road click zone.
    callSpot: { x: 48, y: 392 },
    reinforcementFromWave: 3,
    rainFromWave: 6,
    paths: [
      {
        id: "main",
        name: "The vein",
        // Vertices follow the painted road in public/art/bg/dewcap.jpg
        // (tools/art/backgrounds.py snaps them to the painting).
        points: [
          { x: 0, y: 457 },
          { x: 364, y: 457 },
          { x: 364, y: 268 },
          { x: 798, y: 268 },
          { x: 798, y: 458 },
          { x: 1080, y: 458 },
        ],
      },
    ],
    slots: [
      { id: "a", x: 80, y: 520 },
      { id: "b", x: 270, y: 340 },
      { id: "c", x: 480, y: 375 },
      { id: "d", x: 680, y: 350 },
      { id: "e", x: 920, y: 520 },
      { id: "f", x: 980, y: 380 },
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
    id: "glasscut",
    name: "Glass Cut",
    index: 2,
    briefing: "The cut doubles back across the basin. Runners take the return, and beetles still need magic.",
    startGold: 300,
    lives: 20,
    scenery: "meadow",
    maxTier: 3,
    hero: false,
    heroStart: { x: 700, y: 460 },
    heroHome: { x: 480, y: 420 },
    // Above the cut, clear of pad c1 and the road under the gate.
    callSpot: { x: 48, y: 220 },
    reinforcementFromWave: 2,
    rainFromWave: 4,
    paths: [
      {
        id: "lane",
        name: "The cut",
        points: [
          { x: 0, y: 283 },
          { x: 475, y: 283 },
          { x: 842, y: 341 },
          { x: 1086, y: 463 },
          { x: 816, y: 540 },
          { x: 363, y: 481 },
        ],
      },
    ],
    slots: [
      { id: "c1", x: 110, y: 356 },
      { id: "c2", x: 300, y: 220 },
      { id: "c3", x: 445, y: 375 },
      { id: "c4", x: 705, y: 400 },
      { id: "c5", x: 945, y: 452 },
      { id: "c6", x: 840, y: 605 },
      { id: "c7", x: 560, y: 575 },
    ],
    waves: [
      wave(16, [pack("lane", "sprout", 6, 0.7)]),
      wave(16, [pack("lane", "sprout", 8, 0.5)]),
      wave(16, [pack("lane", "beetle", 3, 1.1), pack("lane", "sprout", 4, 0.6)]),
      wave(16, [pack("lane", "runner", 6, 0.55)]),
      wave(16, [pack("lane", "beetle", 4, 1)]),
      wave(16, [pack("lane", "runner", 5, 0.5), pack("lane", "sprout", 6, 0.45)]),
      wave(18, [pack("lane", "beetle", 3, 1), pack("lane", "runner", 4, 0.55)]),
      wave(0, [pack("lane", "sprout", 8, 0.4), pack("lane", "beetle", 3, 1), pack("lane", "runner", 4, 0.5)]),
    ],
  },
  {
    id: "forkfen",
    name: "Rift Fork",
    index: 3,
    briefing: "The rift splits. Runners take both veins, shades drink magic, and gnats sail over your soldiers. Warden Puff marches with you.",
    startGold: 360,
    lives: 20,
    scenery: "fen",
    maxTier: 4,
    hero: true,
    heroStart: { x: 800, y: 460 },
    heroHome: { x: 1040, y: 400 },
    // Between the veins, clear of south pad a2 (113,589) and the gate road.
    callSpot: { x: 48, y: 400 },
    reinforcementFromWave: 1,
    rainFromWave: 1,
    paths: [
      {
        id: "south",
        name: "South vein",
        points: [
          { x: 0, y: 547 },
          { x: 339, y: 527 },
          { x: 663, y: 388 },
          { x: 948, y: 352 },
          { x: 1118, y: 276 },
        ],
      },
      {
        id: "north",
        name: "North vein",
        points: [
          { x: 0, y: 223 },
          { x: 319, y: 242 },
          { x: 620, y: 393 },
          { x: 948, y: 352 },
          { x: 1118, y: 276 },
        ],
      },
    ],
    slots: [
      { id: "a1", x: 375, y: 348 },
      { id: "a2", x: 113, y: 589 },
      { id: "a3", x: 600, y: 470 },
      { id: "b1", x: 107, y: 302 },
      { id: "b2", x: 290, y: 465 },
      { id: "m1", x: 710, y: 325 },
      { id: "m2", x: 974, y: 284 },
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
    id: "spireyard",
    name: "Spire Yard",
    index: 4,
    briefing: "Brutes and shamans pack the yard. Stall them in the bend, and keep a bow on the gnats.",
    startGold: 420,
    lives: 20,
    scenery: "keep",
    maxTier: 4,
    hero: true,
    heroStart: { x: 500, y: 400 },
    heroHome: { x: 900, y: 420 },
    // Clear of pad y1 (140,277) and the yard entrance.
    callSpot: { x: 48, y: 168 },
    reinforcementFromWave: 1,
    rainFromWave: 1,
    paths: [
      {
        id: "yard",
        name: "The yard",
        points: [
          { x: 0, y: 225 },
          { x: 284, y: 225 },
          { x: 284, y: 470 },
          { x: 640, y: 535 },
          { x: 950, y: 443 },
          { x: 1160, y: 312 },
          { x: 905, y: 222 },
        ],
      },
    ],
    slots: [
      { id: "y1", x: 140, y: 277 },
      { id: "y2", x: 390, y: 400 },
      { id: "y3", x: 640, y: 460 },
      { id: "y4", x: 820, y: 555 },
      { id: "y5", x: 1014, y: 319 },
    ],
    waves: [
      wave(15, [pack("yard", "sprout", 6, 0.55), pack("yard", "beetle", 1, 1)]),
      wave(15, [pack("yard", "runner", 5, 0.55), pack("yard", "beetle", 2, 1)]),
      wave(16, [pack("yard", "brute", 2, 1.5), pack("yard", "sprout", 4, 0.5)]),
      wave(16, [pack("yard", "shaman", 1, 1), pack("yard", "gnat", 4, 0.5)]),
      wave(16, [pack("yard", "shade", 3, 0.8), pack("yard", "brute", 1, 1.4)]),
      wave(16, [pack("yard", "gnat", 6, 0.45), pack("yard", "beetle", 2, 1)]),
      wave(18, [pack("yard", "shaman", 2, 1.1), pack("yard", "runner", 5, 0.5), pack("yard", "brute", 1, 1.4)]),
      wave(0, [pack("yard", "brute", 2, 1.3), pack("yard", "shade", 3, 0.7), pack("yard", "gnat", 5, 0.45)]),
    ],
  },
  {
    id: "blackcap",
    name: "Black Citadel",
    index: 5,
    briefing: "The Rot King is awake in the citadel. Stall the brutes in the bend, silence the shamans, and do not leave the sky empty.",
    startGold: 480,
    lives: 20,
    scenery: "keep",
    maxTier: 4,
    hero: true,
    heroStart: { x: 520, y: 400 },
    heroHome: { x: 980, y: 420 },
    // Clear of the citadel entrance pads and road.
    callSpot: { x: 48, y: 170 },
    reinforcementFromWave: 1,
    rainFromWave: 1,
    paths: [
      {
        id: "bend",
        name: "The bend",
        points: [
          { x: 0, y: 241 },
          { x: 258, y: 241 },
          { x: 258, y: 481 },
          { x: 608, y: 563 },
          { x: 934, y: 487 },
          { x: 1124, y: 339 },
          { x: 901, y: 258 },
        ],
      },
    ],
    slots: [
      { id: "p1", x: 130, y: 312 },
      { id: "p2", x: 399, y: 455 },
      { id: "p3", x: 685, y: 482 },
      { id: "p6", x: 962, y: 392 },
      { id: "p7", x: 1077, y: 475 },
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
