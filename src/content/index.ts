import { initTrigger } from './trigger';
import { onMessage } from '../shared/messaging';
import { Message } from '../shared/types';
import { ShadowCursor } from './shadow-cursor';
import { ActionExecutor } from './action-executor';
import './styles.css';

const cursor = new ShadowCursor();
const executor = new ActionExecutor(cursor);

initTrigger();

onMessage((message: Message) => {
  switch (message.type) {
    case 'ACTION_PLAN':
      executor.execute(message.plan).catch(console.error);
      break;

    case 'ERROR':
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
