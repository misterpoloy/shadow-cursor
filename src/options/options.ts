import { getConfig, setConfig, getLocal } from '../shared/storage';
import { STORAGE_KEYS } from '../shared/constants';
import { UsageStats } from '../shared/storage';
import { UserConfig } from '../shared/types';

async function init(): Promise<void> {
  const config = await getConfig();

  // Mode
  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  modeRadios.forEach((r) => { r.checked = r.value === config.mode; });
  modeRadios.forEach((r) => r.addEventListener('change', updateByokVisibility));

  // Provider
  const providerRadios = document.querySelectorAll<HTMLInputElement>('input[name="provider"]');
  providerRadios.forEach((r) => { r.checked = r.value === config.provider; });

  // API key
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  apiKeyInput.value = config.apiKey ?? '';

  // STT
  const sttRadios = document.querySelectorAll<HTMLInputElement>('input[name="stt"]');
  sttRadios.forEach((r) => { r.checked = r.value === config.sttProvider; });

  const sttKeyInput = document.getElementById('stt-key') as HTMLInputElement;
  sttKeyInput.value = config.sttApiKey ?? '';

  // Behavior
  (document.getElementById('auto-click') as HTMLInputElement).checked = config.autoClick;
  (document.getElementById('confirm-destructive') as HTMLInputElement).checked = config.confirmDestructive;

  updateByokVisibility();

  // Usage
  const stats = await getLocal<UsageStats>(STORAGE_KEYS.USAGE_STATS);
  const usageText = document.getElementById('usage-text')!;
  usageText.textContent = stats
    ? `${stats.requestCount} requests made`
    : 'No requests yet';

  // Save
  document.getElementById('btn-save')!.addEventListener('click', async () => {
    const modeVal = (document.querySelector<HTMLInputElement>('input[name="mode"]:checked'))?.value as UserConfig['mode'];
    const providerVal = (document.querySelector<HTMLInputElement>('input[name="provider"]:checked'))?.value as UserConfig['provider'];
    const sttVal = (document.querySelector<HTMLInputElement>('input[name="stt"]:checked'))?.value as UserConfig['sttProvider'];

    await setConfig({
      mode: modeVal,
      provider: providerVal,
      apiKey: apiKeyInput.value.trim() || undefined,
      sttProvider: sttVal,
      sttApiKey: sttKeyInput.value.trim() || undefined,
      autoClick: (document.getElementById('auto-click') as HTMLInputElement).checked,
      confirmDestructive: (document.getElementById('confirm-destructive') as HTMLInputElement).checked,
    });

    const status = document.getElementById('save-status')!;
    status.textContent = 'Saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
}

function updateByokVisibility(): void {
  const selected = (document.querySelector<HTMLInputElement>('input[name="mode"]:checked'))?.value;
  const byokSection = document.getElementById('byok-section')!;
  byokSection.style.display = selected === 'byok' ? 'flex' : 'none';
}

init().catch(console.error);
