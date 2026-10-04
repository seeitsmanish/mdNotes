import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sharedNote } from "@/lib/db/shares";
import { markdownToHtml } from "@/lib/export/toHtml";
import { displayTitle } from "@/lib/markdown/derive";

/**
 * A note shared by link (PRD §4.68): read-only, rendered on the server with
 * the Copy as HTML renderer (all note text escaped, only safe links), no app
 * chrome, not indexed, never cached — revoking the link ends it at once.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const note = await sharedNote((await params).token);
  return {
    title: note ? `${displayTitle(note.title)} · mdNotes` : "Not found · mdNotes",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function SharedNote({ params }: Props) {
  const { token } = await params;
  const note = await sharedNote(token);
  if (!note) notFound();

  // The renderer only keeps absolute image URLs, so app images are given a
  // placeholder origin and then pointed at this link's own image route.
  const html = markdownToHtml(note.body, { origin: IMAGE_ORIGIN }).replace(
    /src="https:\/\/images\.invalid\/api\/attachments\/([A-Za-z0-9]+)"/g,
    (_, id: string) => `src="/s/${token}/a/${id}"`,
  );
  const updated = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    note.updatedAt,
  );

  return (
    <div className="ursa-shared">
      <style>{SHARED_CSS}</style>
      <article className="ursa-shared-body" dangerouslySetInnerHTML={{ __html: html }} />
      <footer className="ursa-shared-foot">
        Updated {updated} · Shared from <a href="https://www.mdnotes.in">mdNotes</a>
      </footer>
    </div>
  );
}

const IMAGE_ORIGIN = "https://images.invalid";

const SHARED_CSS = `
.ursa-shared { --bg:#fbfaf7; --ink:#1d2127; --soft:#5a616b; --line:#e5e1d8; --code:#f2efe8; --link:#1f6fd1;
  min-height:100dvh; background:var(--bg); color:var(--ink); padding:clamp(1.5rem,5vw,4rem) 1rem 3rem; }
@media (prefers-color-scheme: dark) { .ursa-shared { --bg:#111418; --ink:#e6e9ee; --soft:#a0a8b3; --line:#2a3039; --code:#1a1f26; --link:#7fb2ff; } }
.ursa-shared-body { max-width:44rem; margin:0 auto; font:1.06rem/1.7 "Literata Variable","Iowan Old Style",Georgia,serif; overflow-wrap:anywhere; }
.ursa-shared-body h1,.ursa-shared-body h2,.ursa-shared-body h3 { font-family:var(--font-sans); line-height:1.25; letter-spacing:-0.01em; text-wrap:balance; }
.ursa-shared-body h1 { font-size:2rem; margin:0 0 1rem; }
.ursa-shared-body h2 { font-size:1.4rem; margin:2rem 0 .6rem; }
.ursa-shared-body h3 { font-size:1.15rem; margin:1.6rem 0 .4rem; }
.ursa-shared-body p { margin:0 0 1rem; }
.ursa-shared-body ul,.ursa-shared-body ol { margin:0 0 1rem; padding-left:1.5rem; }
.ursa-shared-body ul { list-style:disc; }
.ursa-shared-body ol { list-style:decimal; }
.ursa-shared-body li { margin:.2rem 0; }
.ursa-shared-body strong { font-weight:700; }
.ursa-shared-body em { font-style:italic; }
.ursa-shared-body mark { background:#ffe58a; color:#1d2127; padding:0 .15em; border-radius:3px; }
.ursa-shared-body a { color:var(--link); }
.ursa-shared-body img { max-width:100%; height:auto; border-radius:10px; }
.ursa-shared-body pre { background:var(--code); border:1px solid var(--line); border-radius:10px; padding:.9rem 1rem; overflow-x:auto; font-size:.86rem; line-height:1.55; }
.ursa-shared-body code { font-family:var(--font-mono); font-size:.9em; }
.ursa-shared-body :not(pre)>code { background:var(--code); padding:.1em .3em; border-radius:4px; }
.ursa-shared-body blockquote { margin:1rem 0; padding-left:1rem; border-left:3px solid var(--line); color:var(--soft); }
.ursa-shared-body table { border-collapse:collapse; display:block; overflow-x:auto; max-width:100%; }
.ursa-shared-body th,.ursa-shared-body td { border:1px solid var(--line); padding:.4rem .6rem; text-align:left; }
.ursa-shared-body hr { border:0; border-top:1px solid var(--line); margin:2rem 0; }
.ursa-shared-foot { max-width:44rem; margin:3rem auto 0; padding-top:1rem; border-top:1px solid var(--line); color:var(--soft); font:.82rem/1.5 var(--font-sans); }
.ursa-shared-foot a { color:inherit; }
`;
