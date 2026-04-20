import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { pool } from "../db.js";
import { config } from "../config.js";
import { ensureWebhookQueue, removeWebhookQueue } from "../queue.js";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  destination_url: z.string().url(),
  destination_headers: z.record(z.string()).optional(),
  active: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

function requireApiKey(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const key = req.headers["x-api-key"];
    if (key !== config.apiKey) {
      return reply.code(401).send({ error: "API key inválida" });
    }
  });
}

function buildWebhookUrl(id: string) {
  return `${config.publicBaseUrl}/w/${id}`;
}

export async function adminRoutes(app: FastifyInstance) {
  requireApiKey(app);

  // Criar webhook
  app.post("/webhooks", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "payload inválido", details: parsed.error.flatten() });
    }
    const id = nanoid(16);
    const { name, destination_url, destination_headers, active } = parsed.data;

    const { rows } = await pool.query(
      `INSERT INTO webhooks (id, name, destination_url, destination_headers, active)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
       RETURNING *`,
      [id, name, destination_url, destination_headers ?? null, active ?? null]
    );

    const wh = rows[0];
    if (wh.active) await ensureWebhookQueue(id);

    return reply.code(201).send({
      ...wh,
      webhook_url: buildWebhookUrl(id),
    });
  });

  // Listar webhooks
  app.get("/webhooks", async () => {
    const { rows } = await pool.query(
      `SELECT * FROM webhooks ORDER BY created_at DESC`
    );
    return rows.map((w) => ({ ...w, webhook_url: buildWebhookUrl(w.id) }));
  });

  // Detalhar webhook
  app.get<{ Params: { id: string } }>("/webhooks/:id", async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM webhooks WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: "não encontrado" });
    return { ...rows[0], webhook_url: buildWebhookUrl(rows[0].id) };
  });

  // Atualizar webhook
  app.patch<{ Params: { id: string } }>("/webhooks/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "payload inválido", details: parsed.error.flatten() });
    }
    const fields = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (sets.length === 0) {
      return reply.code(400).send({ error: "nenhum campo para atualizar" });
    }
    sets.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE webhooks SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return reply.code(404).send({ error: "não encontrado" });

    if (rows[0].active) {
      await ensureWebhookQueue(rows[0].id);
    } else {
      await removeWebhookQueue(rows[0].id);
    }

    return { ...rows[0], webhook_url: buildWebhookUrl(rows[0].id) };
  });

  // Deletar webhook
  app.delete<{ Params: { id: string } }>("/webhooks/:id", async (req, reply) => {
    await removeWebhookQueue(req.params.id);
    const { rowCount } = await pool.query(
      `DELETE FROM webhooks WHERE id = $1`,
      [req.params.id]
    );
    if (!rowCount) return reply.code(404).send({ error: "não encontrado" });
    return reply.code(204).send();
  });

  // Histórico de entregas
  app.get<{ Params: { id: string }; Querystring: { limit?: string; status?: string } }>(
    "/webhooks/:id/deliveries",
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? 50), 500);
      const status = req.query.status;

      const params: unknown[] = [req.params.id];
      let where = `webhook_id = $1`;
      if (status) {
        params.push(status);
        where += ` AND status = $${params.length}`;
      }

      const { rows } = await pool.query(
        `SELECT id, status, attempt, response_status, error, created_at, started_at, finished_at
           FROM deliveries
          WHERE ${where}
          ORDER BY id DESC
          LIMIT ${limit}`,
        params
      );
      return rows;
    }
  );

  // Detalhe de uma entrega (com body completo)
  app.get<{ Params: { deliveryId: string } }>("/deliveries/:deliveryId", async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM deliveries WHERE id = $1`,
      [req.params.deliveryId]
    );
    if (!rows[0]) return reply.code(404).send({ error: "não encontrado" });
    return rows[0];
  });
}
