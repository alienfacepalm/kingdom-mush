import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/kingdom-mush/" : "/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
}));
