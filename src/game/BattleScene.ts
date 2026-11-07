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
import { applyClear, commitSave, loadSave, setAutoWaves } from "../content/save";
import { launchMarch, type DifficultyId, type LaunchedMarch, type ModeId } from "../content/variants";
import type { Branch, Family } from "../content/types";
import { starsFor } from "../sim/combat";
import { mulberry32 } from "../sim/rng";
import { Sim, type TowerInst } from "../sim/Sim";
import {
  ATLAS,
  CREAM,
  DISPLAY_FONT,
  GOLD,
  INK,
  INK_SOFT,
  type Panel,
  UI_FONT,
  art,
  familyIcon,
  familyKey,
  hasFrame,
  iconButton,
  paintTextures,
  parchment,
  pick,
  plank,
  towerFrame,
  woodButton,
} from "./draw";
import { sfx } from "./sfx";

type Selection = { kind: "slot" | "tower" | "enemy" | "hero"; id: string };
type PlaceMode = "reinforcement" | "rain" | "rally" | null;

interface Shot {
  img: Phaser.GameObjects.Image;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  dur: number;
  kind: string;
  arc: number;
  spin: number;
}

interface Body {
  img: Phaser.GameObjects.Image;
  kind: "enemy" | "actor" | "hero" | "tower";
  x: number;
  y: number;
  facing: number;
  seed: number;
}

const SCENERY = {
  meadow: { sky: 0x8ec8ef, grass: 0x3f8f4a, dirt: 0xc2a15a, edge: 0x8d6a32 },
  fen: { sky: 0x8eb4c4, grass: 0x2f6a55, dirt: 0x8d9a62, edge: 0x4e5a32 },
  keep: { sky: 0x8b97a8, grass: 0x4a5560, dirt: 0x6b5a48, edge: 0x3a322c },
};

