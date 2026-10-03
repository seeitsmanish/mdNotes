/**
 * Validates a PATCH /api/notes/:id payload. Pure, so it can be tested without
 * a database (AGENT-LOOP §1 ③).
 */

export interface NotePatch {
  body?: string;
  pinned?: boolean;
  /** The version `body` was edited from (PRD R18.2). Absent → unconditional. */
  baseVersion?: number;
}

export type ParsedPatch = { ok: true; patch: NotePatch } | { ok: false; error: string };

export function parseNotePatch(payload: unknown): ParsedPatch {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const { body, pinned, baseVersion } = payload as Record<string, unknown>;

  if (body !== undefined && typeof body !== "string") {
    return { ok: false, error: "`body` must be a string." };
  }
  if (pinned !== undefined && typeof pinned !== "boolean") {
    return { ok: false, error: "`pinned` must be a boolean." };
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
  // A version without a body has nothing to guard, so it is dropped rather
  // than turning a pin toggle into something that can conflict (R18.1).
  if (typeof baseVersion === "number" && body !== undefined) patch.baseVersion = baseVersion;
  return { ok: true, patch };
}
