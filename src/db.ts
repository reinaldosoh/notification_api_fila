import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

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
