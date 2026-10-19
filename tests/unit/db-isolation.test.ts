import { describe, it, expect } from "vitest";
import path from "path";
import { validateTestDatabaseUrl } from "../setup-test-db";

describe("Database Isolation & Physical Separation Safeguards", () => {
  const devDbPath = path.resolve(process.cwd(), "prisma/dev.db");
  const testDbPath = path.resolve(process.cwd(), "prisma/test.db");

  it("ensures the active test DATABASE_URL points to the isolated test database", () => {
    const activeUrl = process.env.DATABASE_URL;
    expect(activeUrl).toBeDefined();
    expect(activeUrl).toContain("test.db");
    expect(activeUrl).not.toContain("dev.db");
  });

  it("ensures the test database path is physically distinct from the protected dev database", () => {
    const activeUrl = process.env.DATABASE_URL || "";
    const cleanPath = activeUrl.replace(/^file:/, "");
    const resolvedActivePath = path.isAbsolute(cleanPath)
      ? cleanPath
      : path.resolve(process.cwd(), cleanPath);

    expect(resolvedActivePath).not.toBe(devDbPath);
    expect(resolvedActivePath).toBe(testDbPath);
  });

  it("strictly refuses execution when given a relative dev.db URL", () => {
    expect(() => validateTestDatabaseUrl("file:./dev.db")).toThrowError(
      /protected development database/i
    );
    expect(() => validateTestDatabaseUrl("file:./prisma/dev.db")).toThrowError(
      /protected development database/i
    );
  });

  it("strictly refuses execution when given an absolute dev.db path", () => {
    expect(() => validateTestDatabaseUrl(`file:${devDbPath}`)).toThrowError(
      /protected development database/i
    );
    expect(() => validateTestDatabaseUrl(devDbPath)).toThrowError(
      /protected development database/i
    );
  });

  it("strictly refuses execution when given an un-isolated database without 'test' in the name", () => {
    expect(() => validateTestDatabaseUrl("file:./production.db")).toThrowError(
      /must explicitly target a designated test database/i
    );
  });

  it("strictly refuses execution when DATABASE_URL is empty or undefined", () => {
    expect(() => validateTestDatabaseUrl("")).toThrowError(
      /DATABASE_URL is undefined or empty/i
    );
    expect(() => validateTestDatabaseUrl(undefined)).toThrowError(
      /DATABASE_URL is undefined or empty/i
    );
  });

  it("validates successfully when given an isolated test database URL", () => {
    expect(() => validateTestDatabaseUrl("file:./prisma/test.db")).not.toThrow();
    expect(() => validateTestDatabaseUrl(`file:${testDbPath}`)).not.toThrow();
  });
});
