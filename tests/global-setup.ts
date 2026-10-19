import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const testDbPath = path.resolve(process.cwd(), "prisma/test.db");
const testDbUrl = `file:${testDbPath}`;

// Set environment variable in main test runner process
process.env.DATABASE_URL = testDbUrl;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { validateTestDatabaseUrl } from "./setup-test-db";

export default async function globalSetup() {
  // Validate that test database URL is isolated and safe
  validateTestDatabaseUrl(testDbUrl);

  const devDbPath = path.resolve(process.cwd(), "prisma/dev.db");
  if (testDbPath === devDbPath || !testDbPath.endsWith("test.db")) {
    throw new Error(`[SECURITY GUARD] Refusing to touch non-test database: ${testDbPath}`);
  }

  // Reset test database before test execution:
  // Cleanly remove the dedicated test database and any lingering SQLite sidecars
  // before worker threads spawn, preventing stale ProviderCache or test entities.
  const sidecars = [
    testDbPath,
    `${testDbPath}-journal`,
    `${testDbPath}-wal`,
    `${testDbPath}-shm`,
  ];

  for (const file of sidecars) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err: any) {
        console.warn(`[WARN] Could not remove test database artifact ${file}: ${err.message}`);
      }
    }
  }

  // Initialize isolated fresh test schema using Prisma CLI db push
  try {
    execSync(`npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss`, {
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
      stdio: "pipe",
    });
  } catch (err: any) {
    const errorOutput = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`[FATAL] Failed to initialize isolated test database schema: ${errorOutput}`);
  }

  return async () => {
    // Teardown: Do not delete database files while worker connections are closing.
    // Preserving prisma/test.db post-run avoids SQLite file lock races and allows debugging.
  };
}
