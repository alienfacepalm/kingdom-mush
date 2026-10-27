import Phaser from "phaser";
import {
  ENEMY_MAP,
  FAMILY_ORDER,
  FAMILY_SHORT,
  bonusesFrom,
  barracksStats,
  branchCost,
  buildCost,
  familyBlurb,
  familyTint,
  rangedLine,
  rangedStats,
  towerDisplayName,
} from "../content/catalog";
import { LEVELS, levelById } from "../content/levels";
import { applyClear, commitSave, loadSave } from "../content/save";
import type { Branch, Family } from "../content/types";
import { starsFor } from "../sim/combat";
import { buildPoly, closestOnPoly } from "../sim/geom";
import { mulberry32 } from "../sim/rng";
import { Sim, type TowerInst } from "../sim/Sim";
import { UI_FONT, familyKey, paintTextures, woodButton } from "./draw";
import { sfx } from "./sfx";

type Selection = { kind: "slot" | "tower" | "enemy" | "hero"; id: string };
type PlaceMode = "reinforcement" | "rain" | "rally" | null;

interface Bolt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  kind: string;
}

const SCENERY = {
  meadow: { sky: 0x8ec8ef, grass: 0x3f8f4a, dirt: 0xc2a15a, edge: 0x8d6a32, prop: 0x2f6e3a },
  fen: { sky: 0x8eb4c4, grass: 0x2f6a55, dirt: 0x8d9a62, edge: 0x4e5a32, prop: 0x1d4a3c },
  keep: { sky: 0x8b97a8, grass: 0x4a5560, dirt: 0x6b5a48, edge: 0x3a322c, prop: 0x2c333c },
};

export class BattleScene extends Phaser.Scene {
  private levelId = "dewcap";
  private sim!: Sim;
  private speed = 1;
  private paused = false;
  private ended = false;
  private saved = false;
  private selection: Selection | null = null;
  private place: PlaceMode = null;
  private selectKey = "";
  private selectLayer?: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Graphics;
  private bodies = new Map<string, Phaser.GameObjects.Image>();
  private bolts: Bolt[] = [];
  private floaters: { text: Phaser.GameObjects.Text; life: number }[] = [];
  private livesText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private cardText!: Phaser.GameObjects.Text;
  private cardBg!: Phaser.GameObjects.Rectangle;
  private cardLife = 0;
  private preview?: Phaser.GameObjects.Container;
  private previewBody?: Phaser.GameObjects.Text;
  private previewOpen = false;
  private skull = { x: 120, y: 120 };
  private lastLives = 20;
  private modal?: Phaser.GameObjects.Container;

  constructor() {
    super("battle");
  }

  init(data: { levelId?: string }): void {
    this.levelId = data.levelId ?? "dewcap";
  }

