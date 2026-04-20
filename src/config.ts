import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  logLevel: process.env.LOG_LEVEL ?? "info",

  publicBaseUrl: required("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/+$/, ""),

  apiKey: required("API_KEY"),
  adminUser: process.env.ADMIN_USER ?? "admin",
  adminPassword: required("ADMIN_PASSWORD"),

  databaseUrl: process.env.DATABASE_URL ?? null,
  pg: {
    host: process.env.PGHOST ?? null,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER ?? null,
    password: process.env.PGPASSWORD ?? null,
    database: process.env.PGDATABASE ?? null,
  },
  redisUrl: process.env.REDIS_URL ?? null,
  redis: {
    host: process.env.REDIS_HOST ?? null,
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    username: process.env.REDIS_USERNAME ?? undefined,
    password: process.env.REDIS_PASSWORD ?? undefined,
    db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0,
  },

  delivery: {
    timeoutMs: Number(process.env.DELIVERY_TIMEOUT_MS ?? 30000),
    maxAttempts: Number(process.env.DELIVERY_MAX_ATTEMPTS ?? 5),
  },
} as const;
