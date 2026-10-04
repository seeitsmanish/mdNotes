/**
 * Google Keep, from a Google Takeout export (PRD §4.75): one JSON file per
 * note under Takeout/Keep/. Pure — the caller resolves attachment paths.
 */

export interface KeepNote {
  title?: string;
  textContent?: string;
  listContent?: Array<{ text?: string; isChecked?: boolean }>;
  isPinned?: boolean;
  isArchived?: boolean;
  isTrashed?: boolean;
  labels?: Array<{ name?: string }>;
  annotations?: Array<{ url?: string; title?: string }>;
  attachments?: Array<{ filePath?: string; mimetype?: string }>;
  createdTimestampUsec?: number;
  userEditedTimestampUsec?: number;
}

/** Whether a JSON file is a Keep note rather than some other Takeout file. */
export function parseKeep(text: string): KeepNote | null {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const note = value as KeepNote & Record<string, unknown>;
    const looksLikeKeep = "userEditedTimestampUsec" in note && ("textContent" in note || "listContent" in note || "title" in note);
    return looksLikeKeep ? note : null;
  } catch {
    return null;
  }
}

/** A label as a tag: `#travel`, or `#multi word#` when it has spaces. */
export function labelTag(name: string): string {
  const clean = name.trim().replace(/#/g, "");
  if (!clean) return "";
  return /\s/.test(clean) ? `#${clean}#` : `#${clean}`;
}

export interface ImportedNote {
  body: string;
  createdAt?: Date;
  pinned?: boolean;
  archived?: boolean;
}

/**
 * Keep → markdown: title as a heading, the text, a checklist as to-dos,
 * links, images, and labels as tags. Trashed notes give null.
 */
export function keepToNote(note: KeepNote, imageUrl: (filePath: string) => string | null): ImportedNote | null {
  if (note.isTrashed) return null;
  const parts: string[] = [];
  const title = note.title?.trim();
  if (title) parts.push(`# ${title}`);
  const text = note.textContent?.replace(/\r\n?/g, "\n").trim();
  if (text) parts.push(text);
  if (note.listContent?.length) {
    parts.push(note.listContent.map((item) => `- [${item.isChecked ? "x" : " "}] ${(item.text ?? "").trim()}`).join("\n"));
  }
  const links = (note.annotations ?? []).filter((a) => a.url).map((a) => `[${(a.title || a.url)!.replace(/[[\]]/g, "")}](${a.url})`);
  if (links.length) parts.push(links.join("\n"));
  const images = (note.attachments ?? [])
    .filter((a) => a.filePath && (a.mimetype ?? "").startsWith("image/"))
    .map((a) => imageUrl(a.filePath!))
    .filter((url): url is string => url !== null)
    .map((url) => `![](${url})`);
  if (images.length) parts.push(images.join("\n\n"));
  const tags = (note.labels ?? []).map((l) => labelTag(l.name ?? "")).filter(Boolean);
  if (tags.length) parts.push(tags.join(" "));
  if (parts.length === 0) return null;

  const usec = note.createdTimestampUsec ?? note.userEditedTimestampUsec;
  const createdAt = usec ? new Date(Math.floor(usec / 1000)) : undefined;
  return {
    body: `${parts.join("\n\n")}\n`,
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : undefined,
    pinned: note.isPinned === true,
    archived: note.isArchived === true,
  };
}
