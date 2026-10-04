import { createHash } from "node:crypto";
import TurndownService from "turndown";
import type { ImportedNote } from "./keep";

/**
 * Evernote's .enex export (PRD §4.75): XML holding each note's title, dates,
 * tags, its body as ENML (restricted HTML) and its attachments in base64.
 * The XML has a fixed, flat shape, so it is read with patterns rather than a
 * full XML parser; the body HTML goes through Turndown to become markdown.
 */

export interface EnexResource {
  /** MD5 of the bytes: how the body's <en-media hash="…"> refers to it. */
  hash: string;
  mime: string;
  bytes: Uint8Array;
}

export interface EnexNote {
  title: string;
  html: string;
  created?: Date;
  tags: string[];
  resources: EnexResource[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function field(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block);
  return match?.[1];
}

function enexDate(value: string | undefined): Date | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value?.trim() ?? "");
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
}

export function parseEnex(xml: string): EnexNote[] {
  const notes: EnexNote[] = [];
  for (const [, block = ""] of xml.matchAll(/<note>([\s\S]*?)<\/note>/g)) {
    const content = field(block, "content") ?? "";
    const html = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(content)?.[1] ?? decode(content);
    const resources: EnexResource[] = [];
    for (const [, res = ""] of block.matchAll(/<resource>([\s\S]*?)<\/resource>/g)) {
      const data = (field(res, "data") ?? "").replace(/\s+/g, "");
      if (!data) continue;
      const bytes = new Uint8Array(Buffer.from(data, "base64"));
      resources.push({ hash: createHash("md5").update(bytes).digest("hex"), mime: (field(res, "mime") ?? "").trim(), bytes });
    }
    notes.push({
      title: decode(field(block, "title") ?? "").trim(),
      html,
      created: enexDate(field(block, "created")),
      tags: [...block.matchAll(/<tag>([\s\S]*?)<\/tag>/g)].map((m) => decode(m[1] ?? "").trim()).filter(Boolean),
      resources,
    });
  }
  return notes;
}

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*" });

/** ENML → markdown, with <en-media> pointing at wherever `mediaUrl` says (or dropped). */
export function enmlToMarkdown(html: string, mediaUrl: (hash: string) => string | null): string {
  const prepared = html
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    // Checkboxes become text markers first: as unknown tags an HTML parser
    // would swallow the text after them.
    .replace(/<en-todo\b([^>]*?)\/?>(?:<\/en-todo>)?/gi, (_whole, attrs: string) => (/checked="true"/i.test(attrs) ? "[x] " : "[ ] "))
    .replace(/<en-media\b([^>]*?)\/?>(?:<\/en-media>)?/gi, (_whole, attrs: string) => {
      const hash = /hash="([0-9a-f]{32})"/i.exec(attrs)?.[1];
      const url = hash ? mediaUrl(hash.toLowerCase()) : null;
      return url ? `<img src="${url}" alt="">` : "";
    });
  return turndown
    .turndown(prepared)
    .split("\n")
    // A to-do outside a list becomes a list item, so it is a real checkbox.
    .map((line) => line.replace(/^(\s*)\\?\[( |x)\\?\] /, "$1- [$2] ").replace(/^(\s*)- - \[/, "$1- ["))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function enexToNote(note: EnexNote, mediaUrl: (hash: string) => string | null): ImportedNote | null {
  const body = enmlToMarkdown(note.html, mediaUrl);
  const tags = note.tags.map((t) => (/\s/.test(t) ? `#${t.replace(/#/g, "")}#` : `#${t.replace(/#/g, "")}`));
  const parts = [note.title ? `# ${note.title}` : "", body, tags.join(" ")].filter((part) => part.trim());
  if (parts.length === 0) return null;
  return { body: `${parts.join("\n\n")}\n`, createdAt: note.created };
}
