import { processPushBatch } from "@/server/push/worker";
import { runRecordedWorker } from "@/server/workers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(
      await runRecordedWorker("push", () => processPushBatch(50)),
    );
  } catch {
    return Response.json(
      { error: "Push processing failed. Review operations." },
      { status: 503 },
    );
  }
}

export const POST = GET;
