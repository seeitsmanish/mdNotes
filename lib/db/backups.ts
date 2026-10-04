import JSZip from "jszip";
import { prisma } from "./prisma";
import { createNamer } from "@/lib/export/filename";
import { serialise } from "@/lib/export/frontmatter";
import { BACKUPS_KEPT, backupDue, trashCutoff } from "@/lib/backup/policy";

/**
 * Automatic backups and the trash clean-out (PRD §4.77). Every query lives
 * here, like notes.ts.
 */

export async function listBackups(): Promise<Array<{ id: string; createdAt: string; notes: number; size: number }>> {
  const rows = await prisma.backup.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, notes: true, size: true },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function getBackup(id: string): Promise<{ createdAt: Date; bytes: Uint8Array } | null> {
  return prisma.backup.findUnique({ where: { id }, select: { createdAt: true, bytes: true } });
}

/**
 * Every note that isn't in the trash, as markdown with frontmatter — the same
 * files as Export all, without the images (they stay in the database; the
 * full export carries them).
 */
export async function createBackup(): Promise<{ id: string; notes: number; size: number }> {
  const notes = await prisma.note.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, title: true, body: true, pinned: true, createdAt: true, updatedAt: true },
  });
  const zip = new JSZip();
  const name = createNamer(".md");
  for (const note of notes) {
    const content = serialise(
      { id: note.id, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString(), pinned: note.pinned },
      note.body,
    );
    zip.file(name(note.title), content, { date: note.updatedAt });
  }
  const bytes = new Uint8Array(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  const row = await prisma.backup.create({
    data: { notes: notes.length, size: bytes.byteLength, bytes },
    select: { id: true },
  });
  // Keep the newest few.
  const old = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, skip: BACKUPS_KEPT, select: { id: true } });
  if (old.length) await prisma.backup.deleteMany({ where: { id: { in: old.map((b) => b.id) } } });
  return { id: row.id, notes: notes.length, size: bytes.byteLength };
}

export async function getTrashDays(): Promise<number> {
  const row = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { trashDays: true } });
  return row?.trashDays ?? 0;
}

export async function setTrashDays(days: number): Promise<void> {
  await prisma.settings.upsert({ where: { id: "singleton" }, update: { trashDays: days }, create: { id: "singleton", trashDays: days } });
}

/**
 * What the app asks for on launch: a backup if a week has passed, and old
 * trash deleted if that is turned on. Cheap when there is nothing to do.
 */
export async function runMaintenance(now = Date.now()): Promise<{ backedUp: boolean; purged: number }> {
  const last = await prisma.backup.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  let backedUp = false;
  if (backupDue(last?.createdAt ?? null, now)) {
    await createBackup();
    backedUp = true;
  }
  const cutoff = trashCutoff(await getTrashDays(), now);
  const purged = cutoff
    ? (await prisma.note.deleteMany({ where: { deletedAt: { not: null, lt: cutoff } } })).count
    : 0;
  return { backedUp, purged };
}
