import { defineConfig } from "vitest/config";
import path from "path";

const testDbPath = path.resolve(__dirname, "prisma/test.db");
const testDbUrl = `file:${testDbPath}`;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      DATABASE_URL: testDbUrl,
      NODE_ENV: "test",
    },
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-test-db.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
