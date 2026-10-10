import crypto from "crypto";
import { prisma } from "../db/prisma";

export function generateCacheKey(provider: string, params: Record<string, unknown>): string {
  // Round lat/lng to 4 decimal places (~11 meters) to allow natural cache hits
  const sanitizedParams = { ...params };
  if (typeof sanitizedParams.lat === "number") {
    sanitizedParams.lat = Math.round(sanitizedParams.lat * 10000) / 10000;
  }
  if (typeof sanitizedParams.lng === "number") {
    sanitizedParams.lng = Math.round(sanitizedParams.lng * 10000) / 10000;
  }

  const raw = `${provider}:${JSON.stringify(sanitizedParams)}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function getCachedResponse<T>(key: string): Promise<T | null> {
  try {
    const cached = await prisma.providerCache.findUnique({
      where: { key },
    });

    if (!cached) return null;

    if (new Date() > cached.expiresAt) {
      // Expired, delete asynchronously
      prisma.providerCache.delete({ where: { key } }).catch(() => {});
      return null;
    }

    return JSON.parse(cached.response) as T;
  } catch (err) {
    console.warn("[Cache Read Warning]", err);
    return null;
  }
}

export async function setCachedResponse<T>(
  key: string,
  data: T,
  ttlHours = 24
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const response = JSON.stringify(data);

    await prisma.providerCache.upsert({
      where: { key },
      update: {
        response,
        fetchedAt: new Date(),
        expiresAt,
      },
      create: {
        key,
        response,
        fetchedAt: new Date(),
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("[Cache Write Warning]", err);
  }
}
