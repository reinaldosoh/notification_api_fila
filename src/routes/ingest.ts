import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { ensureWebhookQueue } from "../queue.js";

type WebhookRow = {
  id: string;
  name: string;
  active: boolean;
};

export async function ingestRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/w/:id", async (req, reply) => {
    const { rows } = await pool.query<WebhookRow>(
      `SELECT id, name, active FROM webhooks WHERE id = $1`,
      [req.params.id]
    );
    const webhook = rows[0];
    if (!webhook) {
      return reply.code(404).send({ error: "webhook não encontrado" });
    }
    if (!webhook.active) {
      return reply.code(409).send({ error: "webhook inativo" });
    }

    const incomingHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") incomingHeaders[k] = v;
      else if (Array.isArray(v)) incomingHeaders[k] = v.join(",");
    }

    const insert = await pool.query<{ id: number }>(
      `INSERT INTO deliveries (webhook_id, status, request_body, request_headers)
       VALUES ($1, 'queued', $2, $3)
       RETURNING id`,
      [webhook.id, req.body ?? {}, incomingHeaders]
    );
    const deliveryId = insert.rows[0].id;

    const queue = await ensureWebhookQueue(webhook.id, webhook.name);
    await queue.add(
      `delivery-${deliveryId}`,
      { deliveryId, webhookId: webhook.id },
      { jobId: `d-${deliveryId}` }
    );

    return reply.code(202).send({
      accepted: true,
      delivery_id: deliveryId,
      webhook_id: webhook.id,
    });
  });
}
