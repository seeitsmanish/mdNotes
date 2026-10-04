/**
 * A single `Range: bytes=…` request, as [start, end] inclusive, or null to
 * send the whole file (no header, several ranges, or one that makes no
 * sense). PRD §4.74.
 */
export function byteRange(header: string | null, size: number): [number, number] | null {
  if (!header || size === 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, a = "", b = ""] = match;
  if (a === "" && b === "") return null;
  if (a === "") {
    // The last N bytes.
    const length = Math.min(Number(b), size);
    return length > 0 ? [size - length, size - 1] : null;
  }
  const start = Number(a);
  const end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  return start <= end && start < size ? [start, end] : null;
}
