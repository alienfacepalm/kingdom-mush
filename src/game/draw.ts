import Phaser from "phaser";
import type { Branch, Family } from "../content/types";

/** Font family names registered by BootScene. */
export const DISPLAY_FACE = "Metamorphous";
export const UI_FACE = "Nunito";
/** Font stacks for Phaser text. */
export const DISPLAY_FONT = `"${DISPLAY_FACE}", Georgia, serif`;
export const UI_FONT = `"${UI_FACE}", "Segoe UI", sans-serif`;

export const INK = "#3a2416";
export const INK_SOFT = "#6b5030";
export const GOLD = "#f2c14e";
export const CREAM = "#fff3d6";

export const ATLAS = "sprites";

/** True when the painted atlas has this frame. */
export function hasFrame(scene: Phaser.Scene, frame: string): boolean {
  return scene.textures.exists(ATLAS) && scene.textures.get(ATLAS).has(frame);
}

/** Nine-slice objects are WebGL only; Canvas fallback uses plain shapes. */
function canSlice(scene: Phaser.Scene, frame: string): boolean {
  return scene.sys.game.renderer.type === Phaser.WEBGL && hasFrame(scene, frame);
}

/** Painted frame if present, else the procedural fallback texture. */
export function pick(scene: Phaser.Scene, frame: string, fallback: string): { key: string; frame?: string } {
  return hasFrame(scene, frame) ? { key: ATLAS, frame } : { key: fallback };
}

export function art(scene: Phaser.Scene, x: number, y: number, frame: string, fallback: string): Phaser.GameObjects.Image {
  const source = pick(scene, frame, fallback);
  return scene.add.image(x, y, source.key, source.frame);
}

/** Atlas frame for a tower at a tier and branch. */
export function towerFrame(family: Family, tier: number, branch: Branch | null): string {
  if (branch) return `${family}-${branch}`;
  return `${family}${Math.min(3, Math.max(1, tier))}`;
}

export function familyKey(family: Family): string {
  if (family === "barracks") return "tw-barracks";
  if (family === "mage") return "tw-mage";
  if (family === "artillery") return "tw-artillery";
  return "tw-archer";
}

export function familyIcon(family: Family): string {
  return `ic-${family}`;
}

/** Nine-slice parchment panel with a wooden frame; falls back to a dark rectangle. */
export type Panel = Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle;

export function parchment(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Panel {
  if (canSlice(scene, "panel")) {
    return scene.add.nineslice(x, y, ATLAS, "panel", w, h, 30, 30, 30, 30);
  }
  return scene.add.rectangle(x, y, w, h, 0xf1dfb3, 1).setStrokeStyle(4, 0x6b4a2a);
}

/** Dark wooden HUD strip. */
export function plank(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x2a1a10, 0.94);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(2, 0x6b4a2a, 1);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 6);
  g.lineStyle(1, 0xe0b15a, 0.5);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 4);
  return g;
}

export function woodButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  depth = 20,
): Phaser.GameObjects.Container {
  const painted = canSlice(scene, "btn") && hasFrame(scene, "btn-hi");
  const bg = painted
    ? scene.add.nineslice(0, 0, ATLAS, "btn", w, h, 20, 20, 18, 18)
    : scene.add.rectangle(0, 0, w, h, 0x5a3a20).setStrokeStyle(3, 0xe0b15a);
  bg.setInteractive({ useHandCursor: true });
  const fontSize = Math.max(14, Math.min(22, Math.floor(h * 0.48)));
  const text = scene.add.text(0, -1, label, {
    fontFamily: DISPLAY_FONT,
    fontSize: `${fontSize}px`,
    color: CREAM,
    stroke: "#2a1a10",
    strokeThickness: 3,
  }).setOrigin(0.5);
  const hover = (on: boolean) => {
    if (bg instanceof Phaser.GameObjects.NineSlice) bg.setFrame(on ? "btn-hi" : "btn");
    else (bg as Phaser.GameObjects.Rectangle).setFillStyle(on ? 0x7a5030 : 0x5a3a20);
    text.setColor(on ? INK : CREAM);
    text.setStroke(on ? "#f6e6c0" : "#2a1a10", on ? 2 : 3);
  };
  bg.on("pointerover", () => hover(true));
  bg.on("pointerout", () => hover(false));
  bg.on("pointerdown", (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
    void pointer;
    void localX;
    void localY;
    event.stopPropagation();
    onClick();
  });
  return scene.add.container(x, y, [bg, text]).setDepth(depth);
}

