import { BARRACKS, RANGED, branchCost, buildCost } from "../src/content/catalog";
import type { Branch, Family } from "../src/content/types";
import { Sim, type TowerInst } from "../src/sim/Sim";
import { dist } from "../src/sim/geom";

export interface BuildOrder {
  slot: string;
  family: Family;
}

export interface BranchOrder {
  slot: string;
  branch: Branch;
}

export interface Plan {
  builds: BuildOrder[];
  upgradeSlots: string[];
  branches: BranchOrder[];
}

export const PLANS: Record<string, Plan> = {
  dewcap: {
    builds: [
      { slot: "c", family: "barracks" },
      { slot: "e", family: "archer" },
      { slot: "d", family: "mage" },
      { slot: "b", family: "barracks" },
      { slot: "f", family: "archer" },
    ],
    upgradeSlots: ["c", "d", "e", "b", "f"],
    branches: [],
  },
  forkfen: {
    builds: [
      { slot: "a2", family: "barracks" },
      { slot: "b1", family: "barracks" },
      { slot: "m1", family: "archer" },
      { slot: "b2", family: "archer" },
      { slot: "a3", family: "mage" },
      { slot: "m2", family: "artillery" },
    ],
    upgradeSlots: ["a2", "b1", "m1", "b2", "a3", "m2"],
    branches: [
      { slot: "a2", branch: "a" },
      { slot: "m1", branch: "b" },
      { slot: "a3", branch: "b" },
    ],
  },
  blackcap: {
    builds: [
      { slot: "p2", family: "barracks" },
      { slot: "p3", family: "mage" },
      { slot: "p1", family: "archer" },
      { slot: "p6", family: "artillery" },
    ],
    upgradeSlots: ["p2", "p3", "p1", "p6"],
    branches: [
      { slot: "p2", branch: "a" },
      { slot: "p3", branch: "b" },
      { slot: "p1", branch: "b" },
      { slot: "p6", branch: "a" },
    ],
  },
};

export const PHYSICAL_ONLY: Plan = {
  builds: [
    { slot: "c", family: "barracks" },
    { slot: "e", family: "archer" },
    { slot: "b", family: "barracks" },
    { slot: "f", family: "archer" },
    { slot: "a", family: "archer" },
  ],
  upgradeSlots: ["c", "e", "b", "f", "a"],
  branches: [],
};

function upgradeCost(tower: TowerInst): number {
  const tier = tower.tier;
  if (tier !== 1 && tier !== 2) return Infinity;
  if (tower.family === "barracks") return BARRACKS.tiers[tier].cost;
  return RANGED[tower.family].tiers[tier].cost;
}

function spend(sim: Sim, plan: Plan): "spent" | "saving" | "idle" {
  for (const order of plan.builds) {
    if (sim.towerAt(order.slot)) continue;
    const cost = buildCost(order.family);
    if (sim.gold >= cost) {
      sim.build(order.slot, order.family);
      return "spent";
    }
    break;
  }
  for (const slot of plan.upgradeSlots) {
    const tower = sim.towerAt(slot);
    if (!tower) continue;
    if ((tower.tier === 1 || tower.tier === 2) && tower.tier < sim.level.maxTier) {
      const cost = upgradeCost(tower);
      if (sim.gold >= cost) {
        sim.upgrade(tower.id);
        return "spent";
      }
      continue;
    }
    if (tower.tier === 3 && sim.level.maxTier >= 4 && !tower.branch) {
      const wanted = plan.branches.find((entry) => entry.slot === slot);
      if (!wanted) continue;
      const cost = branchCost(tower.family, wanted.branch);
      if (sim.gold >= cost) {
        sim.upgrade(tower.id, wanted.branch);
        return "spent";
      }
    }
  }
  for (const order of plan.builds) {
    if (!sim.towerAt(order.slot)) return "saving";
  }
  return "idle";
}

function commandHero(sim: Sim): void {
  const hero = sim.hero;
  if (!hero?.alive) return;
  const ground = sim.enemies.filter((enemy) => enemy.alive && !enemy.flying).sort((a, b) => b.dist - a.dist);
  if (ground.length === 0) return;
  const lead = ground[0];
  const current = hero.blockId ? ground.find((enemy) => enemy.id === hero.blockId) : undefined;
  const target = current && lead.dist < current.dist + 180 ? current : lead;
  sim.moveHero(target.x, target.y);
  sim.castHeroBurst();
}

function commandSpells(sim: Sim): void {
  if (sim.rainUnlocked() && sim.rainCd <= 0) {
    let best: { x: number; y: number } | null = null;
    let bestCount = 0;
    for (const enemy of sim.enemies) {
      if (!enemy.alive) continue;
      const count = sim.enemies.filter((other) => other.alive && dist(other, enemy) <= 88).length;
      if (count > bestCount) {
        bestCount = count;
        best = enemy;
      }
    }
    if (best && bestCount >= 4) sim.castRain(best.x, best.y);
  }
  if (sim.reinforcementUnlocked() && sim.reinCd <= 0) {
    const lead = sim.enemies.filter((enemy) => enemy.alive && !enemy.flying).sort((a, b) => b.dist - a.dist)[0];
    if (lead && lead.dist / sim.pathTotal(lead.pathId) > 0.58) sim.castReinforcement(lead.x, lead.y);
  }
}

export function act(sim: Sim, plan: Plan): void {
  let outcome: "spent" | "saving" | "idle" = "idle";
  for (let i = 0; i < 8; i++) {
    outcome = spend(sim, plan);
    if (outcome !== "spent") break;
  }
  commandHero(sim);
  commandSpells(sim);
  if (!sim.canCall()) return;
  if (sim.waveStarted === 0 || sim.enemies.length === 0) {
    sim.callWave();
    return;
  }
  if (outcome === "saving") return;
  const threat = sim.enemies.filter((enemy) => enemy.dist / sim.pathTotal(enemy.pathId) > 0.62).length;
  if (threat === 0 && sim.enemies.length <= 2) sim.callWave();
}

export function run(sim: Sim, plan: Plan | null, seconds = 420): Sim {
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    if (plan) act(sim, plan);
    else if (sim.canCall()) sim.callWave();
    sim.step(dt);
    if (sim.phase === "victory" || sim.phase === "defeat") break;
  }
  return sim;
}
