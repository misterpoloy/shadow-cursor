import { ActionStep } from '../shared/types';

export class StepApprovalCard {
  private backdropEl: HTMLElement;
  private backdropTopEl: HTMLElement;
  private backdropLeftEl: HTMLElement;
  private backdropRightEl: HTMLElement;
  private backdropBottomEl: HTMLElement;
  private el: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private metaEl: HTMLElement;
  private continueBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
  private pointerUpHandler: ((event: PointerEvent) => void) | null = null;

  constructor() {
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'sc-step-backdrop sc-step-backdrop--hidden';

    this.backdropTopEl = document.createElement('div');
    this.backdropTopEl.className = 'sc-step-backdrop__pane';
    this.backdropLeftEl = document.createElement('div');
    this.backdropLeftEl.className = 'sc-step-backdrop__pane';
    this.backdropRightEl = document.createElement('div');
    this.backdropRightEl.className = 'sc-step-backdrop__pane';
    this.backdropBottomEl = document.createElement('div');
    this.backdropBottomEl.className = 'sc-step-backdrop__pane';

    this.backdropEl.appendChild(this.backdropTopEl);
    this.backdropEl.appendChild(this.backdropLeftEl);
    this.backdropEl.appendChild(this.backdropRightEl);
    this.backdropEl.appendChild(this.backdropBottomEl);

    this.el = document.createElement('div');
    this.el.className = 'sc-step-card sc-step-card--hidden';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'sc-step-card__title';
    this.titleEl.title = 'Drag to move';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'sc-step-card__body';

    this.metaEl = document.createElement('div');
    this.metaEl.className = 'sc-step-card__meta';

    const actions = document.createElement('div');
    actions.className = 'sc-step-card__actions';

    this.continueBtn = document.createElement('button');
    this.continueBtn.className = 'sc-step-card__button sc-step-card__button--continue';
    this.continueBtn.textContent = 'Continue';

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = 'sc-step-card__button sc-step-card__button--cancel';
    this.cancelBtn.textContent = 'Cancel';

    actions.appendChild(this.continueBtn);
    actions.appendChild(this.cancelBtn);

    this.el.appendChild(this.titleEl);
    this.el.appendChild(this.bodyEl);
    this.el.appendChild(this.metaEl);
    this.el.appendChild(actions);
    document.body.appendChild(this.backdropEl);
    document.body.appendChild(this.el);

    this.titleEl.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('resize', this.handleWindowResize);
  }

