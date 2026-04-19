// Web Speech API types (not in standard TS DOM lib)
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

const SILENCE_THRESHOLD = 10;      // RMS below this = silence (0–255 scale)
const SILENCE_DURATION_MS = 1500;  // auto-stop after this many ms of silence
const STOP_TIMEOUT_MS = 3000;      // max wait for MediaRecorder.onstop before forcing resolve

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;
let recognition: ISpeechRecognition | null = null;

// Silence detection — kept separate so closing audioCtx never touches the recorder stream
let audioCtx: AudioContext | null = null;
let analyserFrame: number | null = null;

let onInterimCallback: ((text: string) => void) | null = null;
let onSilenceCallback: (() => void) | null = null;
let onSilenceCountdownCallback: ((remainingMs: number) => void) | null = null;
let finalTranscript = '';

export function setInterimCallback(cb: (text: string) => void): void {
  onInterimCallback = cb;
}

export function setOnSilenceStop(cb: () => void): void {
  onSilenceCallback = cb;
}

export function setOnSilenceCountdown(cb: (remainingMs: number) => void): void {
  onSilenceCountdownCallback = cb;
}

export function getFinalTranscript(): string {
  return finalTranscript.trim();
}

export async function startRecording(): Promise<void> {
  chunks = [];
  finalTranscript = '';

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start(100);

  startSpeechRecognition();
  startSilenceDetection(stream);
}

export async function stopRecording(): Promise<ArrayBuffer | null> {
  // 1. Stop the analyser loop immediately (no more rAF ticks or silence callbacks)
  cancelAnalyser();
  stopSpeechRecognition();

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    // Already stopped — clean up audioCtx and return whatever we have
    closeAudioCtx();
    return collectBuffer();
  }

  return new Promise((resolve) => {
    // Safety net: if onstop never fires (e.g. Chrome/audioCtx interaction), resolve anyway
    const timeout = setTimeout(() => {
      console.warn('[ShadowCursor] MediaRecorder.onstop timeout — resolving with available chunks');
      cleanupStream();
      closeAudioCtx();
      void collectBuffer().then(resolve);
    }, STOP_TIMEOUT_MS);

    mediaRecorder!.onstop = async () => {
      clearTimeout(timeout);
      cleanupStream();
      // Close AudioContext AFTER recorder has fully stopped to avoid interfering with it
      closeAudioCtx();
      resolve(await collectBuffer());
    };

    try {
      mediaRecorder!.stop();
    } catch (err) {
      clearTimeout(timeout);
      console.warn('[ShadowCursor] mediaRecorder.stop() threw:', err);
      cleanupStream();
      closeAudioCtx();
      void collectBuffer().then(resolve);
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanupStream(): void {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

function closeAudioCtx(): void {
  audioCtx?.close().catch(() => {});
  audioCtx = null;
}

function cancelAnalyser(): void {
  if (analyserFrame !== null) {
    cancelAnimationFrame(analyserFrame);
    analyserFrame = null;
  }
}

async function collectBuffer(): Promise<ArrayBuffer | null> {
  if (chunks.length === 0) return null;
  const mimeType = mediaRecorder?.mimeType ?? 'audio/webm';
  const blob = new Blob(chunks, { type: mimeType });
  chunks = [];
  return blob.arrayBuffer();
}

// ─── Silence detection ────────────────────────────────────────────────────────
// Uses a CLONED stream so AudioContext lifecycle is fully independent from the recorder.

function startSilenceDetection(micStream: MediaStream): void {
  // Clone stream: AudioContext gets its own track reference, closing it is safe
  const analysisStream = micStream.clone();

  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(analysisStream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  let silenceStart: number | null = null;

  const tick = (): void => {
    analyser.getByteFrequencyData(data);

    const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

    if (rms < SILENCE_THRESHOLD) {
      if (silenceStart === null) silenceStart = Date.now();

      const elapsed = Date.now() - silenceStart;
      const remaining = SILENCE_DURATION_MS - elapsed;
      onSilenceCountdownCallback?.(Math.max(0, remaining));

      if (elapsed >= SILENCE_DURATION_MS) {
        cancelAnalyser(); // stop loop before firing callback
        onSilenceCallback?.();
        return;
      }
    } else {
      if (silenceStart !== null) {
        silenceStart = null;
        onSilenceCountdownCallback?.(SILENCE_DURATION_MS);
      }
    }

    analyserFrame = requestAnimationFrame(tick);
  };

  analyserFrame = requestAnimationFrame(tick);
}

// ─── Speech recognition (live transcript display only) ───────────────────────

function startSpeechRecognition(): void {
  const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>;
  const SR = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
  if (!SR) return;

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: ISpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript + ' ';
      } else {
        interim += result[0].transcript;
      }
    }
    onInterimCallback?.((finalTranscript + interim).trim());
  };

  recognition.onerror = () => { /* ignore — MediaRecorder still captures audio */ };

  try { recognition.start(); } catch { /* browser may reject if mic already claimed */ }
}

function stopSpeechRecognition(): void {
  if (!recognition) return;
  try { recognition.stop(); } catch { /* ignore */ }
  recognition = null;
}
