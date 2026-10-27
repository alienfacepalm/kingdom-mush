import {
  BARRACKS,
  ELEMENTAL,
  ENEMY_MAP,
  HERO,
  RAIN,
  REINFORCEMENT,
  barracksStats,
  branchCost,
  buildCost,
  rangedStats,
} from "../content/catalog";
import type { Bonuses, Branch, DamageType, EnemyDef, Family, LevelDef } from "../content/types";
import { applyDamage, rollInt, splashMultiplier } from "./combat";
import { type Poly, buildPoly, closestOnPoly, dist, normalAlong, pointAlong } from "./geom";

export interface TowerInst {
  id: string;
  slotId: string;
  family: Family;
  tier: 1 | 2 | 3 | 4;
  branch: Branch | null;
  x: number;
  y: number;
  spent: number;
  cooldown: number;
  shots: number;
  rx: number;
  ry: number;
}

export interface EnemyInst {
  id: string;
  defId: string;
  name: string;
  pathId: string;
  dist: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  armor: number;
  magicResist: number;
  flying: boolean;
  speed: number;
  bounty: number;
  damage: number;
  attackInterval: number;
  attackCd: number;
  alive: boolean;
  held: boolean;
  blockId: string | null;
  slowUntil: number;
  poisonDps: number;
  poisonUntil: number;
  poisonAcc: number;
  healPerSec: number;
  healRadius: number;
  boss: boolean;
  addEvery: number;
  addCount: number;
  addsLeft: number;
  addTimer: number;
  tint: number;
}

export interface ActorInst {
  id: string;
  kind: "soldier" | "hero" | "reinforcement" | "elemental";
  ownerId: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  ox: number;
  oy: number;
  hp: number;
  maxHp: number;
  armor: number;
  dmgMin: number;
  dmgMax: number;
  interval: number;
  cooldown: number;
  regen: number;
  leash: number;
  speed: number;
  melee: number;
  throwRange: number;
  alive: boolean;
  respawn: number;
  respawnLeft: number;
  blockId: string | null;
  expires: number | null;
  aura: number;
  down: number;
  destX: number;
  destY: number;
  abilityCd: number;
  level: number;
  xp: number;
  dmgBonus: number;
}

export type Notice =
  | { type: "new"; enemyId: string }
  | { type: "wave"; index: number }
  | { type: "unlock"; power: "reinforcement" | "rain" }
  | { type: "fire"; x1: number; y1: number; x2: number; y2: number; kind: DamageType }
  | { type: "float"; x: number; y: number; text: string; color: string }
  | { type: "leak" }
  | { type: "boom"; x: number; y: number; r: number };

interface PendingSpawn {
  time: number;
  enemyId: string;
  pathId: string;
  dist: number;
}

interface Hazard {
  t: number;
  x: number;
  y: number;
  r: number;
  min: number;
  max: number;
}

const STEP = 1 / 30;
const HOLD_RANGE = 40;
const RALLY_ROAD = 30;
const RALLY_REACH = 175;

export class Sim {
  readonly level: LevelDef;
  readonly bonuses: Bonuses;
  readonly enemies: EnemyInst[] = [];
  readonly towers: TowerInst[] = [];
  readonly actors: ActorInst[] = [];
  hero: ActorInst | null = null;
  gold: number;
  lives: number;
  phase: "prep" | "combat" | "victory" | "defeat" = "prep";
  time = 0;
  waveStarted = 0;
  nextWaveIn = 0;
  countingDown = false;
  reinCd = 0;
  rainCd = 0;

  private readonly rng: () => number;
  private readonly enemyDefs: Record<string, EnemyDef>;
  private readonly polys = new Map<string, Poly>();
  private readonly queue: PendingSpawn[] = [];
  private readonly hazards: Hazard[] = [];
  private notices: Notice[] = [];
  private seen = new Set<string>();
  private acc = 0;
  private seq = 1;
  private announced = { reinforcement: false, rain: false };

  constructor(level: LevelDef, bonuses: Bonuses, rng: () => number, enemyDefs: Record<string, EnemyDef> = ENEMY_MAP) {
    this.level = level;
    this.bonuses = bonuses;
    this.rng = rng;
    this.enemyDefs = enemyDefs;
    this.gold = level.startGold;
    this.lives = level.lives;
    for (const path of level.paths) this.polys.set(path.id, buildPoly(path.points));
    if (level.hero) {
      this.hero = this.makeHero();
    }
  }

  drain(): Notice[] {
    const notices = this.notices;
    this.notices = [];
    return notices;
  }

  towerAt(slotId: string): TowerInst | undefined {
    return this.towers.find((tower) => tower.slotId === slotId);
  }

  enemyById(id: string): EnemyInst | undefined {
    return this.enemies.find((enemy) => enemy.id === id);
  }

