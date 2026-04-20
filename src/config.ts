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

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),

  delivery: {
    timeoutMs: Number(process.env.DELIVERY_TIMEOUT_MS ?? 30000),
    maxAttempts: Number(process.env.DELIVERY_MAX_ATTEMPTS ?? 5),
  },
} as const;
