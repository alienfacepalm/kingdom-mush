import Phaser from "phaser";
import { META_UPGRADES } from "../content/catalog";
import { LEVELS, isUnlocked } from "../content/levels";
import { buyUpgrade, commitSave, loadSave, resetUpgrades, starsAvailable } from "../content/save";
import { UI_FONT, woodButton } from "./draw";
import { sfx } from "./sfx";

export class MapScene extends Phaser.Scene {
  private starsText?: Phaser.GameObjects.Text;

  constructor() {
    super("map");
  }

  create(): void {
    const save = loadSave();
    const g = this.add.graphics();
    g.fillStyle(0x1d4a32);
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0xc2a15a);
    g.lineStyle(18, 0xc2a15a);
    g.beginPath();
    g.moveTo(360, 560);
    g.lineTo(520, 430);
    g.lineTo(700, 360);
    g.lineTo(900, 220);
    g.strokePath();

    this.add.text(80, 36, "The Capkeep marches", {
      fontFamily: "Georgia, serif",
      fontSize: "36px",
      color: "#f2c14e",
    });
    this.starsText = this.add.text(80, 84, this.starLine(save.best, save.bought), {
      fontFamily: UI_FONT,
      fontSize: "18px",
      color: "#f4f0e6",
    });

    const spots = [
      { x: 360, y: 560 },
      { x: 700, y: 360 },
      { x: 900, y: 220 },
    ];
    LEVELS.forEach((level, index) => {
      const spot = spots[index];
      const open = isUnlocked(save.best, level);
      const stars = save.best[level.id] ?? 0;
      const node = this.add.circle(spot.x, spot.y, 36, open ? 0xe0b15a : 0x5a6458).setStrokeStyle(4, 0x3a2a1a);
      this.add.text(spot.x, spot.y - 4, String(level.index), {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#1c2430",
      }).setOrigin(0.5);
      this.add.text(spot.x, spot.y + 52, level.name, {
        fontFamily: UI_FONT,
        fontSize: "18px",
        color: "#f4f0e6",
      }).setOrigin(0.5);
      this.add.text(spot.x, spot.y + 76, open ? "★".repeat(stars) + "☆".repeat(3 - stars) : "Locked", {
        fontFamily: UI_FONT,
        fontSize: "16px",
        color: stars > 0 ? "#f2c14e" : "#8aa090",
      }).setOrigin(0.5);
      if (!open) {
        node.setAlpha(0.7);
        return;
      }
      node.setInteractive({ useHandCursor: true });
      node.on("pointerdown", () => this.openBrief(level.id));
    });

    woodButton(this, 160, 660, 200, 48, "Studies", () => this.openStudies());
    woodButton(this, 1120, 660, 200, 48, "Title", () => this.scene.start("menu"));
  }

  private starLine(best: Record<string, number>, bought: string[]): string {
    const earned = Object.values(best).reduce((sum, value) => sum + value, 0);
    return `${earned - bought.length} stars to spend  ·  ${earned} earned`;
  }

  private openBrief(levelId: string): void {
    const level = LEVELS.find((entry) => entry.id === levelId);
    if (!level || this.children.getByName("brief")) return;
    sfx.ui();
    const panel = this.add.container(640, 360).setName("brief").setDepth(20);
    const bg = this.add.rectangle(0, 0, 640, 320, 0x1c2430, 0.97).setStrokeStyle(4, 0xe0b15a);
    const title = this.add.text(0, -120, level.name, { fontFamily: "Georgia, serif", fontSize: "32px", color: "#f2c14e" }).setOrigin(0.5);
    const body = this.add.text(-280, -70, level.briefing, {
      fontFamily: UI_FONT,
      fontSize: "18px",
      color: "#f4f0e6",
      wordWrap: { width: 560 },
    });
    const meta = this.add.text(-280, 40, `Lives 20   ·   ${level.startGold} gold   ·   ${level.waves.length} waves`, {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: "#e0b15a",
    });
    const go = woodButton(this, 120, 110, 180, 48, "To battle", () => {
      sfx.unlock();
      this.scene.start("battle", { levelId });
    }, 21);
    const back = woodButton(this, -100, 110, 140, 48, "Back", () => panel.destroy(true), 21);
    panel.add([bg, title, body, meta, go, back]);
  }

  private openStudies(): void {
    if (this.children.getByName("studies")) return;
    const save = loadSave();
    const panel = this.add.container(640, 370).setName("studies").setDepth(20);
    const bg = this.add.rectangle(0, 0, 820, 560, 0x1c2430, 0.98).setStrokeStyle(4, 0xe0b15a);
    const title = this.add.text(0, -240, "Studies", { fontFamily: "Georgia, serif", fontSize: "32px", color: "#f2c14e" }).setOrigin(0.5);
    const available = this.add.text(0, -200, `${starsAvailable(save)} stars available`, {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: "#f4f0e6",
    }).setOrigin(0.5);
    panel.add([bg, title, available]);
    META_UPGRADES.forEach((upgrade, index) => {
      const owned = save.bought.includes(upgrade.id);
      const y = -150 + index * 52;
      const row = this.add.text(-360, y, `${upgrade.name}  —  ${upgrade.desc}`, {
        fontFamily: UI_FONT,
        fontSize: "16px",
        color: owned ? "#9be07a" : "#f4f0e6",
      });
      panel.add(row);
      if (!owned) {
        const buy = woodButton(this, 300, y + 8, 100, 36, "1 ★", () => {
          const next = buyUpgrade(loadSave(), upgrade.id);
          if (!next) return;
          commitSave(next);
          sfx.ui();
          panel.destroy(true);
          this.openStudies();
          this.refreshStars();
        }, 21);
        panel.add(buy);
      }
    });
    const reset = woodButton(this, -120, 230, 160, 44, "Reset", () => {
      commitSave(resetUpgrades(loadSave()));
      panel.destroy(true);
      this.openStudies();
      this.refreshStars();
    }, 21);
    const done = woodButton(this, 120, 230, 160, 44, "Done", () => panel.destroy(true), 21);
    panel.add([reset, done]);
  }

  private refreshStars(): void {
    const save = loadSave();
    this.starsText?.setText(this.starLine(save.best, save.bought));
  }
}
