import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { deliver } from "./delivery.js";
import { pool } from "./db.js";
import { boardAddQueue, boardRemoveQueue } from "./board.js";

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export type DeliveryJob = {
  deliveryId: number;
  webhookId: string;
};

const QUEUE_PREFIX = "wh";

function queueName(webhookId: string) {
  return `${QUEUE_PREFIX}:${webhookId}`;
}

type Bundle = {
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

export function getQueue(webhookId: string): Queue<DeliveryJob> {
  const b = bundles.get(webhookId);
  if (!b) {
    throw new Error(`Fila ainda não inicializada para webhook ${webhookId}`);
  }
  return b.queue;
}

export function listQueues(): Queue[] {
  return [...bundles.values()].map((b) => b.queue);
}

export async function ensureWebhookQueue(webhookId: string): Promise<Queue<DeliveryJob>> {
  const existing = bundles.get(webhookId);
  if (existing) return existing.queue;

  const name = queueName(webhookId);

  const queue = new Queue<DeliveryJob>(name, {
    connection: redis,
    defaultJobOptions,
  });

  const worker = new Worker<DeliveryJob>(
    name,
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

  const events = new QueueEvents(name, { connection: redis.duplicate() });

  bundles.set(webhookId, { queue, worker, events });
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
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM webhooks WHERE active = TRUE`
  );
  for (const row of rows) {
    await ensureWebhookQueue(row.id);
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
