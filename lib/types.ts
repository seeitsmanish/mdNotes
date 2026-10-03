/** Shapes crossing the API boundary. Dates are ISO strings over the wire. */

export type NoteFilter = "all" | "pinned" | "trash";

/** Row counts for the note list's filter control. */
export type NoteCounts = Record<NoteFilter, number>;

export interface NoteListItem {
  id: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteDetail extends NoteListItem {
  body: string;
  createdAt: string;
}
