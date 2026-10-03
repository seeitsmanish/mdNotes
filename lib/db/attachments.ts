import { prisma } from "./prisma";

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
