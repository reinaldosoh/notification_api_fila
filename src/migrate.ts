import { pool } from "./db.js";

const SQL = `
CREATE TABLE IF NOT EXISTS webhooks (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  destination_url     TEXT NOT NULL,
  destination_headers JSONB,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id               BIGSERIAL PRIMARY KEY,
  webhook_id       TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'queued',
  attempt          INT  NOT NULL DEFAULT 0,
  request_body     JSONB,
  request_headers  JSONB,
  response_status  INT,
  response_body    TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook_created
  ON deliveries (webhook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_status
  ON deliveries (status);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log("Migrations aplicadas com sucesso.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
