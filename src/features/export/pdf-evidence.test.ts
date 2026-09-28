// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscussionBriefContext } from '@/lib/types';
import { loadBriefPhotos } from './pdf-evidence';

function context(photoUrls: string[]): DiscussionBriefContext {
  return {
    concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '',
    observation: { id: 'id', title: '', description: '', photoUrls, address: '', lat: 0, lng: 0, createdAt: 0, source: 'community' },
  };
}
afterEach(() => vi.useRealTimers());

describe('bounded PDF evidence loading', () => {
  it('has no network dependency without photos or for unsupported schemes', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await loadBriefPhotos()).toEqual([]);
    expect(await loadBriefPhotos({ ...context([]), observation: undefined })).toEqual([]);
    expect(await loadBriefPhotos(context(['file:///etc/passwd', 'javascript:alert(1)']))).toEqual([
      { source: 'file:///etc/passwd' }, { source: 'javascript:alert(1)' },
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads at most two allowed image URLs without credentials and keeps isolated photo failures', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('pixels', { headers: { 'content-type': 'image/jpeg' } })).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    const result = await loadBriefPhotos(context(['https://photos.example/first', 'blob:missing', 'https://photos.example/third']));
    expect(result).toHaveLength(2);
    expect(await result[0].image!.text()).toBe('pixels');
    expect(result[1]).toEqual({ source: 'blob:missing' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith('https://photos.example/first', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal) }));
  });

  it.each([
    ['failed status', () => new Response(null, { status: 403 })],
    ['oversize declared length', () => new Response('small', { headers: { 'content-type': 'image/png', 'content-length': String(5 * 1024 * 1024) } })],
    ['oversize actual body', () => new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { 'content-type': 'image/png' } })],
    ['unsupported mime', () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })],
  ])('continues without an image for %s', async (_, fixture) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fixture()));
    expect(await loadBriefPhotos(context(['https://photos.example/image']))).toEqual([{ source: 'https://photos.example/image' }]);
  });

  it('finishes after four seconds even if the photo provider ignores cancellation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const pending = loadBriefPhotos(context(['https://photos.example/hung']));
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toEqual([{ source: 'https://photos.example/hung' }]);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
