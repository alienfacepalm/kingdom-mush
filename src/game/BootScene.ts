import Phaser from "phaser";
import { LEVELS } from "../content/levels";
import { DISPLAY_FACE, UI_FACE } from "./draw";

const BASE = import.meta.env.BASE_URL;

/** Loads the painted atlas, level backgrounds, and web fonts, then opens the title. */
export class BootScene extends Phaser.Scene {
  private fontsReady: Promise<void> = Promise.resolve();

  constructor() {
    super("boot");
  }

  preload(): void {
    this.fontsReady = loadFonts();
    const bar = this.add.graphics();
    const box = this.add.graphics();
    box.fillStyle(0x2a1a10, 1);
    box.fillRoundedRect(440, 350, 400, 28, 8);
    box.lineStyle(3, 0xe0b15a, 1);
    box.strokeRoundedRect(440, 350, 400, 28, 8);
    this.add.text(640, 320, "Raising the keep…", { fontFamily: "Georgia, serif", fontSize: "22px", color: "#f2c14e" }).setOrigin(0.5);
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0xf2c14e, 1);
      bar.fillRoundedRect(446, 356, 388 * value, 16, 5);
    });
    this.load.atlas("sprites", `${BASE}art/sprites.png`, `${BASE}art/sprites.json`);
    this.load.image("bg-title", `${BASE}art/bg/title.jpg`);
    this.load.image("bg-worldmap", `${BASE}art/bg/worldmap.jpg`);
    for (const level of LEVELS) this.load.image(`bg-${level.id}`, `${BASE}art/bg/${level.id}.jpg`);
  }

  create(): void {
    void this.fontsReady.then(() => this.scene.start("menu"));
  }
}

async function loadFonts(): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts) return;
  const faces = [
    new FontFace(DISPLAY_FACE, `url(${BASE}fonts/metamorphous.woff2)`),
    new FontFace(UI_FACE, `url(${BASE}fonts/nunito.woff2)`, { weight: "200 1000" }),
  ];
  await Promise.all(
    faces.map(async (face) => {
      try {
        await face.load();
        (document.fonts as unknown as { add(face: FontFace): void }).add(face);
      } catch {
        // Fall back to the system font declared in draw.ts.
      }
    }),
  );
}
