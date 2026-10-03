import { prisma } from "./prisma";
import { findUnused, type StoredImage } from "@/lib/attachments/unused";

/** Image storage (PRD §4.24). Every query lives here, like every note query. */

export async function createAttachment(input: {
  mime: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
}): Promise<{ id: string }> {
  return prisma.attachment.create({
    data: {
      mime: input.mime,
      bytes: Buffer.from(input.bytes),
      size: input.bytes.byteLength,
      width: input.width ?? null,
      height: input.height ?? null,
    },
    select: { id: true },
  });
}

export async function getAttachment(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const row = await prisma.attachment.findUnique({ where: { id }, select: { mime: true, bytes: true } });
  return row ? { mime: row.mime, bytes: new Uint8Array(row.bytes) } : null;
}

/** Several attachments at once, for export. Unknown ids are simply absent. */
export async function getAttachments(
  ids: string[],
): Promise<Array<{ id: string; mime: string; bytes: Uint8Array; createdAt: Date }>> {
  if (ids.length === 0) return [];
  const rows = await prisma.attachment.findMany({
    where: { id: { in: ids } },
    select: { id: true, mime: true, bytes: true, createdAt: true },
  });
  return rows.map((row) => ({ ...row, bytes: new Uint8Array(row.bytes) }));
}

/** Every body that could refer to an image: notes (trash too) and kept versions. */
async function everyBody(client: Pick<typeof prisma, "note" | "noteRevision">): Promise<string[]> {
  const [notes, revisions] = await Promise.all([
    client.note.findMany({ select: { body: true } }),
    client.noteRevision.findMany({ select: { body: true } }),
  ]);
  return [...notes.map((n) => n.body), ...revisions.map((r) => r.body)];
}

async function storedImages(client: Pick<typeof prisma, "attachment">): Promise<StoredImage[]> {
  // Sizes and dates only — never the bytes, which is most of the table.
  return client.attachment.findMany({ select: { id: true, size: true, createdAt: true } });
}

/** How many images nothing uses, and how much space they take (PRD §4.35). */
export async function countUnused(): Promise<{ count: number; bytes: number }> {
  const unused = findUnused(await storedImages(prisma), await everyBody(prisma), new Date());
  return { count: unused.length, bytes: unused.reduce((sum, image) => sum + image.size, 0) };
}

/**
 * Delete them. Worked out again inside the transaction rather than trusting
 * an earlier count, so an image that came back into use in between is kept.
 */
export async function deleteUnused(): Promise<{ deleted: number; bytes: number }> {
  return prisma.$transaction(async (tx) => {
    const unused = findUnused(await storedImages(tx), await everyBody(tx), new Date());
    if (unused.length === 0) return { deleted: 0, bytes: 0 };
    await tx.attachment.deleteMany({ where: { id: { in: unused.map((image) => image.id) } } });
    return { deleted: unused.length, bytes: unused.reduce((sum, image) => sum + image.size, 0) };
  });
}
