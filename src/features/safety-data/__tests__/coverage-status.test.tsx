import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashCoverageStatus } from '../CrashCoverageStatus';
import { useSafetyDataStore } from '../safety-data-store';

const denver = { south: 39.73, west: -105, north: 39.75, east: -104.98 };
const sf = { south: 37.77, west: -122.43, north: 37.79, east: -122.41 };
const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => data });

describe('visible crash coverage and request state', () => {
  beforeEach(() => {
    useSafetyDataStore.getState().clearAll();
    useSafetyDataStore.getState().clearDateRange();
    useSafetyDataStore.getState().setEnabled(true);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useSafetyDataStore.getState().setEnabled(false);
  });

  it('shows a source failure as unknown and retries without calling it zero crashes', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok({ features: [] }));
    await useSafetyDataStore.getState().fetchForBounds(denver);
    render(<CrashCoverageStatus zoom={13} />);
    expect(screen.getByRole('alert')).toHaveTextContent('unknown or incomplete');
    expect(screen.queryByText(/No mapped records/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Denver Traffic Accidents' })).toHaveAttribute(
      'href',
      expect.stringContaining('/325'),
    );
    expect(screen.getByText(/Only serious injury counts are supplied/)).toBeInTheDocument();

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Retry crash data' })),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'No mapped records returned for this view and date range',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('makes unconnected national coverage explicit and links the official viewer', async () => {
    await useSafetyDataStore.getState().fetchForBounds(sf);
    render(<CrashCoverageStatus zoom={13} />);
    expect(
      screen.getByText(/National crash map coverage is not connected for this area/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'NHTSA FARS — map coverage not connected' }),
    ).toHaveAttribute('href', 'https://cdan.dot.gov/query');
    expect(screen.queryByText(/No mapped records returned/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('distinguishes unsupported coverage and an unqueried zoom level', async () => {
    await useSafetyDataStore
      .getState()
      .fetchForBounds({ south: 51.5, west: -0.15, north: 51.6, east: -0.05 });
    const { rerender } = render(<CrashCoverageStatus zoom={13} />);
    expect(screen.getByText(/No crash dataset is connected/)).toHaveTextContent(
      'does not indicate zero crashes',
    );
    rerender(<CrashCoverageStatus zoom={5} />);
    expect(screen.getByText('Zoom in to see crash data.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let a slow prior city response replace the current viewport', async () => {
    let finishOld: (value: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce(ok({ Results: [[]] }));
    const oldRequest = useSafetyDataStore.getState().fetchForBounds(denver);
    await useSafetyDataStore.getState().fetchForBounds(sf);
    expect(useSafetyDataStore.getState().coverage).toBe('fatal-only');
    finishOld(ok({ features: [] }));
    await oldRequest;
    expect(useSafetyDataStore.getState().coverage).toBe('fatal-only');
    expect(useSafetyDataStore.getState().sources[0].sourceId).toBe('fars');
  });

  it('ignores in-flight results after the layer is disabled', async () => {
    let finish: (value: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const request = useSafetyDataStore.getState().fetchForBounds(denver);
    useSafetyDataStore.getState().setEnabled(false);
    finish(ok({ features: [] }));
    await request;
    expect(useSafetyDataStore.getState()).toMatchObject({
      enabled: false,
      coverage: null,
      sources: [],
      isLoading: false,
    });
  });

  it('shows loading until a source responds, then reports mapped records with their requested dates', async () => {
    let finish: (result: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    useSafetyDataStore.getState().setDateRange('2026-01-01', '2026-03-01');
    const request = useSafetyDataStore.getState().fetchForBounds(denver);
    render(<CrashCoverageStatus zoom={13} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading crash records');
    expect(screen.queryByText(/No mapped records/)).not.toBeInTheDocument();
    await act(async () => {
      finish(
        ok({
          features: [
            {
              attributes: {
                object_id: 1,
                incident_id: 'one',
                geo_lat: 39.74,
                geo_lon: -104.99,
                first_occurrence_date: Date.parse('2026-02-01'),
              },
            },
          ],
        }),
      );
      await request;
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 mapped records returned');
    expect(screen.getByText('Requested dates: 2026-01-01 through 2026-03-01.')).toBeInTheDocument();
  });

  it('does not present discarded unlocatable records as verified complete zero coverage', async () => {
    fetchMock.mockResolvedValue(
      ok({
        features: [
          {
            attributes: {
              object_id: 1,
              incident_id: 'unlocatable',
              first_occurrence_date: Date.parse('2026-02-01'),
            },
          },
        ],
      }),
    );
    await useSafetyDataStore.getState().fetchForBounds(denver);
    render(<CrashCoverageStatus zoom={13} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'No mapped records returned from the available portion',
    );
    expect(
      screen.getByText('Results are incomplete; review the source limits below.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 source rows could not be mapped/)).toBeInTheDocument();
    expect(
      screen.queryByText('No mapped records returned for this view and date range.'),
    ).not.toBeInTheDocument();
  });

  it('distinguishes a local request validation failure from unavailable provider results', async () => {
    await useSafetyDataStore.getState().fetchForBounds({ ...denver, north: NaN });
    render(<CrashCoverageStatus zoom={13} />);
    expect(screen.getByRole('alert')).toHaveTextContent('unknown or incomplete');
    expect(
      screen.getByText('Choose a smaller map area with valid coordinates.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Denver Traffic Accidents' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides coverage while disabled and does not imply that an unqueried view is empty', () => {
    useSafetyDataStore.getState().setEnabled(false);
    const { rerender } = render(<CrashCoverageStatus zoom={13} />);
    expect(screen.queryByText(/Crash data/)).not.toBeInTheDocument();
    act(() => useSafetyDataStore.getState().setEnabled(true));
    rerender(<CrashCoverageStatus zoom={13} />);
    expect(screen.getByText('Crash data has not been checked for this view.')).toBeInTheDocument();
  });
});
