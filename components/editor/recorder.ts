/**
 * Voice memos (PRD §4.74): record with the browser's MediaRecorder, then
 * upload as an attachment. WebM/Opus where supported (Chrome, Firefox,
 * Android), MP4/AAC on Safari. A low bitrate keeps 15 minutes under the
 * 4 MB upload cap; recording stops on its own at 15 minutes.
 */

export const MAX_RECORDING_MS = 15 * 60 * 1000;
const BITRATE = 32_000;

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pickType(): string | undefined {
  for (const type of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

export interface Recording {
  startedAt: number;
  /** Ends the recording and resolves with the audio and its length. */
  stop(): Promise<{ blob: Blob; ms: number }>;
  /** Ends it and throws the audio away. */
  cancel(): void;
}

export async function startRecording(onAutoStop: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = pickType();
  const recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const startedAt = Date.now();
  recorder.start(1000);
  const release = () => stream.getTracks().forEach((track) => track.stop());
  const limit = setTimeout(onAutoStop, MAX_RECORDING_MS);

  return {
    startedAt,
    stop: () =>
      new Promise((resolve) => {
        clearTimeout(limit);
        recorder.onstop = () => {
          release();
          resolve({ blob: new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" }), ms: Date.now() - startedAt });
        };
        recorder.stop();
      }),
    cancel: () => {
      clearTimeout(limit);
      recorder.onstop = release;
      if (recorder.state !== "inactive") recorder.stop();
      else release();
    },
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The markdown a memo is written into the note as: a link the editor draws as a player. */
export function memoMarkdown(url: string, ms: number): string {
  return `[🎙 Voice memo · ${formatDuration(ms)}](${url} "audio")`;
}

export async function uploadMemo(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "memo");
  const response = await fetch("/api/attachments", { method: "POST", body: form });
  const value = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !value.url) throw new Error(value.error ?? "Couldn’t save the recording.");
  return value.url;
}
