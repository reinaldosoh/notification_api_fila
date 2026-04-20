import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { deliver } from "./delivery.js";
import { pool } from "./db.js";
import { boardAddQueue, boardRemoveQueue } from "./board.js";

function buildRedis(): IORedis {
  const base = { maxRetriesPerRequest: null, enableReadyCheck: true } as const;
  if (config.redis.host) {
    return new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      username: config.redis.username,
      password: config.redis.password,
      db: config.redis.db,
      ...base,
    });
  }
  if (config.redisUrl) {
    return new IORedis(config.redisUrl, base);
  }
  throw new Error(
    "Configuração Redis ausente. Defina REDIS_HOST/REDIS_PASSWORD ou REDIS_URL."
  );
}

export const redis = buildRedis();

export type DeliveryJob = {
  deliveryId: number;
  webhookId: string;
};

function sanitize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function queueName(name: string, webhookId: string) {
  const safe = sanitize(name) || "webhook";
  return `${safe}-${webhookId}`;
}

type Bundle = {
  name: string;
  queue: Queue<DeliveryJob>;
  worker: Worker<DeliveryJob>;
  events: QueueEvents;
};

const bundles = new Map<string, Bundle>();

const defaultJobOptions: JobsOptions = {
  attempts: config.delivery.maxAttempts,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5000 },
  removeOnFail: { age: 60 * 60 * 24 * 30 },
};

export function listQueues(): Queue[] {
  return [...bundles.values()].map((b) => b.queue);
}

export async function ensureWebhookQueue(
  webhookId: string,
  displayName: string
): Promise<Queue<DeliveryJob>> {
  const desired = queueName(displayName, webhookId);
  const existing = bundles.get(webhookId);
  if (existing && existing.name === desired) {
    return existing.queue;
  }
  if (existing && existing.name !== desired) {
    await removeWebhookQueue(webhookId);
  }

  const queue = new Queue<DeliveryJob>(desired, {
    connection: redis,
    defaultJobOptions,
  });

  const worker = new Worker<DeliveryJob>(
    desired,
    async (job) => {
      return deliver(job.data, job.attemptsMade + 1);
    },
    {
      connection: redis,
      concurrency: 1,
      lockDuration: 60_000,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const attempt = job.attemptsMade;
    const isFinal = attempt >= (job.opts.attempts ?? 1);
    await pool.query(
      `UPDATE deliveries
         SET status = $1,
             attempt = $2,
             error = $3,
             finished_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE finished_at END
       WHERE id = $4`,
      [isFinal ? "failed" : "queued", attempt, err.message, job.data.deliveryId]
    );
  });

  const events = new QueueEvents(desired, { connection: redis.duplicate() });

  bundles.set(webhookId, { name: desired, queue, worker, events });
  boardAddQueue(queue);
  return queue;
}

export async function removeWebhookQueue(webhookId: string) {
  const b = bundles.get(webhookId);
  if (!b) return;
  boardRemoveQueue(b.queue.name);
  await b.worker.close();
  await b.events.close();
  await b.queue.obliterate({ force: true }).catch(() => {});
  await b.queue.close();
  bundles.delete(webhookId);
}

export async function bootstrapQueuesFromDb() {
  const { rows } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM webhooks WHERE active = TRUE`
  );
  for (const row of rows) {
    await ensureWebhookQueue(row.id, row.name);
  }
}

export async function shutdownAllQueues() {
  const tasks: Promise<unknown>[] = [];
  for (const b of bundles.values()) {
    tasks.push(b.worker.close());
    tasks.push(b.events.close());
    tasks.push(b.queue.close());
  }
  await Promise.allSettled(tasks);
  bundles.clear();
  await redis.quit().catch(() => {});
}