  create(): void {
    paintTextures(this);
    sfx.unlock();
    const level = levelById(this.levelId);
    const save = loadSave();
    this.sim = new Sim(level, bonusesFrom(save.bought), mulberry32((Date.now() ^ (level.index * 997)) >>> 0));
    this.lastLives = this.sim.lives;
    this.drawTerrain();
    this.overlay = this.add.graphics().setDepth(8);
    this.buildHud();
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.modal) return;
      if (over && over.length > 0) return;
      this.onWorld(pointer);
    });
    const keyboard = this.input.keyboard;
    keyboard?.on("keydown-SPACE", () => this.togglePause());
    keyboard?.on("keydown-F", () => this.toggleSpeed());
    keyboard?.on("keydown-ONE", () => this.arm("reinforcement"));
    keyboard?.on("keydown-TWO", () => this.arm("rain"));
    keyboard?.on("keydown-H", () => this.tryBurst());
    keyboard?.on("keydown-ESC", () => {
      if (this.place) this.place = null;
      else this.togglePause();
    });
    keyboard?.addCapture(["SPACE"]);
    this.toast(level.index === 1 ? "Build on the pads. Barracks hold the road." : level.briefing);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    if (!this.paused && !this.ended) this.sim.step(dt * this.speed);
    this.consumeNotices();
    this.syncBodies();
    this.drawOverlay(dt);
    this.syncHud();
    if (!this.ended && this.sim.phase === "victory") this.showEnd(true);
    if (!this.ended && this.sim.phase === "defeat") this.showEnd(false);
    if (this.livesText && this.sim.lives < this.lastLives) sfx.leak();
    this.lastLives = this.sim.lives;
  }

  private drawTerrain(): void {
    const level = this.sim.level;
    const tone = SCENERY[level.scenery];
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(tone.sky);
    g.fillRect(0, 0, 1280, 220);
    g.fillStyle(tone.grass);
    g.fillRect(0, 160, 1280, 560);
    const rng = mulberry32(level.index * 80 + 3);
    for (let i = 0; i < 36; i++) {
      const x = 30 + rng() * 1220;
      const y = 80 + rng() * 560;
      if (this.nearRoad(x, y, 72) || level.slots.some((slot) => Phaser.Math.Distance.Between(slot.x, slot.y, x, y) < 48)) continue;
      g.fillStyle(tone.prop, 0.9);
      g.fillCircle(x, y, 16 + rng() * 14);
      g.fillStyle(level.scenery === "keep" ? 0x6a5030 : 0xc45a4a, 0.95);
      g.fillEllipse(x, y - 16, 22, 12);
    }
    for (const path of level.paths) {
      g.lineStyle(46, tone.edge);
      this.strokePath(g, path.points);
      g.lineStyle(34, tone.dirt);
      this.strokePath(g, path.points);
      const end = path.points[path.points.length - 1];
      g.fillStyle(0xf4f0e6);
      g.fillRect(end.x - 18, end.y - 46, 6, 32);
      g.fillRect(end.x + 12, end.y - 46, 6, 32);
      g.fillStyle(0xc0392b);
      g.fillTriangle(end.x - 18, end.y - 46, end.x - 2, end.y - 40, end.x - 18, end.y - 32);
      g.fillTriangle(end.x + 12, end.y - 46, end.x + 28, end.y - 40, end.x + 12, end.y - 32);
      this.add.text(end.x, end.y + 28, "HOLD", { fontFamily: UI_FONT, fontSize: "14px", color: "#f4f0e6" }).setOrigin(0.5).setDepth(2);
    }
    for (const slot of level.slots) {
      this.add.image(slot.x, slot.y, "pad").setDepth(1);
    }
    const start = level.paths[0].points[0];
    this.skull = {
      x: Phaser.Math.Clamp(start.x - 72, 64, 1180),
      y: Phaser.Math.Clamp(start.y - 16, 88, 590),
    };
  }

  private strokePath(g: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]): void {
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.strokePath();
  }

  private nearRoad(x: number, y: number, radius: number): boolean {
    for (const path of this.sim.level.paths) {
      if (closestOnPoly(buildPoly(path.points), x, y).gap < radius) return true;
    }
    return false;
  }

  private buildHud(): void {
    const bar = this.add.graphics().setDepth(14);
    bar.fillStyle(0x1c2430, 0.94);
    bar.fillRect(0, 0, 1280, 52);
    bar.fillRect(0, 656, 1280, 64);
    this.livesText = this.add.text(24, 14, "", { fontFamily: UI_FONT, fontSize: "22px", color: "#ff8d8d" }).setDepth(15);
    this.goldText = this.add.text(170, 14, "", { fontFamily: UI_FONT, fontSize: "22px", color: "#f2c14e" }).setDepth(15);
    this.waveText = this.add.text(360, 14, "", { fontFamily: UI_FONT, fontSize: "22px", color: "#f4f0e6" }).setDepth(15);
    this.infoTitle = this.add.text(24, 668, "", { fontFamily: "Georgia, serif", fontSize: "20px", color: "#f2c14e" }).setDepth(15);
    this.infoBody = this.add.text(24, 694, "", { fontFamily: UI_FONT, fontSize: "15px", color: "#f4f0e6" }).setDepth(15);
    this.toastText = this.add.text(640, 78, "", { fontFamily: UI_FONT, fontSize: "18px", color: "#fff6d8", backgroundColor: "#1c2430", padding: { x: 10, y: 6 } }).setOrigin(0.5, 0).setDepth(18).setAlpha(0);
    this.bannerText = this.add.text(640, 120, "", { fontFamily: "Georgia, serif", fontSize: "28px", color: "#f2c14e" }).setOrigin(0.5).setDepth(18).setAlpha(0);
    this.cardBg = this.add.rectangle(250, 210, 340, 150, 0x1c2430, 0.95).setStrokeStyle(3, 0xe0b15a).setDepth(18).setVisible(false);
    this.cardText = this.add.text(100, 150, "", { fontFamily: UI_FONT, fontSize: "16px", color: "#f4f0e6", wordWrap: { width: 300 } }).setDepth(19).setVisible(false);

    const pause = woodButton(this, 1080, 26, 90, 34, "Pause", () => this.togglePause(), 16);
    const speed = woodButton(this, 1190, 26, 70, 34, "1x", () => this.toggleSpeed(), 16);
    this.speedButton = speed;
    void pause;

    const rein = this.add.rectangle(54, 590, 76, 64, 0x3a2a1a).setStrokeStyle(3, 0xe0b15a).setInteractive({ useHandCursor: true }).setDepth(15);
    const rain = this.add.rectangle(146, 590, 76, 64, 0x3a2a1a).setStrokeStyle(3, 0x8c2f3b).setInteractive({ useHandCursor: true }).setDepth(15);
    this.reinLabel = this.add.text(54, 590, "Aid\n1", { fontFamily: UI_FONT, fontSize: "14px", color: "#f4f0e6", align: "center" }).setOrigin(0.5).setDepth(16);
    this.rainLabel = this.add.text(146, 590, "Rain\n2", { fontFamily: UI_FONT, fontSize: "14px", color: "#f4f0e6", align: "center" }).setOrigin(0.5).setDepth(16);
    rein.on("pointerdown", () => this.arm("reinforcement"));
    rain.on("pointerdown", () => this.arm("rain"));

    const skull = this.add.circle(this.skull.x, this.skull.y, 28, 0x1c2430).setStrokeStyle(3, 0xe0b15a).setInteractive({ useHandCursor: true }).setDepth(15);
    this.add.text(this.skull.x, this.skull.y, "Wave", { fontFamily: UI_FONT, fontSize: "13px", color: "#f4f0e6" }).setOrigin(0.5).setDepth(16);
    skull.on("pointerdown", () => {
      this.previewOpen = !this.previewOpen;
      this.preview?.setVisible(this.previewOpen);
    });
    this.preview = this.add.container(this.skull.x + 150, this.skull.y).setDepth(17).setVisible(false);
    const bg = this.add.rectangle(0, 0, 240, 150, 0x1c2430, 0.96).setStrokeStyle(3, 0xe0b15a);
    this.previewBody = this.add.text(-100, -60, "", { fontFamily: UI_FONT, fontSize: "14px", color: "#f4f0e6", wordWrap: { width: 210 } });
    const call = woodButton(this, 0, 50, 150, 36, "Call", () => this.callWave(), 18);
    this.preview.add([bg, this.previewBody, call]);
  }

  private speedButton!: Phaser.GameObjects.Container;
  private reinLabel!: Phaser.GameObjects.Text;
  private rainLabel!: Phaser.GameObjects.Text;

  private onWorld(pointer: Phaser.Input.Pointer): void {
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (y < 56 || y > 650) return;
    if (pointer.rightButtonDown()) {
      this.place = null;
      if (this.sim.hero) this.sim.moveHero(x, y);
      this.selection = null;
      return;
    }
    if (this.place === "rain") {
      if (!this.sim.castRain(x, y)) this.toast("Spore Rain is not ready.");
      else sfx.shot("true");
      this.place = null;
      return;
    }
    if (this.place === "reinforcement") {
      if (!this.sim.castReinforcement(x, y)) this.toast("Drop aid on the road.");
      else sfx.ui();
      this.place = null;
      return;
    }
    if (this.place === "rally" && this.selection?.kind === "tower") {
      if (!this.sim.setRally(this.selection.id, x, y)) this.toast("Rally on the road, near the barracks.");
      else sfx.ui();
      this.place = null;
      return;
    }
    this.selection = this.pick(x, y);
    if (this.selection?.kind === "hero") sfx.ui();
  }

  private pick(x: number, y: number): Selection | null {
    const hits: { sel: Selection; d: number }[] = [];
    const consider = (sx: number, sy: number, radius: number, sel: Selection) => {
      const d = Phaser.Math.Distance.Between(x, y, sx, sy);
      if (d <= radius) hits.push({ sel, d });
    };
    for (const enemy of this.sim.enemies) {
      consider(enemy.x, enemy.y - (enemy.flying ? 26 : 0), enemy.boss ? 30 : 20, { kind: "enemy", id: enemy.id });
    }
    if (this.sim.hero?.alive) consider(this.sim.hero.x, this.sim.hero.y, 22, { kind: "hero", id: "hero" });
    for (const tower of this.sim.towers) consider(tower.x, tower.y, 32, { kind: "tower", id: tower.id });
    for (const slot of this.sim.level.slots) {
      if (this.sim.towerAt(slot.id)) continue;
      consider(slot.x, slot.y, 30, { kind: "slot", id: slot.id });
    }
    hits.sort((a, b) => a.d - b.d);
    return hits[0]?.sel ?? null;
  }

  private syncBodies(): void {
    const seen = new Set<string>();
    for (const enemy of this.sim.enemies) {
      seen.add(enemy.id);
      const sprite = this.sprite(enemy.id, `foe-${enemy.defId}`, 4);
      const bob = enemy.flying ? -26 : 0;
      sprite.setPosition(enemy.x, enemy.y + bob);
      sprite.setScale(enemy.boss ? 1.2 : 1);
      sprite.setVisible(true);
    }
    for (const actor of this.sim.actors) {
      seen.add(actor.id);
      const sprite = this.sprite(actor.id, this.unitTexture(actor.kind, actor.ownerId), actor.kind === "elemental" ? 5 : 3);
      sprite.setPosition(actor.x, actor.y);
      sprite.setVisible(actor.alive);
      sprite.setAlpha(actor.kind === "reinforcement" ? 0.95 : 1);
    }
    if (this.sim.hero) {
      const hero = this.sim.hero;
      seen.add(hero.id);
      const sprite = this.sprite(hero.id, "unit-hero", 6);
      sprite.setPosition(hero.x, hero.y);
      sprite.setVisible(hero.alive);
    }
    for (const tower of this.sim.towers) {
      seen.add(tower.id);
      const sprite = this.sprite(tower.id, familyKey(tower.family), 2);
      sprite.setPosition(tower.x, tower.y - 6);
      sprite.setScale(1 + (tower.tier - 1) * 0.04);
    }
    for (const [id, sprite] of this.bodies) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.bodies.delete(id);
      }
    }
  }

  private sprite(id: string, key: string, depth: number): Phaser.GameObjects.Image {
    let sprite = this.bodies.get(id);
    if (!sprite) {
      sprite = this.add.image(0, 0, key).setDepth(depth);
      this.bodies.set(id, sprite);
    } else if (sprite.texture.key !== key && this.textures.exists(key)) {
      sprite.setTexture(key);
    }
    return sprite;
  }

  private unitTexture(kind: string, ownerId: string): string {
    if (kind === "elemental") return "unit-elemental";
    if (kind === "reinforcement") return "unit-reinforcement";
    const tower = this.sim.towers.find((entry) => entry.id === ownerId);
    if (tower?.branch === "a") return "unit-paladin";
    if (tower?.branch === "b" && tower.family === "barracks") return "unit-axe";
    return "unit-soldier";
  }

  private drawOverlay(dt: number): void {
    const g = this.overlay;
    g.clear();
    const selectedTower = this.selection?.kind === "tower" ? this.sim.towers.find((tower) => tower.id === this.selection?.id) : undefined;
    if (selectedTower && selectedTower.family !== "barracks") {
      const stats = rangedStats(selectedTower.family as "archer" | "mage" | "artillery", selectedTower.tier, selectedTower.branch, this.sim.bonuses);
      g.lineStyle(2, familyTint(selectedTower.family), 0.8);
      g.strokeCircle(selectedTower.x, selectedTower.y, stats.range);
    }
    if (this.place === "rally" && selectedTower) {
      g.lineStyle(2, 0x6aa6e0, 0.9);
      g.strokeCircle(selectedTower.x, selectedTower.y, 175);
    }
    for (const enemy of this.sim.enemies) {
      const y = enemy.y - (enemy.flying ? 40 : 16) - (enemy.boss ? 18 : 0);
      g.fillStyle(0x1c2430, 0.8);
      g.fillRect(enemy.x - 16, y, 32, 5);
      g.fillStyle(enemy.boss ? 0xc0392b : 0x9be07a, 1);
      g.fillRect(enemy.x - 16, y, 32 * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
    }
    for (const actor of [...this.sim.actors, ...(this.sim.hero ? [this.sim.hero] : [])]) {
      if (!actor.alive) continue;
      g.fillStyle(0x1c2430, 0.7);
      g.fillRect(actor.x - 12, actor.y - 22, 24, 4);
      g.fillStyle(0x6aa6e0, 1);
      g.fillRect(actor.x - 12, actor.y - 22, 24 * Phaser.Math.Clamp(actor.hp / actor.maxHp, 0, 1), 4);
    }
    this.bolts = this.bolts.filter((bolt) => {
      bolt.life -= dt;
      if (bolt.life <= 0) return false;
      const t = 1 - bolt.life / 0.18;
      g.lineStyle(2, boltColor(bolt.kind), 0.9);
      g.lineBetween(bolt.x1, bolt.y1, Phaser.Math.Linear(bolt.x1, bolt.x2, t), Phaser.Math.Linear(bolt.y1, bolt.y2, t));
      return true;
    });
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.text.y -= 18 * dt;
      floater.text.setAlpha(Phaser.Math.Clamp(floater.life / 0.6, 0, 1));
    }
    this.floaters = this.floaters.filter((floater) => {
      if (floater.life > 0) return true;
      floater.text.destroy();
      return false;
    });
    if (this.cardLife > 0) {
      this.cardLife -= dt;
      if (this.cardLife <= 0) {
        this.cardBg.setVisible(false);
        this.cardText.setVisible(false);
      }
    }
  }

  private syncHud(): void {
    const sim = this.sim;
    this.livesText.setText(`Lives  ${sim.lives}`);
    this.goldText.setText(`Gold  ${sim.gold}`);
    const shown = sim.waveStarted === 0 ? 0 : sim.waveStarted;
    this.waveText.setText(`Wave  ${shown} / ${sim.level.waves.length}`);
    this.reinLabel.setText(this.powerLabel("Aid", sim.reinforcementUnlocked(), sim.reinCd, sim.level.reinforcementFromWave));
    this.rainLabel.setText(this.powerLabel("Rain", sim.rainUnlocked(), sim.rainCd, sim.level.rainFromWave));
    const speedLabel = this.speedButton.list[1];
    if (speedLabel instanceof Phaser.GameObjects.Text) speedLabel.setText(this.speed === 1 ? "1x" : "2x");
    this.writeInfo();
    this.refreshSelection();
    if (this.previewOpen && this.previewBody) {
      const groups = sim.upcomingGroups();
      if (!groups) this.previewBody.setText(sim.waveStarted >= sim.level.waves.length ? "No further waves." : "The wave is already on the road.");
      else {
        const lines = groups.map((group) => {
          const name = ENEMY_MAP[group.enemyId]?.name ?? group.enemyId;
          return `${group.pathName}: ${name} ×${group.count}`;
        });
        const bonus = sim.canCall() && sim.waveStarted > 0 ? `\nCall now  +${sim.earlyBonus()} gold` : sim.canCall() ? "\nCall the first wave" : "";
        this.previewBody.setText(lines.join("\n") + bonus);
      }
    }
  }

  private powerLabel(name: string, unlocked: boolean, cd: number, fromWave: number): string {
    if (!unlocked) return `${name}\nwave ${fromWave}`;
    if (cd > 0.05) return `${name}\n${Math.ceil(cd)}s`;
    return `${name}\nready`;
  }

  private writeInfo(): void {
    const sel = this.selection;
    if (!sel) {
      this.infoTitle.setText(this.place ? "Choose a spot" : "Capkeep");
      this.infoBody.setText(this.place === "rally" ? "Click the road near this barracks." : "Select a pad, tower, or foe. Right-click moves the warden.");
      return;
    }
    if (sel.kind === "slot") {
      this.infoTitle.setText("Empty pad");
      this.infoBody.setText("Choose a tower. Grey gold means you cannot afford it yet.");
      return;
    }
    if (sel.kind === "hero" && this.sim.hero) {
      const hero = this.sim.hero;
      this.infoTitle.setText(`Warden Puff  ·  level ${hero.level}`);
      this.infoBody.setText(`${Math.ceil(hero.hp)} / ${hero.maxHp}  ·  burst ${hero.abilityCd > 0 ? Math.ceil(hero.abilityCd) + "s" : "ready"}  ·  H or the button`);
      return;
    }
    if (sel.kind === "enemy") {
      const enemy = this.sim.enemyById(sel.id);
      if (!enemy) {
        this.selection = null;
        return;
      }
      this.infoTitle.setText(enemy.name);
      const fly = enemy.flying ? "flying" : "ground";
      this.infoBody.setText(`${Math.ceil(enemy.hp)}/${enemy.maxHp}  ·  armor ${Math.round(enemy.armor * 100)}%  ·  magic resist ${Math.round(enemy.magicResist * 100)}%  ·  ${fly}`);
      return;
    }
    const tower = this.sim.towers.find((entry) => entry.id === sel.id);
    if (!tower) {
      this.selection = null;
      return;
    }
    this.infoTitle.setText(towerDisplayName(tower.family, tower.tier, tower.branch));
    if (tower.family === "barracks") {
      const stats = barracksStats(tower.tier, tower.branch, this.sim.bonuses);
      this.infoBody.setText(`${stats.soldiers} soldiers  ·  ${stats.min}-${stats.max} dmg  ·  armor ${Math.round(stats.armor * 100)}%  ·  respawn ${stats.respawn}s`);
    } else {
      const stats = rangedStats(tower.family, tower.tier, tower.branch, this.sim.bonuses);
      const air = stats.air ? "hits air" : "ground aim";
      this.infoBody.setText(`${stats.min}-${stats.max} ${stats.damageType}  ·  ${stats.interval.toFixed(2)}s  ·  range ${stats.range}  ·  ${air}`);
    }
  }

  private refreshSelection(): void {
    const tower = this.selection?.kind === "tower" ? this.sim.towers.find((entry) => entry.id === this.selection?.id) : undefined;
    const key = `${this.selection?.kind ?? ""}:${this.selection?.id ?? ""}:${tower?.tier ?? 0}:${tower?.branch ?? ""}:${this.sim.gold}:${this.place ?? ""}`;
    if (key === this.selectKey) return;
    this.selectKey = key;
    this.selectLayer?.destroy(true);
    this.selectLayer = this.add.container(0, 0).setDepth(16);
    if (!this.selection) return;
    if (this.selection.kind === "slot") this.buildRadial(this.selection.id);
    if (this.selection.kind === "tower" && tower) this.buildTowerActions(tower);
    if (this.selection.kind === "hero") {
      const burst = woodButton(this, 1100, 692, 180, 40, "Spore burst", () => this.tryBurst(), 17);
      this.selectLayer.add(burst);
    }
  }

  private buildRadial(slotId: string): void {
    const slot = this.sim.level.slots.find((entry) => entry.id === slotId);
    if (!slot || !this.selectLayer) return;
    const flip = slot.y < 190 ? 1 : -1;
    const offsets = [
      { x: -84, y: 28 * flip },
      { x: -30, y: 78 * flip },
      { x: 30, y: 78 * flip },
      { x: 84, y: 28 * flip },
    ];
    FAMILY_ORDER.forEach((family, index) => {
      const cost = buildCost(family);
      const offset = offsets[index];
      const x = Phaser.Math.Clamp(slot.x + offset.x, 40, 1240);
      const y = Phaser.Math.Clamp(slot.y + offset.y, 70, 630);
      const bg = this.add.circle(x, y, 30, familyTint(family)).setStrokeStyle(3, 0x1c2430).setInteractive({ useHandCursor: true });
      bg.setAlpha(this.sim.gold >= cost ? 1 : 0.45);
      const label = this.add.text(x, y - 6, FAMILY_SHORT[family], { fontFamily: UI_FONT, fontSize: "13px", color: "#1c2430" }).setOrigin(0.5);
      const price = this.add.text(x, y + 10, String(cost), { fontFamily: UI_FONT, fontSize: "12px", color: "#1c2430" }).setOrigin(0.5);
      bg.on("pointerdown", () => this.tryBuild(slotId, family));
      bg.on("pointerover", () => this.infoBody.setText(familyBlurb(family)));
      this.selectLayer?.add([bg, label, price]);
    });
  }

  private buildTowerActions(tower: TowerInst): void {
    if (!this.selectLayer) return;
    const refund = Math.floor(tower.spent * this.sim.refundRate());
    const sell = woodButton(this, 1160, 692, 150, 40, `Sell ${refund}`, () => {
      this.sim.sell(tower.id);
      this.selection = null;
      sfx.ui();
    }, 17);
    this.selectLayer.add(sell);
    const rallyable = tower.family === "barracks" || (tower.family === "mage" && tower.branch === "b");
    if (rallyable) {
      const rally = woodButton(this, 860, 692, 120, 40, "Rally", () => {
        this.place = "rally";
        this.toast("Click the road near the troops.");
      }, 17);
      this.selectLayer.add(rally);
    }
    if (tower.tier < 3 && tower.tier < this.sim.level.maxTier) {
      const next = tower.family === "barracks" ? barracksStats((tower.tier + 1) as 2 | 3, null, this.sim.bonuses) : rangedStats(tower.family, (tower.tier + 1) as 2 | 3, null, this.sim.bonuses);
      const upgrade = woodButton(this, 1000, 692, 170, 40, `Up ${next.cost}`, () => this.tryUpgrade(tower.id), 17);
      this.selectLayer.add(upgrade);
      return;
    }
    if (tower.tier === 3 && this.sim.level.maxTier >= 4 && !tower.branch) {
      const line = tower.family === "barracks" ? null : rangedLine(tower.family);
      const aName = tower.family === "barracks" ? "Paladin" : line?.branchA.name.split(" ")[0] ?? "A";
      const bName = tower.family === "barracks" ? "Axes" : line?.branchB.name.split(" ")[0] ?? "B";
      const a = woodButton(this, 760, 692, 150, 40, `${aName} ${branchCost(tower.family, "a")}`, () => this.tryUpgrade(tower.id, "a"), 17);
      const b = woodButton(this, 980, 692, 150, 40, `${bName} ${branchCost(tower.family, "b")}`, () => this.tryUpgrade(tower.id, "b"), 17);
      this.selectLayer.add([a, b]);
    }
  }

  private tryBuild(slotId: string, family: Family): void {
    if (!this.sim.build(slotId, family)) this.toast(`Need ${buildCost(family)} gold.`);
    else {
      sfx.ui();
      this.selection = null;
    }
  }

  private tryUpgrade(towerId: string, branch?: Branch): void {
    const tower = this.sim.towers.find((entry) => entry.id === towerId);
    if (!tower) return;
    const cost = branch ? branchCost(tower.family, branch) : tower.family === "barracks" ? barracksStats((tower.tier + 1) as 2 | 3, null, this.sim.bonuses).cost : rangedStats(tower.family as "archer" | "mage" | "artillery", (tower.tier + 1) as 2 | 3, null, this.sim.bonuses).cost;
    if (!this.sim.upgrade(towerId, branch)) this.toast(`Need ${cost} gold.`);
    else sfx.ui();
  }

  private arm(power: "reinforcement" | "rain"): void {
    if (this.modal) return;
    const unlocked = power === "rain" ? this.sim.rainUnlocked() : this.sim.reinforcementUnlocked();
    if (!unlocked) {
      this.toast("That power arrives on a later wave.");
      return;
    }
    this.place = this.place === power ? null : power;
    this.toast(power === "rain" ? "Click the crowd." : "Click the road.");
  }

  private tryBurst(): void {
    if (!this.sim.hero) {
      this.toast("The warden joins after Dewcap Road.");
      return;
    }
    if (!this.sim.castHeroBurst()) this.toast("Burst only fires with a foe in reach.");
    else sfx.shot("true");
  }

  private callWave(): void {
    if (!this.sim.canCall()) {
      this.toast("Wait for this wave to finish leaving the gate.");
      return;
    }
    const bonus = this.sim.callWave();
    sfx.ui();
    if (bonus > 0) this.toast(`Early call +${bonus} gold`);
    this.previewOpen = false;
    this.preview?.setVisible(false);
  }

  private consumeNotices(): void {
    for (const notice of this.sim.drain()) {
      if (notice.type === "fire") {
        this.bolts.push({ x1: notice.x1, y1: notice.y1, x2: notice.x2, y2: notice.y2, life: 0.18, kind: notice.kind });
        sfx.shot(notice.kind);
      } else if (notice.type === "float" && this.floaters.length < 24) {
        const text = this.add.text(notice.x, notice.y, notice.text, { fontFamily: UI_FONT, fontSize: "14px", color: notice.color }).setOrigin(0.5).setDepth(9);
        this.floaters.push({ text, life: 0.7 });
      } else if (notice.type === "new") {
        const foe = ENEMY_MAP[notice.enemyId];
        if (!foe) continue;
        const tags = [
          foe.flying ? "Flying" : "Ground",
          foe.armor > 0 ? `Armor ${Math.round(foe.armor * 100)}%` : "",
          foe.magicResist > 0.2 ? `Resists magic ${Math.round(foe.magicResist * 100)}%` : "",
        ].filter(Boolean);
        this.cardText.setText(`New foe: ${foe.name}\n${foe.blurb}\n${tags.join("  ·  ")}`);
        this.cardBg.setVisible(true);
        this.cardText.setVisible(true);
        this.cardLife = 7;
      } else if (notice.type === "wave") {
        this.bannerText.setText(`Wave ${notice.index}`);
        this.bannerText.setAlpha(1);
        this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 700, duration: 500 });
        if (this.sim.level.id === "dewcap" && notice.index === 3) this.toast("Reinforcements are free. Press 1, then click the road.");
        if (this.sim.level.id === "dewcap" && notice.index === 6) this.toast("Spore Rain is true damage. Press 2 and drop it on a crowd.");
      } else if (notice.type === "unlock") {
        this.toast(notice.power === "rain" ? "Spore Rain unlocked." : "Reinforcements unlocked.");
      } else if (notice.type === "boom") {
        this.bolts.push({ x1: notice.x, y1: notice.y, x2: notice.x, y2: notice.y, life: 0.18, kind: "explosive" });
      }
    }
  }

  private toast(message: string): void {
    this.toastText.setText(message);
    this.toastText.setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2400, duration: 400 });
  }

  private togglePause(): void {
    if (this.ended) return;
    if (this.modal) {
      this.modal.destroy(true);
      this.modal = undefined;
      this.paused = false;
      return;
    }
    this.paused = true;
    const panel = this.add.container(640, 360).setDepth(30);
    const bg = this.add.rectangle(0, 0, 420, 280, 0x1c2430, 0.96).setStrokeStyle(4, 0xe0b15a);
    const title = this.add.text(0, -90, "Paused", { fontFamily: "Georgia, serif", fontSize: "36px", color: "#f2c14e" }).setOrigin(0.5);
    const resume = woodButton(this, 0, -20, 200, 46, "Resume", () => this.togglePause(), 31);
    const retry = woodButton(this, 0, 40, 200, 46, "Retry", () => this.scene.restart({ levelId: this.levelId }), 31);
    const map = woodButton(this, 0, 100, 200, 46, "Map", () => this.scene.start("map"), 31);
    panel.add([bg, title, resume, retry, map]);
    this.modal = panel;
  }

  private toggleSpeed(): void {
    if (this.modal) return;
    this.speed = this.speed === 1 ? 2 : 1;
  }

  private showEnd(victory: boolean): void {
    this.ended = true;
    const stars = starsFor(this.sim.lives, victory);
    if (victory && !this.saved) {
      this.saved = true;
      commitSave(applyClear(loadSave(), this.sim.level.id, stars));
      sfx.win();
    }
    const panel = this.add.container(640, 360).setDepth(30);
    const bg = this.add.rectangle(0, 0, 520, 320, 0x1c2430, 0.97).setStrokeStyle(4, 0xe0b15a);
    const title = this.add.text(0, -110, victory ? "The road holds" : "The road is lost", {
      fontFamily: "Georgia, serif",
      fontSize: "32px",
      color: victory ? "#f2c14e" : "#ff8d8d",
    }).setOrigin(0.5);
    const detail = this.add.text(0, -50, victory ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}    ${this.sim.lives} lives left` : "The march reached the hold.", {
      fontFamily: UI_FONT,
      fontSize: "18px",
      color: "#f4f0e6",
    }).setOrigin(0.5);
    const nextLevel = LEVELS.find((level) => level.index === this.sim.level.index + 1);
    const buttons: Phaser.GameObjects.GameObject[] = [bg, title, detail];
    buttons.push(woodButton(this, victory && nextLevel ? -120 : 0, 40, 160, 46, "Retry", () => this.scene.restart({ levelId: this.levelId }), 31));
    buttons.push(woodButton(this, victory && nextLevel ? 80 : 0, 110, 160, 46, "Map", () => this.scene.start("map"), 31));
    if (victory && nextLevel) {
      buttons.push(woodButton(this, 100, 40, 180, 46, "Next march", () => this.scene.start("battle", { levelId: nextLevel.id }), 31));
    }
    if (victory && this.sim.level.id === "dewcap") {
      const note = this.add.text(0, 160, "Warden Puff will march with you.", { fontFamily: UI_FONT, fontSize: "16px", color: "#e0b15a" }).setOrigin(0.5);
      buttons.push(note);
    }
    panel.add(buttons);
    this.modal = panel;
  }
}

function boltColor(kind: string): number {
  if (kind === "magic") return 0xd7a6ff;
  if (kind === "explosive") return 0xffb15a;
  if (kind === "electric") return 0x9fd7ff;
  if (kind === "poison") return 0x9be07a;
  if (kind === "true") return 0xffe08a;
  return 0xf4f0e6;
}
