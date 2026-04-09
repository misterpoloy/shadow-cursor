import { getConfig } from '../shared/storage';

async function init(): Promise<void> {
  const config = await getConfig();

  const badge = document.getElementById('status-badge')!;
  const modeLabel = document.getElementById('mode-label')!;

  if (config.mode === 'byok' && !config.apiKey) {
    badge.textContent = 'API key not configured';
    badge.classList.add('status-badge--error');
  } else {
    badge.textContent = config.mode === 'pro' ? 'Pro mode active' : 'BYOK mode active';
  }

  const providerName = config.provider === 'claude' ? 'Claude' : 'OpenAI';
  modeLabel.textContent = config.mode === 'byok' ? `via ${providerName}` : 'SmartQuiz proxy';

  document.getElementById('btn-settings')!.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

init().catch(console.error);
