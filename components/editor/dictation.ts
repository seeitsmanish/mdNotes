import type { EditorView } from "@codemirror/view";

/**
 * Voice typing (PRD §4.72) with the browser's own speech recognition: Chrome,
 * Edge and Safari (including on iPhone) have it; Firefox does not, and there
 * the button is not shown. Finished phrases are typed at the caret; the
 * phrase still being heard shows in a bubble above the format bar.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return ctor() !== null;
}

export interface DictationState {
  listening: boolean;
  interim: string;
  error?: string;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "The microphone is blocked. Allow it for this site in your browser's settings.",
  "service-not-allowed": "This browser doesn't allow voice typing here. Use the microphone on your keyboard instead.",
  "audio-capture": "No microphone was found.",
  network: "This browser couldn't reach its speech service. Use the microphone on your keyboard instead — it works in any app.",
  "language-not-supported": "Voice typing doesn't support your language in this browser.",
  "no-speech": "Didn't hear anything. Check the microphone isn't muted, then try again.",
};
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"]);

/**
 * Starts listening; returns a function that stops.
 *
 * Browsers end a recognition session after each pause (phones within a
 * second or two), so listening is a loop of short sessions, each on a fresh
 * recogniser and started a moment after the last ends — restarting the same
 * one straight from its end event is refused by several browsers, which made
 * voice typing stop after a second (PRD R72.1b). Sessions that end without
 * hearing anything three times running stop the loop, with the reason.
 */
export function startDictation(view: EditorView, onState: (state: DictationState) => void): () => void {
  const Recognition = ctor();
  if (!Recognition) {
    onState({ listening: false, interim: "", error: "Voice typing isn't available in this browser." });
    return () => undefined;
  }

  let stopped = false;
  let current: Recognition | null = null;
  let emptyRuns = 0;
  let lastError: string | null = null;
  let restart: ReturnType<typeof setTimeout> | null = null;

  const finish = (error?: string) => {
    stopped = true;
    if (restart) clearTimeout(restart);
    const message = error ? `${ERRORS[error] ?? "Voice typing stopped."} (${error})` : undefined;
    onState({ listening: false, interim: "", ...(message ? { error: message } : {}) });
  };

  const type = (phrase: string) => {
    const { state } = view;
    const head = state.selection.main.from;
    const before = state.sliceDoc(Math.max(0, head - 1), head);
    const space = before && !/\s/.test(before) ? " " : "";
    view.dispatch(state.replaceSelection(space + phrase), { userEvent: "input.dictation", scrollIntoView: true });
  };

  const begin = () => {
    if (stopped) return;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    let heard = false;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        const text = result[0].transcript;
        if (text.trim()) heard = true;
        if (!result.isFinal) {
          interim += text;
          continue;
        }
        const phrase = text.trim();
        if (phrase) type(phrase);
      }
      onState({ listening: true, interim: interim.trim() });
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      lastError = event.error;
      if (FATAL.has(event.error)) finish(event.error === "network" && !navigator.onLine ? "offline" : event.error);
    };
    recognition.onend = () => {
      current = null;
      if (stopped) return;
      emptyRuns = heard ? 0 : emptyRuns + 1;
      if (emptyRuns >= 3) {
        finish(lastError ?? "no-speech");
        return;
      }
      onState({ listening: true, interim: "" });
      restart = setTimeout(begin, 250);
    };

    try {
      recognition.start();
      current = recognition;
    } catch (error) {
      finish(error instanceof Error ? error.name : "start-failed");
    }
  };

  onState({ listening: true, interim: "" });
  begin();
  return () => {
    if (stopped) return;
    stopped = true;
    if (restart) clearTimeout(restart);
    current?.stop();
    onState({ listening: false, interim: "" });
  };
}
