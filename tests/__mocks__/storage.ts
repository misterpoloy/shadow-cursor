import { UserConfig } from '../../src/shared/types';
import { DEFAULT_CONFIG } from '../../src/shared/constants';

export const getConfig = jest.fn(async (): Promise<UserConfig> => ({ ...DEFAULT_CONFIG }));
export const setConfig = jest.fn(async () => {});
export const getLocal = jest.fn(async () => undefined);
export const setLocal = jest.fn(async () => {});
export const incrementUsage = jest.fn(async () => ({ requestCount: 1, lastReset: Date.now() }));
