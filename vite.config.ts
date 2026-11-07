import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/CapKeep/" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: { phaser: ["phaser"] },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
}));
