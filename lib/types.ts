/** Shapes crossing the API boundary. Dates are ISO strings over the wire. */

export type NoteFilter = "all" | "pinned" | "trash";

/** Row counts for the note list's filter control. */
export type NoteCounts = Record<NoteFilter, number>;

/** Present only on search results (PRD §4.11). */
export interface SearchMatch {
  snippet: string;
  marks: Array<[number, number]>;
}

export interface NoteListItem {
  id: string;
  title: string;
  excerpt: string;
  /** First image URL, for the row thumbnail (PRD §4.51). */
  cover: string | null;
  pinned: boolean;
  updatedAt: string;
  deletedAt: string | null;
  match?: SearchMatch;
}

export interface NoteDetail extends NoteListItem {
  body: string;
  createdAt: string;
  /** Body revision, for conflict detection on save (PRD §4.18). */
  version: number;
}
