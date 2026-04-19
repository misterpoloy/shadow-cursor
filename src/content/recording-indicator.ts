export class RecordingIndicator {
  private el: HTMLElement;
  private bars: HTMLElement[] = [];
  private transcriptEl: HTMLElement;
  private hintEl: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private silenceBar!: HTMLElement;
  private animFrame: number | null = null;
  private onSubmitCallback: (() => void) | null = null;
  private onCancelCallback: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private silenceDurationMs = 1500;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'sc-recording-indicator sc-recording-indicator--hidden';

    // Top row: mic + waveform + actions
    const topRow = document.createElement('div');
    topRow.className = 'sc-recording-indicator__top';

    const mic = document.createElement('div');
    mic.className = 'sc-recording-indicator__mic';
    mic.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="2" width="6" height="13" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>`;

    const waveform = document.createElement('div');
    waveform.className = 'sc-recording-indicator__waveform';
    for (let i = 0; i < 5; i++) {
      const bar = document.createElement('div');
      bar.className = 'sc-recording-indicator__bar';
      waveform.appendChild(bar);
      this.bars.push(bar);
    }

    const actions = document.createElement('div');
    actions.className = 'sc-recording-indicator__actions';

    this.submitBtn = document.createElement('button');
    this.submitBtn.className = 'sc-recording-indicator__action sc-recording-indicator__action--submit';
    this.submitBtn.title = 'Submit recording (Enter)';
    this.submitBtn.textContent = 'Send';
    this.submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onSubmitCallback?.();
    });

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = 'sc-recording-indicator__action sc-recording-indicator__action--cancel';
    this.cancelBtn.title = 'Cancel recording (Escape)';
    this.cancelBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>`;
    this.cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onCancelCallback?.();
    });

    actions.appendChild(this.submitBtn);
    actions.appendChild(this.cancelBtn);

    topRow.appendChild(mic);
    topRow.appendChild(waveform);
    topRow.appendChild(actions);

    // Hint text
    this.hintEl = document.createElement('div');
    this.hintEl.className = 'sc-recording-indicator__hint';
    this.hintEl.textContent = 'Enter to send, Esc to cancel';

    // Transcript text
    this.transcriptEl = document.createElement('div');
    this.transcriptEl.className = 'sc-recording-indicator__transcript';
    this.transcriptEl.textContent = 'Listening…';

    // Silence countdown bar
    const silenceTrack = document.createElement('div');
    silenceTrack.className = 'sc-recording-indicator__silence-track';
    this.silenceBar = document.createElement('div');
    this.silenceBar.className = 'sc-recording-indicator__silence-bar';
    silenceTrack.appendChild(this.silenceBar);

    this.el.appendChild(topRow);
    this.el.appendChild(this.transcriptEl);
    this.el.appendChild(silenceTrack);
    this.el.appendChild(this.hintEl);
    document.body.appendChild(this.el);
  }

  show(x: number, y: number, onSubmit: () => void, onCancel: () => void): void {
    this.onSubmitCallback = onSubmit;
    this.onCancelCallback = onCancel;
    this.submitBtn.style.display = 'inline-flex';
    this.cancelBtn.style.display = 'inline-flex';
    this.transcriptEl.textContent = 'Listening…';
    this.hintEl.textContent = 'Enter to send, Esc to cancel';
    this.silenceBar.style.width = '100%';
    this.silenceBar.style.background = 'linear-gradient(to right, #6366f1, #818cf8)';
    this.position(x, y);
    this.el.classList.remove('sc-recording-indicator--hidden');
    this.animateBars();

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.onSubmitCallback?.();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.onCancelCallback?.();
      }
    };
    document.addEventListener('keydown', this.keyHandler, { capture: true });
  }

  hide(): void {
    this.el.classList.add('sc-recording-indicator--hidden');
    this.onSubmitCallback = null;
    this.onCancelCallback = null;

    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, { capture: true });
      this.keyHandler = null;
    }
  }

  updateTranscript(text: string): void {
    this.transcriptEl.textContent = text.trim() || 'Listening…';
  }

  setSilenceCountdown(remainingMs: number): void {
    const pct = Math.min(100, (remainingMs / this.silenceDurationMs) * 100);
    this.silenceBar.style.width = `${pct}%`;
    // Turn orange when draining
    this.silenceBar.style.background = pct > 50
      ? 'linear-gradient(to right, #6366f1, #818cf8)'
      : 'linear-gradient(to right, #f59e0b, #fbbf24)';
  }

  setProcessing(): void {
    this.transcriptEl.textContent = 'Processing…';
    this.submitBtn.style.display = 'none';
    this.cancelBtn.style.display = 'none';
    this.hintEl.textContent = 'Sending request...';
    this.silenceBar.style.width = '100%';
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.bars.forEach((b) => { b.style.height = '3px'; });
  }

  private position(x: number, y: number): void {
    const margin = 16;
    const elW = 230;
    const elH = 90;
    const vw = window.innerWidth;

    let left = x + margin;
    let top = y - elH - margin;

    if (left + elW > vw - margin) left = x - elW - margin;
    if (top < margin) top = y + margin;

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  private animateBars(): void {
    const heights = [4, 10, 16, 10, 4];
    let tick = 0;

    const animate = (): void => {
      tick++;
      this.bars.forEach((bar, i) => {
        const phase = tick * 0.08 + i * 0.7;
        const h = heights[i] + Math.sin(phase) * heights[i] * 0.8;
        bar.style.height = `${Math.max(3, h)}px`;
      });
      this.animFrame = requestAnimationFrame(animate);
    };

    this.animFrame = requestAnimationFrame(animate);
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }
}
