import Fastify from "fastify";
import basicAuth from "@fastify/basic-auth";

import { config } from "./config.js";
import { pool } from "./db.js";
import { bootstrapQueuesFromDb, shutdownAllQueues } from "./queue.js";
import { adminRoutes } from "./routes/admin.js";
import { ingestRoutes } from "./routes/ingest.js";
import { healthRoutes } from "./routes/health.js";
import { initBoard } from "./board.js";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty" },
    },
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024,
  });

  await app.register(basicAuth, {
    validate: async (username, password) => {
      if (username !== config.adminUser || password !== config.adminPassword) {
        throw new Error("credenciais inválidas");
      }
    },
    authenticate: { realm: "queues" },
  });

  await app.register(healthRoutes);
  await app.register(ingestRoutes);
  await app.register(adminRoutes, { prefix: "/admin" });

  const boardAdapter = initBoard();

  await app.register(
    async (scoped) => {
      scoped.addHook("onRequest", scoped.basicAuth);
      await scoped.register(boardAdapter.registerPlugin(), { prefix: "/" });
    },
    { prefix: "/admin/queues" }
  );

  await bootstrapQueuesFromDb();

  return app;
}

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Recebido ${signal}, encerrando...`);
    try {
      await app.close();
      await shutdownAllQueues();
      await pool.end();
    } catch (err) {
      app.log.error({ err }, "erro ao encerrar");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
