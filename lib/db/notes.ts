import { prisma } from "./prisma";
import { applyBody, insertBody } from "./write";
import { lockBody, maybeKeepRevision } from "./history";
import { conflictCopyBody } from "@/lib/notes/conflict";
import type { NotePatch } from "@/lib/notes/patch";
import { deriveCover, deriveExcerpt, deriveTitle, deriveTodos } from "@/lib/markdown/derive";
import { linksTo, normaliseTitle } from "@/lib/markdown/wikilink";
import { rank, terms } from "@/lib/search/rank";
import { CANDIDATE_CAP, mergeCandidates } from "@/lib/search/candidates";
import { containsPattern, FOLD_FROM, FOLD_TO } from "@/lib/search/foldSql";
import { Prisma } from "@/lib/generated/prisma/client";
import { isNoteColor, type NoteColor } from "@/lib/notes/colors";
import type { NoteCounts, NoteDetail, NoteFilter, NoteListItem } from "@/lib/types";

/**
 * Every note query lives here. No route handler touches `prisma` directly —
 * that is the seam that makes the deferred `userId` column a one-file change
 * (docs/TECH-SPEC.md §2).
 */

const LIST_FIELDS = {
  id: true,
  title: true,
  excerpt: true,
  cover: true,
  todoDone: true,
  todoTotal: true,
  pinned: true,
  archivedAt: true,
  color: true,
  isTemplate: true,
  updatedAt: true,
  deletedAt: true,
} as const;

