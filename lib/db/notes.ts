import { prisma } from "./prisma";
import { applyBody } from "./write";
import { deriveExcerpt, deriveTitle } from "@/lib/markdown/derive";
import { linksTo, normaliseTitle } from "@/lib/markdown/wikilink";
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
  pinned: true,
  updatedAt: true,
  deletedAt: true,
} as const;

type ListRow = {
  id: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toListItem(row: ListRow): NoteListItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    pinned: row.pinned,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function filterWhere(filter: NoteFilter) {
  if (filter === "trash") return { deletedAt: { not: null } };
  if (filter === "pinned") return { deletedAt: null, pinned: true };
  return { deletedAt: null };
}

export async function countNotes(): Promise<NoteCounts> {
  const [all, pinned, trash] = await Promise.all([
    prisma.note.count({ where: filterWhere("all") }),
    prisma.note.count({ where: filterWhere("pinned") }),
    prisma.note.count({ where: filterWhere("trash") }),
  ]);
  return { all, pinned, trash };
}

export async function listNotes(options: {
  filter?: NoteFilter;
  query?: string | null;
}): Promise<NoteListItem[]> {
  const { filter = "all", query } = options;
  const search = query?.trim();

  const rows = await prisma.note.findMany({
    where: {
      ...filterWhere(filter),
      // Case-insensitive contains over the body covers title and excerpt too,
      // since both are derived from it.
      ...(search ? { body: { contains: search, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: LIST_FIELDS,
  });

  return rows.map(toListItem);
}

export async function getNote(id: string): Promise<NoteDetail | null> {
  const row = await prisma.note.findUnique({
    where: { id },
    select: { ...LIST_FIELDS, body: true, createdAt: true },
  });
  if (!row) return null;
  return { ...toListItem(row), body: row.body, createdAt: row.createdAt.toISOString() };
}

export async function createNote(): Promise<NoteDetail> {
  const row = await prisma.note.create({
    data: {},
    select: { ...LIST_FIELDS, body: true, createdAt: true },
  });
  return { ...toListItem(row), body: row.body, createdAt: row.createdAt.toISOString() };
}

export async function updateNote(
  id: string,
  patch: { body?: string; pinned?: boolean },
): Promise<NoteDetail | null> {
  const exists = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return null;

  await prisma.$transaction(async (tx) => {
    if (patch.pinned !== undefined) {
      await tx.note.update({ where: { id }, data: { pinned: patch.pinned } });
    }
    if (patch.body !== undefined) {
      await applyBody(tx, id, patch.body);
    }
  });

  return getNote(id);
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
  Array<{ title: string; body: string; updatedAt: Date }>
> {
  return prisma.note.findMany({
    where: options.includeTrashed ? {} : { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    select: { title: true, body: true, updatedAt: true },
  });
}

/**
 * Create many notes in one transaction (PRD §4.9). Import never overwrites, so
 * this only ever inserts — there is no merge to get wrong.
 */
export async function createNotesFromBodies(bodies: string[]): Promise<number> {
  if (bodies.length === 0) return 0;

  const rows = bodies.map((body) => ({
    body,
    title: deriveTitle(body),
    excerpt: deriveExcerpt(body),
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
