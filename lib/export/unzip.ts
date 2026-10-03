import type JSZip from "jszip";

/**
 * Decompress one zip entry, giving up once it passes `maxBytes`
 * (docs/SECURITY-AUDIT.md A4).
 *
 * The upload cap is on the compressed size, and markdown compresses
 * extremely well: a 50 MB zip of repeated text inflates to gigabytes. Reading
 * an entry whole with `async("string")` would exhaust the function's memory
 * before any size check ran, so entries are streamed and abandoned at the cap.
 *
 * Resolves to the text, or null when the entry is larger than `maxBytes`.
 */
export function readEntryCapped(entry: JSZip.JSZipObject, maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    let done = false;

    const stream = entry.nodeStream("nodebuffer");
    const stop = () => {
      done = true;
      stream.removeAllListeners("data");
      stream.pause();
    };

    stream.on("data", (chunk: Buffer) => {
      if (done) return;
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        stop();
        resolve(null);
        return;
      }
      text += decoder.decode(chunk, { stream: true });
    });
    stream.on("error", (error: Error) => {
      if (done) return;
      stop();
      reject(error);
    });
    stream.on("end", () => {
      if (done) return;
      done = true;
      resolve(text + decoder.decode());
    });
  });
}
