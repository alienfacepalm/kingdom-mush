import { describe, expect, it } from "vitest";
import { ENEMY_MAP, NEUTRAL_BONUSES } from "../src/content/catalog";
import { LEVELS } from "../src/content/levels";
import { applyClear, buyUpgrade, emptySave, resetUpgrades, starsAvailable } from "../src/content/save";
import { applyDamage, splashMultiplier, starsFor } from "../src/sim/combat";
import { Sim } from "../src/sim/Sim";
import { closestOnPoly, buildPoly } from "../src/sim/geom";
import { mulberry32 } from "../src/sim/rng";
import { PHYSICAL_ONLY, PLANS, run } from "./strategy";

describe("damage", () => {
  it("matches the published armor examples", () => {
    expect(applyDamage(14, "physical", 0.8, 0)).toBe(2);
    expect(applyDamage(60, "magic", 0, 0.85)).toBe(9);
    expect(applyDamage(50, "explosive", 0.95, 0)).toBe(26);
    expect(applyDamage(10, "poison", 0.9, 0.9)).toBe(10);
    expect(applyDamage(10, "true", 1, 1)).toBe(10);
  });

  it("falls off across a blast", () => {
    expect(splashMultiplier(0, 100)).toBe(1);
    expect(splashMultiplier(100, 100)).toBeCloseTo(0.5);
    expect(splashMultiplier(101, 100)).toBe(0);
  });
});

describe("campaign rules", () => {
  it("keeps every build pad within bowshot of a road", () => {
    for (const level of LEVELS) {
      for (const slot of level.slots) {
        let gap = Infinity;
        for (const path of level.paths) {
          gap = Math.min(gap, closestOnPoly(buildPoly(path.points), slot.x, slot.y).gap);
        }
        expect(gap, `${level.id}:${slot.id}`).toBeLessThanOrEqual(120);
      }
    }
  });

  it("refunds the full cost before the first wave and 60% after", () => {
    const sim = new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(1));
    expect(sim.build("c", "barracks")).toBe(true);
    expect(sim.gold).toBe(180);
    const id = sim.towers[0].id;
    expect(sim.sell(id)).toBe(true);
    expect(sim.gold).toBe(250);
    sim.build("c", "barracks");
    sim.callWave();
    expect(sim.sell(sim.towers[0].id)).toBe(true);
    expect(sim.gold).toBe(250 - 70 + 42);
  });

  it("pays the early-call bonus from the seconds still on the clock", () => {
    const sim = new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(2));
    sim.callWave();
    let guard = 0;
    while (!sim.countingDown && guard++ < 900) sim.step(1 / 30);
    expect(sim.countingDown).toBe(true);
    const bonus = sim.earlyBonus();
    const gold = sim.gold;
    expect(bonus).toBeGreaterThan(0);
    sim.callWave();
    expect(sim.gold).toBe(gold + bonus);
  });

  it("lets barracks hold a sproutling that would otherwise walk through", () => {
    const open = roadSim();
    const held = roadSim();
    held.build("s", "barracks");
    open.callWave();
    held.callWave();
    for (let i = 0; i < 12 * 30; i++) {
      open.step(1 / 30);
      held.step(1 / 30);
    }
    const openDist = open.enemies[0]?.dist ?? 9999;
    const heldDist = held.enemies[0]?.dist ?? 0;
    expect(heldDist).toBeLessThan(openDist - 80);
    expect(held.lives).toBe(5);
  });

  it("stops mages and mortars from aiming at a lone gnat, but lets the blast catch one", () => {
    const mage = duel("mage", ["gnat"]);
    const bow = duel("archer", ["gnat"]);
    const mortar = duel("artillery", ["gnat"]);
    const splash = duel("artillery", ["beetle", "gnat"]);
    expect(mage.hpOf("gnat")).toBe(40);
    expect(bow.hpOf("gnat")).toBeLessThan(40);
    expect(mortar.hpOf("gnat")).toBe(40);
    expect(splash.hpOf("gnat")).toBeLessThan(40);
  });

  it("kills an armored beetle faster with magic than with arrows", () => {
    const bow = duel("archer", ["beetle"]);
    const mage = duel("mage", ["beetle"]);
    expect(mage.hpOf("beetle")).toBeLessThan(bow.hpOf("beetle"));
  });
});

