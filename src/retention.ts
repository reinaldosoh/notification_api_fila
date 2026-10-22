import { config } from "./config.js";
import { pool } from "./db.js";

type Log = { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };

/**
 * Apaga entregas terminadas (succeeded/failed) mais antigas que a retenção, em lotes
 * para não travar a tabela. Entregas em fila ou processando nunca são removidas.
 */
export async function purgeOldDeliveries(): Promise<number> {
  const { deliveriesDays, purgeBatch } = config.retention;
  if (deliveriesDays <= 0) return 0;

  let total = 0;
  for (;;) {
    const res = await pool.query(
      `DELETE FROM deliveries
        WHERE id IN (
          SELECT id FROM deliveries
           WHERE status IN ('succeeded', 'failed')
             AND created_at < NOW() - make_interval(days => $1::int)
           ORDER BY id
           LIMIT $2
        )`,
      [deliveriesDays, purgeBatch]
    );
    const n = res.rowCount ?? 0;
    total += n;
    if (n < purgeBatch) return total;
  }
}

export function startRetention(log: Log): () => void {
  if (config.retention.deliveriesDays <= 0) return () => {};

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const n = await purgeOldDeliveries();
      if (n > 0) log.info({ removidas: n }, "purga de deliveries");
    } catch (err) {
      log.error({ err }, "erro na purga de deliveries");
    } finally {
      running = false;
    }
  };

  const first = setTimeout(tick, 30_000);
  const timer = setInterval(tick, config.retention.purgeIntervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
