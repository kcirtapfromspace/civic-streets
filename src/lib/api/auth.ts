import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const SESSION_KEY = 'curbwise-session';

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    // localStorage unavailable (e.g., incognito in some browsers)
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function useAuth() {
  const [sessionToken, setSessionToken] = useState<string | null>(
    getStoredToken,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const createAnonymousUser = useMutation(api.users.createAnonymousUser);

  // Query the current user based on session token
  // useQuery returns undefined while loading, null if not found
  const user = useQuery(
    api.users.getCurrentUser,
    sessionToken ? { sessionToken } : 'skip',
  );

  // Only this effect creates sessions. Clearing an invalid token or logging
  // out routes through it instead of starting competing creation requests.
  useEffect(() => {
    let active = true;
    async function init() {
      if (sessionToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await createAnonymousUser();
        if (!active) return;
        if (result.sessionToken) {
          storeToken(result.sessionToken);
          setSessionToken(result.sessionToken);
        }
      } catch (err) {
        if (active) console.error('Failed to create anonymous user:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void init();
    return () => { active = false; };
  }, [sessionToken, sessionEpoch, createAnonymousUser]);

  useEffect(() => {
    if (user === null && sessionToken && !isLoading) {
      clearToken();
      setSessionToken(null);
      setIsLoading(true);
    }
  }, [user, sessionToken, isLoading]);

  // The backend deliberately reports false until verified sign-in is configured.
  // A legacy email field is contact data, not proof of authentication.
  const isAuthenticated = user?.isAuthenticated ?? false;

  const login = useCallback((_provider: string) => {
    throw new Error('Verified account sign-in is not available yet. You can continue reporting anonymously.');
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setSessionToken(null);
    setIsLoading(true);
    // Also restart when logout happens while the initial token is still null.
    setSessionEpoch((epoch) => epoch + 1);
  }, []);

  const upgradeAccount = useCallback(
    async (_email: string, _provider: string, _authId: string) => {
      // Client-supplied provider claims must never be used to link accounts.
      throw new Error('Verified account sign-in is not available yet. You can continue reporting anonymously.');
    },
    [],
  );

  return {
    user: user ?? null,
    sessionToken,
    isLoading: isLoading || (!!sessionToken && user === undefined),
    isAuthenticated,
    login,
    logout,
    upgradeAccount,
  };
}
