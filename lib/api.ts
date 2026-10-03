import type { NoteCounts, NoteDetail, NoteFilter, NoteListItem } from "./types";

/** Thin client over the route handlers in app/api (docs/TECH-SPEC.md §5). */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      (detail as { error?: string } | null)?.error ?? `Request failed (${response.status}).`,
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

export function fetchNote(id: string): Promise<{ note: NoteDetail }> {
  return request(`/api/notes/${id}`);
}

export function createNote(): Promise<{ note: NoteDetail }> {
  return request("/api/notes", { method: "POST" });
}

export function patchNote(
  id: string,
  patch: { body?: string; pinned?: boolean },
): Promise<{ note: NoteDetail }> {
  return request(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
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
