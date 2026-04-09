export class Highlighter {
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;

  highlight(el: Element, description: string): void {
    this.clear();

    const rect = el.getBoundingClientRect();

    this.overlay = document.createElement('div');
    this.overlay.className = 'sc-highlight';
    this.overlay.style.cssText = `
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    `;
    document.body.appendChild(this.overlay);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sc-tooltip';
    this.tooltip.textContent = description;

    const tooltipTop = rect.top + window.scrollY - 40;
    this.tooltip.style.cssText = `
      left: ${rect.left + window.scrollX}px;
      top: ${tooltipTop > 0 ? tooltipTop : rect.bottom + window.scrollY + 8}px;
    `;
    document.body.appendChild(this.tooltip);
  }

  clear(): void {
    this.overlay?.remove();
    this.tooltip?.remove();
    this.overlay = null;
    this.tooltip = null;
  }

  showCountdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.tooltip) { resolve(); return; }
      const tooltip = this.tooltip;
      const originalText = tooltip.textContent ?? '';
      let remaining = seconds;

      const tick = (): void => {
        tooltip.textContent = `${originalText} (${remaining}s)`;
        if (remaining <= 0) {
          tooltip.textContent = originalText;
          resolve();
          return;
        }
        remaining--;
        setTimeout(tick, 1000);
      };
      tick();
    });
  }
}
