import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth';

const { createAnonymousUser, upgradeToAuthenticated, useQuery } = vi.hoisted(() => ({
  createAnonymousUser: vi.fn(),
  upgradeToAuthenticated: vi.fn(),
  useQuery: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useQuery,
  useMutation: (endpoint: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(endpoint) === 'users:createAnonymousUser'
      ? createAnonymousUser
      : upgradeToAuthenticated,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const user = (id: string) => ({ _id: id, displayName: 'Civic Fox', isAuthenticated: false });
const created = (token: string) => ({ sessionToken: token, user: user(token) });
let stored: Map<string, string>;
let queryResults: Map<
  string,
  ReturnType<typeof user> | { _id: string; email: string; displayName: string } | null | undefined
>;

beforeEach(() => {
  stored = new Map([['curbwise-session', 'original-session']]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  queryResults = new Map([['original-session', user('original-user')]]);
  // Like Convex, skipped/pending queries return undefined; results belong to
  // their query arguments and do not accidentally carry over to a new token.
  useQuery
    .mockReset()
    .mockImplementation((_endpoint, args: 'skip' | { sessionToken: string }) =>
      args === 'skip' ? undefined : queryResults.get(args.sessionToken),
    );
  createAnonymousUser.mockReset();
  upgradeToAuthenticated.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('unverified account state', () => {
  it('does not treat a legacy self-asserted email as authenticated', () => {
    queryResults.set('original-session', {
      _id: 'legacy-user',
      email: 'self-asserted@example.test',
      displayName: 'Civic Fox',
    });
    const { result } = renderHook(() => useAuth());
    expect(result.current.user?.email).toBe('self-asserted@example.test');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionToken).toBe('original-session');
    expect(createAnonymousUser).not.toHaveBeenCalled();
  });

  it('preserves the anonymous session when verified sign-in is unavailable', async () => {
    const { result } = renderHook(() => useAuth());
    expect(() => result.current.login('unconfigured-provider')).toThrow('sign-in is not available');
    await expect(
      result.current.upgradeAccount('claim@example.test', 'provider', 'claimed-id'),
    ).rejects.toThrow('sign-in is not available');
    expect(upgradeToAuthenticated).not.toHaveBeenCalled();
    expect(localStorage.getItem('curbwise-session')).toBe('original-session');
    expect(result.current.sessionToken).toBe('original-session');
  });
});

describe('anonymous session lifecycle', () => {
  it('creates a session once and waits for that session’s user query', async () => {
    stored.clear();
    const pending = deferred<ReturnType<typeof created>>();
    createAnonymousUser.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(createAnonymousUser).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(created('new-session')));
    expect(stored.get('curbwise-session')).toBe('new-session');
    expect(result.current.sessionToken).toBe('new-session');
    expect(result.current.isLoading).toBe(true);
    queryResults.set('new-session', user('new-user'));
    rerender();
    expect(result.current.user).toMatchObject({ _id: 'new-user' });
    expect(result.current.isLoading).toBe(false);
    expect(createAnonymousUser).toHaveBeenCalledTimes(1);
  });

  it('waits for a stored session query without creating another user', () => {
    queryResults.set('original-session', undefined);
    const { result, rerender } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(true);
    expect(createAnonymousUser).not.toHaveBeenCalled();
    queryResults.set('original-session', user('loaded-user'));
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toMatchObject({ _id: 'loaded-user' });
  });

  it('replaces an invalid stored session with exactly one new anonymous user', async () => {
    queryResults.set('original-session', null);
    const pending = deferred<ReturnType<typeof created>>();
    createAnonymousUser.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(createAnonymousUser).toHaveBeenCalledTimes(1));
    queryResults.set('replacement', user('replacement-user'));
    await act(async () => pending.resolve(created('replacement')));
    expect(result.current.sessionToken).toBe('replacement');
    expect(result.current.isLoading).toBe(false);
    expect(createAnonymousUser).toHaveBeenCalledTimes(1);
  });

  it('stops loading after session creation fails instead of waiting for a skipped query forever', async () => {
    stored.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createAnonymousUser.mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessionToken).toBeNull();
    expect(result.current.user).toBeNull();
    expect(createAnonymousUser).toHaveBeenCalledTimes(1);
  });

  it('does not write a late initialization response after unmount', async () => {
    stored.clear();
    const pending = deferred<ReturnType<typeof created>>();
    createAnonymousUser.mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useAuth());
    unmount();
    await act(async () => pending.resolve(created('orphan-session')));
    expect(stored.has('curbwise-session')).toBe(false);
  });

  it('invalidates a pending initialization on logout and ignores its late response', async () => {
    stored.clear();
    const old = deferred<ReturnType<typeof created>>();
    const fresh = deferred<ReturnType<typeof created>>();
    createAnonymousUser.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => useAuth());
    act(() => result.current.logout());
    await waitFor(() => expect(createAnonymousUser).toHaveBeenCalledTimes(2));
    queryResults.set('fresh-session', user('fresh-user'));
    await act(async () => fresh.resolve(created('fresh-session')));
    await act(async () => old.resolve(created('obsolete-session')));
    expect(result.current.sessionToken).toBe('fresh-session');
    expect(stored.get('curbwise-session')).toBe('fresh-session');
  });

  it('logs out a loaded user and establishes a fresh anonymous session', async () => {
    queryResults.set('fresh-session', user('fresh-user'));
    createAnonymousUser.mockResolvedValue(created('fresh-session'));
    const { result } = renderHook(() => useAuth());
    await act(async () => result.current.logout());
    expect(result.current.user).toMatchObject({ _id: 'fresh-user' });
    expect(result.current.sessionToken).toBe('fresh-session');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(stored.get('curbwise-session')).toBe('fresh-session');
    expect(createAnonymousUser).toHaveBeenCalledTimes(1);
  });

  it('clears an invalid stored token even when replacement fails', async () => {
    queryResults.set('original-session', null);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    createAnonymousUser.mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessionToken).toBeNull();
    expect(stored.has('curbwise-session')).toBe(false);
    expect(createAnonymousUser).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledOnce();
  });

  it.each(['getItem', 'setItem'])(
    'can establish an in-memory session when localStorage.%s throws',
    async (method) => {
      stored.clear();
      const storage = {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => {
          stored.set(key, value);
        },
        removeItem: (key: string) => {
          stored.delete(key);
        },
      };
      const blocked = () => {
        throw new Error('Storage blocked');
      };
      if (method === 'getItem') storage.getItem = blocked;
      else storage.setItem = blocked;
      vi.stubGlobal('localStorage', storage);
      queryResults.set('memory-session', user('memory-user'));
      createAnonymousUser.mockResolvedValue(created('memory-session'));
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sessionToken).toBe('memory-session');
      expect(result.current.user).toMatchObject({ _id: 'memory-user' });
      expect(createAnonymousUser).toHaveBeenCalledTimes(1);
    },
  );

  it('logs out despite a blocked storage removal', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'original-session',
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: () => {
        throw new Error('Storage blocked');
      },
    });
    queryResults.set('replacement', user('replacement-user'));
    createAnonymousUser.mockResolvedValue(created('replacement'));
    const { result } = renderHook(() => useAuth());
    await act(async () => result.current.logout());
    expect(result.current.sessionToken).toBe('replacement');
    expect(result.current.user).toMatchObject({ _id: 'replacement-user' });
  });

  it('ignores a late failure from a request invalidated by logout', async () => {
    stored.clear();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const old = deferred<ReturnType<typeof created>>();
    const fresh = deferred<ReturnType<typeof created>>();
    createAnonymousUser.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => useAuth());
    act(() => result.current.logout());
    await act(async () => old.reject(new Error('Obsolete network failure')));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sessionToken).toBeNull();
    expect(log).not.toHaveBeenCalled();
    queryResults.set('fresh-session', user('fresh-user'));
    await act(async () => fresh.resolve(created('fresh-session')));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.sessionToken).toBe('fresh-session');
  });
});
