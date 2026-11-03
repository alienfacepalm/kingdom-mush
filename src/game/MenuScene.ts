import Phaser from "phaser";
import { CREAM, DISPLAY_FONT, INK, INK_SOFT, UI_FONT, paintTextures, parchment, woodButton } from "./draw";
import { sfx } from "./sfx";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create(): void {
    paintTextures(this);
    if (this.textures.exists("bg-title")) {
      this.add.image(640, 360, "bg-title");
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x8ec8ef);
      g.fillRect(0, 0, 1280, 420);
      g.fillStyle(0x3f8f4a);
      g.fillRect(0, 420, 1280, 300);
    }

    const shadow = this.add.text(646, 136, "CAPKEEP", {
      fontFamily: DISPLAY_FONT,
      fontSize: "104px",
      color: "#2a1a10",
    }).setOrigin(0.5).setAlpha(0.45);
    const title = this.add.text(640, 130, "CAPKEEP", {
      fontFamily: DISPLAY_FONT,
      fontSize: "104px",
      color: "#f6cf5a",
      stroke: "#4a2a10",
      strokeThickness: 12,
    }).setOrigin(0.5);
    this.add.text(640, 206, "Hold the road.", {
      fontFamily: DISPLAY_FONT,
      fontSize: "28px",
      color: CREAM,
      stroke: "#2a1a10",
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: [title, shadow], y: "-=6", duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    woodButton(this, 640, 330, 260, 66, "Start", () => {
      sfx.unlock();
      sfx.ui();
      this.scene.start("map");
    });
    woodButton(this, 640, 408, 260, 52, "Field notes", () => this.showNotes());
    const mute = woodButton(this, 1180, 40, 150, 40, sfx.muted ? "Sound off" : "Sound on", () => {
      sfx.unlock();
      const muted = sfx.toggle();
      const label = mute.list[1];
      if (label instanceof Phaser.GameObjects.Text) label.setText(muted ? "Sound off" : "Sound on");
    });

  }

  private showNotes(): void {
    if (this.children.getByName("notes")) return;
    const panel = this.add.container(640, 360).setName("notes").setDepth(30);
    const dim = this.add.rectangle(0, 0, 1280, 720, 0x100804, 0.45).setInteractive();
    const bg = parchment(this, 0, 0, 780, 500);
    const title = this.add.text(0, -210, "Field notes", { fontFamily: DISPLAY_FONT, fontSize: "30px", color: INK }).setOrigin(0.5);
    const body = [
      "Build only on the stone pads.",
      "Barracks put soldiers on the road. Each one stops a single ground foe.",
      "Archers are fast and can hit fliers. Magic ignores armor but misses the sky.",
      "Mortars aim at the ground. The blast still catches anything in it.",
      "Auto march is the default for new saves: a prep clock, then waves call themselves. Switch to Manual on the map brief or battle HUD.",
      "Between waves, call early for bonus gold. Prep before wave 1 is build time only — no early gold. The skull sign shows what is coming.",
      "Sell a tower for the full cost before wave 1, or 60% after.",
      "At tier 3, the fourth upgrade is a choice of two specialties.",
      "1 reinforcements, 2 spore rain, right-click moves Warden Puff.",
      "Space pauses. F changes speed. Stars from clears buy permanent studies.",
    ].join("\n");
    const text = this.add.text(-340, -170, body, {
      fontFamily: UI_FONT,
      fontSize: "17px",
      color: INK_SOFT,
      wordWrap: { width: 680 },
      lineSpacing: 9,
    });
    const close = woodButton(this, 0, 210, 170, 44, "Close", () => panel.destroy(true), 31);
    panel.add([dim, bg, title, text, close]);
  }
}
