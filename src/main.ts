import Phaser from "phaser";
import { BattleScene } from "./game/BattleScene";
import { BootScene } from "./game/BootScene";
import { MapScene } from "./game/MapScene";
import { MenuScene } from "./game/MenuScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1280,
  height: 720,
  backgroundColor: "#102016",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, MenuScene, MapScene, BattleScene],
});
