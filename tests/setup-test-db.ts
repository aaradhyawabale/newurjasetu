import path from "path";

/**
 * Validates that the active database URL in the test environment
 * targets an isolated test database and strictly refuses to run against
 * the protected development/demo database.
 */
export function validateTestDatabaseUrl(url: string | undefined): void {
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error("[SECURITY GUARD] Refusing to run tests: DATABASE_URL is undefined or empty in test environment.");
  }

  const cleanPath = url.replace(/^file:/, "");
  const absoluteTarget = path.isAbsolute(cleanPath)
    ? cleanPath
    : path.resolve(process.cwd(), cleanPath);
  const devDbPath = path.resolve(process.cwd(), "prisma/dev.db");

  // Refuse execution if URL points to dev.db
  if (absoluteTarget === devDbPath || url.includes("dev.db")) {
    throw new Error(
      `[SECURITY GUARD] Refusing to run tests: DATABASE_URL (${url}) resolves to protected development database (${devDbPath}). Aborted to prevent data corruption.`
    );
  }

  // Refuse execution if target filename does not contain "test"
  if (!url.toLowerCase().includes("test")) {
    throw new Error(
      `[SECURITY GUARD] Refusing to run tests: DATABASE_URL (${url}) must explicitly target a designated test database.`
    );
  }
}

const defaultTestDbPath = path.resolve(process.cwd(), "prisma/test.db");
const defaultTestDbUrl = `file:${defaultTestDbPath}`;

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = defaultTestDbUrl;
}

// Execute guard check immediately upon worker startup
validateTestDatabaseUrl(process.env.DATABASE_URL);