type ListRow = {
  id: string;
  title: string;
  excerpt: string;
  cover: string | null;
  todoDone: number;
  todoTotal: number;
  pinned: boolean;
  archivedAt: Date | null;
  color: string | null;
  isTemplate: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toListItem(row: ListRow): NoteListItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    cover: row.cover,
    todoDone: row.todoDone,
    todoTotal: row.todoTotal,
    pinned: row.pinned,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    color: isNoteColor(row.color) ? row.color : null,
    isTemplate: row.isTemplate,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

const DETAIL_FIELDS = { ...LIST_FIELDS, body: true, createdAt: true, version: true } as const;

function toDetail(row: ListRow & { body: string; createdAt: Date; version: number }): NoteDetail {
  return {
    ...toListItem(row),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  };
}

/**
 * Which notes a filter shows (PRD §4.65). The main list leaves out archived
 * notes and templates; each has its own filter. A colour narrows any filter.
 */
function filterWhere(filter: NoteFilter, color: NoteColor | null = null) {
  const tint = color ? { color } : {};
  if (filter === "trash") return { deletedAt: { not: null }, ...tint };
  if (filter === "archive") return { deletedAt: null, archivedAt: { not: null }, ...tint };
  if (filter === "templates") return { deletedAt: null, isTemplate: true, ...tint };
  const live = { deletedAt: null, archivedAt: null, isTemplate: false, ...tint };
  if (filter === "pinned") return { ...live, pinned: true };
  return live;
}

/** The same scopes as raw SQL, for search. Only fixed fragments; the colour is bound. */
function filterSql(filter: NoteFilter, color: NoteColor | null) {
  const base =
    filter === "trash"
      ? Prisma.sql`"deletedAt" IS NOT NULL`
      : filter === "archive"
        ? Prisma.sql`"deletedAt" IS NULL AND "archivedAt" IS NOT NULL`
        : filter === "templates"
          ? Prisma.sql`"deletedAt" IS NULL AND "isTemplate" = true`
          : filter === "pinned"
            ? Prisma.sql`"deletedAt" IS NULL AND "archivedAt" IS NULL AND "isTemplate" = false AND "pinned" = true`
            : Prisma.sql`"deletedAt" IS NULL AND "archivedAt" IS NULL AND "isTemplate" = false`;
  return color ? Prisma.sql`${base} AND "color" = ${color}` : base;
}

export async function countNotes(): Promise<NoteCounts> {
  const [all, pinned, archive, templates, trash] = await Promise.all([
    prisma.note.count({ where: filterWhere("all") }),
    prisma.note.count({ where: filterWhere("pinned") }),
    prisma.note.count({ where: filterWhere("archive") }),
    prisma.note.count({ where: filterWhere("templates") }),
    prisma.note.count({ where: filterWhere("trash") }),
  ]);
  return { all, pinned, archive, templates, trash };
}

export async function listNotes(options: {
  filter?: NoteFilter;
  query?: string | null;
  color?: NoteColor | null;
}): Promise<NoteListItem[]> {
  const { filter = "all", query, color = null } = options;
  const queryTerms = terms(query ?? "");

  // No query: the plain, cheap path — ordered by pinned then recency.
  if (queryTerms.length === 0) {
    const rows = await prisma.note.findMany({
      where: filterWhere(filter, color),
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: LIST_FIELDS,
    });
    return rows.map(toListItem);
  }

  // Searching: narrow in SQL on the rarest term, then rank in one place so the
  // editor and the server agree on what "matches" means (R11.5). Bodies are
  // read here and deliberately not returned — the client never needs them to
  // order a list.
  //
  // Title and body matches are read separately so the one cannot crowd out the
  // other, and newest-first so the cap is deterministic (R11.6).
  const narrowest = queryTerms.reduce((a, b) => (a.length >= b.length ? a : b));
  //
  // Raw SQL because the stored text has to be accent-folded the same way the
  // terms are, and Prisma's `contains` cannot apply a function to the column
  // (R11.4). Every value is a bound parameter; only fixed fragments are spliced.
  const pattern = containsPattern(narrowest);
  const scope = filterSql(filter, color);
  const read = (column: Prisma.Sql) =>
    prisma.$queryRaw<Array<ListRow & { body: string }>>`
      SELECT "id", "title", "excerpt", "cover", "todoDone", "todoTotal", "pinned", "archivedAt", "color", "isTemplate", "updatedAt", "deletedAt", "body"
      FROM "Note"
      WHERE ${scope}
        AND translate(${column}, ${FOLD_FROM}, ${FOLD_TO}) ILIKE ${pattern} ESCAPE '\\'
      ORDER BY "updatedAt" DESC, "id" ASC
      LIMIT ${CANDIDATE_CAP}`;
  const [byTitle, byBody] = await Promise.all([
    read(Prisma.sql`"title"`),
    read(Prisma.sql`"body"`),
  ]);
  const candidates = mergeCandidates(byTitle, byBody);

  const byId = new Map(candidates.map((row) => [row.id, row]));
  return rank(candidates, query ?? "").flatMap((hit) => {
    const row = byId.get(hit.id);
    if (!row) return [];
    return [{ ...toListItem(row), match: { snippet: hit.snippet, marks: hit.marks } }];
  });
}

export async function getNote(id: string): Promise<NoteDetail | null> {
  const row = await prisma.note.findUnique({
    where: { id },
    select: DETAIL_FIELDS,
  });
  if (!row) return null;
  return toDetail(row);
}

export async function createNote(): Promise<NoteDetail> {
  const row = await prisma.note.create({
    data: {},
    select: DETAIL_FIELDS,
  });
  return toDetail(row);
}

export type UpdateResult =
  | { status: "saved"; note: NoteDetail }
  | { status: "missing" }
  /** The body was stale: `note` is the current one, `copy` holds the stale text. */
  | { status: "conflict"; note: NoteDetail; copy: NoteDetail };

export async function updateNote(id: string, patch: NotePatch): Promise<UpdateResult> {
  const exists = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { status: "missing" };

  const copyId = await prisma.$transaction(async (tx) => {
    // Labels: they bump the edit time like pinning always has, which is how
    // other devices' resync notices them (PRD §4.39).
    const flags = {
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      ...(patch.archived !== undefined ? { archivedAt: patch.archived ? new Date() : null } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.template !== undefined ? { isTemplate: patch.template } : {}),
    };
    if (Object.keys(flags).length > 0) await tx.note.update({ where: { id }, data: flags });
    if (patch.body === undefined) return null;

    const previous = await lockBody(tx, id);
    const applied = await applyBody(tx, id, patch.body, patch.baseVersion);
    if (applied) {
      // Kept only now that the save has won: a stale save changes nothing,
      // so there is nothing it replaced (PRD §4.28).
      if (previous !== null) await maybeKeepRevision(tx, id, previous, patch.body);
      return null;
    }

    // Stale save. The text is kept, in the same transaction, so it survives
    // even when nobody reads this response — a closing tab's last save (R18.3).
    const copy = await insertBody(tx, conflictCopyBody(patch.body));
    return copy.id;
  });

  const [note, copy] = await Promise.all([getNote(id), copyId ? getNote(copyId) : null]);
  if (!note) return { status: "missing" };
  if (copy) return { status: "conflict", note, copy };
  return { status: "saved", note };
}

/** Trash. Reversible, and the stamp doubles as a sync tombstone. */
export async function trashNote(id: string): Promise<void> {
  await prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function restoreNote(id: string): Promise<NoteDetail | null> {
  await prisma.note.update({ where: { id }, data: { deletedAt: null } });
  return getNote(id);
}

export async function deleteNoteForever(id: string): Promise<void> {
  await prisma.note.delete({ where: { id } });
}

/** Full note bodies for export (PRD §4.8). Trash is excluded unless asked for. */
export async function listNotesForExport(options: { includeTrashed?: boolean } = {}): Promise<
  Array<{ id: string; title: string; body: string; pinned: boolean; createdAt: Date; updatedAt: Date }>
> {
  return prisma.note.findMany({
    where: options.includeTrashed ? {} : { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, title: true, body: true, pinned: true, createdAt: true, updatedAt: true },
  });
}

/**
 * Create many notes in one transaction (PRD §4.9). Import never overwrites, so
 * this only ever inserts — there is no merge to get wrong.
 */
export async function createNotesFromBodies(
  entries: Array<{ body: string; createdAt?: Date; pinned?: boolean }>,
): Promise<number> {
  if (entries.length === 0) return 0;

  const rows = entries.map((entry) => ({
    body: entry.body,
    title: deriveTitle(entry.body),
    excerpt: deriveExcerpt(entry.body),
    cover: deriveCover(entry.body),
    ...deriveTodos(entry.body),
    // Restored from frontmatter when present, so a restore reproduces the
    // library rather than flattening it to "everything created just now".
    ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
    ...(entry.pinned ? { pinned: true } : {}),
  }));

  const result = await prisma.note.createMany({ data: rows });
  return result.count;
}

/**
 * Resolve wiki-link targets to note ids (PRD R10.2).
 *
 * Normalisation happens in JS rather than SQL because the same function has to
 * agree with the editor's rendering — two normalisers would drift.
 */
export async function resolveTitles(titles: string[]): Promise<Record<string, string>> {
  if (titles.length === 0) return {};

  const rows = await prisma.note.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const wanted = new Set(titles.map(normaliseTitle));
  const resolved: Record<string, string> = {};

  for (const row of rows) {
    const key = normaliseTitle(row.title);
    // Most recently edited wins when two notes share a title.
    if (wanted.has(key) && !(key in resolved)) resolved[key] = row.id;
  }

  return resolved;
}

/**
 * Notes that link to `title` (PRD R10.5). Resolved on read: a join table would
 * be a second source of truth to keep in step with the text.
 */
export async function backlinksFor(
  noteId: string,
  title: string,
): Promise<Array<{ id: string; title: string; excerpt: string }>> {
  if (title.trim().length === 0) return [];

  // `contains` narrows the scan; `linksTo` then applies the real rule, which
  // knows about code spans and whitespace.
  const candidates = await prisma.note.findMany({
    where: {
      deletedAt: null,
      id: { not: noteId },
      body: { contains: "[[", mode: "insensitive" },
    },
    select: { id: true, title: true, excerpt: true, body: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return candidates
    .filter((note) => linksTo(note.body, title))
    .map(({ id, title: noteTitle, excerpt }) => ({ id, title: noteTitle, excerpt }));
}

/**
 * Permanently delete every trashed note (PRD R12.1).
 *
 * Only ever reachable from an explicit action — trash is never emptied on a
 * timer, because silently deleting someone's notes is not a feature.
 */
export async function emptyTrash(): Promise<number> {
  const result = await prisma.note.deleteMany({ where: { deletedAt: { not: null } } });
  return result.count;
}
