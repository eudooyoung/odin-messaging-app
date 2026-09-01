import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import "dotenv/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
    exclude: ["dist/**", "node_modules/**"],
  },
});
