import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { useDesignById } from '../use-designs';
import { street } from '@/features/editor/__tests__/fixtures';
const port = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../convex-provider', () => ({ convexAvailable: true }));
vi.mock('convex/react', () => ({ useConvex: () => port, useQuery: vi.fn() }));
beforeEach(() => { port.query.mockReset(); });
afterEach(cleanup);
it.each([false, true])('loads the exact persisted concept with before data=%s', async (withBefore) => {
  port.query.mockResolvedValue({ streetData: JSON.stringify(street()), beforeStreetData: withBefore ? JSON.stringify({ ...street(), name: 'Before' }) : undefined });
  const { result } = renderHook(() => useDesignById('shared-a'));
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(getFunctionName(port.query.mock.calls[0][0])).toBe('designs:getById');
  expect(port.query.mock.calls[0][1]).toEqual({ designId: 'shared-a' });
  expect(result.current).toEqual({ id: 'shared-a', status: 'ready', street: street(), beforeStreet: withBefore ? { ...street(), name: 'Before' } : null });
});
it('treats a private, deleted, or missing public record as unavailable', async () => {
  port.query.mockResolvedValue(null);
  const { result } = renderHook(() => useDesignById('private'));
  await waitFor(() => expect(result.current).toEqual({ id: 'private', status: 'missing' }));
});
it.each([
  { streetData: 'not json' },
  { streetData: JSON.stringify({ id: 'broken' }) },
  { streetData: JSON.stringify(street()), beforeStreetData: '{}' },
  new Error('Connection unavailable'),
])('shows a recoverable error for malformed data or query failure', async (doc) => {
  if (doc instanceof Error) port.query.mockRejectedValue(doc); else port.query.mockResolvedValue(doc);
  const { result } = renderHook(() => useDesignById('broken'));
  await waitFor(() => expect(result.current).toEqual({ id: 'broken', status: 'error' }));
});
it('does not flash the previous route or apply an obsolete delayed query', async () => {
  let finishOld!: (value: unknown) => void;
  port.query.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  port.query.mockResolvedValueOnce({ streetData: JSON.stringify({ ...street(), name: 'New route' }) });
  const { result, rerender } = renderHook((id) => useDesignById(id), { initialProps: 'old' });
  rerender('new');
  expect(result.current).toEqual({ id: 'new', status: 'loading' });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => finishOld({ streetData: JSON.stringify(street()) }));
  expect(result.current).toMatchObject({ id: 'new', street: { name: 'New route' } });
  port.query.mockImplementationOnce(() => new Promise(() => {}));
  rerender('third');
  expect(result.current).toEqual({ id: 'third', status: 'loading' });
});
it('ignores a rejected request after leaving the route', async () => {
  let fail!: (error: Error) => void;
  port.query.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const { unmount } = renderHook(() => useDesignById('old'));
  unmount();
  await act(async () => fail(new Error('late error')));
  expect(port.query).toHaveBeenCalledOnce();
});

it('retries a failed link in place without reloading or showing stale errors', async () => {
  port.query.mockRejectedValueOnce(new Error('Temporary failure'));
  port.query.mockResolvedValueOnce({ streetData: JSON.stringify(street()) });
  const { result, rerender } = renderHook((attempt) => useDesignById('retry', attempt), { initialProps: 0 });
  await waitFor(() => expect(result.current.status).toBe('error'));
  rerender(1);
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(port.query).toHaveBeenCalledTimes(2);
});
