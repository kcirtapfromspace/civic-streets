import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSafetyDataStore } from '../safety-data-store';

const bounds = { south: 39.73, west: -105, north: 39.75, east: -104.98 };
const fetchMock = vi.fn();
const response = (id: string) => ({
  ok: true,
  json: async () => ({
    features: [
      {
        attributes: {
          object_id: 1,
          incident_id: id,
          geo_lat: 39.74,
          geo_lon: -104.99,
          first_occurrence_date: Date.parse('2026-02-10T00:00:00Z'),
          FATALITIES: 0,
          SERIOUSLY_INJURED: 1,
        },
      },
    ],
  }),
});

describe('safety data state across user actions', () => {
  beforeEach(() => {
    useSafetyDataStore.getState().setEnabled(false);
    useSafetyDataStore.getState().clearAll();
    useSafetyDataStore.setState({
      showHeatmap: true,
      showPoints: false,
      filters: {
        modes: new Set(['pedestrian', 'cyclist', 'motorist']),
        severities: new Set(['fatal', 'severe-injury', 'moderate-injury', 'minor', 'unknown']),
        dateRange: null,
      },
    });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    useSafetyDataStore.getState().setEnabled(false);
    vi.unstubAllGlobals();
  });

  it('does not query when disabled or when retry has no selected viewport', async () => {
    await useSafetyDataStore.getState().fetchForBounds(bounds);
    await useSafetyDataStore.getState().retry();
    useSafetyDataStore.getState().setDateRange('2026-01-01', '2026-03-01');
    useSafetyDataStore.getState().clearDateRange();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useSafetyDataStore.getState()).toMatchObject({
      lastBounds: null,
      coverage: null,
      isLoading: false,
    });
  });

  it('lets display filters change independently without clearing the selected dates or issuing new requests', async () => {
    fetchMock.mockResolvedValue(response('one'));
    const state = useSafetyDataStore.getState();
    state.setDateRange('2026-01-01', '2026-03-01');
    state.setEnabled(true);
    await state.fetchForBounds(bounds);
    const previousModes = useSafetyDataStore.getState().filters.modes;
    state.toggleMode('cyclist');
    state.toggleSeverity('unknown');
    state.toggleHeatmap();
    state.togglePoints();
    expect(previousModes.has('cyclist')).toBe(true);
    expect(useSafetyDataStore.getState().filters.modes.has('cyclist')).toBe(false);
    expect(useSafetyDataStore.getState().filters.severities.has('unknown')).toBe(false);
    expect(useSafetyDataStore.getState()).toMatchObject({
      showHeatmap: false,
      showPoints: true,
      filters: { dateRange: { start: '2026-01-01', end: '2026-03-01' } },
    });
    state.toggleMode('cyclist');
    state.toggleSeverity('unknown');
    state.toggleHeatmap();
    state.togglePoints();
    expect(useSafetyDataStore.getState().filters.modes.has('cyclist')).toBe(true);
    expect(useSafetyDataStore.getState().filters.severities.has('unknown')).toBe(true);
    expect(useSafetyDataStore.getState()).toMatchObject({ showHeatmap: true, showPoints: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches the current viewport on date changes and ignores a failed response for the previous dates', async () => {
    let rejectOld: (error: Error) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      )
      .mockResolvedValueOnce(response('new-dates'))
      .mockResolvedValueOnce(response('all-dates'));
    const state = useSafetyDataStore.getState();
    state.setEnabled(true);
    const initial = state.fetchForBounds(bounds);
    state.setDateRange('2026-02-01', '2026-02-28');
    await vi.waitFor(() => expect(useSafetyDataStore.getState().isLoading).toBe(false));
    expect(useSafetyDataStore.getState().crashes[0].id).toBe('denver-new-dates');
    rejectOld(new Error('Connection lost for old request'));
    await initial;
    expect(useSafetyDataStore.getState().sources[0].status).toBe('loaded');
    expect(useSafetyDataStore.getState().crashes[0].id).toBe('denver-new-dates');
    state.clearDateRange();
    await vi.waitFor(() =>
      expect(useSafetyDataStore.getState().crashes[0]?.id).toBe('denver-all-dates'),
    );
    expect(useSafetyDataStore.getState().filters.dateRange).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears visible records immediately when zooming away and ignores the pending response', async () => {
    let finish: (result: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = useSafetyDataStore.getState();
    state.setEnabled(true);
    const request = state.fetchForBounds(bounds);
    state.resetViewport();
    expect(useSafetyDataStore.getState()).toMatchObject({
      isLoading: false,
      lastBounds: null,
      crashes: [],
      coverage: null,
    });
    finish(response('old-view'));
    await request;
    expect(useSafetyDataStore.getState()).toMatchObject({
      crashes: [],
      sources: [],
      coverage: null,
    });
  });

  it('surfaces invalid viewport errors without retaining a previous successful coverage claim', async () => {
    fetchMock.mockResolvedValue(response('one'));
    const state = useSafetyDataStore.getState();
    state.setEnabled(true);
    await state.fetchForBounds(bounds);
    await state.fetchForBounds({ ...bounds, north: NaN });
    expect(useSafetyDataStore.getState()).toMatchObject({
      crashes: [],
      sources: [],
      coverage: null,
      isLoading: false,
      error: expect.stringContaining('valid coordinates'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears cached records when all crash data is cleared so the next view can refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(response('before-clear'))
      .mockResolvedValueOnce(response('after-clear'));
    const state = useSafetyDataStore.getState();
    state.setEnabled(true);
    await state.fetchForBounds(bounds);
    state.clearAll();
    expect(useSafetyDataStore.getState()).toMatchObject({
      crashes: [],
      sources: [],
      lastBounds: null,
    });
    await state.fetchForBounds(bounds);
    expect(useSafetyDataStore.getState().crashes[0].id).toBe('denver-after-clear');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
