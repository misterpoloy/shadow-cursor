import { sendToServiceWorker } from '../shared/messaging';
import {
  startRecording,
  stopRecording,
  setInterimCallback,
  setOnSilenceStop,
  setOnSilenceCountdown,
  getFinalTranscript,
} from './voice-capture';
import { scrapeDOM } from './dom-scraper';
import { RecordingIndicator } from './recording-indicator';
import { getLoadingIndicator } from './loading-indicator';

let isCapturing = false;
let recordingIndicator: RecordingIndicator | null = null;
const loadingIndicator = getLoadingIndicator();
let captureX = window.innerWidth / 2;
let captureY = window.innerHeight / 2;
let triggerInitialized = false;

async function startCapture(): Promise<void> {
  if (isCapturing) return;
  isCapturing = true;

  if (!recordingIndicator) {
    recordingIndicator = new RecordingIndicator();
  }

  recordingIndicator.show(captureX, captureY, () => {
    stopCapture().catch(console.error);
  }, () => {
    cancelCapture().catch(console.error);
  });

  setInterimCallback((text) => recordingIndicator?.updateTranscript(text));
  setOnSilenceStop(() => stopCapture().catch(console.error));
  setOnSilenceCountdown((ms) => recordingIndicator?.setSilenceCountdown(ms));

  await sendToServiceWorker({ type: 'CAPTURE_STARTED' });
  await startRecording();
}

async function stopCapture(): Promise<void> {
  if (!isCapturing) return;
  isCapturing = false;

  recordingIndicator?.setProcessing();

  const audio = await stopRecording();
  recordingIndicator?.hide();

  if (!audio) return;

  loadingIndicator.show(captureX, captureY);
  try {
    await sendToServiceWorker({
      type: 'CAPTURE_COMPLETE',
      audio,
      transcript: getFinalTranscript(),
      dom: scrapeDOM(captureX, captureY),
      url: location.href,
      title: document.title,
    });
  } catch (err) {
    loadingIndicator.hide();
    throw err;
  }
}

async function cancelCapture(): Promise<void> {
  if (!isCapturing) return;
  isCapturing = false;

  await stopRecording();
  recordingIndicator?.hide();
  loadingIndicator.hide();
}

function isWakeShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  return key === 'k' && event.shiftKey && (event.metaKey || event.ctrlKey);
}

export function initTrigger(): void {
  if (triggerInitialized) return;
  triggerInitialized = true;

  document.addEventListener('mousemove', (event: MouseEvent) => {
    captureX = event.clientX;
    captureY = event.clientY;
  }, true);

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!isWakeShortcut(event) || isCapturing) return;
    event.preventDefault();
    event.stopPropagation();
    startCapture().catch(console.error);
  }, true);
}
