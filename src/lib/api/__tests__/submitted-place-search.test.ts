import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPlaceSearchCache, useSubmittedPlaceSearch } from '../use-submitted-place-search';

const { searchPlaces } = vi.hoisted(() => ({ searchPlaces: vi.fn() }));
vi.mock('../geocoding', () => ({ searchPlaces }));
const denver = { place_id: 1, display_name: 'Denver, Colorado', lat: '39.7392', lon: '-104.9903' };

describe('submitted place search', () => {
  beforeEach(() => {
    searchPlaces.mockReset();
    clearPlaceSearchCache();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not request while typing and normalizes an explicitly submitted query', async () => {
    searchPlaces.mockResolvedValue([denver]);
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery(' Denver   Colorado '));
    expect(searchPlaces).not.toHaveBeenCalled();
    await act(() => result.current.search());
    expect(searchPlaces).toHaveBeenCalledWith('Denver Colorado');
    expect(result.current).toMatchObject({
      results: [denver],
      isLoading: false,
      error: null,
      hasSearched: true,
    });
  });

  it('keeps configuration failures visible and permits an explicit retry', async () => {
    searchPlaces
      .mockRejectedValueOnce(new Error('Place search is not configured yet.'))
      .mockResolvedValueOnce([denver]);
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    await act(() => result.current.search());
    expect(result.current.error).toBe('Place search is not configured yet.');
    expect(result.current.results).toEqual([]);
    await act(() => result.current.search());
    expect(result.current.error).toBeNull();
    expect(result.current.results).toEqual([denver]);
    expect(searchPlaces).toHaveBeenCalledTimes(2);
  });

  it('caches successful empty results without presenting them as an error', async () => {
    searchPlaces.mockResolvedValue([]);
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Unmatched location'));
    await act(() => result.current.search());
    await act(() => result.current.search());
    expect(result.current).toMatchObject({
      hasSearched: true,
      isLoading: false,
      error: null,
      results: [],
    });
    expect(searchPlaces).toHaveBeenCalledTimes(1);
  });

  it('expires cached responses so later searches can refresh', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    searchPlaces.mockResolvedValue([denver]);
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    await act(() => result.current.search());
    now.mockReturnValue(1000 + 6 * 60_000);
    await act(() => result.current.search());
    expect(searchPlaces).toHaveBeenCalledTimes(2);
  });

  it('suppresses stale results after the query is edited', async () => {
    let finish: (value: unknown) => void = () => {};
    searchPlaces.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    let request: Promise<void>;
    act(() => {
      request = result.current.search();
    });
    expect(result.current.isLoading).toBe(true);
    act(() => result.current.setQuery('Chicago'));
    await act(async () => {
      finish([denver]);
      await request;
    });
    expect(result.current).toMatchObject({
      query: 'Chicago',
      results: [],
      hasSearched: false,
      isLoading: false,
    });
  });

  it('clearing a pending request prevents its later error from reopening the search state', async () => {
    let reject: (value: unknown) => void = () => {};
    searchPlaces.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    let request: Promise<void>;
    act(() => {
      request = result.current.search();
    });
    act(() => result.current.clearResults());
    await act(async () => {
      reject(new Error('Old network failure'));
      await request;
    });
    expect(result.current).toMatchObject({
      error: null,
      hasSearched: false,
      isLoading: false,
      results: [],
    });
  });

  it('guards duplicate submissions before React rerenders', async () => {
    let finish: (value: unknown) => void = () => {};
    searchPlaces.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    let request: Promise<void>;
    act(() => {
      request = result.current.search();
      void result.current.search();
    });
    expect(searchPlaces).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish([denver]);
      await request;
    });
  });

  it('rejects a too-short submitted query without using provider quota', async () => {
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('  ab  '));
    await act(() => result.current.search());
    expect(result.current).toMatchObject({
      isLoading: false,
      hasSearched: true,
      error: 'Enter at least 3 characters to search.',
    });
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('keeps a newer completed search when an older search subsequently fails', async () => {
    let failOld: (error: Error) => void = () => {};
    const chicago = {
      ...denver,
      place_id: 2,
      display_name: 'Chicago',
      lat: '41.88',
      lon: '-87.63',
    };
    searchPlaces
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failOld = reject;
          }),
      )
      .mockResolvedValueOnce([chicago]);
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    let oldRequest: Promise<void>;
    act(() => {
      oldRequest = result.current.search();
    });
    act(() => result.current.setQuery('Chicago'));
    await act(() => result.current.search());
    await act(async () => {
      failOld(new Error('Old network error'));
      await oldRequest;
    });
    expect(result.current).toMatchObject({
      query: 'Chicago',
      results: [chicago],
      error: null,
      isLoading: false,
    });
  });

  it('does not populate a later search surface with a result that arrived after the first surface unmounted', async () => {
    let finishOld: (results: unknown) => void = () => {};
    searchPlaces
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce([{ ...denver, display_name: 'Updated Denver result' }]);
    const first = renderHook(() => useSubmittedPlaceSearch());
    act(() => first.result.current.setQuery('Denver'));
    let oldRequest: Promise<void>;
    act(() => {
      oldRequest = first.result.current.search();
    });
    first.unmount();
    await act(async () => {
      finishOld([denver]);
      await oldRequest;
    });
    const second = renderHook(() => useSubmittedPlaceSearch());
    act(() => second.result.current.setQuery('Denver'));
    await act(() => second.result.current.search());
    expect(second.result.current.results[0].display_name).toBe('Updated Denver result');
    expect(searchPlaces).toHaveBeenCalledTimes(2);
  });

  it('shares completed cached searches across surfaces without sharing their UI state', async () => {
    searchPlaces.mockResolvedValue([denver]);
    const map = renderHook(() => useSubmittedPlaceSearch());
    const explorer = renderHook(() => useSubmittedPlaceSearch());
    act(() => map.result.current.setQuery('Denver Colorado'));
    await act(() => map.result.current.search());
    expect(explorer.result.current.hasSearched).toBe(false);
    act(() => explorer.result.current.setQuery(' denver   colorado '));
    await act(() => explorer.result.current.search());
    expect(explorer.result.current.results).toEqual([denver]);
    act(() => map.result.current.clearResults());
    expect(explorer.result.current.results).toEqual([denver]);
    expect(searchPlaces).toHaveBeenCalledTimes(1);
  });

  it('shows a safe retryable failure for an unexpected non-Error rejection', async () => {
    searchPlaces.mockRejectedValueOnce({ internal: 'untrusted provider diagnostics' });
    const { result } = renderHook(() => useSubmittedPlaceSearch());
    act(() => result.current.setQuery('Denver'));
    await act(() => result.current.search());
    expect(result.current.error).toBe('Place search is unavailable. Please try again.');
    expect(result.current.error).not.toContain('untrusted');
  });
});
