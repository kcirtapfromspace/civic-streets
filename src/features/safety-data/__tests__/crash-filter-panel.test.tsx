import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashFilterPanel } from '../CrashFilterPanel';
import { useSafetyDataStore } from '../safety-data-store';
import { useMapStore } from '@/features/map/map-store';

describe('crash filter controls', () => {
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
    useMapStore.getState().setZoom(13);
  });
  afterEach(() => {
    cleanup();
    useSafetyDataStore.getState().setEnabled(false);
    vi.unstubAllGlobals();
  });

  it('hides disabled controls and explains low zoom rather than claiming no crashes', () => {
    render(<CrashFilterPanel />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    act(() => {
      useSafetyDataStore.getState().setEnabled(true);
      useMapStore.getState().setZoom(10);
    });
    expect(screen.getByText('Zoom in to see crash data.')).toBeInTheDocument();
    expect(screen.queryByText(/No mapped records/)).not.toBeInTheDocument();
  });

  it('lets users independently select layers, travel modes, and unknown severity', () => {
    useSafetyDataStore.getState().setEnabled(true);
    render(<CrashFilterPanel />);
    const heatmap = screen.getByRole('checkbox', { name: 'Heatmap' });
    const points = screen.getByRole('checkbox', { name: 'Crash Points' });
    const cyclist = screen.getByRole('checkbox', { name: 'Cyclist' });
    const unknown = screen.getByRole('checkbox', { name: 'Other / unknown severity' });
    expect(heatmap).toBeChecked();
    expect(points).not.toBeChecked();
    expect(unknown).toBeChecked();
    fireEvent.click(heatmap);
    fireEvent.click(points);
    fireEvent.click(cyclist);
    fireEvent.click(unknown);
    expect(heatmap).not.toBeChecked();
    expect(points).toBeChecked();
    expect(cyclist).not.toBeChecked();
    expect(unknown).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pedestrian' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Motorist' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fatal' })).toBeChecked();
    expect(useSafetyDataStore.getState().filters.modes).toEqual(
      new Set(['pedestrian', 'motorist']),
    );
    expect(useSafetyDataStore.getState().filters.severities.has('unknown')).toBe(false);
    fireEvent.click(cyclist);
    fireEvent.click(unknown);
    expect(cyclist).toBeChecked();
    expect(unknown).toBeChecked();
  });

  it('keeps pending coverage visible in the panel and only reports zero after a successful response', async () => {
    let finish: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    useSafetyDataStore.getState().setEnabled(true);
    const request = useSafetyDataStore
      .getState()
      .fetchForBounds({ south: 39.73, west: -105, north: 39.75, east: -104.98 });
    render(<CrashFilterPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading crash records');
    expect(screen.queryByText(/No mapped records/)).not.toBeInTheDocument();
    await act(async () => {
      finish({ ok: true, json: async () => ({ features: [] }) });
      await request;
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'No mapped records returned for this view and date range',
    );
  });
});
