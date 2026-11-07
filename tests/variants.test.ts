import { describe, expect, it } from "vitest";
import { ENEMY_MAP, NEUTRAL_BONUSES } from "../src/content/catalog";
import { LEVELS } from "../src/content/levels";
import { launchMarch, heroById } from "../src/content/variants";
import { Sim } from "../src/sim/Sim";
import { mulberry32 } from "../src/sim/rng";

describe("launch variants", () => {
  it("heroic is one life against tougher foes", () => {
    const march = launchMarch(LEVELS[0], "heroic", "normal", "puff");
    expect(march.level.lives).toBe(1);
    expect(march.enemyDefs.sprout.hp).toBeGreaterThan(ENEMY_MAP.sprout.hp);
    expect(march.level.waves).toHaveLength(LEVELS[0].waves.length);
  });

  it("iron caps tier 4, trims gold, and forces manual in the scene contract", () => {
    const tier4 = LEVELS.find((l) => l.maxTier === 4) ?? LEVELS[0];
    const march = launchMarch(tier4, "iron", "normal", "puff");
    expect(march.level.maxTier).toBe(3);
    expect(march.level.startGold).toBeLessThan(tier4.startGold);
    expect(march.mode.forceManual).toBe(true);
  });

  it("endless appends twelve growing waves deterministically", () => {
    const a = launchMarch(LEVELS[0], "endless", "normal", "puff");
    const b = launchMarch(LEVELS[0], "endless", "normal", "puff");
    expect(a.level.waves).toHaveLength(LEVELS[0].waves.length + 12);
    expect(a.level.waves.map((w) => w.spawns.map((s) => s.count))).toEqual(b.level.waves.map((w) => w.spawns.map((s) => s.count)));
    const firstExtra = a.level.waves[LEVELS[0].waves.length].spawns[0].count;
    const lastExtra = a.level.waves[a.level.waves.length - 1].spawns[0].count;
    expect(lastExtra).toBeGreaterThanOrEqual(firstExtra);
  });

  it("difficulty shifts lives, gold, and foe hp together", () => {
    const casual = launchMarch(LEVELS[0], "campaign", "casual", "puff");
    const veteran = launchMarch(LEVELS[0], "campaign", "veteran", "puff");
    expect(casual.level.lives).toBeGreaterThan(veteran.level.lives);
    expect(casual.level.startGold).toBeGreaterThan(veteran.level.startGold);
    expect(casual.enemyDefs.sprout.hp).toBeLessThan(veteran.enemyDefs.sprout.hp);
  });

  it("unknown heroes fall back to Warden Puff", () => {
    expect(heroById("nope").id).toBe("puff");
  });
});

describe("sim pause, prep resume, and wardens", () => {
  it("paused sim neither ticks nor takes orders", () => {
    const sim = new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(5));
    sim.setAutoWaves(false);
    sim.paused = true;
    for (let i = 0; i < 90; i++) sim.step(1 / 30);
    expect(sim.time).toBe(0);
    expect(sim.build("a", "archer")).toBe(false);
    sim.paused = false;
    expect(sim.build("a", "archer")).toBe(true);
  });

  it("toggling Auto off and on resumes prep where it stopped", () => {
    const sim = new Sim(LEVELS[0], NEUTRAL_BONUSES, mulberry32(6));
    sim.armPrep(10);
    for (let i = 0; i < 150; i++) sim.step(1 / 30); // ~5s of prep spent
    sim.setAutoWaves(false);
    sim.setAutoWaves(true);
    expect(sim.countingDown).toBe(true);
    expect(sim.nextWaveIn).toBeLessThanOrEqual(6);
    expect(sim.nextWaveIn).toBeGreaterThan(3);
  });

  it("launches the chosen warden with their own stats", () => {
    const march = launchMarch(LEVELS[2], "campaign", "normal", "bramble");
    const sim = new Sim(march.level, NEUTRAL_BONUSES, mulberry32(7), march.enemyDefs, march.hero);
    expect(sim.hero).not.toBeNull();
    expect(sim.hero!.maxHp).toBe(260);
    expect(sim.heroDef.name).toBe("Bramble the Broad");
  });
});
