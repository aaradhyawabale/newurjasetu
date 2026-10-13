import crypto from "crypto";
import { prisma } from "../db/prisma";

export interface CacheEntryMetadata<T> {
  data: T;
  fetchedAt: string;
  expiresAt: string;
  isStale: boolean;
  ageSeconds: number;
}

const inFlightRequests = new Map<string, Promise<any>>();

function canonicalizeValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    const mapped = val.map(canonicalizeValue);
    if (mapped.every((item) => typeof item === "string")) {
      return [...(mapped as string[])].sort();
    }
    return mapped;
  }
  if (val !== null && typeof val === "object") {
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      const v = (val as Record<string, unknown>)[k];
      if (v !== undefined) {
        out[k] = canonicalizeValue(v);
      }
    }
    return out;
  }
  return val;
}

export function generateCacheKey(provider: string, params: Record<string, unknown>): string {
  // Round lat/lng to 4 decimal places (~11 meters) to allow natural cache hits
  const sanitizedParams: Record<string, unknown> = { ...params };
  if (typeof sanitizedParams.lat === "number" && Number.isFinite(sanitizedParams.lat)) {
    sanitizedParams.lat = Math.round(sanitizedParams.lat * 10000) / 10000;
  }
  if (typeof sanitizedParams.lng === "number" && Number.isFinite(sanitizedParams.lng)) {
    sanitizedParams.lng = Math.round(sanitizedParams.lng * 10000) / 10000;
  }

  const canonical = canonicalizeValue(sanitizedParams);
  const raw = `${provider.trim().toLowerCase()}:${JSON.stringify(canonical)}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Coalesces concurrent identical provider requests so duplicate network calls
 * and race-condition DB writes are avoided.
 */
export async function withInFlightDedup<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

export function getInFlightCount(): number {
  return inFlightRequests.size;
}

/**
 * Retrieves a cached provider response along with freshness / staleness metadata.
 * When allowStale is true, expired entries within maxStaleHours (default 168h / 7 days)
 * are returned with isStale = true so callers can fall back to them during provider outages
 * while explicitly flagging stale provenance.
 */
export async function getCachedEntry<T>(
  key: string,
  options?: { allowStale?: boolean; maxStaleHours?: number }
): Promise<CacheEntryMetadata<T> | null> {
  const allowStale = options?.allowStale ?? false;
  const maxStaleHours = options?.maxStaleHours ?? 168; // 7 days max stale retention

  try {
    const cached = await prisma.providerCache.findUnique({
      where: { key },
    });

    if (!cached) return null;

    const now = new Date();
    const isStale = now > cached.expiresAt;
    const ageSeconds = Math.max(
      0,
      Math.round((now.getTime() - cached.fetchedAt.getTime()) / 1000)
    );

    if (isStale) {
      const staleLimitMs = maxStaleHours * 60 * 60 * 1000;
      const timeSinceFetchMs = now.getTime() - cached.fetchedAt.getTime();
      if (timeSinceFetchMs > staleLimitMs) {
        prisma.providerCache.delete({ where: { key } }).catch(() => {});
        return null;
      }
      if (!allowStale) {
        return null;
      }
    }

    const parsed = JSON.parse(cached.response) as T;
    return {
      data: parsed,
      fetchedAt: cached.fetchedAt.toISOString(),
      expiresAt: cached.expiresAt.toISOString(),
      isStale,
      ageSeconds,
    };
  } catch (err) {
    console.warn("[Cache Read Warning]", err);
    return null;
  }
}

export async function getCachedResponse<T>(key: string): Promise<T | null> {
  const entry = await getCachedEntry<T>(key, { allowStale: false });
  return entry ? entry.data : null;
}

export async function setCachedResponse<T>(
  key: string,
  data: T,
  ttlHours = 24
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    const response = JSON.stringify(data);

    await prisma.providerCache.upsert({
      where: { key },
      update: {
        response,
        fetchedAt: now,
        expiresAt,
      },
      create: {
        key,
        response,
        fetchedAt: now,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("[Cache Write Warning]", err);
  }
}
