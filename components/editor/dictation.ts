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
  "service-not-allowed": "Voice typing isn't available in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Voice typing needs a connection.",
};

/** Starts listening; returns a function that stops. */
export function startDictation(view: EditorView, onState: (state: DictationState) => void): () => void {
  const Recognition = ctor();
  if (!Recognition) {
    onState({ listening: false, interim: "", error: "Voice typing isn't available in this browser." });
    return () => undefined;
  }
  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  let wanted = true;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]!;
      const text = result[0].transcript;
      if (!result.isFinal) {
        interim += text;
        continue;
      }
      const phrase = text.trim();
      if (!phrase) continue;
      const { state } = view;
      const head = state.selection.main.from;
      const before = state.sliceDoc(Math.max(0, head - 1), head);
      const space = before && !/\s/.test(before) ? " " : "";
      view.dispatch(state.replaceSelection(space + phrase), { userEvent: "input.dictation", scrollIntoView: true });
    }
    onState({ listening: true, interim: interim.trim() });
  };
  recognition.onerror = (event) => {
    if (event.error === "no-speech" || event.error === "aborted") return;
    wanted = false;
    onState({ listening: false, interim: "", error: ERRORS[event.error] ?? "Voice typing stopped." });
  };
  // Phones end a session after a pause; keep listening until told to stop.
  recognition.onend = () => {
    if (wanted) {
      try {
        recognition.start();
        return;
      } catch {
        wanted = false;
      }
    }
    onState({ listening: false, interim: "" });
  };

  try {
    recognition.start();
    onState({ listening: true, interim: "" });
  } catch {
    onState({ listening: false, interim: "", error: "Couldn't start voice typing." });
  }
  return () => {
    wanted = false;
    recognition.stop();
  };
}
