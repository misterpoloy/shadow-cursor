import { initTrigger } from './trigger';
import { onMessage } from '../shared/messaging';
import { ActionSession, Message } from '../shared/types';
import { ShadowCursor } from './shadow-cursor';
import { ActionExecutor } from './action-executor';
import { getLoadingIndicator } from './loading-indicator';
import { scrapeDOM } from './dom-scraper';
import { sendToServiceWorker } from '../shared/messaging';
import { AnswerCard } from './answer-card';
import './styles.css';

const cursor = new ShadowCursor();
const executor = new ActionExecutor(cursor);
const loadingIndicator = getLoadingIndicator();
const answerCard = new AnswerCard();

initTrigger();
resumePendingActionSession().catch(console.error);

onMessage((message: Message) => {
  switch (message.type) {
    case 'LLM_RESPONSE':
      loadingIndicator.hide();
      answerCard.hide();
      if (message.response.mode === 'action') {
        executor.execute(message.response).catch(console.error);
      } else {
        executor.cancelActiveUI();
        answerCard.show(message.response);
      }
      break;

    case 'ERROR':
      loadingIndicator.hide();
      answerCard.hide();
      showErrorToast(message.message);
      break;
  }
});

function showErrorToast(msg: string): void {
  const toast = document.createElement('div');
  toast.className = 'sc-toast sc-toast--error';
  toast.textContent = `ShadowCursor: ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

async function resumePendingActionSession(): Promise<void> {
  const session = await sendToServiceWorker<ActionSession | null>({ type: 'GET_PENDING_ACTION_SESSION' });
  if (!session) return;
  if (session.nextStepIndex >= session.plan.steps.length) {
    await sendToServiceWorker({ type: 'CLEAR_ACTION_SESSION' });
    return;
  }

  if (session.nextStepIndex > 0) {
    loadingIndicator.show(window.innerWidth - 120, window.innerHeight - 120, 'Refreshing next steps...');
    const replanned = await sendToServiceWorker<ActionSession['plan'] | null>({
      type: 'REPLAN_ACTION_SESSION',
      dom: scrapeDOM(),
      url: location.href,
      title: document.title,
    });
    loadingIndicator.hide();

    if (replanned) {
      await executor.execute(replanned);
      return;
    }
  }

  loadingIndicator.hide();
  await executor.execute(session.plan, session.nextStepIndex, session.warningsConfirmed);
}