  actorById(id: string): ActorInst | undefined {
    if (this.hero?.id === id) return this.hero;
    return this.actors.find((actor) => actor.id === id);
  }

  canCall(): boolean {
    if (this.phase === "victory" || this.phase === "defeat") return false;
    if (this.queue.length > 0) return false;
    if (this.waveStarted >= this.level.waves.length) return false;
    if (this.waveStarted === 0) return true;
    return this.countingDown;
  }

  earlyBonus(): number {
    if (!this.countingDown) return 0;
    return Math.floor(Math.max(0, this.nextWaveIn) * this.bonuses.earlyGold);
  }

  upcomingGroups(): { pathName: string; enemyId: string; count: number }[] | null {
    if (this.waveStarted >= this.level.waves.length) return null;
    if (this.queue.length > 0) return null;
    const wave = this.level.waves[this.waveStarted];
    return wave.spawns.map((group) => ({
      pathName: this.level.paths.find((path) => path.id === group.pathId)?.name ?? group.pathId,
      enemyId: group.enemyId,
      count: group.count,
    }));
  }

  reinforcementUnlocked(): boolean {
    if (this.level.reinforcementFromWave <= 1) return true;
    return this.waveStarted >= this.level.reinforcementFromWave;
  }

  rainUnlocked(): boolean {
    if (this.level.rainFromWave <= 1) return true;
    return this.waveStarted >= this.level.rainFromWave;
  }

  refundRate(): number {
    return this.waveStarted === 0 ? 1 : 0.6;
  }

  pathTotal(pathId: string): number {
    return this.polys.get(pathId)?.total ?? 1;
  }

  build(slotId: string, family: Family): boolean {
    if (!this.acceptsOrders()) return false;
    const slot = this.level.slots.find((entry) => entry.id === slotId);
    if (!slot || this.towerAt(slotId)) return false;
    const cost = buildCost(family);
    if (this.gold < cost) return false;
    this.gold -= cost;
    const rally = this.nearestRoad(slot.x, slot.y);
    const tower: TowerInst = {
      id: this.nid("t"),
      slotId,
      family,
      tier: 1,
      branch: null,
      x: slot.x,
      y: slot.y,
      spent: cost,
      cooldown: 0.2,
      shots: 0,
      rx: rally.point.x,
      ry: rally.point.y,
    };
    this.towers.push(tower);
    if (family === "barracks") this.refreshSoldiers(tower);
    return true;
  }

  upgrade(towerId: string, branch?: Branch): boolean {
    if (!this.acceptsOrders()) return false;
    const tower = this.towers.find((entry) => entry.id === towerId);
    if (!tower) return false;
    const currentTier = tower.tier;
    if (currentTier === 1 || currentTier === 2) {
      const cost = tower.family === "barracks" ? BARRACKS.tiers[currentTier].cost : rangedCost(tower);
      if (this.gold < cost) return false;
      this.gold -= cost;
      tower.spent += cost;
      tower.tier = (tower.tier + 1) as 2 | 3;
    } else if (tower.tier === 3 && this.level.maxTier >= 4 && !tower.branch && branch) {
      const cost = branchCost(tower.family, branch);
      if (this.gold < cost) return false;
      this.gold -= cost;
      tower.spent += cost;
      tower.tier = 4;
      tower.branch = branch;
    } else {
      return false;
    }
    if (tower.family === "barracks") this.refreshSoldiers(tower);
    if (tower.family === "mage" && tower.branch === "b") this.ensureElemental(tower);
    return true;
  }

  sell(towerId: string): boolean {
    if (!this.acceptsOrders()) return false;
    const tower = this.towers.find((entry) => entry.id === towerId);
    if (!tower) return false;
    const refund = Math.floor(tower.spent * this.refundRate());
    this.gold += refund;
    const index = this.towers.indexOf(tower);
    this.towers.splice(index, 1);
    for (let i = this.actors.length - 1; i >= 0; i--) {
      if (this.actors[i].ownerId === tower.id) this.actors.splice(i, 1);
    }
    return true;
  }

  setRally(towerId: string, x: number, y: number): boolean {
    if (!this.acceptsOrders()) return false;
    const tower = this.towers.find((entry) => entry.id === towerId);
    if (!tower) return false;
    const rallyable = tower.family === "barracks" || (tower.family === "mage" && tower.branch === "b");
    if (!rallyable) return false;
    const road = this.nearestRoad(x, y);
    if (road.gap > RALLY_ROAD) return false;
    if (dist(tower, road.point) > RALLY_REACH) return false;
    tower.rx = road.point.x;
    tower.ry = road.point.y;
    this.reposition(tower);
    return true;
  }

