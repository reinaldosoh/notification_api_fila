import { request } from "undici";
import { pool } from "./db.js";
import { config } from "./config.js";
import type { DeliveryJob } from "./queue.js";

type WebhookRow = {
  destination_url: string;
  destination_headers: Record<string, string> | null;
};

type DeliveryRow = {
  request_body: unknown;
  request_headers: Record<string, string> | null;
};

export async function deliver(job: DeliveryJob, attempt: number): Promise<void> {
  const { rows: whRows } = await pool.query<WebhookRow>(
    `SELECT destination_url, destination_headers
       FROM webhooks
      WHERE id = $1 AND active = TRUE`,
    [job.webhookId]
  );
  const webhook = whRows[0];
  if (!webhook) {
    throw new Error(`Webhook ${job.webhookId} não existe ou está inativo`);
  }

  const { rows: delRows } = await pool.query<DeliveryRow>(
    `SELECT request_body, request_headers FROM deliveries WHERE id = $1`,
    [job.deliveryId]
  );
  const delivery = delRows[0];
  if (!delivery) {
    throw new Error(`Delivery ${job.deliveryId} não encontrada`);
  }

  await pool.query(
    `UPDATE deliveries
        SET status = 'processing',
            attempt = $1,
            started_at = COALESCE(started_at, NOW())
      WHERE id = $2`,
    [attempt, job.deliveryId]
  );

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "webhook-queue-api/1.0",
    ...(webhook.destination_headers ?? {}),
    "x-webhook-id": job.webhookId,
    "x-delivery-id": String(job.deliveryId),
    "x-delivery-attempt": String(attempt),
  };

  let status: number | null = null;
  let responseBody: string | null = null;

  try {
    const res = await request(webhook.destination_url, {
      method: "POST",
      headers,
      body: JSON.stringify(delivery.request_body ?? {}),
      headersTimeout: config.delivery.timeoutMs,
      bodyTimeout: config.delivery.timeoutMs,
    });
    status = res.statusCode;
    responseBody = (await res.body.text()).slice(0, 10_000);

    if (status >= 200 && status < 300) {
      await pool.query(
        `UPDATE deliveries
            SET status = 'succeeded',
                response_status = $1,
                response_body = $2,
                error = NULL,
                finished_at = NOW()
          WHERE id = $3`,
        [status, responseBody, job.deliveryId]
      );
      return;
    }

    throw new Error(`HTTP ${status}: ${responseBody?.slice(0, 500) ?? ""}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE deliveries
          SET response_status = $1,
              response_body = $2,
              error = $3
        WHERE id = $4`,
      [status, responseBody, message, job.deliveryId]
    );
    throw err;
  }
}