describe("campaign balance", () => {
  it("wins Dewcap with magic in the mix, and leaks more if the build never uses it", () => {
    const mixed = run(new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(3)), PLANS.dewcap);
    const physical = run(new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(3)), PHYSICAL_ONLY);
    expect(mixed.phase, mixed.report()).toBe("victory");
    expect(mixed.lives, mixed.report()).toBeGreaterThanOrEqual(16);
    expect(physical.lives, physical.report()).toBeLessThan(mixed.lives);
  });

  it("wins Forkfen across damage rolls", () => {
    const sim = worst(LEVELS[1], PLANS.forkfen);
    expect(sim.phase, sim.report()).toBe("victory");
    expect(sim.lives, sim.report()).toBeGreaterThanOrEqual(14);
  });

  it("wins Blackcap across damage rolls", () => {
    const sim = worst(LEVELS[2], PLANS.blackcap);
    expect(sim.phase, sim.report()).toBe("victory");
    expect(sim.lives, sim.report()).toBeGreaterThanOrEqual(8);
  });

  it("loses Dewcap if nothing is built", () => {
    const sim = run(new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(6)), null, 240);
    expect(sim.phase, sim.report()).toBe("defeat");
  });
});

describe("stars", () => {
  it("spends a star and refunds it on reset", () => {
    let save = applyClear(emptySave(), "dewcap", 3);
    expect(starsAvailable(save)).toBe(3);
    expect(starsFor(16, true)).toBe(3);
    expect(starsFor(8, true)).toBe(2);
    expect(starsFor(1, true)).toBe(1);
    const bought = buyUpgrade(save, "eagle");
    expect(bought).not.toBeNull();
    save = bought!;
    expect(starsAvailable(save)).toBe(2);
    expect(buyUpgrade(save, "eagle")).toBeNull();
    save = resetUpgrades(save);
    expect(starsAvailable(save)).toBe(3);
  });
});

function worst(level: (typeof LEVELS)[number], plan: (typeof PLANS)[keyof typeof PLANS]): Sim {
  let worstSim = run(new Sim(level, NEUTRAL_BONUSES, mulberry32(1)), plan, 520);
  for (let seed = 2; seed <= 8; seed++) {
    const sim = run(new Sim(level, NEUTRAL_BONUSES, mulberry32(seed)), plan, 520);
    const worsePhase = sim.phase !== "victory" && worstSim.phase === "victory";
    if (worsePhase || sim.lives < worstSim.lives) worstSim = sim;
  }
  return worstSim;
}

function roadSim(): Sim {
  const level = {
    ...LEVELS[0],
    id: "road",
    startGold: 200,
    lives: 5,
    slots: [{ id: "s", x: 400, y: 270 }],
    paths: [{ id: "main", name: "road", points: [{ x: 40, y: 200 }, { x: 760, y: 200 }] }],
    waves: [{ gap: 30, spawns: [{ enemyId: "sprout", count: 1, interval: 1, pathId: "main" }] }],
  };
  return new Sim(level, NEUTRAL_BONUSES, mulberry32(9));
}

function duel(family: "archer" | "mage" | "artillery", enemyIds: string[]) {
  const level = {
    ...LEVELS[0],
    id: "duel",
    startGold: 400,
    lives: 5,
    hero: false,
    slots: [{ id: "s", x: 200, y: 180 }],
    paths: [{ id: "main", name: "road", points: [{ x: 200, y: 200 }, { x: 240, y: 200 }] }],
    waves: [
      {
        gap: 0,
        spawns: enemyIds.map((enemyId) => ({ enemyId, count: 1, interval: 0.05, pathId: "main" })),
      },
    ],
  };
  const defs = { ...ENEMY_MAP };
  for (const id of enemyIds) defs[id] = { ...ENEMY_MAP[id], speed: 0 };
  const sim = new Sim(level, NEUTRAL_BONUSES, mulberry32(8), defs);
  sim.build("s", family);
  sim.callWave();
  for (let i = 0; i < 8 * 30; i++) sim.step(1 / 30);
  return {
    hpOf(id: string) {
      const enemy = sim.enemies.find((entry) => entry.defId === id);
      return enemy ? enemy.hp : 0;
    },
  };
}
