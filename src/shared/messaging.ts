import { Message } from './types';

function isBenignClosedPortError(message: string | undefined): boolean {
  return message === 'The message port closed before a response was received.';
}

export function sendToServiceWorker<T = void>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        if (isBenignClosedPortError(chrome.runtime.lastError.message)) {
          resolve(response as T);
          return;
        }
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

export function sendToTab<T = void>(tabId: number, message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        if (isBenignClosedPortError(chrome.runtime.lastError.message)) {
          resolve(response as T);
          return;
        }
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

export function onMessage(
  handler: (message: Message, sender: chrome.runtime.MessageSender) => void | Promise<unknown>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = handler(message as Message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch((err) => {
        console.error('[ShadowCursor] message handler error:', err);
        sendResponse({ error: String(err) });
      });
      return true; // keep channel open for async
    }
  });
}
