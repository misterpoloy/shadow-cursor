export class LoadingIndicator {
  private el: HTMLElement;
  private labelEl: HTMLElement;
  private mouseHandler: ((e: MouseEvent) => void) | null = null;
  private currentX = 0;
  private currentY = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'sc-loading-indicator sc-loading-indicator--hidden';

    const spinner = document.createElement('div');
    spinner.className = 'sc-loading-indicator__spinner';

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'sc-loading-indicator__label';
    this.labelEl.textContent = 'ShadowCursor is thinking...';

    this.el.appendChild(spinner);
    this.el.appendChild(this.labelEl);
    document.body.appendChild(this.el);
  }

  show(x: number, y: number, label = 'ShadowCursor is thinking...'): void {
    this.currentX = x;
    this.currentY = y;
    this.labelEl.textContent = label;
    this.position();
    this.el.classList.remove('sc-loading-indicator--hidden');

    if (!this.mouseHandler) {
      this.mouseHandler = (e: MouseEvent) => {
        this.currentX = e.clientX;
        this.currentY = e.clientY;
        this.position();
      };
      document.addEventListener('mousemove', this.mouseHandler, true);
    }
  }

  hide(): void {
    this.el.classList.add('sc-loading-indicator--hidden');
    if (this.mouseHandler) {
      document.removeEventListener('mousemove', this.mouseHandler, true);
      this.mouseHandler = null;
    }
  }

  private position(): void {
    const offset = 18;
    this.el.style.left = `${this.currentX + offset}px`;
    this.el.style.top = `${this.currentY + offset}px`;
  }
}

let sharedLoadingIndicator: LoadingIndicator | null = null;

export function getLoadingIndicator(): LoadingIndicator {
  if (!sharedLoadingIndicator) {
    sharedLoadingIndicator = new LoadingIndicator();
  }
  return sharedLoadingIndicator;
}
