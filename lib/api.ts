import type { NoteCounts, NoteDetail, NoteFilter, NoteListItem } from "./types";

/** Thin client over the route handlers in app/api (docs/TECH-SPEC.md §5). */

/** A failed request, carrying the HTTP status so callers need not parse messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(
      (detail as { error?: string } | null)?.error ?? `Request failed (${response.status}).`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchNotes(options: {
  filter: NoteFilter;
  query?: string;
}): Promise<{ notes: NoteListItem[]; counts: NoteCounts }> {
  const params = new URLSearchParams({ filter: options.filter });
  if (options.query?.trim()) params.set("q", options.query.trim());
  return request(`/api/notes?${params}`);
}

export function fetchNote(id: string, signal?: AbortSignal): Promise<{ note: NoteDetail }> {
  return request(`/api/notes/${id}`, { signal });
}

export function createNote(): Promise<{ note: NoteDetail }> {
  return request("/api/notes", { method: "POST" });
}

export function patchNote(
  id: string,
  patch: { pinned?: boolean },
): Promise<{ note: NoteDetail }> {
  return request(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/**
 * Browsers cap the bodies of all in-flight keepalive requests at 64 KiB
 * together, and reject one over the cap outright. Below this a save is sent
 * keepalive so it survives the tab closing; above it, it is sent normally.
 */
const KEEPALIVE_MAX_BYTES = 48 * 1024;

export type SaveResult =
  | { status: "saved"; note: NoteDetail }
  /** Stale save (PRD §4.18): `note` is current, `copy` holds the text sent. */
  | { status: "conflict"; note: NoteDetail; copy: NoteDetail };

export async function saveBody(
  id: string,
  body: string,
  baseVersion: number | undefined,
): Promise<SaveResult> {
  const payload = JSON.stringify({ body, baseVersion });
  const response = await fetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: new TextEncoder().encode(payload).byteLength <= KEEPALIVE_MAX_BYTES,
  });

  if (response.status === 409) {
    const { note, copy } = (await response.json()) as { note: NoteDetail; copy: NoteDetail };
    return { status: "conflict", note, copy };
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      (detail as { error?: string } | null)?.error ?? `Request failed (${response.status}).`,
    );
  }
  const { note } = (await response.json()) as { note: NoteDetail };
  return { status: "saved", note };
}

export function trashNote(id: string): Promise<void> {
  return request(`/api/notes/${id}`, { method: "DELETE" });
}

export function deleteNoteForever(id: string): Promise<void> {
  return request(`/api/notes/${id}?permanent=true`, { method: "DELETE" });
}

export function restoreNote(id: string): Promise<{ note: NoteDetail }> {
  return request(`/api/notes/${id}/restore`, { method: "POST" });
}

export function resolveWikiLinks(titles: string[]): Promise<{ resolved: Record<string, string> }> {
  return request("/api/resolve", { method: "POST", body: JSON.stringify({ titles }) });
}

export function emptyTrash(): Promise<{ deleted: number }> {
  return request("/api/notes/trash", { method: "DELETE" });
}

export interface RevisionSummary {
  id: string;
  createdAt: string;
  title: string;
  words: number;
}

export function fetchHistory(noteId: string): Promise<{ revisions: RevisionSummary[] }> {
  return request(`/api/notes/${noteId}/history`);
}

export function fetchRevision(
  noteId: string,
  revisionId: string,
): Promise<{ revision: { id: string; createdAt: string; body: string } }> {
  return request(`/api/notes/${noteId}/history/${revisionId}`);
}

export function restoreRevision(noteId: string, revisionId: string): Promise<{ note: NoteDetail }> {
  return request(`/api/notes/${noteId}/history/${revisionId}`, { method: "POST" });
}
