import Phaser from "phaser";
import type { Family } from "../content/types";

const FONT = "Segoe UI, sans-serif";

export function paintTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("foe-sprout")) return;
  paint(scene, "foe-sprout", 40, 40, (g) => {
    g.fillStyle(0x6aaa48);
    g.fillEllipse(20, 28, 16, 8);
    g.fillStyle(0x8fd86a);
    g.fillEllipse(20, 16, 26, 16);
    g.fillStyle(0xf4fff0, 0.8);
    g.fillCircle(14, 12, 3);
  });
  paint(scene, "foe-runner", 40, 40, (g) => {
    g.fillStyle(0xc47a32);
    g.fillEllipse(20, 22, 12, 26);
    g.fillStyle(0xf0c14a);
    g.fillCircle(20, 8, 6);
  });
  paint(scene, "foe-beetle", 44, 40, (g) => {
    g.fillStyle(0x6b4428);
    g.fillEllipse(22, 24, 28, 16);
    g.fillStyle(0xb07a3a);
    g.fillEllipse(22, 18, 24, 14);
    g.lineStyle(2, 0x4a2c16);
    g.lineBetween(10, 16, 34, 16);
  });
  paint(scene, "foe-shade", 40, 44, (g) => {
    g.fillStyle(0x8a6ad4, 0.95);
    g.fillTriangle(20, 4, 36, 38, 4, 38);
    g.fillStyle(0xf4f0ff);
    g.fillCircle(15, 22, 2);
    g.fillCircle(25, 22, 2);
  });
  paint(scene, "foe-gnat", 40, 40, (g) => {
    g.fillStyle(0xf0d35a);
    g.fillEllipse(20, 22, 14, 10);
    g.fillStyle(0xfff6c8, 0.9);
    g.fillEllipse(8, 18, 12, 6);
    g.fillEllipse(32, 18, 12, 6);
  });
  paint(scene, "foe-brute", 52, 52, (g) => {
    g.fillStyle(0x4e3424);
    g.fillRoundedRect(8, 16, 36, 30, 6);
    g.fillStyle(0x6b4a32);
    g.fillCircle(26, 16, 12);
  });
  paint(scene, "foe-shaman", 40, 48, (g) => {
    g.fillStyle(0x1f6e62);
    g.fillEllipse(20, 30, 16, 22);
    g.fillStyle(0x3cb8a0);
    g.fillCircle(20, 12, 8);
    g.lineStyle(3, 0xd7c08a);
    g.lineBetween(30, 10, 34, 40);
  });
  paint(scene, "foe-rotking", 64, 64, (g) => {
    g.fillStyle(0x4a1820);
    g.fillRoundedRect(14, 28, 36, 28, 6);
    g.fillStyle(0x8c2f3b);
    g.fillEllipse(32, 24, 40, 26);
    g.fillStyle(0xf2c14e);
    g.fillTriangle(18, 18, 24, 4, 28, 18);
    g.fillTriangle(32, 16, 40, 2, 46, 16);
  });
  paint(scene, "tw-archer", 72, 72, (g) => {
    g.fillStyle(0x6a5030);
    g.fillRect(32, 30, 8, 28);
    g.fillStyle(0x7dce6a);
    g.fillEllipse(36, 24, 36, 22);
    g.lineStyle(3, 0xf4f0e6);
    g.beginPath();
    g.arc(50, 36, 12, -1, 1);
    g.strokePath();
  });
  paint(scene, "tw-barracks", 72, 72, (g) => {
    g.fillStyle(0x3d5f86);
    g.fillTriangle(36, 10, 64, 40, 8, 40);
    g.fillStyle(0x6aa6e0);
    g.fillRect(16, 40, 40, 20);
    g.fillStyle(0xf2c14e);
    g.fillRect(34, 18, 4, 16);
  });
  paint(scene, "tw-mage", 72, 72, (g) => {
    g.fillStyle(0x3a3058);
    g.fillRect(24, 34, 24, 24);
    g.fillStyle(0xb07ad4);
    g.fillEllipse(36, 26, 40, 24);
    g.fillStyle(0xf4e2ff);
    g.fillCircle(36, 22, 4);
  });
  paint(scene, "tw-artillery", 72, 72, (g) => {
    g.fillStyle(0x6a5030);
    g.fillRect(20, 40, 32, 16);
    g.fillStyle(0xe09a4a);
    g.fillRoundedRect(28, 28, 28, 12, 4);
    g.fillCircle(36, 22, 10);
  });
  paint(scene, "unit-soldier", 28, 28, (g) => {
    g.fillStyle(0x6aa6e0);
    g.fillCircle(14, 16, 8);
    g.fillStyle(0xd7c08a);
    g.fillCircle(14, 8, 5);
  });
  paint(scene, "unit-paladin", 28, 28, (g) => {
    g.fillStyle(0xf2c14e);
    g.fillCircle(14, 16, 8);
    g.fillStyle(0xfff6d8);
    g.fillCircle(14, 8, 5);
  });
  paint(scene, "unit-axe", 28, 28, (g) => {
    g.fillStyle(0xc45a3a);
    g.fillCircle(14, 16, 8);
    g.fillStyle(0xf0c14a);
    g.fillCircle(14, 8, 5);
  });
  paint(scene, "unit-elemental", 36, 36, (g) => {
    g.fillStyle(0x7a4ea3);
    g.fillCircle(18, 20, 12);
    g.fillStyle(0xd7a6ff);
    g.fillCircle(18, 12, 6);
  });
  paint(scene, "unit-reinforcement", 28, 28, (g) => {
    g.fillStyle(0xd7c08a);
    g.fillCircle(14, 16, 8);
    g.fillStyle(0x6a5030);
    g.fillCircle(14, 8, 5);
  });
  paint(scene, "unit-hero", 40, 40, (g) => {
    g.fillStyle(0x2f4d73);
    g.fillRoundedRect(10, 16, 20, 18, 4);
    g.fillStyle(0xe7b45a);
    g.fillEllipse(20, 12, 22, 14);
    g.fillStyle(0xf4f0e6);
    g.fillCircle(20, 14, 4);
  });
  paint(scene, "pad", 64, 48, (g) => {
    g.fillStyle(0xc8bfa4);
    g.fillEllipse(32, 26, 52, 28);
    g.lineStyle(3, 0x8a7a58);
    g.strokeEllipse(32, 26, 52, 28);
    g.fillStyle(0xf2c14e);
    g.fillTriangle(32, 6, 36, 18, 28, 18);
  });
}

function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
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
  const bg = scene.add.rectangle(0, 0, w, h, 0x3a2a1a).setStrokeStyle(3, 0xe0b15a).setInteractive({ useHandCursor: true });
  const text = scene.add.text(0, 0, label, { fontFamily: "Georgia, serif", fontSize: "22px", color: "#f4e2b0" }).setOrigin(0.5);
  bg.on("pointerover", () => bg.setFillStyle(0x5a4030));
  bg.on("pointerout", () => bg.setFillStyle(0x3a2a1a));
  bg.on("pointerdown", (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
    void pointer;
    void localX;
    void localY;
    event.stopPropagation();
    onClick();
  });
  return scene.add.container(x, y, [bg, text]).setDepth(depth);
}

export function familyKey(family: Family): string {
  if (family === "barracks") return "tw-barracks";
  if (family === "mage") return "tw-mage";
  if (family === "artillery") return "tw-artillery";
  return "tw-archer";
}

export const UI_FONT = FONT;
