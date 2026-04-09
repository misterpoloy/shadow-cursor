import { UserConfig } from './types';
import { DEFAULT_CONFIG, STORAGE_KEYS } from './constants';

export async function getConfig(): Promise<UserConfig> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.USER_CONFIG, (result) => {
      resolve({ ...DEFAULT_CONFIG, ...(result[STORAGE_KEYS.USER_CONFIG] ?? {}) });
    });
  });
}

export async function setConfig(config: Partial<UserConfig>): Promise<void> {
  const current = await getConfig();
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      { [STORAGE_KEYS.USER_CONFIG]: { ...current, ...config } },
      () => resolve()
    );
  });
}

export async function getLocal<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

export async function setLocal<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

export interface UsageStats {
  requestCount: number;
  lastReset: number;
}

export async function incrementUsage(): Promise<UsageStats> {
  const stats = await getLocal<UsageStats>(STORAGE_KEYS.USAGE_STATS) ?? {
    requestCount: 0,
    lastReset: Date.now(),
  };
  stats.requestCount += 1;
  await setLocal(STORAGE_KEYS.USAGE_STATS, stats);
  return stats;
}