  callWave(): number {
    if (!this.canCall()) return 0;
    let bonus = 0;
    if (this.countingDown) {
      bonus = this.earlyBonus();
      const shaved = Math.max(0, this.nextWaveIn);
      this.gold += bonus;
      this.reinCd = Math.max(0, this.reinCd - shaved);
      this.rainCd = Math.max(0, this.rainCd - shaved);
    }
    this.countingDown = false;
    this.nextWaveIn = 0;
    const wave = this.level.waves[this.waveStarted];
    let t = this.time;
    for (const group of wave.spawns) {
      for (let i = 0; i < group.count; i++) {
        this.queue.push({ time: t, enemyId: group.enemyId, pathId: group.pathId, dist: 0 });
        t += group.interval;
      }
    }
    this.waveStarted += 1;
    this.phase = "combat";
    this.push({ type: "wave", index: this.waveStarted });
    this.announcePowers();
    return bonus;
  }

  castReinforcement(x: number, y: number): boolean {
    if (!this.acceptsOrders() || !this.reinforcementUnlocked() || this.reinCd > 0) return false;
    const road = this.nearestRoad(x, y);
    if (road.gap > 36) return false;
    this.reinCd = REINFORCEMENT.cooldown;
    const hp = REINFORCEMENT.hp + this.bonuses.reinforcementHp;
    const duration = REINFORCEMENT.duration + this.bonuses.reinforcementDuration;
    const normal = this.normalAt(road.point.x, road.point.y);
    for (const offset of [-12, 12]) {
      const actor = this.blankActor("reinforcement", "spell", hp);
      actor.armor = REINFORCEMENT.armor;
      actor.dmgMin = REINFORCEMENT.min;
      actor.dmgMax = REINFORCEMENT.max;
      actor.interval = REINFORCEMENT.interval;
      actor.rx = road.point.x;
      actor.ry = road.point.y;
      actor.ox = normal.x * offset;
      actor.oy = normal.y * offset;
      actor.x = actor.rx + actor.ox;
      actor.y = actor.ry + actor.oy;
      actor.leash = 120;
      actor.speed = 120;
      actor.expires = this.time + duration;
      this.actors.push(actor);
    }
    return true;
  }

  castRain(x: number, y: number): boolean {
    if (!this.acceptsOrders() || !this.rainUnlocked() || this.rainCd > 0) return false;
    this.rainCd = RAIN.cooldown;
    for (let i = 0; i < RAIN.hits; i++) {
      this.hazards.push({ t: this.time + i * RAIN.gap, x, y, r: RAIN.radius, min: RAIN.min, max: RAIN.max });
    }
    return true;
  }

  moveHero(x: number, y: number): void {
    if (!this.hero || !this.acceptsOrders()) return;
    this.hero.destX = clampCoord(x, 30, 1250);
    this.hero.destY = clampCoord(y, 70, 640);
  }

  castHeroBurst(): boolean {
    if (!this.hero || !this.hero.alive || !this.acceptsOrders() || this.hero.abilityCd > 0) return false;
    const victims = this.enemies.filter((enemy) => enemy.alive && dist(enemy, this.hero!) <= HERO.abilityRadius);
    if (victims.length === 0) return false;
    this.hero.abilityCd = HERO.abilityCd;
    const amount = HERO.abilityDamage + (this.hero.level - 1) * 4;
    for (const enemy of victims) {
      this.hurt(enemy, amount, "true");
      if (enemy.alive) enemy.slowUntil = this.time + HERO.abilitySlow;
    }
    this.push({ type: "boom", x: this.hero.x, y: this.hero.y, r: HERO.abilityRadius });
    return true;
  }

  step(dt: number): void {
    if (this.isOver()) return;
    this.acc += Math.min(Math.max(dt, 0), 0.1);
    if (this.acc > 1) this.acc = 1;
    let guard = 0;
    while (this.acc >= STEP && guard++ < 30) {
      this.acc -= STEP;
      this.tick(STEP);
      if (this.isOver()) {
        this.acc = 0;
        break;
      }
    }
  }

  private isOver(): boolean {
    return this.phase === "victory" || this.phase === "defeat";
  }

  report(): string {
    const towers = this.towers.map((tower) => `${tower.slotId}:${tower.family}${tower.tier}${tower.branch ?? ""}`).join(",");
    return `phase=${this.phase} lives=${this.lives} gold=${this.gold} wave=${this.waveStarted}/${this.level.waves.length} enemies=${this.enemies.length} towers=${towers}`;
  }

  private tick(dt: number): void {
    this.time += dt;
    this.reinCd = Math.max(0, this.reinCd - dt);
    this.rainCd = Math.max(0, this.rainCd - dt);
    this.tickHeroDown(dt);
    this.tickRespawns(dt);
    this.tickSpawns();
    this.tickHazards();
    this.tickPoison(dt);
    this.tickBossAdds(dt);
    this.refreshHeld();
    this.moveEnemies(dt);
    this.assignBlockers();
    this.moveActors(dt);
    this.refreshHeld();
    this.tickAttacks(dt);
    this.tickTowers(dt);
    this.tickHeals(dt);
    this.tickRegen(dt);
    this.compact();
    this.tickCountdown(dt);
    this.checkVictory();
  }

