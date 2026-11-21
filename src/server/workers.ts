import "server-only";

import { randomUUID } from "node:crypto";
import { database } from "./db";

export type WorkerName = "mail" | "payments" | "media" | "push";

export async function runRecordedWorker<T extends Record<string, unknown>>(
  worker: WorkerName,
  task: () => Promise<T>,
) {
  const lockClient = await database().connect();
  const id = randomUUID();
  try {
    const lock = await lockClient.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [`paydan-worker:${worker}`],
    );
    if (!lock.rows[0]?.acquired)
      return { skipped: true, reason: "worker-already-running" } as const;
    await database().query(
      "INSERT INTO worker_run(id,worker,status) VALUES($1,$2,'running')",
      [id, worker],
    );
    try {
      const metrics = await task();
      await database().query(
        `UPDATE worker_run SET status='succeeded',completed_at=now(),metrics=$2
         WHERE id=$1`,
        [id, JSON.stringify(metrics)],
      );
      return { skipped: false, ...metrics };
    } catch (error) {
      await database().query(
        `UPDATE worker_run SET status='failed',completed_at=now(),error_class=$2
         WHERE id=$1`,
        [id, error instanceof Error ? error.name : "UnknownError"],
      );
      throw error;
    }
  } finally {
    try {
      await lockClient.query("SELECT pg_advisory_unlock(hashtext($1))", [
        `paydan-worker:${worker}`,
      ]);
    } finally {
      lockClient.release();
    }
  }
}
