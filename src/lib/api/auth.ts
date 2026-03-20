import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const SESSION_KEY = 'street-copilot-session';

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

  const createAnonymousUser = useMutation(api.users.createAnonymousUser);
  const upgradeToAuthenticated = useMutation(api.users.upgradeToAuthenticated);

  // Query the current user based on session token
  // useQuery returns undefined while loading, null if not found
  const user = useQuery(
    api.users.getCurrentUser,
    sessionToken ? { sessionToken } : 'skip',
  );

  // Initialize: create anonymous user if no session token exists
  useEffect(() => {
    async function init() {
      if (sessionToken) {
        // We have a token; the useQuery above will load the user
        setIsLoading(false);
        return;
      }

      try {
        const result = await createAnonymousUser();
        if (result.sessionToken) {
          storeToken(result.sessionToken);
          setSessionToken(result.sessionToken);
        }
      } catch (err) {
        console.error('Failed to create anonymous user:', err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [sessionToken, createAnonymousUser]);

  // If user query finishes loading but returns null (invalid token),
  // create a new anonymous user
  useEffect(() => {
    async function handleInvalidSession() {
      if (user === null && sessionToken && !isLoading) {
        clearToken();
        setSessionToken(null);
        setIsLoading(true);
        try {
          const result = await createAnonymousUser();
          if (result.sessionToken) {
            storeToken(result.sessionToken);
            setSessionToken(result.sessionToken);
          }
        } catch (err) {
          console.error('Failed to create anonymous user:', err);
        } finally {
          setIsLoading(false);
        }
      }
    }

    handleInvalidSession();
  }, [user, sessionToken, isLoading, createAnonymousUser]);

  const isAuthenticated = !!user && !!user.email;

  const login = useCallback((provider: string) => {
    // Placeholder for OAuth flow
    console.log(`Login with ${provider} — not yet implemented`);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setSessionToken(null);
  }, []);

  const upgradeAccount = useCallback(
    async (email: string, provider: string, authId: string) => {
      if (!sessionToken) {
        throw new Error('No active session');
      }
      const result = await upgradeToAuthenticated({
        sessionToken,
        email,
        authProvider: provider,
        authId,
      });
      if (result.sessionToken) {
        storeToken(result.sessionToken);
        setSessionToken(result.sessionToken);
      }
      return result.user;
    },
    [sessionToken, upgradeToAuthenticated],
  );

  return {
    user: user ?? null,
    sessionToken,
    isLoading: isLoading || user === undefined,
    isAuthenticated,
    login,
    logout,
    upgradeAccount,
  };
}