  private tickHeroDown(dt: number): void {
    if (!this.hero || this.hero.alive) return;
    this.hero.down -= dt;
    this.hero.abilityCd = Math.max(0, this.hero.abilityCd - dt);
    if (this.hero.down <= 0) {
      this.hero.alive = true;
      this.hero.hp = this.hero.maxHp;
      this.hero.down = 0;
      this.hero.x = this.level.heroHome.x;
      this.hero.y = this.level.heroHome.y;
      this.hero.destX = this.hero.x;
      this.hero.destY = this.hero.y;
    }
  }

  private tickRespawns(dt: number): void {
    for (const actor of this.actors) {
      if (actor.alive || actor.kind === "reinforcement") continue;
      actor.respawnLeft -= dt;
      if (actor.respawnLeft <= 0) {
        actor.alive = true;
        actor.hp = actor.maxHp;
        actor.x = actor.rx + actor.ox;
        actor.y = actor.ry + actor.oy;
        actor.cooldown = 0.3;
      }
    }
  }

  private tickSpawns(): void {
    while (this.queue.length > 0 && this.queue[0].time <= this.time) {
      const pending = this.queue.shift()!;
      this.spawnEnemy(pending.enemyId, pending.pathId, pending.dist);
    }
  }

  private tickHazards(): void {
    for (let i = 0; i < this.hazards.length; i++) {
      const hazard = this.hazards[i];
      if (hazard.t > this.time) continue;
      this.push({ type: "boom", x: hazard.x, y: hazard.y, r: hazard.r });
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const gap = dist(enemy, hazard);
        const multiplier = splashMultiplier(gap, hazard.r);
        if (multiplier <= 0) continue;
        const rolled = rollInt(hazard.min, hazard.max, this.rng);
        this.hurt(enemy, Math.max(1, Math.round(rolled * multiplier)), "true");
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      if (this.hazards[i].t <= this.time) this.hazards.splice(i, 1);
    }
  }

