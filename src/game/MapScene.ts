import Phaser from "phaser";
import { META_UPGRADES } from "../content/catalog";
import { LEVELS, isUnlocked } from "../content/levels";
import { buyUpgrade, commitSave, loadSave, resetUpgrades, setAutoWaves, setHero, starsAvailable } from "../content/save";
import { DIFFICULTIES, HEROES, MODES, difficultyById, heroById, modeById, type DifficultyId, type ModeId } from "../content/variants";
import { Sim } from "../sim/Sim";
import { CREAM, DISPLAY_FONT, GOLD, INK, INK_SOFT, UI_FONT, art, hasFrame, paintTextures, parchment, plank, woodButton } from "./draw";
import { sfx } from "./sfx";

/** Landmark positions on public/art/bg/worldmap.jpg, in level order. */
const SPOTS = [
  { x: 190, y: 470 },
  { x: 412, y: 420 },
  { x: 630, y: 352 },
  { x: 858, y: 278 },
  { x: 1080, y: 170 },
];

export class MapScene extends Phaser.Scene {
  private starsText?: Phaser.GameObjects.Text;

  constructor() {
    super("map");
  }

  create(): void {
    paintTextures(this);
    const save = loadSave();
    if (this.textures.exists("bg-worldmap")) {
      this.add.image(640, 360, "bg-worldmap");
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x1d4a32);
      g.fillRect(0, 0, 1280, 720);
      g.lineStyle(18, 0xc2a15a);
      g.beginPath();
      g.moveTo(SPOTS[0].x, SPOTS[0].y);
      for (const spot of SPOTS.slice(1)) g.lineTo(spot.x, spot.y);
      g.strokePath();
    }

    plank(this, -4, -4, 1288, 56).setDepth(5);
    this.add.text(24, 12, "The landing", { fontFamily: DISPLAY_FONT, fontSize: "26px", color: GOLD }).setDepth(6);
    this.starsText = this.add.text(1256, 16, this.starLine(save.best, save.bought), {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: CREAM,
    }).setOrigin(1, 0).setDepth(6);

