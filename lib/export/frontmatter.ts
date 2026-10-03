/**
 * YAML frontmatter for exported notes (PRD §4.16).
 *
 * Deliberately a tiny hand-rolled subset rather than a YAML dependency: the
 * only values written are an id, three timestamps and a boolean, and a full
 * YAML parser on untrusted imported files is a much larger attack surface than
 * the feature justifies.
 */

export interface NoteMeta {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  pinned?: boolean;
}

const FENCE = "---";

function quote(value: string): string {
  // Only quote when the value could otherwise be misread as YAML.
  return /^[\w.:+-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}

export function serialise(meta: NoteMeta, body: string): string {
  const lines = [FENCE];
  if (meta.id) lines.push(`id: ${quote(meta.id)}`);
  if (meta.createdAt) lines.push(`created: ${quote(meta.createdAt)}`);
  if (meta.updatedAt) lines.push(`updated: ${quote(meta.updatedAt)}`);
  if (meta.pinned) lines.push("pinned: true");
  lines.push(FENCE, "");
  return `${lines.join("\n")}\n${body}`;
}

/**
 * Split frontmatter from the body.
 *
 * A file with no frontmatter, or malformed frontmatter, is returned whole as
 * the body (R16.4) — a note from Bear or Obsidian must still import cleanly,
 * and losing someone's text to a parse error is far worse than losing metadata.
 */
export function parse(source: string): { meta: NoteMeta; body: string } {
  const normalised = source.replace(/^﻿/, "");
  if (!normalised.startsWith(`${FENCE}\n`) && !normalised.startsWith(`${FENCE}\r\n`)) {
    return { meta: {}, body: source };
  }

  const lines = normalised.split(/\r?\n/);
  const end = lines.indexOf(FENCE, 1);
  if (end === -1) return { meta: {}, body: source };

  const meta: NoteMeta = {};
  for (const line of lines.slice(1, end)) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }

    if (key === "id") meta.id = value;
    else if (key === "created") meta.createdAt = value;
    else if (key === "updated") meta.updatedAt = value;
    else if (key === "pinned") meta.pinned = value === "true";
  }

  // Drop one blank line after the closing fence, which serialise() adds.
  let start = end + 1;
  if (lines[start] === "") start += 1;

  return { meta, body: lines.slice(start).join("\n") };
}
