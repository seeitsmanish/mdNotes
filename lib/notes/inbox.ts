/**
 * Quick capture (PRD §4.73): a thought becomes one entry at the end of the
 * Inbox note. Pure, so the format is tested without a database.
 */

export const INBOX_TITLE = "Inbox";
export const INBOX_START = `# ${INBOX_TITLE}\n\nThings captured on the go. Move them where they belong.\n`;
export const MAX_CAPTURE = 10_000;

/**
 * One entry: a bullet with the time it was captured; further lines are
 * indented under it so they stay part of the same item.
 */
export function inboxEntry(text: string, stamp: string): string {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  const [first = "", ...rest] = lines;
  const when = stamp.trim().slice(0, 40).replace(/[_*`[\]]/g, "");
  const head = `- ${first}${when ? ` _(${when})_` : ""}`;
  return [head, ...rest.map((line) => (line.trim() ? `  ${line}` : ""))].join("\n");
}

/** The Inbox body with an entry added at the end. */
export function appendEntry(body: string, entry: string): string {
  const base = body.trim() ? body.replace(/\s+$/, "") : INBOX_START.trimEnd();
  const last = base.slice(base.lastIndexOf("\n") + 1);
  // Straight after a list item (or its indented lines) the entry continues
  // the list; after anything else it starts one, a blank line down.
  const inList = /^(- |  )/.test(last);
  return `${base}\n${inList ? "" : "\n"}${entry}\n`;
}
