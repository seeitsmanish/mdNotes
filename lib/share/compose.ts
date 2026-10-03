/**
 * What a share becomes (PRD §4.31).
 *
 * Phones hand a share over as up to three loose fields — title, text, url —
 * filled inconsistently: Chrome on Android puts the link in `text` and leaves
 * `url` empty; other apps send a title that is just the site name. This turns
 * whatever arrives into a tidy note: a heading, the text, and the link once.
 */

export interface Shared {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").trim();
}

export function composeShared(shared: Shared): string {
  const title = clean(shared.title);
  let text = clean(shared.text);
  let url = clean(shared.url);

  // The link often arrives inside the text instead of on its own.
  if (!url) {
    const found = URL_IN_TEXT.exec(text);
    if (found) url = found[0];
  }
  if (url && text.includes(url)) {
    text = text.replace(url, "").replace(/[ \t]+\n/g, "\n").trim();
  }
  // A text that only repeats the title adds nothing.
  if (text && title && text === title) text = "";

  // Without a title, the text's first line becomes the heading — and is then
  // not repeated underneath it.
  let body = text;
  let heading = title;
  if (!heading && text) {
    const [first = "", ...rest] = text.split("\n");
    heading = first.slice(0, 80);
    body = first.length > 80 ? text : rest.join("\n").trim();
  }
  if (!heading && url) heading = hostOf(url);

  const parts: string[] = [];
  if (heading) parts.push(`# ${heading}`);
  if (body) parts.push(body);
  if (url) parts.push(url);
  return parts.join("\n\n") + "\n";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
