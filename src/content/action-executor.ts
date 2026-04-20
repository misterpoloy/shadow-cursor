import { ActionPlan, ActionStep, ActionSession } from '../shared/types';
import { sendToServiceWorker } from '../shared/messaging';
import { ShadowCursor } from './shadow-cursor';
import { Highlighter } from './highlighter';
import { StepApprovalCard } from './step-approval-card';
import { STEP_DELAY_MS } from '../shared/constants';
import { scrapeDOM } from './dom-scraper';

export class ActionExecutor {
  private highlighter = new Highlighter();
  private approvalCard = new StepApprovalCard();

  constructor(private cursor: ShadowCursor) {}

  async execute(plan: ActionPlan, nextStepIndex = 0, warningsConfirmed = false): Promise<void> {
    let activePlan = plan;
    let activeStepIndex = nextStepIndex;
    let activeWarningsConfirmed = warningsConfirmed;
    let hasShownUnderstanding = false;
    let shouldClearSession = false;
    let completedAllSteps = true;

    this.cursor.show();

    while (activeStepIndex < activePlan.steps.length) {
      if (activePlan.warnings.length > 0 && !activeWarningsConfirmed) {
        const ok = await this.confirmWarnings(activePlan.warnings);
        if (!ok) {
          await this.clearActionSession();
          return;
        }
        activeWarningsConfirmed = true;
        await this.syncActionSession(activePlan, activeStepIndex, true);
      }

      if (!hasShownUnderstanding) {
        this.showUnderstanding(
          activeStepIndex > 0
            ? `${activePlan.understanding} — resuming at step ${activeStepIndex + 1}`
            : activePlan.understanding
        );
        hasShownUnderstanding = true;
      }

      const step = activePlan.steps[activeStepIndex];
      const approved = await this.confirmStep(step, activeStepIndex, activePlan.steps.length);
      if (!approved) {
        completedAllSteps = false;
        shouldClearSession = true;
        break;
      }

      try {
        if (this.shouldPersistBeforeExecution(step)) {
          await this.syncActionSession(activePlan, activeStepIndex + 1, activeWarningsConfirmed);
        }
        await this.executeStep(step);
        if (!this.shouldPersistBeforeExecution(step)) {
          await this.syncActionSession(activePlan, activeStepIndex + 1, activeWarningsConfirmed);
        }
      } catch (err) {
        if (this.canRecoverFromStepFailure(step, err)) {
          const replanned = await this.replanFromCurrentPage();
          if (replanned) {
            activePlan = replanned;
            activeStepIndex = 0;
            activeWarningsConfirmed = false;
            hasShownUnderstanding = false;
            continue;
          }
        }

        console.error(`[ShadowCursor] Step ${activeStepIndex} failed:`, err);
        this.showStepError(step, err instanceof Error ? err.message : String(err));
        completedAllSteps = false;
        shouldClearSession = true;
        break;
      }

      activeStepIndex += 1;

      if (activeStepIndex < activePlan.steps.length && this.shouldReplanAfterStep(step)) {
        const replanned = await this.replanFromCurrentPage();
        if (replanned) {
          activePlan = replanned;
          activeStepIndex = 0;
          activeWarningsConfirmed = false;
          hasShownUnderstanding = false;
          continue;
        }
      }

      await this.delay(STEP_DELAY_MS);
    }

    if (completedAllSteps) {
      shouldClearSession = true;
    }

    if (shouldClearSession) {
      await this.clearActionSession();
    }
    this.cursor.hide();
    this.approvalCard.hide();
    this.highlighter.clear();
  }

  cancelActiveUI(): void {
    this.cursor.hide();
    this.approvalCard.hide();
    this.highlighter.clear();
  }

  private async executeStep(step: ActionStep): Promise<void> {
    if (step.action === 'navigate') {
      window.location.href = step.value ?? step.selector;
      return;
    }

    if (step.action === 'wait') {
      await this.delay(parseInt(step.value ?? '1000', 10));
      return;
    }

    if (!step.selector) {
      throw new Error('Missing selector for this action');
    }

    const el = document.querySelector<HTMLElement>(step.selector);

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
    return this.approvalCard.confirmWarnings(warnings);
  }

  private shouldPersistBeforeExecution(step: ActionStep): boolean {
    return step.action === 'click' || step.action === 'navigate';
  }

  private shouldReplanAfterStep(step: ActionStep): boolean {
    return step.action === 'click' || step.action === 'navigate';
  }

  private canRecoverFromStepFailure(step: ActionStep, err: unknown): boolean {
    if (step.action !== 'click' && step.action !== 'type' && step.action !== 'scroll') {
      return false;
    }

    const message = err instanceof Error ? err.message : String(err);
    return message.startsWith('Element not found:');
  }

  private async syncActionSession(plan: ActionPlan, nextStepIndex: number, warningsConfirmed: boolean): Promise<void> {
    const session: ActionSession = {
      plan,
      nextStepIndex,
      warningsConfirmed,
      updatedAt: Date.now(),
    };
    await sendToServiceWorker({ type: 'SYNC_ACTION_SESSION', session });
  }

  private async clearActionSession(): Promise<void> {
    await sendToServiceWorker({ type: 'CLEAR_ACTION_SESSION' });
  }

  private async replanFromCurrentPage(): Promise<ActionPlan | null> {
    return sendToServiceWorker<ActionPlan | null>({
      type: 'REPLAN_ACTION_SESSION',
      dom: scrapeDOM(),
      url: location.href,
      title: document.title,
    });
  }

  private confirmStep(step: ActionStep, stepIndex: number, totalSteps: number): Promise<boolean> {
    let focusRect: DOMRect | null = null;

    if (step.action !== 'navigate' && step.action !== 'wait') {
      const el = document.querySelector(step.selector);
      if (el) {
        this.highlighter.highlight(el, step.description);
        focusRect = el.getBoundingClientRect();
      }
    }

    return this.approvalCard.confirm(step, stepIndex, totalSteps, focusRect);
  }

  private showUnderstanding(text: string): void {
    const toast = document.createElement('div');
    toast.className = 'sc-toast sc-toast--understanding';
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
