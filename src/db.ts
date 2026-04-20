import { Pool, type PoolConfig } from "pg";
import { config } from "./config.js";

function buildPoolConfig(): PoolConfig {
  const { host, port, user, password, database } = config.pg;
  if (host && user && password && database) {
    return { host, port, user, password, database, max: 10 };
  }
  if (config.databaseUrl) {
    return { connectionString: config.databaseUrl, max: 10 };
  }
  throw new Error(
    "Configuração Postgres ausente. Defina PGHOST/PGUSER/PGPASSWORD/PGDATABASE ou DATABASE_URL."
  );
}

export const pool = new Pool(buildPoolConfig());

export type Webhook = {
  id: string;
  name: string;
  destination_url: string;
  destination_headers: Record<string, string> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type Delivery = {
  id: number;
  webhook_id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  attempt: number;
  request_body: unknown;
  request_headers: Record<string, string> | null;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};
