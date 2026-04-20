import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { redis } from "../queue.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/ready", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
      const pong = await redis.ping();
      return { ok: pong === "PONG" };
    } catch (err) {
      return reply.code(503).send({ ok: false, error: (err as Error).message });
    }
  });
}