const FOE_FRAME: Record<string, string> = {
  sprout: "sprout",
  runner: "runner",
  beetle: "beetle",
  shade: "shade",
  gnat: "gnat",
  brute: "brute",
  shaman: "shaman",
  rotking: "rotking",
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
  private bodies = new Map<string, Body>();
  private shots: Shot[] = [];
  private floaters: { text: Phaser.GameObjects.Text; life: number }[] = [];
  private livesText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private cardText!: Phaser.GameObjects.Text;
  private cardBg!: Panel;
  private cardLife = 0;
  private preview?: Phaser.GameObjects.Container;
  private previewBody?: Phaser.GameObjects.Text;
  private previewOpen = false;
  private skull = { x: 120, y: 120 };
  private skullButton?: Phaser.GameObjects.Image;
  private lastLives = 20;
  private modal?: Phaser.GameObjects.Container;
  private clock = 0;
  private speedButton?: Phaser.GameObjects.Image;
  private reinLabel!: Phaser.GameObjects.Text;
  private rainLabel!: Phaser.GameObjects.Text;
  private burstLabel?: Phaser.GameObjects.Text;
  private reinSlot!: Phaser.GameObjects.Image;
  private rainSlot!: Phaser.GameObjects.Image;
  private countdownText?: Phaser.GameObjects.Text;
  private autoLabel?: Phaser.GameObjects.Text;
  private previewCacheKey = "";
  private sparks?: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private ghostAt = new Map<string, number>();
  private bossIds = new Set<string>();
  private ghostsActive = 0;
  private zoomPunching = false;

  constructor() {
    super("battle");
  }

  private launchData: { levelId: string; modeId: ModeId; difficultyId: DifficultyId; heroId: string } = {
    levelId: "dewcap",
    modeId: "campaign",
    difficultyId: "normal",
    heroId: "puff",
  };
  private launched?: LaunchedMarch;

  init(data: { levelId?: string; modeId?: ModeId; difficultyId?: DifficultyId; heroId?: string }): void {
    this.levelId = data.levelId ?? "dewcap";
    this.launchData = {
      levelId: this.levelId,
      modeId: data.modeId ?? "campaign",
      difficultyId: data.difficultyId ?? "normal",
      heroId: data.heroId ?? "puff",
    };
  }

  create(): void {
    paintTextures(this);
    sfx.unlock();
    this.bodies.clear();
    this.shots = [];
    this.floaters = [];
    this.selection = null;
    this.place = null;
    this.selectKey = "";
    this.selectLayer = undefined;
    this.modal = undefined;
    this.paused = false;
    this.ended = false;
    this.saved = false;
    this.speed = 1;
    this.previewOpen = false;
    this.clock = 0;
    const baseLevel = levelById(this.levelId);
    const save = loadSave();
    const launched = launchMarch(baseLevel, this.launchData.modeId, this.launchData.difficultyId, this.launchData.heroId || save.heroId);
    this.launched = launched;
    const level = launched.level;
    this.sim = new Sim(level, bonusesFrom(save.bought), mulberry32((Date.now() ^ (level.index * 997)) >>> 0), launched.enemyDefs, launched.hero, launched.hero.id);
    const auto = launched.mode.forceManual ? false : save.autoWaves;
    this.sim.setAutoWaves(auto);
    if (auto) this.sim.armPrep();
    this.lastLives = this.sim.lives;
    this.drawTerrain();
    this.overlay = this.add.graphics().setDepth(1.5);
    this.buildHud();
    this.buildFx();
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.modal) return;
      if (over && over.length > 0) return;
      this.onWorld(pointer);
    });
    const keyboard = this.input.keyboard;
    keyboard?.removeAllListeners();
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
    const variantNote = `${launched.mode.name} · ${launched.difficulty.name}${level.hero ? ` · ${launched.hero.name}` : ""}`;
    if (this.sim.autoWaves) {
      this.toast(`${variantNote} — wave 1 in ${Sim.PREP_SECONDS}s. Pause freezes the clock.`);
    } else {
      this.toast(`${variantNote} — build, then call the first wave.`);
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    if (!this.paused && !this.ended) {
      this.sim.step(dt * this.speed);
      this.clock += dt * this.speed;
    }
    this.consumeNotices();
    this.syncBodies();
    this.drawOverlay(dt);
    this.syncHud();
    if (!this.ended && this.sim.phase === "victory") this.showEnd(true);
    if (!this.ended && this.sim.phase === "defeat") this.showEnd(false);
    if (this.livesText && this.sim.lives < this.lastLives) {
      sfx.leak();
      this.triggerJuiceImpact(1);
      this.cameras.main.flash(110, 170, 26, 26);
      const points = this.sim.level.paths[0]?.points;
      const gate = points?.[points.length - 1];
      if (gate) this.sparks?.explode(22, gate.x, gate.y - 10);
    }
    this.lastLives = this.sim.lives;
  }

  // ---------------------------------------------------------------- terrain

  private drawTerrain(): void {
    const level = this.sim.level;
    const bgKey = `bg-${level.id}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(640, 360, bgKey).setDepth(0);
    } else {
      this.drawFallbackTerrain();
    }
    if (!this.textures.exists(bgKey)) {
      // The paintings already include the hold flags; only the fallback terrain needs them.
      for (const path of level.paths) {
        const end = path.points[path.points.length - 1];
        art(this, end.x, end.y + 4, "flags", "pad").setOrigin(0.5, 0.92).setDepth(this.depthAt(end.y));
      }
    }
    for (const slot of level.slots) {
      art(this, slot.x, slot.y, "pad", "pad").setDepth(1);
    }
    // Prefer an authored call spot; otherwise plant the sign on the dirt just inside the gate
    // (offsetting above the road often lands on painted bushes).
    if (level.callSpot) {
      this.skull = { x: level.callSpot.x, y: level.callSpot.y };
    } else {
      const start = level.paths[0].points[0];
      const next = level.paths[0].points[1] ?? start;
      this.skull = {
        x: Phaser.Math.Clamp(start.x + (next.x - start.x) * 0.08 + 48, 70, 1180),
        y: Phaser.Math.Clamp(start.y + (next.y - start.y) * 0.08 + 10, 100, 600),
      };
    }
  }

  private drawFallbackTerrain(): void {
    const level = this.sim.level;
    const tone = SCENERY[level.scenery];
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(tone.sky);
    g.fillRect(0, 0, 1280, 220);
    g.fillStyle(tone.grass);
    g.fillRect(0, 160, 1280, 560);
    for (const path of level.paths) {
      g.lineStyle(46, tone.edge);
      this.strokePath(g, path.points);
      g.lineStyle(34, tone.dirt);
      this.strokePath(g, path.points);
    }
  }

  private strokePath(g: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]): void {
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.strokePath();
  }

  private depthAt(y: number): number {
    return 2 + Phaser.Math.Clamp(y, 0, 720) / 1000;
  }

  // -------------------------------------------------------------------- HUD

  private buildHud(): void {
    plank(this, -4, -4, 1288, 56).setDepth(14);
    plank(this, -4, 656, 1288, 70).setDepth(14);

    art(this, 34, 26, "ic-heart", "dot").setDisplaySize(34, 34).setDepth(15);
    this.livesText = this.add.text(58, 13, "", { fontFamily: DISPLAY_FONT, fontSize: "22px", color: "#ff9d9d" }).setDepth(15);
    art(this, 176, 26, "ic-gold", "dot").setDisplaySize(34, 34).setDepth(15);
    this.goldText = this.add.text(200, 13, "", { fontFamily: DISPLAY_FONT, fontSize: "22px", color: GOLD }).setDepth(15);
    art(this, 340, 26, "ic-skull", "dot").setDisplaySize(34, 34).setDepth(15);
    this.waveText = this.add.text(364, 13, "", { fontFamily: DISPLAY_FONT, fontSize: "22px", color: CREAM }).setDepth(15);
    const titleSuffix = this.launched && (this.launched.mode.id !== "campaign" || this.launched.difficulty.id !== "normal")
      ? ` · ${this.launched.mode.name} ${this.launched.difficulty.name}`
      : "";
    this.add.text(640, 26, `${this.sim.level.name}${titleSuffix}`, { fontFamily: DISPLAY_FONT, fontSize: "20px", color: "#d9c08a" }).setOrigin(0.5).setDepth(15);

    this.infoTitle = this.add.text(24, 664, "", { fontFamily: DISPLAY_FONT, fontSize: "20px", color: GOLD }).setDepth(15);
    this.infoBody = this.add.text(24, 692, "", { fontFamily: UI_FONT, fontSize: "15px", color: CREAM }).setDepth(15);
    this.toastText = this.add.text(640, 78, "", {
      fontFamily: UI_FONT,
      fontSize: "18px",
      color: CREAM,
      backgroundColor: "#2a1a10",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0).setDepth(18).setAlpha(0);
    this.bannerText = this.add.text(640, 130, "", {
      fontFamily: DISPLAY_FONT,
      fontSize: "40px",
      color: GOLD,
      stroke: "#2a1a10",
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(18).setAlpha(0);

    const card = parchment(this, 250, 215, 360, 160).setDepth(18);
    card.setVisible(false);
    this.cardBg = card;
    this.cardText = this.add.text(100, 160, "", { fontFamily: UI_FONT, fontSize: "16px", color: INK, wordWrap: { width: 300 } }).setDepth(19).setVisible(false);

    iconButton(this, 1096, 26, 42, "btn-pause", () => this.togglePause(), 15);
    this.speedButton = iconButton(this, 1156, 26, 42, "btn-fast", () => this.toggleSpeed(), 15);
    iconButton(this, 1226, 26, 42, "btn-x", () => this.confirmQuit(), 15);

    this.reinSlot = this.slotButton(54, 586, "slot-aid", () => this.arm("reinforcement"));
    this.rainSlot = this.slotButton(142, 586, "slot-rain", () => this.arm("rain"));
    this.reinLabel = this.slotLabel(54, 630);
    this.rainLabel = this.slotLabel(142, 630);
    if (this.sim.hero) {
      this.slotButton(230, 586, "slot-burst", () => this.tryBurst());
      this.burstLabel = this.slotLabel(230, 630);
    }

    const source = pick(this, "spawn-sign", "pad");
    this.skullButton = this.add.image(this.skull.x, this.skull.y, source.key, source.frame).setDepth(15).setInteractive({ useHandCursor: true });
    this.skullButton.setDisplaySize(72, 72);
    this.skullButton.on("pointerdown", (pointer: Phaser.Input.Pointer, lx: number, ly: number, event: Phaser.Types.Input.EventData) => {
      void lx;
      void ly;
      event.stopPropagation();
      // Placement modes need the road/crowd under the sign; don't eat those clicks.
      if (this.place) {
        this.onWorld(pointer);
        return;
      }
      this.previewOpen = !this.previewOpen;
      this.preview?.setVisible(this.previewOpen);
    });
    this.countdownText = this.add.text(this.skull.x, this.skull.y + 48, "", {
      fontFamily: DISPLAY_FONT,
      fontSize: "22px",
      color: GOLD,
      stroke: "#2a1a10",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(16);
    const px = Phaser.Math.Clamp(this.skull.x + 170, 150, 1130);
    const py = Phaser.Math.Clamp(this.skull.y + 10, 150, 560);
    this.preview = this.add.container(px, py).setDepth(17).setVisible(false);
    const bg = parchment(this, 0, 0, 270, 210);
    this.previewBody = this.add.text(-112, -86, "", { fontFamily: UI_FONT, fontSize: "15px", color: INK, wordWrap: { width: 230 } });
    const call = woodButton(this, 0, 48, 160, 40, "Call wave", () => this.callWave(), 18);
    this.preview.add([bg, this.previewBody, call]);

    this.autoLabel = this.add.text(980, 14, "", { fontFamily: UI_FONT, fontSize: "14px", color: CREAM }).setDepth(15).setInteractive({ useHandCursor: true });
    this.autoLabel.on("pointerdown", (pointer: Phaser.Input.Pointer, lx: number, ly: number, event: Phaser.Types.Input.EventData) => {
      void pointer;
      void lx;
      void ly;
      event.stopPropagation();
      this.toggleAuto();
    });
    this.refreshAutoLabel();
  }

  private toggleAuto(): void {
    const next = !this.sim.autoWaves;
    this.sim.setAutoWaves(next);
    commitSave(setAutoWaves(loadSave(), next));
    this.refreshAutoLabel();
    sfx.ui();
    this.toast(next ? "Auto march on — waves call themselves." : "Manual — call each wave yourself.");
  }

  private refreshAutoLabel(): void {
    this.autoLabel?.setText(this.sim.autoWaves ? "Auto on" : "Manual");
    this.autoLabel?.setColor(this.sim.autoWaves ? GOLD : CREAM);
  }

  private slotButton(x: number, y: number, frame: string, onClick: () => void): Phaser.GameObjects.Image {
    const source = pick(this, frame, "pad");
    const img = this.add.image(x, y, source.key, source.frame).setDepth(15).setInteractive({ useHandCursor: true });
    img.setDisplaySize(68, 68);
    img.on("pointerdown", (pointer: Phaser.Input.Pointer, lx: number, ly: number, event: Phaser.Types.Input.EventData) => {
      void pointer;
      void lx;
      void ly;
      event.stopPropagation();
      onClick();
    });
    return img;
  }

  private slotLabel(x: number, y: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, "", {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: CREAM,
      backgroundColor: "#2a1a10",
      padding: { x: 6, y: 2 },
      align: "center",
    }).setOrigin(0.5).setDepth(16);
  }

  // ------------------------------------------------------------------ input

  private onWorld(pointer: Phaser.Input.Pointer): void {
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (y < 56 || y > 650) return;
    if (pointer.rightButtonDown()) {
      this.place = null;
      if (this.sim.hero) {
        this.sim.moveHero(x, y);
        this.ping(x, y);
      }
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
      else {
        sfx.ui();
        this.ping(x, y);
      }
      this.place = null;
      return;
    }
    this.selection = this.pick(x, y);
    if (this.selection?.kind === "hero") sfx.ui();
  }

  private ping(x: number, y: number): void {
    const source = pick(this, "ring", "dot");
    const ring = this.add.image(x, y, source.key, source.frame).setDepth(1.6).setScale(0.3).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: 0.9, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
  }

  private pick(x: number, y: number): Selection | null {
    const hits: { sel: Selection; d: number }[] = [];
    const consider = (sx: number, sy: number, radius: number, sel: Selection) => {
      const d = Phaser.Math.Distance.Between(x, y, sx, sy);
      if (d <= radius) hits.push({ sel, d });
    };
    for (const enemy of this.sim.enemies) {
      consider(enemy.x, enemy.y - (enemy.flying ? 26 : 12), enemy.boss ? 40 : 24, { kind: "enemy", id: enemy.id });
    }
    if (this.sim.hero?.alive) consider(this.sim.hero.x, this.sim.hero.y - 14, 26, { kind: "hero", id: "hero" });
    for (const tower of this.sim.towers) consider(tower.x, tower.y - 24, 44, { kind: "tower", id: tower.id });
    for (const slot of this.sim.level.slots) {
      if (this.sim.towerAt(slot.id)) continue;
      consider(slot.x, slot.y, 34, { kind: "slot", id: slot.id });
    }
    hits.sort((a, b) => a.d - b.d);
    return hits[0]?.sel ?? null;
  }

  // ----------------------------------------------------------------- bodies

  private syncBodies(): void {
    const seen = new Set<string>();
    const t = this.clock;
    for (const enemy of this.sim.enemies) {
      seen.add(enemy.id);
      const body = this.body(enemy.id, "enemy", FOE_FRAME[enemy.defId] ?? "sprout", `foe-${enemy.defId}`);
      const img = body.img;
      const phase = t * (enemy.flying ? 14 : 9) + body.seed;
      const dx = enemy.x - body.x;
      const dy = enemy.y - body.y;
      const moved = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const wasFacing = body.facing;
      // Angle-quantized facing: flip on horizontal intent, hold facing on steep verticals.
      if (Math.abs(Math.cos(angle)) > 0.45) {
        if (dx < -0.2) body.facing = -1;
        else if (dx > 0.2) body.facing = 1;
      }
      const moving = moved > 0.05;
      body.x = enemy.x;
      body.y = enemy.y;
      if (enemy.boss) this.bossIds.add(enemy.id);
      const hover = enemy.flying ? -28 + Math.sin(phase) * 4 : 0;
      const hop = !enemy.flying && moving ? Math.abs(Math.sin(phase)) * 3 : 0;
      img.setOrigin(0.5, enemy.flying ? 0.6 : 0.92);
      img.setPosition(enemy.x, enemy.y + 6 + hover - hop);
      const squash = moving && !enemy.flying ? 1 + Math.sin(phase * 2) * 0.04 : 1;
      img.setScale(body.facing, squash);
      img.setDepth(this.depthAt(enemy.y) + (enemy.flying ? 0.6 : 0));
      img.setVisible(true);
      img.setTint(enemy.poisonUntil > this.sim.time ? 0xa8ff8a : 0xffffff);
      if (body.facing !== wasFacing && moving) this.dust?.explode(3, enemy.x, enemy.y + 5);
      this.maybeGhost(enemy.id, body, moved, 1.35);
    }
    for (const actor of this.sim.actors) {
      seen.add(actor.id);
      const [frame, fallback] = this.unitFrame(actor.kind, actor.ownerId);
      const body = this.body(actor.id, "actor", frame, fallback);
      const img = body.img;
      const adx = actor.x - body.x;
      const ady = actor.y - body.y;
      const aMoved = Math.hypot(adx, ady);
      const aAngle = Math.atan2(ady, adx);
      const aWasFacing = body.facing;
      if (Math.abs(Math.cos(aAngle)) > 0.45) {
        if (adx > 0.2) body.facing = -1;
        else if (adx < -0.2) body.facing = 1;
      }
      const moving = aMoved > 0.05;
      body.x = actor.x;
      body.y = actor.y;
      const phase = t * 10 + body.seed;
      const fighting = actor.blockId !== null;
      const hop = moving ? Math.abs(Math.sin(phase)) * 3 : 0;
      const lunge = fighting ? Math.max(0, Math.sin(phase * 0.8)) * 3 : 0;
      img.setOrigin(0.5, 0.92);
      img.setPosition(actor.x + lunge * -body.facing, actor.y + 6 - hop);
      img.setScale(body.facing, 1);
      img.setDepth(this.depthAt(actor.y));
      img.setVisible(actor.alive);
      img.setAlpha(actor.kind === "reinforcement" ? 0.96 : 1);
      if (body.facing !== aWasFacing && moving) this.dust?.explode(3, actor.x, actor.y + 5);
      this.maybeGhost(actor.id, body, aMoved, 1.6);
    }
    if (this.sim.hero) {
      const hero = this.sim.hero;
      seen.add(hero.id);
      const body = this.body(hero.id, "hero", "hero", "unit-hero");
      const img = body.img;
      const hdx = hero.x - body.x;
      const hdy = hero.y - body.y;
      const hMoved = Math.hypot(hdx, hdy);
      const hAngle = Math.atan2(hdy, hdx);
      const hWasFacing = body.facing;
      if (Math.abs(Math.cos(hAngle)) > 0.45) {
        if (hdx > 0.2) body.facing = -1;
        else if (hdx < -0.2) body.facing = 1;
      }
      const moving = hMoved > 0.05;
      body.x = hero.x;
      body.y = hero.y;
      const hop = moving ? Math.abs(Math.sin(t * 11 + body.seed)) * 4 : 0;
      img.setOrigin(0.5, 0.92);
      img.setPosition(hero.x, hero.y + 6 - hop);
      // One painted warden, three reads: tint + bulk per chosen hero.
      const heroTint = this.sim.heroId === "bramble" ? 0xb8e6a0 : this.sim.heroId === "sable" ? 0xaac8ff : 0xffffff;
      const heroScale = this.sim.heroId === "bramble" ? 1.12 : this.sim.heroId === "sable" ? 0.92 : 1;
      img.setTint(heroTint);
      img.setScale(body.facing * heroScale, heroScale);
      img.setDepth(this.depthAt(hero.y) + 0.05);
      img.setVisible(hero.alive);
      if (hero.alive && body.facing !== hWasFacing && moving) this.dust?.explode(4, hero.x, hero.y + 5);
      if (hero.alive) this.maybeGhost(hero.id, body, hMoved, 1.1);
    }
    for (const tower of this.sim.towers) {
      seen.add(tower.id);
      const body = this.body(tower.id, "tower", towerFrame(tower.family, tower.tier, tower.branch), familyKey(tower.family));
      const img = body.img;
      img.setOrigin(0.5, 0.86);
      img.setPosition(tower.x, tower.y + 12);
      const recoil = tower.cooldown > 0 && tower.family !== "barracks" ? Math.max(0, 1 - tower.cooldown * 6) : 0;
      img.setScale(1 + recoil * 0.06, 1 - recoil * 0.06);
      img.setDepth(this.depthAt(tower.y));
      body.x = tower.x;
      body.y = tower.y;
    }
    for (const [id, body] of this.bodies) {
      if (seen.has(id)) continue;
      if (body.kind === "enemy") {
        this.puff(body.x, body.y - 10, "puff", 0.6);
        const wasBoss = this.bossIds.has(id);
        this.sparks?.explode(wasBoss ? 42 : 7, body.x, body.y - 8);
        if (wasBoss) this.triggerJuiceImpact(1);
      }
      this.ghostAt.delete(id);
      this.bossIds.delete(id);
      body.img.destroy();
      this.bodies.delete(id);
    }
  }

  private body(id: string, kind: Body["kind"], frame: string, fallback: string): Body {
    let body = this.bodies.get(id);
    const source = pick(this, frame, fallback);
    if (!body) {
      const img = this.add.image(0, 0, source.key, source.frame);
      body = { img, kind, x: 0, y: 0, facing: 1, seed: Math.random() * Math.PI * 2 };
      this.bodies.set(id, body);
      if (kind !== "tower") {
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: 220 });
      } else {
        img.setScale(0.6);
        this.tweens.add({ targets: img, scale: 1, duration: 260, ease: "Back.easeOut" });
        this.puff(0, 0, "puff", 0);
      }
    } else if (source.key === ATLAS ? body.img.frame.name !== frame : body.img.texture.key !== source.key) {
      body.img.setTexture(source.key, source.frame);
      if (kind === "tower") {
        this.puff(body.x, body.y - 20, "sparkle", 0.9);
        this.tweens.add({ targets: body.img, scaleX: { from: 1.15, to: 1 }, scaleY: { from: 0.85, to: 1 }, duration: 300, ease: "Back.easeOut" });
      }
    }
    return body;
  }

  private unitFrame(kind: string, ownerId: string): [string, string] {
    if (kind === "elemental") return ["elemental", "unit-soldier"];
    if (kind === "reinforcement") return ["reinforcement", "unit-soldier"];
    const tower = this.sim.towers.find((entry) => entry.id === ownerId);
    if (tower?.branch === "a") return ["paladin", "unit-soldier"];
    if (tower?.branch === "b" && tower.family === "barracks") return ["axe", "unit-soldier"];
    return [`soldier${Math.min(3, tower?.tier ?? 1)}`, "unit-soldier"];
  }

  // ------------------------------------------------------------- chaos fx

  private buildFx(): void {
    if (!this.textures.exists("fx-dot")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 7);
      g.generateTexture("fx-dot", 16, 16);
      g.destroy();
    }
    this.sparks = this.add.particles(0, 0, "fx-dot", {
      speed: { min: 40, max: 260 },
      lifespan: { min: 180, max: 480 },
      scale: { start: 0.55, end: 0 },
      tint: [0xffe9a0, 0xffb056, 0xfff6d8, 0x9be8ff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(9);
    this.dust = this.add.particles(0, 0, "fx-dot", {
      speed: { min: 10, max: 55 },
      lifespan: { min: 280, max: 620 },
      scale: { start: 0.45, end: 1.1 },
      alpha: { start: 0.45, end: 0 },
      tint: [0xd8c49a, 0xb59a6a, 0x8a6f4d],
      gravityY: -16,
      emitting: false,
    }).setDepth(8.5);
    this.ghostAt.clear();
    this.bossIds.clear();
    this.ghostsActive = 0;
    this.zoomPunching = false;
  }

  /** Violent camera juice: shake scaled by intensity, plus a zoom punch for big hits. */
  private triggerJuiceImpact(intensity: number): void {
    const cam = this.cameras.main;
    cam.shake(150, Math.min(0.02, 0.02 * intensity));
    if (intensity < 0.5 || this.zoomPunching) return;
    this.zoomPunching = true;
    cam.zoomTo(1.08, 60, "Power2", true);
    this.time.delayedCall(75, () => {
      cam.zoomTo(1, 200, "Power2", true, (_cam, progress) => {
        if (progress === 1) this.zoomPunching = false;
      });
    });
  }

  /** Decaying neon ghost clone of a fast mover (ADD blend, 250ms fade + swell). */
  private ghostTrail(body: Body): void {
    if (this.ghostsActive >= 36) return;
    const src = body.img;
    this.ghostsActive += 1;
    const ghost = this.add.image(src.x, src.y, src.texture.key, src.frame.name)
      .setOrigin(src.originX, src.originY)
      .setScale(src.scaleX, src.scaleY)
      .setDepth(src.depth - 0.02)
      .setTint(0x00ffff)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: src.scaleX * 1.18,
      scaleY: src.scaleY * 1.18,
      duration: 250,
      ease: "Cubic.easeOut",
      onComplete: () => { ghost.destroy(); this.ghostsActive -= 1; },
    });
  }

  private maybeGhost(id: string, body: Body, moved: number, minMove: number): void {
    if (moved < minMove) return;
    if (this.clock - (this.ghostAt.get(id) ?? -9) < 0.08) return;
    this.ghostAt.set(id, this.clock);
    this.ghostTrail(body);
  }

  private puff(x: number, y: number, frame: string, scale: number): void {
    if (scale <= 0 || !hasFrame(this, frame)) return;
    const img = this.add.image(x, y, ATLAS, frame).setDepth(this.depthAt(y) + 0.7).setScale(scale * 0.5).setAlpha(0.95);
    this.tweens.add({ targets: img, scale: scale, alpha: 0, y: y - 14, duration: 520, ease: "Cubic.easeOut", onComplete: () => img.destroy() });
  }

  private burst(x: number, y: number, radius: number): void {
    const frame = radius > 60 ? "boom-l" : "boom-s";
    if (!hasFrame(this, frame)) return;
    const img = this.add.image(x, y, ATLAS, frame).setDepth(this.depthAt(y) + 0.75);
    const target = (radius * 2.2) / img.width;
    img.setScale(target * 0.4).setAlpha(1);
    this.tweens.add({ targets: img, scale: target, alpha: 0, duration: 380, ease: "Cubic.easeOut", onComplete: () => img.destroy() });
    this.cameras.main.shake(radius > 60 ? 140 : 70, radius > 60 ? 0.004 : 0.0015);
  }

  // ---------------------------------------------------------------- overlay

  private drawOverlay(dt: number): void {
    const g = this.overlay;
    g.clear();
    for (const enemy of this.sim.enemies) {
      const r = enemy.boss ? 22 : 13;
      g.fillStyle(0x000000, enemy.flying ? 0.14 : 0.24);
      g.fillEllipse(enemy.x, enemy.y + 6, r * 2, r * 0.8);
    }
    for (const actor of this.sim.actors) {
      if (!actor.alive) continue;
      g.fillStyle(0x000000, 0.22);
      g.fillEllipse(actor.x, actor.y + 6, 22, 9);
    }
    if (this.sim.hero?.alive) {
      g.fillStyle(0x000000, 0.24);
      g.fillEllipse(this.sim.hero.x, this.sim.hero.y + 6, 28, 11);
    }
    const selectedTower = this.selection?.kind === "tower" ? this.sim.towers.find((tower) => tower.id === this.selection?.id) : undefined;
    if (selectedTower && selectedTower.family !== "barracks") {
      const stats = rangedStats(selectedTower.family as "archer" | "mage" | "artillery", selectedTower.tier, selectedTower.branch, this.sim.bonuses);
      g.fillStyle(familyTint(selectedTower.family), 0.12);
      g.fillCircle(selectedTower.x, selectedTower.y, stats.range);
      g.lineStyle(2, familyTint(selectedTower.family), 0.85);
      g.strokeCircle(selectedTower.x, selectedTower.y, stats.range);
    }
    if (this.place === "rally" && selectedTower) {
      g.lineStyle(2, 0x6aa6e0, 0.9);
      g.strokeCircle(selectedTower.x, selectedTower.y, 175);
    }
    if (this.selection?.kind === "slot") {
      const slot = this.sim.level.slots.find((entry) => entry.id === this.selection?.id);
      if (slot) {
        g.lineStyle(3, 0xf2c14e, 0.9);
        g.strokeEllipse(slot.x, slot.y, 92, 62);
      }
    }
    // HP bars: derive the sprite top from y/height/origin instead of getBounds()
    // (which forces a full world-transform pass per body, per frame).
    const spriteTop = (id: string, fallbackY: number): number => {
      const img = this.bodies.get(id)?.img;
      return img ? img.y - img.displayHeight * img.originY : fallbackY;
    };
    for (const enemy of this.sim.enemies) {
      if (enemy.hp >= enemy.maxHp) continue;
      const y = spriteTop(enemy.id, enemy.y - 30) - 7;
      const w = enemy.boss ? 44 : 30;
      g.fillStyle(0x2a1a10, 0.85);
      g.fillRect(enemy.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle(enemy.boss ? 0xc0392b : 0x9be07a, 1);
      g.fillRect(enemy.x - w / 2, y, w * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1), 4);
    }
    const actorBar = (actor: { id: string; x: number; y: number; alive: boolean; hp: number; maxHp: number }) => {
      if (!actor.alive || actor.hp >= actor.maxHp) return;
      const top = spriteTop(actor.id, actor.y - 26);
      g.fillStyle(0x2a1a10, 0.8);
      g.fillRect(actor.x - 13, top - 7, 26, 5);
      g.fillStyle(0x6aa6e0, 1);
      g.fillRect(actor.x - 12, top - 6, 24 * Phaser.Math.Clamp(actor.hp / actor.maxHp, 0, 1), 3);
    };
    for (const actor of this.sim.actors) actorBar(actor);
    if (this.sim.hero) actorBar(this.sim.hero);
    this.overlay.setDepth(1.5);

    this.shots = this.shots.filter((shot) => {
      shot.t += dt * this.speed;
      const k = Math.min(1, shot.t / shot.dur);
      const x = Phaser.Math.Linear(shot.x1, shot.x2, k);
      const y = Phaser.Math.Linear(shot.y1, shot.y2, k) - Math.sin(k * Math.PI) * shot.arc;
      shot.img.setPosition(x, y);
      if (shot.spin) shot.img.rotation += shot.spin * dt;
      shot.img.setDepth(this.depthAt(shot.y2) + 0.65);
      if (k >= 1) {
        shot.img.destroy();
        if (shot.kind === "explosive") this.burst(shot.x2, shot.y2, 40);
        else if (shot.kind === "magic") this.puff(shot.x2, shot.y2 - 10, "ring", 0.5);
        else if (shot.kind === "poison") this.puff(shot.x2, shot.y2 - 10, "poison-cloud", 0.5);
        else if (shot.kind === "electric") this.puff(shot.x2, shot.y2 - 10, "sparkle", 0.5);
        return false;
      }
      return true;
    });

    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.text.y -= 22 * dt;
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
    if (this.skullButton) {
      const ready = this.sim.canCall() && !this.ended;
      const pulse = ready ? 1 + Math.sin(this.time.now / 180) * 0.06 : 1;
      this.skullButton.setDisplaySize(72 * pulse, 72 * pulse);
      this.skullButton.setAlpha(ready ? 1 : 0.7);
    }
  }

  private launch(x1: number, y1: number, x2: number, y2: number, kind: string): void {
    const frame = kind === "magic" ? "bolt" : kind === "explosive" ? "bomb" : kind === "electric" ? "spark" : kind === "poison" ? "poison" : kind === "true" ? "sparkle" : "arrow";
    const source = pick(this, frame, "dot");
    const img = this.add.image(x1, y1, source.key, source.frame).setDepth(7);
    const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    let dur = 0.22;
    let arc = 0;
    let spin = 0;
    if (frame === "arrow") {
      img.setScale(0.6).setRotation(angle + 0.58);
      dur = 0.16 + dist / 1400;
    } else if (frame === "bolt") {
      img.setScale(0.7).setRotation(angle);
      dur = 0.18 + dist / 1200;
    } else if (frame === "bomb") {
      img.setScale(0.7);
      dur = 0.45 + dist / 700;
      arc = 40 + dist * 0.25;
      spin = 4;
    } else if (frame === "spark") {
      img.setScale(0.6).setRotation(angle + 0.8);
      dur = 0.08;
    } else if (frame === "poison") {
      img.setScale(0.6);
      dur = 0.3;
      arc = 24;
    } else {
      img.setScale(0.5);
      dur = 0.15;
    }
    this.shots.push({ img, x1, y1, x2, y2, t: 0, dur, kind, arc, spin });
  }

  // -------------------------------------------------------------------- hud

  private syncHud(): void {
    const sim = this.sim;
    this.livesText.setText(String(sim.lives));
    this.goldText.setText(String(sim.gold));
    const shown = sim.waveStarted === 0 ? 0 : sim.waveStarted;
    this.waveText.setText(`${shown} / ${sim.level.waves.length}`);
    this.reinLabel.setText(this.powerLabel("Aid", sim.reinforcementUnlocked(), sim.reinCd, sim.level.reinforcementFromWave));
    this.rainLabel.setText(this.powerLabel("Rain", sim.rainUnlocked(), sim.rainCd, sim.level.rainFromWave));
    this.reinSlot.setAlpha(sim.reinforcementUnlocked() && sim.reinCd <= 0.05 ? 1 : 0.55);
    this.rainSlot.setAlpha(sim.rainUnlocked() && sim.rainCd <= 0.05 ? 1 : 0.55);
    if (this.burstLabel && sim.hero) {
      this.burstLabel.setText(sim.hero.abilityCd > 0.05 ? `Burst  ${Math.ceil(sim.hero.abilityCd)}s` : "Burst  H");
    }
    this.speedButton?.setTint(this.speed === 2 ? 0xfff0a0 : 0xffffff);
    if (this.countdownText) {
      if (sim.countingDown && sim.canCall() && sim.nextWaveIn > 0) {
        const secs = Math.max(0, Math.ceil(sim.nextWaveIn));
        this.countdownText.setText(this.paused ? `Paused ${secs}` : String(secs));
        this.countdownText.setVisible(true);
      } else if (sim.canCall() && sim.waveStarted > 0 && (!sim.countingDown || sim.nextWaveIn <= 0) && !sim.autoWaves) {
        this.countdownText.setText("Call");
        this.countdownText.setVisible(true);
      } else {
        this.countdownText.setVisible(false);
      }
    }
    this.writeInfo();
    this.refreshSelection();
    if (this.previewOpen && this.previewBody) {
      // Only rebuild the preview text when something it shows actually changed.
      const cacheKey = `${sim.waveStarted}:${sim.enemies.length}:${Math.ceil(sim.nextWaveIn)}:${sim.autoWaves}:${sim.gold}`;
      if (cacheKey === this.previewCacheKey) return;
      this.previewCacheKey = cacheKey;
      const groups = sim.upcomingGroups();
      if (!groups) this.previewBody.setText(sim.waveStarted >= sim.level.waves.length ? "No further waves." : "The wave is already on the road.");
      else {
        const lines = groups.map((group) => {
          const name = ENEMY_MAP[group.enemyId]?.name ?? group.enemyId;
          return `${group.pathName}: ${name} ×${group.count}`;
        });
        let tip = "";
        if (sim.canCall() && sim.countingDown && sim.nextWaveIn > 0) {
          tip = sim.autoWaves
            ? `\nAuto in ${Math.ceil(sim.nextWaveIn)}s  ·  Call early +${sim.earlyBonus()} gold`
            : `\nReady in ${Math.ceil(sim.nextWaveIn)}s  ·  Call for +${sim.earlyBonus()} gold`;
        } else if (sim.canCall() && sim.waveStarted === 0) tip = "\nCall the first wave";
        else if (sim.canCall()) tip = "\nCall when ready";
        this.previewBody.setText(`Wave ${sim.waveStarted + 1}\n` + lines.join("\n") + tip);
      }
    }
  }

  private powerLabel(name: string, unlocked: boolean, cd: number, fromWave: number): string {
    if (!unlocked) return `${name}  wave ${fromWave}`;
    if (cd > 0.05) return `${name}  ${Math.ceil(cd)}s`;
    return `${name}  ${name === "Aid" ? "1" : "2"}`;
  }

  private writeInfo(): void {
    const sel = this.selection;
    if (!sel) {
      this.infoTitle.setText(this.place ? "Choose a spot" : "Capkeep");
      if (this.place === "rally") this.infoBody.setText("Click the road near this barracks.");
      else if (this.sim.countingDown && this.sim.canCall() && this.sim.nextWaveIn > 0) {
        this.infoBody.setText(
          this.paused
            ? `Paused — wave ${this.sim.waveStarted + 1} waits. Resume to keep the clock running.`
            : `Wave ${this.sim.waveStarted + 1} in ${Math.ceil(this.sim.nextWaveIn)}s. Call early for bonus gold.`,
        );
      } else if (this.sim.canCall() && this.sim.waveStarted === 0) {
        this.infoBody.setText("Call the first wave when you are ready.");
      } else if (this.sim.canCall()) {
        this.infoBody.setText(`Call wave ${this.sim.waveStarted + 1} when you are ready.`);
      } else this.infoBody.setText("Select a pad, tower, or foe. Right-click moves the warden.");
      return;
    }
    if (sel.kind === "slot") {
      this.infoTitle.setText("Empty pad");
      this.infoBody.setText("Choose a tower. Faded icons cost more than you have.");
      return;
    }
    if (sel.kind === "hero" && this.sim.hero) {
      const hero = this.sim.hero;
      this.infoTitle.setText(`${this.sim.heroDef.name}  ·  level ${hero.level}`);
      this.infoBody.setText(`${Math.ceil(hero.hp)} / ${hero.maxHp}  ·  burst ${hero.abilityCd > 0 ? Math.ceil(hero.abilityCd) + "s" : "ready"}  ·  H or the slot`);
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
  }

  private buildRadial(slotId: string): void {
    const slot = this.sim.level.slots.find((entry) => entry.id === slotId);
    if (!slot || !this.selectLayer) return;
    // Fan the four icons in an arc that opens away from the nearest screen edge.
    let centre = slot.y < 210 ? 90 : -90;
    if (slot.x < 160) centre = slot.y < 210 ? 45 : -45;
    else if (slot.x > 1120) centre = slot.y < 210 ? 135 : -135;
    const radius = 88;
    FAMILY_ORDER.forEach((family, index) => {
      const cost = buildCost(family);
      const angle = Phaser.Math.DegToRad(centre - 66 + index * 44);
      const x = Phaser.Math.Clamp(slot.x + Math.cos(angle) * radius, 44, 1236);
      const y = Phaser.Math.Clamp(slot.y + Math.sin(angle) * radius, 76, 600);
      const affordable = this.sim.gold >= cost;
      const source = pick(this, familyIcon(family), "pad");
      const icon = this.add.image(x, y, source.key, source.frame).setInteractive({ useHandCursor: true });
      icon.setDisplaySize(58, 58);
      if (source.key !== ATLAS) icon.setTint(familyTint(family));
      icon.setAlpha(affordable ? 1 : 0.45);
      const price = this.add.text(x, y + 36, String(cost), {
        fontFamily: UI_FONT,
        fontSize: "13px",
        color: affordable ? GOLD : "#d9b0a0",
        backgroundColor: "#2a1a10",
        padding: { x: 5, y: 1 },
      }).setOrigin(0.5);
      const label = source.key === ATLAS ? undefined : this.add.text(x, y, FAMILY_SHORT[family], { fontFamily: UI_FONT, fontSize: "12px", color: INK }).setOrigin(0.5);
      icon.on("pointerdown", (pointer: Phaser.Input.Pointer, lx: number, ly: number, event: Phaser.Types.Input.EventData) => {
        void pointer;
        void lx;
        void ly;
        event.stopPropagation();
        this.tryBuild(slotId, family);
      });
      icon.on("pointerover", () => {
        icon.setDisplaySize(64, 64);
        this.infoBody.setText(familyBlurb(family));
      });
      icon.on("pointerout", () => icon.setDisplaySize(58, 58));
      this.selectLayer?.add(label ? [icon, label, price] : [icon, price]);
    });
  }

  private buildTowerActions(tower: TowerInst): void {
    if (!this.selectLayer) return;
    const refund = Math.floor(tower.spent * this.sim.refundRate());
    const sell = woodButton(this, 1170, 690, 150, 42, `Sell ${refund}`, () => {
      this.sim.sell(tower.id);
      this.selection = null;
      sfx.ui();
    }, 17);
    this.selectLayer.add(sell);
    const rallyable = tower.family === "barracks" || (tower.family === "mage" && tower.branch === "b");
    if (rallyable) {
      const rally = woodButton(this, 850, 690, 120, 42, "Rally", () => {
        this.place = "rally";
        this.toast("Click the road near the troops.");
      }, 17);
      this.selectLayer.add(rally);
    }
    if (tower.tier < 3 && tower.tier < this.sim.level.maxTier) {
      const next = tower.family === "barracks" ? barracksStats((tower.tier + 1) as 2 | 3, null, this.sim.bonuses) : rangedStats(tower.family, (tower.tier + 1) as 2 | 3, null, this.sim.bonuses);
      const upgrade = woodButton(this, 1000, 690, 170, 42, `Upgrade ${next.cost}`, () => this.tryUpgrade(tower.id), 17);
      this.selectLayer.add(upgrade);
      return;
    }
    if (tower.tier === 3 && this.sim.level.maxTier >= 4 && !tower.branch) {
      const line = tower.family === "barracks" ? null : rangedLine(tower.family);
      const aName = tower.family === "barracks" ? "Paladin" : line?.branchA.name.split(" ")[0] ?? "A";
      const bName = tower.family === "barracks" ? "Axes" : line?.branchB.name.split(" ")[0] ?? "B";
      const a = woodButton(this, 740, 690, 160, 42, `${aName} ${branchCost(tower.family, "a")}`, () => this.tryUpgrade(tower.id, "a"), 17);
      const b = woodButton(this, 980, 690, 160, 42, `${bName} ${branchCost(tower.family, "b")}`, () => this.tryUpgrade(tower.id, "b"), 17);
      this.selectLayer.add([a, b]);
    }
  }

  // ---------------------------------------------------------------- actions

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
    if (this.modal || this.paused) return;
    if (!this.sim.hero) {
      this.toast("The warden joins at Rift Fork.");
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
        this.launch(notice.x1, notice.y1 - 30, notice.x2, notice.y2 - 10, notice.kind);
        this.sparks?.explode(2, notice.x2, notice.y2 - 8);
        sfx.shot(notice.kind);
      } else if (notice.type === "float" && this.floaters.length < 24) {
        const text = this.add.text(notice.x, notice.y - 20, notice.text, {
          fontFamily: UI_FONT,
          fontSize: "15px",
          color: notice.color,
          stroke: "#2a1a10",
          strokeThickness: 3,
        }).setOrigin(0.5).setDepth(9);
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
        this.bannerText.setAlpha(1).setScale(0.7);
        this.tweens.add({ targets: this.bannerText, scale: 1, duration: 300, ease: "Back.easeOut" });
        this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 900, duration: 500 });
        if (this.sim.level.id === "dewcap" && notice.index === 3) this.toast("Reinforcements are free. Press 1, then click the road.");
        if (this.sim.level.id === "dewcap" && notice.index === 6) this.toast("Spore Rain is true damage. Press 2 and drop it on a crowd.");
      } else if (notice.type === "unlock") {
        this.toast(notice.power === "rain" ? "Spore Rain unlocked." : "Reinforcements unlocked.");
      } else if (notice.type === "boom") {
        this.burst(notice.x, notice.y, notice.r);
        this.sparks?.explode(notice.r > 60 ? 30 : 12, notice.x, notice.y - 6);
        if (notice.r > 60) this.triggerJuiceImpact(0.7);
      }
    }
  }

  private toast(message: string): void {
    this.toastText.setText(message);
    this.toastText.setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2400, duration: 400 });
  }

  // ----------------------------------------------------------------- modals

  private openModal(width: number, height: number): Phaser.GameObjects.Container {
    const panel = this.add.container(640, 360).setDepth(30);
    const dim = this.add.rectangle(0, 0, 1280, 720, 0x100804, 0.45).setInteractive();
    const bg = parchment(this, 0, 0, width, height);
    panel.add([dim, bg]);
    panel.setScale(0.85);
    this.tweens.add({ targets: panel, scale: 1, duration: 220, ease: "Back.easeOut" });
    return panel;
  }

  private setPaused(value: boolean): void {
    this.paused = value;
    if (this.sim) this.sim.paused = value;
  }

  private closeModal(): void {
    this.modal?.destroy(true);
    this.modal = undefined;
    this.setPaused(false);
  }

  private togglePause(): void {
    if (this.ended) return;
    if (this.modal) {
      this.closeModal();
      return;
    }
    this.setPaused(true);
    const panel = this.openModal(420, 320);
    const title = this.add.text(0, -110, "Paused", { fontFamily: DISPLAY_FONT, fontSize: "36px", color: INK }).setOrigin(0.5);
    const resume = woodButton(this, 0, -30, 220, 48, "Resume", () => this.togglePause(), 31);
    const retry = woodButton(this, 0, 34, 220, 48, "Retry", () => this.scene.restart({ ...this.launchData }), 31);
    const map = woodButton(this, 0, 98, 220, 48, "Map", () => this.scene.start("map"), 31);
    panel.add([title, resume, retry, map]);
    this.modal = panel;
  }

  private confirmQuit(): void {
    if (this.ended) {
      this.scene.start("map");
      return;
    }
    if (this.modal) {
      this.closeModal();
      return;
    }
    this.setPaused(true);
    const panel = this.openModal(440, 240);
    const title = this.add.text(0, -70, "Leave the march?", { fontFamily: DISPLAY_FONT, fontSize: "28px", color: INK }).setOrigin(0.5);
    const note = this.add.text(0, -28, "Progress on this road is lost.", { fontFamily: UI_FONT, fontSize: "16px", color: INK_SOFT }).setOrigin(0.5);
    const stay = woodButton(this, -95, 50, 160, 46, "Stay", () => this.closeModal(), 31);
    const leave = woodButton(this, 95, 50, 160, 46, "Leave", () => this.scene.start("map"), 31);
    panel.add([title, note, stay, leave]);
    this.modal = panel;
  }

  private toggleSpeed(): void {
    if (this.modal) return;
    this.speed = this.speed === 1 ? 2 : 1;
  }

  private showEnd(victory: boolean): void {
    this.ended = true;
    if (victory) {
      this.triggerJuiceImpact(0.8);
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 130, () => {
          this.sparks?.explode(26, 240 + Math.random() * 800, 150 + Math.random() * 320);
        });
      }
    } else {
      this.triggerJuiceImpact(1.2);
      this.cameras.main.flash(220, 120, 20, 20);
    }
    const stars = starsFor(this.sim.lives, victory);
    if (victory && !this.saved) {
      this.saved = true;
      commitSave(applyClear(loadSave(), this.sim.level.id, stars));
      sfx.win();
    }
    const panel = this.openModal(540, 360);
    const title = this.add.text(0, -130, victory ? "The road holds" : "The road is lost", {
      fontFamily: DISPLAY_FONT,
      fontSize: "34px",
      color: victory ? INK : "#8c2f3b",
    }).setOrigin(0.5);
    panel.add(title);
    if (victory) {
      for (let i = 0; i < 3; i++) {
        const star = art(this, -70 + i * 70, -62, "ic-star", "dot").setDisplaySize(56, 56);
        star.setAlpha(i < stars ? 1 : 0.3);
        if (i < stars) {
          star.setScale(0);
          this.tweens.add({ targets: star, displayWidth: 56, displayHeight: 56, delay: 250 + i * 200, duration: 320, ease: "Back.easeOut" });
        }
        panel.add(star);
      }
    }
    const detail = this.add.text(0, -8, victory ? `${this.sim.lives} lives left` : "The march reached the hold.", {
      fontFamily: UI_FONT,
      fontSize: "18px",
      color: INK_SOFT,
    }).setOrigin(0.5);
    panel.add(detail);
    const nextLevel = LEVELS.find((level) => level.index === this.sim.level.index + 1);
    const showNext = victory && !!nextLevel;
    panel.add(woodButton(this, showNext ? -150 : -90, 60, 150, 46, "Retry", () => this.scene.restart({ ...this.launchData }), 31));
    panel.add(woodButton(this, showNext ? 0 : 90, 60, 150, 46, "Map", () => this.scene.start("map"), 31));
    if (showNext && nextLevel) {
      panel.add(woodButton(this, 150, 60, 160, 46, "Next march", () => this.scene.start("battle", { ...this.launchData, levelId: nextLevel.id }), 31));
    }
    if (victory && this.sim.level.id === "dewcap") {
      panel.add(this.add.text(0, 120, "Warden Puff will march with you.", { fontFamily: UI_FONT, fontSize: "16px", color: INK_SOFT }).setOrigin(0.5));
    }
    this.modal = panel;
  }
}