    LEVELS.forEach((level, index) => {
      const spot = SPOTS[index];
      const open = isUnlocked(save.best, level);
      const stars = save.best[level.id] ?? 0;
      const marker = hasFrame(this, "pad-flag")
        ? art(this, spot.x, spot.y, "pad-flag", "pad").setDisplaySize(72, 72)
        : this.add.circle(spot.x, spot.y, 30, 0xe0b15a).setStrokeStyle(4, 0x3a2a1a);
      marker.setDepth(2);
      if (!open) marker.setAlpha(0.5);
      const badge = this.add.circle(spot.x + 24, spot.y - 22, 15, open ? 0xf2c14e : 0x6b6b60).setStrokeStyle(3, 0x3a2416).setDepth(3);
      this.add.text(badge.x, badge.y, String(level.index), { fontFamily: DISPLAY_FONT, fontSize: "16px", color: INK }).setOrigin(0.5).setDepth(4);
      this.add.text(spot.x, spot.y + 44, level.name, {
        fontFamily: DISPLAY_FONT,
        fontSize: "17px",
        color: CREAM,
        stroke: "#2a1a10",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(4);
      const starRow = this.add.container(spot.x, spot.y + 70).setDepth(4);
      if (open) {
        for (let i = 0; i < 3; i++) {
          const star = art(this, -22 + i * 22, 0, "ic-star", "dot").setDisplaySize(20, 20);
          star.setAlpha(i < stars ? 1 : 0.3);
          starRow.add(star);
        }
      } else {
        starRow.add(this.add.text(0, 0, "Locked", { fontFamily: UI_FONT, fontSize: "14px", color: "#d9c08a", stroke: "#2a1a10", strokeThickness: 3 }).setOrigin(0.5));
      }
      if (!open) return;
      marker.setInteractive({ useHandCursor: true });
      marker.on("pointerover", () => marker.setDisplaySize(80, 80));
      marker.on("pointerout", () => marker.setDisplaySize(72, 72));
      marker.on("pointerdown", () => this.openBrief(level.id));
      if (stars === 0 && !this.children.getByName("bounce")) {
        this.tweens.add({ targets: marker, y: spot.y - 6, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    });

    woodButton(this, 150, 672, 220, 50, "Studies", () => this.openStudies());
    woodButton(this, 1130, 672, 220, 50, "Title", () => this.scene.start("menu"));
  }

  private starLine(best: Record<string, number>, bought: string[]): string {
    const earned = Object.values(best).reduce((sum, value) => sum + value, 0);
    return `${earned - bought.length} stars to spend  ·  ${earned} earned`;
  }

  private openBrief(levelId: string): void {
    const level = LEVELS.find((entry) => entry.id === levelId);
    if (!level || this.children.getByName("brief")) return;
    sfx.ui();
    const save0 = loadSave();
    let auto = save0.autoWaves;
    let modeId: ModeId = "campaign";
    let difficultyId: DifficultyId = "normal";
    let heroId = save0.heroId;
    const panel = this.add.container(640, 360).setName("brief").setDepth(20);
    const dim = this.add.rectangle(0, 0, 1280, 720, 0x100804, 0.45).setInteractive();
    const bg = parchment(this, 0, 0, 700, 500);
    const title = this.add.text(0, -205, level.name, { fontFamily: DISPLAY_FONT, fontSize: "32px", color: INK }).setOrigin(0.5);
    const body = this.add.text(-290, -160, level.briefing, {
      fontFamily: UI_FONT,
      fontSize: "17px",
      color: INK_SOFT,
      wordWrap: { width: 580 },
    });
    const meta = this.add.text(-290, -52, `Lives ${level.lives}   ·   ${level.startGold} gold   ·   ${level.waves.length} waves`, {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: INK,
    });
    const hint = this.add.text(0, 148, "", { fontFamily: UI_FONT, fontSize: "14px", color: INK_SOFT, align: "center", wordWrap: { width: 600 } }).setOrigin(0.5, 0);
    const setLabel = (btn: Phaser.GameObjects.Container, text: string) => {
      const label = btn.list[1];
      if (label instanceof Phaser.GameObjects.Text) label.setText(text);
    };
    const paint = () => {
      const m = modeById(modeId);
      const d = difficultyById(difficultyId);
      const lines = [`${m.name} — ${m.blurb}`, `${d.name} — ${d.blurb}`];
      if (level.hero) lines.push(`${heroById(heroId).name} — ${heroById(heroId).blurb}`);
      lines.push(m.forceManual ? "Iron marches are Manual." : auto ? `Auto: ${Sim.PREP_SECONDS}s prep, waves call themselves. Pause freezes the clock.` : "Manual: call each wave yourself.");
      hint.setText(lines.join("\n"));
    };
    const cycle = <T extends string>(list: readonly { id: T }[], current: T): T => {
      const i = list.findIndex((e) => e.id === current);
      return list[(i + 1) % list.length].id;
    };
    const modeBtn = woodButton(this, -215, 18, 200, 42, "Campaign", () => {
      modeId = cycle(MODES, modeId);
      setLabel(modeBtn, modeById(modeId).name);
      paint();
      sfx.ui();
    }, 21);
    const diffBtn = woodButton(this, 0, 18, 200, 42, "Normal", () => {
      difficultyId = cycle(DIFFICULTIES, difficultyId);
      setLabel(diffBtn, difficultyById(difficultyId).name);
      paint();
      sfx.ui();
    }, 21);
    const autoBtn = woodButton(this, 215, 18, 200, 42, auto ? "Auto on" : "Manual", () => {
      auto = !auto;
      commitSave(setAutoWaves(loadSave(), auto));
      setLabel(autoBtn, auto ? "Auto on" : "Manual");
      paint();
      sfx.ui();
    }, 21);
    const heroBtn = woodButton(this, -150, 72, 260, 42, heroById(heroId).name, () => {
      if (!level.hero) return;
      heroId = cycle(HEROES, heroId);
      commitSave(setHero(loadSave(), heroId));
      setLabel(heroBtn, heroById(heroId).name);
      paint();
      sfx.ui();
    }, 21);
    if (!level.hero) heroBtn.setAlpha(0.35).disableInteractive();
    const go = woodButton(this, 95, 72, 200, 48, "To battle", () => {
      sfx.unlock();
      this.scene.start("battle", { levelId, modeId, difficultyId, heroId });
    }, 21);
    const back = woodButton(this, 275, 72, 100, 42, "Back", () => panel.destroy(true), 21);
    paint();
    panel.add([dim, bg, title, body, meta, modeBtn, diffBtn, autoBtn, heroBtn, go, back, hint]);
    panel.setScale(0.9);
    this.tweens.add({ targets: panel, scale: 1, duration: 220, ease: "Back.easeOut" });
  }

  private openStudies(): void {
    if (this.children.getByName("studies")) return;
    const save = loadSave();
    const panel = this.add.container(640, 370).setName("studies").setDepth(20);
    const dim = this.add.rectangle(0, -10, 1280, 720, 0x100804, 0.45).setInteractive();
    const bg = parchment(this, 0, 0, 840, 580);
    const title = this.add.text(0, -250, "Studies", { fontFamily: DISPLAY_FONT, fontSize: "32px", color: INK }).setOrigin(0.5);
    const available = this.add.text(0, -210, `${starsAvailable(save)} stars available`, {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: INK_SOFT,
    }).setOrigin(0.5);
    panel.add([dim, bg, title, available]);
    META_UPGRADES.forEach((upgrade, index) => {
      const owned = save.bought.includes(upgrade.id);
      const y = -160 + index * 52;
      const row = this.add.text(-360, y, `${upgrade.name}  —  ${upgrade.desc}`, {
        fontFamily: UI_FONT,
        fontSize: "16px",
        color: owned ? "#2f6e3a" : INK,
      });
      panel.add(row);
      if (owned) {
        panel.add(art(this, 330, y + 10, "ic-star", "dot").setDisplaySize(26, 26));
        return;
      }
      const buy = woodButton(this, 330, y + 8, 110, 36, "1 star", () => {
        const next = buyUpgrade(loadSave(), upgrade.id);
        if (!next) return;
        commitSave(next);
        sfx.ui();
        panel.destroy(true);
        this.openStudies();
        this.refreshStars();
      }, 21);
      panel.add(buy);
    });
    const reset = woodButton(this, -120, 240, 170, 44, "Reset", () => {
      commitSave(resetUpgrades(loadSave()));
      panel.destroy(true);
      this.openStudies();
      this.refreshStars();
    }, 21);
    const done = woodButton(this, 120, 240, 170, 44, "Done", () => panel.destroy(true), 21);
    panel.add([reset, done]);
  }

  private refreshStars(): void {
    const save = loadSave();
    this.starsText?.setText(this.starLine(save.best, save.bought));
  }
}
