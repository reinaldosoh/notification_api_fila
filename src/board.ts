import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import type { Queue } from "bullmq";

let api: ReturnType<typeof createBullBoard> | null = null;
let adapter: FastifyAdapter | null = null;

export function initBoard() {
  adapter = new FastifyAdapter();
  adapter.setBasePath("/admin/queues");
  api = createBullBoard({ queues: [], serverAdapter: adapter });
  return adapter;
}

export function boardAdapter(): FastifyAdapter {
  if (!adapter) throw new Error("board não inicializado");
  return adapter;
}

export function boardAddQueue(q: Queue) {
  api?.addQueue(new BullMQAdapter(q));
}

export function boardRemoveQueue(name: string) {
  api?.removeQueue(name);
}