  private tickPoison(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.poisonUntil < this.time || enemy.poisonDps <= 0) continue;
      enemy.poisonAcc += enemy.poisonDps * dt;
      const whole = Math.floor(enemy.poisonAcc);
      if (whole > 0) {
        enemy.poisonAcc -= whole;
        this.hurt(enemy, whole, "poison");
      }
    }
  }

  private tickBossAdds(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.boss || enemy.addsLeft <= 0 || enemy.addEvery <= 0) continue;
      enemy.addTimer -= dt;
      if (enemy.addTimer > 0) continue;
      enemy.addTimer = enemy.addEvery;
      const count = Math.min(enemy.addCount, enemy.addsLeft);
      enemy.addsLeft -= count;
      for (let i = 0; i < count; i++) {
        this.spawnEnemy("sprout", enemy.pathId, Math.max(0, enemy.dist - 80));
      }
    }
  }

  private moveEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const poly = this.polys.get(enemy.pathId);
      if (!poly) continue;
      if (!enemy.held) {
        const slow = enemy.slowUntil > this.time ? 0.5 : 1;
        enemy.dist += enemy.speed * slow * dt;
      }
      if (enemy.dist >= poly.total) {
        enemy.dist = poly.total;
        this.syncEnemy(enemy);
        this.leak(enemy);
        continue;
      }
      this.syncEnemy(enemy);
    }
  }

  private assignBlockers(): void {
    for (const enemy of this.enemies) enemy.blockId = null;
    const blockers = this.holders();
    for (const blocker of blockers) blocker.blockId = null;
    const foes = this.enemies.filter((enemy) => enemy.alive && !enemy.flying);
    foes.sort((a, b) => b.dist - a.dist);
    const used = new Set<string>();
    for (const foe of foes) {
      let best: ActorInst | null = null;
      let bestDist = Infinity;
      for (const blocker of blockers) {
        if (used.has(blocker.id)) continue;
        const center = blocker.kind === "hero" ? blocker : { x: blocker.rx, y: blocker.ry };
        const reach = dist(center, foe);
        if (reach > blocker.leash && dist(blocker, foe) > blocker.melee) continue;
        const gap = dist(blocker, foe);
        if (gap < bestDist) {
          best = blocker;
          bestDist = gap;
        }
      }
      if (!best) continue;
      best.blockId = foe.id;
      foe.blockId = best.id;
      used.add(best.id);
    }
  }

  private moveActors(dt: number): void {
    for (const actor of this.actors) {
      if (!actor.alive) continue;
      if (actor.blockId) {
        const foe = this.enemyById(actor.blockId);
        if (foe && foe.alive) {
          moveToward(actor, foe.x, foe.y, dt);
          continue;
        }
      }
      moveToward(actor, actor.rx + actor.ox, actor.ry + actor.oy, dt);
    }
    if (this.hero?.alive) {
      const gap = dist(this.hero, { x: this.hero.destX, y: this.hero.destY });
      if (gap > 28) {
        moveToward(this.hero, this.hero.destX, this.hero.destY, dt);
        this.hero.blockId = null;
        for (const enemy of this.enemies) {
          if (enemy.blockId === this.hero.id) enemy.blockId = null;
        }
      }
    }
  }

  private refreshHeld(): void {
    for (const enemy of this.enemies) {
      enemy.held = false;
      if (!enemy.blockId || enemy.flying) continue;
      const blocker = this.actorById(enemy.blockId);
      if (blocker && blocker.alive && dist(blocker, enemy) <= HOLD_RANGE) enemy.held = true;
    }
  }

  private tickAttacks(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.damage <= 0 || !enemy.blockId) continue;
      const blocker = this.actorById(enemy.blockId);
      if (!blocker || !blocker.alive || dist(blocker, enemy) > HOLD_RANGE + 4) continue;
      enemy.attackCd -= dt;
      if (enemy.attackCd > 0) continue;
      enemy.attackCd = enemy.attackInterval;
      const dealt = applyDamage(enemy.damage, "physical", blocker.armor, 0);
      blocker.hp -= dealt;
      if (blocker.hp <= 0) this.downActor(blocker);
    }
    for (const actor of this.holders()) {
      if (!actor.alive) continue;
      actor.cooldown -= dt;
      if (actor.cooldown > 0) continue;
      const melee = actor.blockId ? this.enemyById(actor.blockId) : undefined;
      const pile =
        melee && melee.alive && dist(actor, melee) <= HOLD_RANGE + 6
          ? melee
          : this.enemies.find((enemy) => enemy.alive && !enemy.flying && dist(actor, enemy) <= HOLD_RANGE + 10);
      if (pile) {
        actor.cooldown = actor.interval;
        const amount = rollInt(actor.dmgMin + actor.dmgBonus, actor.dmgMax + actor.dmgBonus, this.rng);
        this.hurt(pile, amount, "physical");
        continue;
      }
      if (actor.throwRange <= 0) continue;
      const thrown = this.nearestEnemy(actor.x, actor.y, actor.throwRange, true);
      if (!thrown) continue;
      actor.cooldown = actor.interval;
      const amount = rollInt(actor.dmgMin + actor.dmgBonus, actor.dmgMax + actor.dmgBonus, this.rng);
      this.hurt(thrown, amount, "physical");
      this.push({ type: "fire", x1: actor.x, y1: actor.y, x2: thrown.x, y2: thrown.y, kind: "physical" });
    }
  }

  private tickTowers(dt: number): void {
    for (const tower of this.towers) {
      if (tower.family === "barracks") continue;
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const stats = rangedStats(tower.family, tower.tier, tower.branch, this.bonuses);
      const target = this.acquire(tower.x, tower.y, stats.range, stats.air);
      if (!target) {
        tower.cooldown = 0;
        continue;
      }
      tower.cooldown = stats.interval;
      tower.shots += 1;
      this.push({ type: "fire", x1: tower.x, y1: tower.y - 16, x2: target.x, y2: target.y, kind: stats.damageType });
      if (stats.chain > 0) {
        this.fireChain(target, stats);
      } else if (stats.splash > 0) {
        const center = stats.max;
        this.hurt(target, center, stats.damageType);
        for (const enemy of this.enemies) {
          if (!enemy.alive || enemy.id === target.id) continue;
          const multiplier = splashMultiplier(dist(enemy, target), stats.splash);
          if (multiplier <= 0) continue;
          this.hurt(enemy, Math.max(1, Math.round(center * multiplier)), stats.damageType);
        }
      } else {
        this.hurt(target, rollInt(stats.min, stats.max, this.rng), stats.damageType);
      }
      if (target.alive && stats.shred > 0) target.armor = Math.max(0, target.armor - stats.shred);
      if (target.alive && stats.poisonDps > 0) {
        target.poisonDps = Math.max(target.poisonDps, stats.poisonDps);
        target.poisonUntil = this.time + stats.poisonTime;
      }
      if (target.alive && stats.teleport > 0 && stats.teleportEvery > 0 && tower.shots % stats.teleportEvery === 0) {
        const amount = target.boss ? Math.min(70, stats.teleport) : stats.teleport;
        target.dist = Math.max(0, target.dist - amount);
        this.syncEnemy(target);
      }
    }
  }

  private fireChain(target: EnemyInst, stats: ReturnType<typeof rangedStats>): void {
    const first = rollInt(stats.min, stats.max, this.rng);
    const hit = new Set<string>([target.id]);
    this.hurt(target, first, stats.damageType);
    let origin = target;
    for (let hop = 1; hop < stats.chain; hop++) {
      let next: EnemyInst | null = null;
      let nearest = 120;
      for (const enemy of this.enemies) {
        if (!enemy.alive || hit.has(enemy.id)) continue;
        const gap = dist(origin, enemy);
        if (gap <= nearest) {
          nearest = gap;
          next = enemy;
        }
      }
      if (!next) break;
      hit.add(next.id);
      this.hurt(next, Math.max(1, Math.round(first * (1 - hop * 0.2))), "electric");
      this.push({ type: "fire", x1: origin.x, y1: origin.y, x2: next.x, y2: next.y, kind: "electric" });
      origin = next;
    }
  }

  private tickHeals(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.healPerSec <= 0) continue;
      for (const other of this.enemies) {
        if (!other.alive || other.id === enemy.id) continue;
        if (dist(enemy, other) <= enemy.healRadius) other.hp = Math.min(other.maxHp, other.hp + enemy.healPerSec * dt);
      }
    }
    for (const actor of this.actors) {
      if (!actor.alive || actor.aura <= 0) continue;
      for (const other of this.bodies()) {
        if (!other.alive || other.id === actor.id) continue;
        if (dist(actor, other) <= 90) other.hp = Math.min(other.maxHp, other.hp + actor.aura * dt);
      }
    }
  }

  private tickRegen(dt: number): void {
    for (const actor of this.bodies()) {
      if (!actor.alive || actor.blockId || actor.regen <= 0) continue;
      actor.hp = Math.min(actor.maxHp, actor.hp + actor.regen * dt);
    }
  }

  private compact(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].alive) this.enemies.splice(i, 1);
    }
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const actor = this.actors[i];
      const expired = actor.expires !== null && this.time >= actor.expires;
      if (actor.kind === "reinforcement" && (!actor.alive || expired)) this.actors.splice(i, 1);
    }
  }

  private tickCountdown(dt: number): void {
    if (this.phase !== "combat" || this.queue.length > 0) return;
    if (!this.countingDown && this.waveStarted < this.level.waves.length) {
      const gap = this.level.waves[this.waveStarted - 1]?.gap ?? 0;
      if (gap <= 0) {
        this.callWave();
        return;
      }
      this.countingDown = true;
      this.nextWaveIn = gap;
    }
    if (!this.countingDown) return;
    this.nextWaveIn -= dt;
    if (this.nextWaveIn <= 0) this.callWave();
  }

  private checkVictory(): void {
    if (this.phase !== "combat") return;
    if (this.waveStarted < this.level.waves.length) return;
    if (this.queue.length > 0) return;
    if (this.enemies.some((enemy) => enemy.alive)) return;
    this.phase = "victory";
  }

  private leak(enemy: EnemyInst): void {
    enemy.alive = false;
    this.lives = Math.max(0, this.lives - 1);
    this.push({ type: "leak" });
    if (this.lives <= 0) this.phase = "defeat";
  }

  private hurt(enemy: EnemyInst, amount: number, type: DamageType): void {
    if (!enemy.alive || amount <= 0) return;
    const dealt = applyDamage(amount, type, enemy.armor, enemy.magicResist);
    if (dealt <= 0) return;
    enemy.hp -= dealt;
    this.push({ type: "float", x: enemy.x, y: enemy.y - 10, text: String(dealt), color: floatColor(type) });
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: EnemyInst): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.gold += enemy.bounty;
    this.push({ type: "float", x: enemy.x, y: enemy.y - 22, text: `+${enemy.bounty}`, color: "#f2c14e" });
    if (this.hero) this.gainXp(enemy.bounty);
  }

  private gainXp(amount: number): void {
    const hero = this.hero;
    if (!hero) return;
    hero.xp += amount;
    const caps = [70, 170, 320];
    while (hero.level < 4 && hero.xp >= caps[hero.level - 1]) {
      hero.level += 1;
      hero.maxHp += 28;
      hero.hp = hero.maxHp;
      hero.dmgBonus += 3;
    }
  }

  private spawnEnemy(defId: string, pathId: string, distance: number): void {
    const def = this.enemyDefs[defId];
    const poly = this.polys.get(pathId);
    if (!def || !poly) return;
    const distAlong = Math.max(0, Math.min(distance, poly.total - 1));
    const point = pointAlong(poly, distAlong);
    const enemy: EnemyInst = {
      id: this.nid("e"),
      defId: def.id,
      name: def.name,
      pathId,
      dist: distAlong,
      x: point.x,
      y: point.y,
      hp: def.hp,
      maxHp: def.hp,
      armor: def.armor,
      magicResist: def.magicResist,
      flying: def.flying,
      speed: def.speed,
      bounty: def.bounty,
      damage: def.damage,
      attackInterval: def.attackInterval,
      attackCd: def.attackInterval * 0.5,
      alive: true,
      held: false,
      blockId: null,
      slowUntil: 0,
      poisonDps: 0,
      poisonUntil: 0,
      poisonAcc: 0,
      healPerSec: def.healPerSec,
      healRadius: def.healRadius,
      boss: def.boss,
      addEvery: def.addEvery,
      addCount: def.addCount,
      addsLeft: def.addCap,
      addTimer: def.addEvery,
      tint: def.tint,
    };
    this.enemies.push(enemy);
    if (!this.seen.has(def.id)) {
      this.seen.add(def.id);
      this.push({ type: "new", enemyId: def.id });
    }
  }

  private refreshSoldiers(tower: TowerInst): void {
    const stats = barracksStats(tower.tier, tower.branch, this.bonuses);
    const existing = this.actors.filter((actor) => actor.ownerId === tower.id && actor.kind === "soldier");
    while (existing.length > stats.soldiers) {
      const removed = existing.pop()!;
      const index = this.actors.indexOf(removed);
      if (index >= 0) this.actors.splice(index, 1);
    }
    const normal = this.normalAt(tower.rx, tower.ry);
    while (existing.length < stats.soldiers) {
      const actor = this.blankActor("soldier", tower.id, stats.hp);
      existing.push(actor);
      this.actors.push(actor);
    }
    existing.forEach((actor, index) => {
      const offset = (index - (stats.soldiers - 1) / 2) * 16;
      actor.maxHp = stats.hp;
      actor.hp = actor.maxHp;
      actor.alive = true;
      actor.respawnLeft = 0;
      actor.armor = stats.armor;
      actor.dmgMin = stats.min;
      actor.dmgMax = stats.max;
      actor.interval = stats.interval;
      actor.respawn = stats.respawn;
      actor.regen = stats.regen;
      actor.throwRange = stats.throwRange;
      actor.aura = stats.aura;
      actor.rx = tower.rx;
      actor.ry = tower.ry;
      actor.ox = normal.x * offset;
      actor.oy = normal.y * offset;
      actor.x = actor.rx + actor.ox;
      actor.y = actor.ry + actor.oy;
      actor.leash = 140;
      actor.speed = 125;
    });
  }

  private ensureElemental(tower: TowerInst): void {
    if (this.actors.some((actor) => actor.ownerId === tower.id && actor.kind === "elemental")) {
      this.reposition(tower);
      return;
    }
    const actor = this.blankActor("elemental", tower.id, ELEMENTAL.hp);
    actor.armor = ELEMENTAL.armor;
    actor.dmgMin = ELEMENTAL.min;
    actor.dmgMax = ELEMENTAL.max;
    actor.interval = ELEMENTAL.interval;
    actor.respawn = ELEMENTAL.respawn;
    actor.regen = ELEMENTAL.regen;
    actor.leash = 130;
    actor.speed = 80;
    actor.rx = tower.rx;
    actor.ry = tower.ry;
    actor.x = tower.rx;
    actor.y = tower.ry;
    this.actors.push(actor);
  }

  private reposition(tower: TowerInst): void {
    const normal = this.normalAt(tower.rx, tower.ry);
    const owned = this.actors.filter((actor) => actor.ownerId === tower.id);
    owned.forEach((actor, index) => {
      const offset = (index - (owned.length - 1) / 2) * 16;
      actor.rx = tower.rx;
      actor.ry = tower.ry;
      actor.ox = normal.x * offset;
      actor.oy = normal.y * offset;
    });
  }

  private makeHero(): ActorInst {
    const hero = this.blankActor("hero", "hero", HERO.hp);
    hero.armor = HERO.armor;
    hero.dmgMin = HERO.min;
    hero.dmgMax = HERO.max;
    hero.interval = HERO.interval;
    hero.regen = HERO.regen;
    hero.speed = HERO.speed;
    hero.leash = 64;
    hero.x = this.level.heroStart.x;
    hero.y = this.level.heroStart.y;
    hero.rx = hero.x;
    hero.ry = hero.y;
    hero.destX = hero.x;
    hero.destY = hero.y;
    return hero;
  }

  private blankActor(kind: ActorInst["kind"], ownerId: string, hp: number): ActorInst {
    return {
      id: this.nid(kind.slice(0, 1)),
      kind,
      ownerId,
      x: 0,
      y: 0,
      rx: 0,
      ry: 0,
      ox: 0,
      oy: 0,
      hp,
      maxHp: hp,
      armor: 0,
      dmgMin: 1,
      dmgMax: 1,
      interval: 1,
      cooldown: 0.2,
      regen: 0,
      leash: 100,
      speed: 100,
      melee: 36,
      throwRange: 0,
      alive: true,
      respawn: 8,
      respawnLeft: 0,
      blockId: null,
      expires: null,
      aura: 0,
      down: 0,
      destX: 0,
      destY: 0,
      abilityCd: 0,
      level: 1,
      xp: 0,
      dmgBonus: 0,
    };
  }

  private holders(): ActorInst[] {
    const list = this.actors.filter((actor) => actor.alive);
    if (this.hero?.alive) {
      const gap = dist(this.hero, { x: this.hero.destX, y: this.hero.destY });
      if (gap <= 28) list.push(this.hero);
    }
    return list;
  }

  private bodies(): ActorInst[] {
    return this.hero ? [...this.actors, this.hero] : this.actors;
  }

  private downActor(actor: ActorInst): void {
    actor.alive = false;
    actor.hp = 0;
    actor.blockId = null;
    if (actor.kind === "hero") {
      actor.down = 10;
      actor.x = this.level.heroHome.x;
      actor.y = this.level.heroHome.y;
      return;
    }
    if (actor.kind === "reinforcement") return;
    actor.respawnLeft = actor.respawn;
  }

  private acquire(x: number, y: number, range: number, air: boolean): EnemyInst | null {
    let best: EnemyInst | null = null;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.flying && !air) continue;
      if (dist(enemy, { x, y }) > range) continue;
      if (!best || enemy.dist > best.dist) best = enemy;
    }
    return best;
  }

  private nearestEnemy(x: number, y: number, range: number, air: boolean): EnemyInst | null {
    let best: EnemyInst | null = null;
    let bestDist = range;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.flying && !air) continue;
      const gap = dist(enemy, { x, y });
      if (gap <= bestDist) {
        bestDist = gap;
        best = enemy;
      }
    }
    return best;
  }

  private nearestRoad(x: number, y: number): { point: { x: number; y: number }; gap: number } {
    let best = { point: { x, y }, gap: Infinity };
    for (const poly of this.polys.values()) {
      const closest = closestOnPoly(poly, x, y);
      if (closest.gap < best.gap) best = { point: closest.point, gap: closest.gap };
    }
    return best;
  }

  private normalAt(x: number, y: number): { x: number; y: number } {
    let bestGap = Infinity;
    let best = { x: 0, y: -1 };
    for (const poly of this.polys.values()) {
      const closest = closestOnPoly(poly, x, y);
      if (closest.gap < bestGap) {
        bestGap = closest.gap;
        best = normalAlong(poly, closest.along);
      }
    }
    return best;
  }

  private syncEnemy(enemy: EnemyInst): void {
    const poly = this.polys.get(enemy.pathId);
    if (!poly) return;
    const point = pointAlong(poly, enemy.dist);
    enemy.x = point.x;
    enemy.y = point.y;
  }

  private announcePowers(): void {
    if (!this.announced.reinforcement && this.level.reinforcementFromWave > 1 && this.reinforcementUnlocked()) {
      this.announced.reinforcement = true;
      this.push({ type: "unlock", power: "reinforcement" });
    }
    if (!this.announced.rain && this.level.rainFromWave > 1 && this.rainUnlocked()) {
      this.announced.rain = true;
      this.push({ type: "unlock", power: "rain" });
    }
  }

  private acceptsOrders(): boolean {
    return this.phase === "prep" || this.phase === "combat";
  }

  private push(notice: Notice): void {
    this.notices.push(notice);
    if (this.notices.length <= 120) return;
    const drop = this.notices.findIndex((entry) => entry.type === "float" || entry.type === "fire");
    if (drop >= 0) this.notices.splice(drop, 1);
    else this.notices.shift();
  }

  private nid(prefix: string): string {
    this.seq += 1;
    return `${prefix}${this.seq}`;
  }
}

