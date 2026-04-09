import { sendToServiceWorker } from '../shared/messaging';
import { startRecording, stopRecording } from './voice-capture';
import { scrapeDOM } from './dom-scraper';
import { TRIGGER_HOLD_MS } from '../shared/constants';

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let isCapturing = false;
let indicator: HTMLElement | null = null;

function createIndicator(x: number, y: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sc-trigger-indicator';
  el.style.left = `${x - 30}px`;
  el.style.top = `${y - 30}px`;
  document.body.appendChild(el);
  return el;
}

function removeIndicator(): void {
  indicator?.remove();
  indicator = null;
}

async function onHoldComplete(): Promise<void> {
  if (isCapturing) return;
  isCapturing = true;

  removeIndicator();

  await sendToServiceWorker({ type: 'CAPTURE_STARTED' });
  await startRecording();
}

async function onRelease(): Promise<void> {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  removeIndicator();

  if (!isCapturing) return;
  isCapturing = false;

  const audio = await stopRecording();
  if (!audio) return;

  const dom = scrapeDOM();

  await sendToServiceWorker({
    type: 'CAPTURE_COMPLETE',
    audio,
    dom,
    url: location.href,
    title: document.title,
  });
}

export function initTrigger(): void {
  document.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 2) return;

    indicator = createIndicator(e.clientX, e.clientY);

    holdTimer = setTimeout(() => {
      // Suppress context menu for this interaction
      document.addEventListener('contextmenu', suppressContextMenu, { once: true });
      onHoldComplete().catch(console.error);
    }, TRIGGER_HOLD_MS);
  });

  document.addEventListener('mouseup', (e: MouseEvent) => {
    if (e.button !== 2) return;
    onRelease().catch(console.error);
  });

  // Cancel on movement
  document.addEventListener('mousemove', () => {
    if (holdTimer && !isCapturing) {
      clearTimeout(holdTimer);
      holdTimer = null;
      removeIndicator();
    }
  });
}

function suppressContextMenu(e: Event): void {
  e.preventDefault();
}
