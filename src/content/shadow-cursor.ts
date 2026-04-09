import { CURSOR_ANIMATION_MS } from '../shared/constants';

export class ShadowCursor {
  private el: HTMLElement;
  private currentX = -100;
  private currentY = -100;
  private animFrame: number | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'sc-shadow-cursor';
    document.body.appendChild(this.el);
    this.updatePosition(this.currentX, this.currentY);
  }

  private updatePosition(x: number, y: number): void {
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  moveTo(targetX: number, targetY: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.animFrame !== null) {
        cancelAnimationFrame(this.animFrame);
      }

      const startX = this.currentX;
      const startY = this.currentY;
      const startTime = performance.now();

      const easeInOut = (t: number): number =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const animate = (now: number): void => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / CURSOR_ANIMATION_MS, 1);
        const eased = easeInOut(progress);

        this.currentX = startX + (targetX - startX) * eased;
        this.currentY = startY + (targetY - startY) * eased;
        this.updatePosition(this.currentX, this.currentY);

        if (progress < 1) {
          this.animFrame = requestAnimationFrame(animate);
        } else {
          this.animFrame = null;
          resolve();
        }
      };

      this.animFrame = requestAnimationFrame(animate);
    });
  }

  show(): void {
    this.el.classList.remove('sc-shadow-cursor--hidden');
  }

  hide(): void {
    this.el.classList.add('sc-shadow-cursor--hidden');
  }

  pulse(): void {
    this.el.classList.add('sc-shadow-cursor--pulse');
    setTimeout(() => this.el.classList.remove('sc-shadow-cursor--pulse'), 600);
  }
}