  async confirm(
    step: ActionStep,
    stepIndex: number,
    totalSteps: number,
    focusRect?: DOMRect | null
  ): Promise<boolean> {
    this.titleEl.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
    this.bodyEl.textContent = step.description;
    this.el.classList.remove('sc-step-card--warning');
    this.continueBtn.textContent = 'Continue';
    this.cancelBtn.textContent = 'Cancel';

    const extras = [
      `Action: ${step.action}`,
      `Confidence: ${Math.round(step.confidence * 100)}%`,
    ];
    if (step.value) {
      extras.push(`Input: ${step.value}`);
    }
    this.metaEl.textContent = extras.join(' • ');
    this.setFocusRect(focusRect ?? null);
    this.backdropEl.classList.remove('sc-step-backdrop--hidden');
    this.el.classList.remove('sc-step-card--hidden');

    return new Promise((resolve) => {
      const cleanup = (): void => {
        this.continueBtn.removeEventListener('click', handleContinue);
        this.cancelBtn.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleKeydown, true);
        this.backdropEl.classList.add('sc-step-backdrop--hidden');
        this.el.classList.add('sc-step-card--hidden');
      };

      const handleContinue = (): void => {
        cleanup();
        resolve(true);
      };

      const handleCancel = (): void => {
        cleanup();
        resolve(false);
      };

      const handleKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleContinue();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };

      this.continueBtn.addEventListener('click', handleContinue);
      this.cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleKeydown, true);
    });
  }

  async confirmWarnings(warnings: string[]): Promise<boolean> {
    this.titleEl.textContent = 'Potential risks';
    this.bodyEl.innerHTML = warnings
      .map((warning) => `<div class="sc-step-card__warning">• ${escapeHtml(warning)}</div>`)
      .join('');
    this.metaEl.textContent = 'Review these risks before continuing.';
    this.continueBtn.textContent = 'Proceed';
    this.cancelBtn.textContent = 'Cancel';
    this.el.classList.add('sc-step-card--warning');
    this.backdropEl.classList.add('sc-step-backdrop--hidden');
    this.el.classList.remove('sc-step-card--hidden');

    return new Promise((resolve) => {
      const cleanup = (): void => {
        this.continueBtn.removeEventListener('click', handleContinue);
        this.cancelBtn.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleKeydown, true);
        this.el.classList.add('sc-step-card--hidden');
      };

      const handleContinue = (): void => {
        cleanup();
        this.continueBtn.textContent = 'Continue';
        resolve(true);
      };

      const handleCancel = (): void => {
        cleanup();
        this.continueBtn.textContent = 'Continue';
        resolve(false);
      };

      const handleKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleContinue();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };

      this.continueBtn.addEventListener('click', handleContinue);
      this.cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleKeydown, true);
    });
  }

  hide(): void {
    this.teardownDrag();
    this.backdropEl.classList.add('sc-step-backdrop--hidden');
    this.el.classList.add('sc-step-card--hidden');
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    const rect = this.el.getBoundingClientRect();
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;

    this.pinToViewportPosition(rect.left, rect.top);
    this.el.classList.add('sc-step-card--dragging');

    this.pointerMoveHandler = (moveEvent: PointerEvent) => {
      const nextLeft = moveEvent.clientX - this.dragOffsetX;
      const nextTop = moveEvent.clientY - this.dragOffsetY;
      this.pinToViewportPosition(nextLeft, nextTop);
    };

    this.pointerUpHandler = () => {
      this.teardownDrag();
    };

    this.titleEl.setPointerCapture(event.pointerId);
    document.addEventListener('pointermove', this.pointerMoveHandler, true);
    document.addEventListener('pointerup', this.pointerUpHandler, true);

    event.preventDefault();
  };

  private handleWindowResize = (): void => {
    if (this.el.classList.contains('sc-step-card--hidden')) return;

    const rect = this.el.getBoundingClientRect();
    if (this.el.style.left || this.el.style.top) {
      this.pinToViewportPosition(rect.left, rect.top);
    }
  };

  private teardownDrag(): void {
    this.el.classList.remove('sc-step-card--dragging');

    if (this.pointerMoveHandler) {
      document.removeEventListener('pointermove', this.pointerMoveHandler, true);
      this.pointerMoveHandler = null;
    }

    if (this.pointerUpHandler) {
      document.removeEventListener('pointerup', this.pointerUpHandler, true);
      this.pointerUpHandler = null;
    }
  }

  private pinToViewportPosition(left: number, top: number): void {
    const rect = this.el.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    const clampedLeft = Math.min(Math.max(8, left), maxLeft);
    const clampedTop = Math.min(Math.max(8, top), maxTop);

    this.el.style.left = `${clampedLeft}px`;
    this.el.style.top = `${clampedTop}px`;
    this.el.style.right = 'auto';
    this.el.style.bottom = 'auto';
  }

  private setFocusRect(rect: DOMRect | null): void {
    if (!rect) {
      this.backdropEl.classList.add('sc-step-backdrop--full');
      this.backdropTopEl.style.inset = '0 0 0 0';
      this.backdropLeftEl.style.inset = '0 0 0 0';
      this.backdropRightEl.style.inset = '0 0 0 0';
      this.backdropBottomEl.style.inset = '0 0 0 0';
      return;
    }

    this.backdropEl.classList.remove('sc-step-backdrop--full');

    const padding = 18;
    const top = Math.max(0, rect.top - padding);
    const left = Math.max(0, rect.left - padding);
    const right = Math.min(window.innerWidth, rect.right + padding);
    const bottom = Math.min(window.innerHeight, rect.bottom + padding);

    this.backdropTopEl.style.inset = `0 0 ${window.innerHeight - top}px 0`;
    this.backdropLeftEl.style.inset = `${top}px ${window.innerWidth - left}px ${window.innerHeight - bottom}px 0`;
    this.backdropRightEl.style.inset = `${top}px 0 ${window.innerHeight - bottom}px ${right}px`;
    this.backdropBottomEl.style.inset = `${bottom}px 0 0 0`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