/** Round painted icon button (pause, fast-forward, sell…). */
export function iconButton(scene: Phaser.Scene, x: number, y: number, size: number, frame: string, onClick: () => void, depth = 20): Phaser.GameObjects.Image {
  const source = pick(scene, frame, "pad");
  const img = scene.add.image(x, y, source.key, source.frame).setDepth(depth).setInteractive({ useHandCursor: true });
  img.setDisplaySize(size, size);
  img.on("pointerover", () => img.setDisplaySize(size * 1.08, size * 1.08));
  img.on("pointerout", () => img.setDisplaySize(size, size));
  img.on("pointerdown", (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
    void pointer;
    void localX;
    void localY;
    event.stopPropagation();
    onClick();
  });
  return img;
}

/** Procedural placeholder textures, used only when an atlas frame is missing. */
export function paintTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("foe-sprout")) return;
  paint(scene, "foe-sprout", 40, 40, (g) => {
    g.fillStyle(0x6aaa48);
    g.fillEllipse(20, 28, 16, 8);
    g.fillStyle(0x8fd86a);
    g.fillEllipse(20, 16, 26, 16);
  });
  paint(scene, "foe-runner", 40, 40, (g) => {
    g.fillStyle(0xc47a32);
    g.fillEllipse(20, 22, 12, 26);
  });
  paint(scene, "foe-beetle", 44, 40, (g) => {
    g.fillStyle(0x6b4428);
    g.fillEllipse(22, 24, 28, 16);
  });
  paint(scene, "foe-shade", 40, 44, (g) => {
    g.fillStyle(0x8a6ad4, 0.95);
    g.fillTriangle(20, 4, 36, 38, 4, 38);
  });
  paint(scene, "foe-gnat", 40, 40, (g) => {
    g.fillStyle(0xf0d35a);
    g.fillEllipse(20, 22, 14, 10);
  });
  paint(scene, "foe-brute", 52, 52, (g) => {
    g.fillStyle(0x4e3424);
    g.fillRoundedRect(8, 16, 36, 30, 6);
  });
  paint(scene, "foe-shaman", 40, 48, (g) => {
    g.fillStyle(0x1f6e62);
    g.fillEllipse(20, 30, 16, 22);
  });
  paint(scene, "foe-rotking", 64, 64, (g) => {
    g.fillStyle(0x8c2f3b);
    g.fillEllipse(32, 24, 40, 26);
  });
  paint(scene, "tw-archer", 72, 72, (g) => {
    g.fillStyle(0x7dce6a);
    g.fillEllipse(36, 24, 36, 22);
  });
  paint(scene, "tw-barracks", 72, 72, (g) => {
    g.fillStyle(0x6aa6e0);
    g.fillRect(16, 40, 40, 20);
  });
  paint(scene, "tw-mage", 72, 72, (g) => {
    g.fillStyle(0xb07ad4);
    g.fillEllipse(36, 26, 40, 24);
  });
  paint(scene, "tw-artillery", 72, 72, (g) => {
    g.fillStyle(0xe09a4a);
    g.fillRoundedRect(28, 28, 28, 12, 4);
  });
  paint(scene, "unit-soldier", 28, 28, (g) => {
    g.fillStyle(0x6aa6e0);
    g.fillCircle(14, 16, 8);
  });
  paint(scene, "unit-hero", 40, 40, (g) => {
    g.fillStyle(0xe7b45a);
    g.fillEllipse(20, 12, 22, 14);
  });
  paint(scene, "pad", 64, 48, (g) => {
    g.fillStyle(0xc8bfa4);
    g.fillEllipse(32, 26, 52, 28);
  });
  paint(scene, "dot", 8, 8, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
  });
}

function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}
