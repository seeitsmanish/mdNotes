import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth/session";
import { composeShared } from "@/lib/share/compose";
import { SharePreview } from "./SharePreview";

/**
 * Where the phone's share sheet sends things (PRD §4.31).
 *
 * Nothing is saved on arrival. A share arrives as a GET, and a GET that
 * wrote a note would let any website plant notes in this account just by
 * linking here — the session cookie travels with a top-level link. So this
 * shows what would be saved, editable, and saving takes one tap.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function SharePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (!(await hasSession())) {
    const query = new URLSearchParams();
    for (const key of ["title", "text", "url", "clip"]) if (first(params[key])) query.set(key, first(params[key]));
    redirect(`/login?next=${encodeURIComponent(`/share?${query}`)}`);
  }

  // From the web clipper (PRD §4.73): the selected text is a quote from the page.
  const clip = first(params.clip) === "1";
  const raw = first(params.text);
  const text = clip && raw.trim() ? raw.trim().split(/\r?\n/).map((line) => `> ${line}`).join("\n") : raw;
  const body = composeShared({ title: first(params.title), text, url: first(params.url) });
  return <SharePreview initialBody={body} clip={clip} />;
}