function rangedCost(tower: TowerInst): number {
  if (tower.family === "barracks") return 0;
  return rangedStats(tower.family, (tower.tier + 1) as 2 | 3, null, {
    archerRange: 1,
    barracksHp: 1,
    mageDamage: 1,
    artillerySplash: 1,
    earlyGold: 1,
    reinforcementHp: 0,
    reinforcementDuration: 0,
  }).cost;
}

function moveToward(actor: { x: number; y: number; speed: number }, x: number, y: number, dt: number): void {
  const dx = x - actor.x;
  const dy = y - actor.y;
  const gap = Math.hypot(dx, dy);
  if (gap < 1) {
    actor.x = x;
    actor.y = y;
    return;
  }
  const step = actor.speed * dt;
  if (step >= gap) {
    actor.x = x;
    actor.y = y;
    return;
  }
  actor.x += (dx / gap) * step;
  actor.y += (dy / gap) * step;
}

function clampCoord(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function floatColor(type: DamageType): string {
  switch (type) {
    case "magic":
      return "#d7a6ff";
    case "explosive":
      return "#ffb15a";
    case "electric":
      return "#9fd7ff";
    case "poison":
      return "#9be07a";
    case "true":
      return "#ffe08a";
    default:
      return "#f4f0e6";
  }
}
