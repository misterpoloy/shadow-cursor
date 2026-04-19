// Auth placeholder for an optional managed service integration.
// For MVP, auth state is stored in chrome.storage.sync.

export interface AuthState {
  userId?: string;
  email?: string;
  subscriptionActive: boolean;
  trialExpiresAt?: number;
}

export async function getAuthState(): Promise<AuthState> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('auth_state', (result) => {
      resolve(result['auth_state'] as AuthState ?? { subscriptionActive: false });
    });
  });
}

export async function setAuthState(state: AuthState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ auth_state: state }, () => resolve());
  });
}

export async function clearAuthState(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.remove('auth_state', () => resolve());
  });
}

export async function isProUser(): Promise<boolean> {
  const state = await getAuthState();
  if (!state.subscriptionActive) return false;
  if (state.trialExpiresAt && Date.now() > state.trialExpiresAt) {
    await clearAuthState();
    return false;
  }
  return true;
}
