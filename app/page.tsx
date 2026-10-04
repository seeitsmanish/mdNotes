import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth/session";
import { Shell } from "@/components/shell/Shell";
import { countNotes, listNotes } from "@/lib/db/notes";
import { getSettingsForRequest } from "@/lib/db/settings";
import type { NoteCounts, NoteListItem } from "@/lib/types";
import { CLOCK_COOKIE, parseClockCookie } from "@/lib/clock";
import type { SyncedSettings } from "@/lib/store/useUiStore";

/**
 * Initial fetch happens on the server so the shell paints with content rather
 * than two empty panes. Everything after this is client-side.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  // The real gate. proxy.ts already turned anonymous traffic away, but a page
  // must not depend on that alone.
  if (!(await hasSession())) redirect("/login");

  let initialNotes: NoteListItem[] = [];
  let initialCounts: NoteCounts = { all: 0, pinned: 0, trash: 0 };
  let initialSettings: SyncedSettings | null = null;
  let dbError: string | null = null;

  try {
    [initialNotes, initialCounts] = await Promise.all([listNotes({ filter: "all" }), countNotes()]);
  } catch (error) {
    // The overwhelmingly likely cause is that Postgres isn't up yet, so say so
    // rather than showing a stack trace.
    dbError = error instanceof Error ? error.message : "Unknown database error.";
  }

  // Settings are read separately and on purpose. They have defaults, so a
  // failure here must degrade to the default appearance rather than take the
  // whole app down with it — notes that read perfectly well are the point.
  try {
    initialSettings = (await getSettingsForRequest()) as SyncedSettings;
  } catch {
    initialSettings = null;
  }

  if (dbError) return <DatabaseDown detail={dbError} />;

  // Dates in the list are rendered in the browser's timezone and locale, and
  // at this instant, so hydration sees the same text (PRD R38.6).
  // Before the browser has said, both sides use UTC and en-US explicitly: an
  // unset zone means "this machine's", which differs between the two.
  const saved = parseClockCookie((await cookies()).get(CLOCK_COOKIE)?.value);
  const clock = { now: Date.now(), timeZone: saved.timeZone ?? "UTC", locale: saved.locale ?? "en-US" };

  return (
    <Shell
      initialClock={clock}
      initialNotes={initialNotes}
      initialCounts={initialCounts}
      initialSettings={initialSettings}
    />
  );
}

function DatabaseDown({ detail }: { detail: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-lg font-semibold">myNotes can’t reach its database</h1>
      <p className="text-[0.85rem] leading-relaxed text-ink-soft">
        Postgres runs in Docker for local development. Start it, push the schema, then reload:
      </p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-code-bg px-4 py-3 font-mono text-[0.78rem] leading-relaxed">
        {`docker compose up -d\npnpm db:push\npnpm db:seed`}
      </pre>
      <p className="text-[0.75rem] text-ink-faint">
        Reported: <span className="font-mono">{detail}</span>
      </p>
    </main>
  );
}
