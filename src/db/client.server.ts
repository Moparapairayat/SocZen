import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  return databaseUrl;
}

declare global {
  var __soczenDrizzleDb: ReturnType<typeof createDrizzleClient> | undefined;
}

function createDrizzleClient() {
  const url = getDatabaseUrl();
  const isNeon = url.includes("neon.tech") || url.includes("neondatabase") || url.includes("sslmode=require");

  // In Neon serverless environments (e.g. Vercel), HTTP client is the fastest and has zero connection overhead
  if (isNeon && process.env.VERCEL) {
    const sqlClient = neon(url);
    return drizzleHttp(sqlClient, { schema });
  }

  // Use Pool for local development or transaction-heavy environments
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.DATABASE_SSL?.toLowerCase() === "require" ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return drizzleServerless(pool, { schema });
}

export const db = globalThis.__soczenDrizzleDb ?? createDrizzleClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__soczenDrizzleDb = db;
}

export * from "./schema";
