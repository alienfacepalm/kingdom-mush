// Writes the level geometry to art/levels.json so the Python art tools can draw
// layout plates and check that painted backgrounds follow the sim's roads.
// Run: node tools/art/export-levels.ts   (Node 24 strips the types itself)
import { mkdirSync, writeFileSync } from "node:fs";
import { LEVELS } from "../../src/content/levels.ts";

const out = LEVELS.map((level) => ({
  id: level.id,
  name: level.name,
  scenery: level.scenery,
  paths: level.paths.map((path) => ({ id: path.id, points: path.points })),
  slots: level.slots,
}));

mkdirSync("art", { recursive: true });
writeFileSync("art/levels.json", JSON.stringify(out, null, 2));
console.log(`wrote art/levels.json (${out.length} levels)`);
