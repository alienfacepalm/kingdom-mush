import Phaser from "phaser";
import { UI_FONT, paintTextures, woodButton } from "./draw";
import { sfx } from "./sfx";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create(): void {
    paintTextures(this);
    const g = this.add.graphics();
    g.fillStyle(0x8ec8ef);
    g.fillRect(0, 0, 1280, 420);
    g.fillStyle(0x3f8f4a);
    g.fillRect(0, 420, 1280, 300);
    g.fillStyle(0xc2a15a);
    g.fillEllipse(180, 520, 220, 70);
    g.fillStyle(0x7dce6a);
    g.fillEllipse(180, 470, 160, 70);
    g.fillStyle(0xe07a4a);
    g.fillEllipse(1040, 500, 180, 80);
    g.fillStyle(0x6b4a32);
    g.fillRect(1000, 500, 30, 80);
    g.fillStyle(0x2f4d73);
    g.fillRoundedRect(150, 430, 70, 80, 8);
    g.fillStyle(0xe7b45a);
    g.fillEllipse(185, 420, 80, 36);

    this.add.text(640, 150, "CAPKEEP", {
      fontFamily: "Georgia, serif",
      fontSize: "92px",
      color: "#f2c14e",
      stroke: "#3a2a1a",
      strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(640, 230, "Hold the road.", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#3a2a1a",
    }).setOrigin(0.5);

    woodButton(this, 640, 340, 240, 64, "Start", () => {
      sfx.unlock();
      sfx.ui();
      this.scene.start("map");
    });
    woodButton(this, 640, 420, 240, 52, "Field notes", () => this.showNotes());
    const mute = this.add.text(1180, 40, sfx.muted ? "Sound off" : "Sound on", {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: "#f4f0e6",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    mute.on("pointerdown", () => {
      sfx.unlock();
      const muted = sfx.toggle();
      mute.setText(muted ? "Sound off" : "Sound on");
    });

    this.add.text(640, 680, "An original tower defense. Not affiliated with Ironhide Game Studio.", {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#e7f6ea",
    }).setOrigin(0.5);
  }

  private showNotes(): void {
    if (this.children.getByName("notes")) return;
    const panel = this.add.container(640, 360).setName("notes").setDepth(30);
    const bg = this.add.rectangle(0, 0, 760, 460, 0x1c2430, 0.96).setStrokeStyle(4, 0xe0b15a);
    const body = [
      "Build only on the stone pads.",
      "Barracks put soldiers on the road. Each one stops a single ground foe.",
      "Archers are fast and can hit fliers. Magic ignores armor but misses the sky.",
      "Mortars aim at the ground. The blast still catches anything in it.",
      "Call the next wave early for bonus gold. The skull shows what is coming.",
      "Sell a tower for the full cost before wave 1, or 60% after.",
      "At tier 3, the fourth upgrade is a choice of two specialties.",
      "1 reinforcements, 2 spore rain, right-click moves Warden Puff.",
      "Space pauses. F changes speed. Stars from clears buy permanent studies.",
    ].join("\n\n");
    const text = this.add.text(-340, -190, body, {
      fontFamily: UI_FONT,
      fontSize: "18px",
      color: "#f4f0e6",
      wordWrap: { width: 680 },
      lineSpacing: 2,
    });
    const close = woodButton(this, 0, 190, 160, 44, "Close", () => panel.destroy(true), 31);
    panel.add([bg, text, close]);
  }
}
