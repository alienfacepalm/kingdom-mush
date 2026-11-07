import { describe, expect, it } from "vitest";
import { NEUTRAL_BONUSES } from "../src/content/catalog";
import { LEVELS } from "../src/content/levels";
import { Sim } from "../src/sim/Sim";
import { mulberry32 } from "../src/sim/rng";
import type { Family } from "../src/content/types";

/**
 * Adversarial invariant fuzz: a seeded random player builds, upgrades, sells,
 * calls waves early, toggles Auto, and steps time in bursts. After every
 * action the core safety invariants from docs/tla/Capkeep.tla must hold.
 */
const FAMILIES: Family[] = ["archer", "barracks", "mage", "artillery"];
const PHASES = ["prep", "combat", "victory", "defeat"] as const;
type Phase = (typeof PHASES)[number];

const ALLOWED: Record<Phase, Phase[]> = {
  prep: ["prep", "combat", "victory", "defeat"],
  combat: ["combat", "victory", "defeat"],
  victory: ["victory"],
  defeat: ["defeat"],
};

function checkInvariants(sim: Sim, prevWave: number, prevPhase: Phase, label: string): { wave: number; phase: Phase } {
  expect(sim.gold, `${label} gold integer`).toBe(Math.floor(sim.gold));
  expect(sim.gold, `${label} gold >= 0`).toBeGreaterThanOrEqual(0);
  expect(sim.lives, `${label} lives low`).toBeGreaterThanOrEqual(0);
  expect(sim.lives, `${label} lives high`).toBeLessThanOrEqual(sim.level.lives);
  expect(sim.waveStarted, `${label} wave monotone`).toBeGreaterThanOrEqual(prevWave);
  expect(sim.waveStarted, `${label} wave bounded`).toBeLessThanOrEqual(sim.level.waves.length);
  const phase = sim.phase as Phase;
  expect(ALLOWED[prevPhase], `${label} phase ${prevPhase} -> ${phase}`).toContain(phase);
  const slotIds = sim.towers.map((t) => t.slotId);
  expect(new Set(slotIds).size, `${label} duplicate slots`).toBe(slotIds.length);
  for (const tower of sim.towers) {
    expect(tower.spent, `${label} tower spent`).toBeGreaterThan(0);
    expect(tower.tier, `${label} tower tier`).toBeGreaterThanOrEqual(1);
    expect(tower.tier, `${label} tower tier max`).toBeLessThanOrEqual(4);
  }
  for (const enemy of sim.enemies) {
    expect(enemy.hp, `${label} enemy hp`).toBeLessThanOrEqual(enemy.maxHp + 0.001);
  }
  if (phase === "victory") {
    expect(sim.waveStarted, `${label} victory waves`).toBe(sim.level.waves.length);
    expect(sim.enemies.some((e) => e.alive), `${label} victory field clear`).toBe(false);
  }
  if (phase === "defeat") expect(sim.lives, `${label} defeat at zero`).toBe(0);
  return { wave: sim.waveStarted, phase };
}

describe("adversarial invariant fuzz", () => {
  it("holds the TLA safety invariants under a random adversary", () => {
    for (const level of [LEVELS[0], LEVELS[2]]) {
      for (const seed of [11, 42, 97]) {
        const label = `${level.id}/${seed}`;
        const sim = new Sim(level, NEUTRAL_BONUSES, mulberry32(seed));
        const rng = mulberry32(seed * 7919 + 13);
        sim.setAutoWaves(rng() < 0.5);
        if (sim.autoWaves) sim.armPrep(3);
        let wave = 0;
        let phase: Phase = "prep";
        const slots = level.slots.map((s) => s.id);
        for (let op = 0; op < 420; op++) {
          const roll = rng();
          if (roll < 0.22) {
            sim.build(slots[Math.floor(rng() * slots.length)], FAMILIES[Math.floor(rng() * FAMILIES.length)]);
          } else if (roll < 0.34 && sim.towers.length > 0) {
            const tower = sim.towers[Math.floor(rng() * sim.towers.length)];
            sim.upgrade(tower.id, rng() < 0.4 ? (rng() < 0.5 ? "a" : "b") : undefined);
          } else if (roll < 0.42 && sim.towers.length > 0) {
            const tower = sim.towers[Math.floor(rng() * sim.towers.length)];
            const rate = sim.refundRate();
            const expected = Math.floor(tower.spent * rate);
            const goldBefore = sim.gold;
            if (sim.sell(tower.id)) {
              expect(sim.gold - goldBefore, `${label} refund exact`).toBe(expected);
              expect(expected, `${label} refund <= spent`).toBeLessThanOrEqual(tower.spent);
            }
          } else if (roll < 0.52) {
            sim.callWave();
          } else if (roll < 0.58) {
            sim.setAutoWaves(rng() < 0.5);
          } else if (roll < 0.64 && level.hero) {
            sim.castHeroBurst();
          }
          ({ wave, phase } = checkInvariants(sim, wave, phase, `${label} op${op}`));
          const burst = 1 + Math.floor(rng() * 20);
          for (let i = 0; i < burst; i++) sim.step(1 / 30);
          ({ wave, phase } = checkInvariants(sim, wave, phase, `${label} op${op} steps`));
          if (phase === "victory" || phase === "defeat") break;
        }
      }
    }
  }, 30000);

  it("auto march eventually starts wave 1 from any toggle sequence", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(seed));
      const rng = mulberry32(seed * 31 + 7);
      sim.armPrep(2);
      for (let i = 0; i < 6; i++) {
        sim.setAutoWaves(rng() < 0.5);
        for (let j = 0; j < 15; j++) sim.step(1 / 30);
      }
      sim.setAutoWaves(true);
      for (let i = 0; i < (Sim.PREP_SECONDS + 2) * 30 && sim.waveStarted === 0; i++) sim.step(1 / 30);
      expect(sim.waveStarted, `seed ${seed} auto starts`).toBe(1);
    }
  });
});
