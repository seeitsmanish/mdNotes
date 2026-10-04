/**
 * Validates a PATCH /api/notes/:id payload. Pure, so it can be tested without
 * a database (AGENT-LOOP §1 ③).
 */

export interface NotePatch {
  body?: string;
  pinned?: boolean;
  /** Archive (true) or bring back (false) (PRD §4.65). */
  archived?: boolean;
  /** A colour label, or null to clear it. */
  color?: NoteColor | null;
  /** Mark as a template, or back to an ordinary note. */
  template?: boolean;
  /** The version `body` was edited from (PRD R18.2). Absent → unconditional. */
  baseVersion?: number;
}

import { isNoteColor, type NoteColor } from "./colors";

export type ParsedPatch = { ok: true; patch: NotePatch } | { ok: false; error: string };

export function parseNotePatch(payload: unknown): ParsedPatch {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const { body, pinned, baseVersion, archived, color, template } = payload as Record<string, unknown>;

  if (body !== undefined && typeof body !== "string") {
    return { ok: false, error: "`body` must be a string." };
  }
  if (pinned !== undefined && typeof pinned !== "boolean") {
    return { ok: false, error: "`pinned` must be a boolean." };
  }
  if (archived !== undefined && typeof archived !== "boolean") {
    return { ok: false, error: "`archived` must be a boolean." };
  }
  if (template !== undefined && typeof template !== "boolean") {
    return { ok: false, error: "`template` must be a boolean." };
  }
  if (color !== undefined && color !== null && !isNoteColor(color)) {
    return { ok: false, error: "`color` must be one of the label colours, or null." };
  }
  if (
    baseVersion !== undefined &&
    baseVersion !== null &&
    !(typeof baseVersion === "number" && Number.isSafeInteger(baseVersion) && baseVersion >= 0)
  ) {
    return { ok: false, error: "`baseVersion` must be a non-negative integer." };
  }

  const patch: NotePatch = {};
  if (body !== undefined) patch.body = body;
  if (pinned !== undefined) patch.pinned = pinned;
  if (archived !== undefined) patch.archived = archived;
  if (template !== undefined) patch.template = template;
  if (color !== undefined) patch.color = color as NoteColor | null;
  // A version without a body has nothing to guard, so it is dropped rather
  // than turning a pin toggle into something that can conflict (R18.1).
  if (typeof baseVersion === "number" && body !== undefined) patch.baseVersion = baseVersion;
  return { ok: true, patch };
}
