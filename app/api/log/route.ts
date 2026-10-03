import { guarded } from "@/lib/auth/session";
import { normaliseReport } from "@/lib/report/report";

/**
 * Client errors, written to the server log where the host keeps them
 * (PRD §4.32). Signed-in callers only, bounded fields, and a per-instance
 * ceiling, so the log cannot be flooded — by a stranger or by a loop.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
let windowStart = 0;
let count = 0;

async function handlePOST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const report = normaliseReport(payload);
  if (!report) return new Response(null, { status: 400 });

  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    count = 0;
  }
  count += 1;
  if (count > MAX_PER_WINDOW) return new Response(null, { status: 429 });

  console.error(JSON.stringify({ type: "client-error", at: new Date(now).toISOString(), ...report }));
  return new Response(null, { status: 204 });
}

export const POST = guarded(handlePOST);
