import { ActionPlan, ActionStep } from '../shared/types';
import { ShadowCursor } from './shadow-cursor';
import { Highlighter } from './highlighter';
import { STEP_DELAY_MS, AUTO_CLICK_COUNTDOWN_MS } from '../shared/constants';

export class ActionExecutor {
  private highlighter = new Highlighter();

  constructor(private cursor: ShadowCursor) {}

  async execute(plan: ActionPlan): Promise<void> {
    if (plan.warnings.length > 0) {
      const ok = await this.confirmWarnings(plan.warnings);
      if (!ok) return;
    }

    this.showUnderstanding(plan.understanding);
    this.cursor.show();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      if (step.confidence < 0.7) {
        const ok = await this.confirmStep(step);
        if (!ok) continue;
      }

      try {
        await this.executeStep(step);
      } catch (err) {
        console.error(`[ShadowCursor] Step ${i} failed:`, err);
        this.showStepError(step, err instanceof Error ? err.message : String(err));
      }

      await this.delay(STEP_DELAY_MS);
    }

    this.cursor.hide();
    this.highlighter.clear();
  }

  private async executeStep(step: ActionStep): Promise<void> {
    const el = document.querySelector<HTMLElement>(step.selector);

    if (step.action === 'navigate') {
      window.location.href = step.value ?? step.selector;
      return;
    }

    if (step.action === 'wait') {
      await this.delay(parseInt(step.value ?? '1000', 10));
      return;
    }

    if (!el) {
      throw new Error(`Element not found: ${step.selector}`);
    }

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 + window.scrollX;
    const centerY = rect.top + rect.height / 2 + window.scrollY;

    await this.cursor.moveTo(centerX - window.scrollX, centerY - window.scrollY);
    this.cursor.pulse();

    this.highlighter.highlight(el, step.description);

    if (step.action === 'click') {
      await this.highlighter.showCountdown(Math.round(AUTO_CLICK_COUNTDOWN_MS / 1000));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else if (step.action === 'type' && step.value) {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = step.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (step.action === 'scroll') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    await this.waitForDOMStabilize();
  }

  private waitForDOMStabilize(): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { observer.disconnect(); resolve(); }, 300);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      // Resolve even if no mutations
      timer = setTimeout(() => { observer.disconnect(); resolve(); }, 800);
    });
  }

  private confirmWarnings(warnings: string[]): Promise<boolean> {
    const msg = `ShadowCursor — Potential risks:\n\n${warnings.map((w) => `• ${w}`).join('\n')}\n\nProceed?`;
    return Promise.resolve(confirm(msg));
  }

  private confirmStep(step: ActionStep): Promise<boolean> {
    const msg = `Low confidence (${Math.round(step.confidence * 100)}%) for:\n"${step.description}"\n\nProceed?`;
    return Promise.resolve(confirm(msg));
  }

  private showUnderstanding(text: string): void {
    const toast = document.createElement('div');
    toast.className = 'sc-toast';
    toast.textContent = `ShadowCursor: ${text}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  private showStepError(step: ActionStep, msg: string): void {
    const toast = document.createElement('div');
    toast.className = 'sc-toast sc-toast--error';
    toast.textContent = `Step failed: ${step.description} — ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
