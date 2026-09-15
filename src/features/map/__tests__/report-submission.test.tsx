import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { MapView } from '../MapView';
import { useMapStore } from '../map-store';

const { createHotspot } = vi.hoisted(() => ({ createHotspot: vi.fn() }));

vi.mock('../useMapLibre', () => ({
  useMapLibre: () => ({ map: null, isLoaded: true, error: null }),
  isProgrammaticMove: false,
}));
vi.mock('@/lib/api/use-hotspots', () => ({ useCreateHotspot: () => createHotspot }));

function fillReport() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sidewalk & Path' }));
  fireEvent.click(screen.getByRole('button', { name: 'No Curb Ramp' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByLabelText('Any details that would help? (optional)'), {
    target: { value: 'A wheelchair cannot reach the crossing.' },
  });
}

describe('map issue reporting', () => {
  beforeEach(() => {
    createHotspot.mockReset();
    useMapStore.getState().openReportForm({
      lat: 39.7392,
      lng: -104.9903,
      address: 'Broadway & Colfax, Denver, CO',
    });
  });

  afterEach(cleanup);

  it('keeps the draft and shows the reason after failure, then closes after a successful retry', async () => {
    createHotspot.mockRejectedValueOnce(
      new ConvexError('New reporters must include at least one photo'),
    );
    createHotspot.mockResolvedValueOnce('saved-report-id');
    render(<MapView />);
    fillReport();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'New reporters must include at least one photo',
    );
    expect(useMapStore.getState().reportFormOpen).toBe(true);
    expect(screen.getByLabelText('Any details that would help? (optional)')).toHaveValue(
      'A wheelchair cannot reach the crossing.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(useMapStore.getState().reportFormOpen).toBe(false));
    expect(screen.queryByRole('heading', { name: 'Report a Problem' })).not.toBeInTheDocument();
    expect(createHotspot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: 'A wheelchair cannot reach the crossing.',
        lat: 39.7392,
        lng: -104.9903,
        issueType: 'no-curb-ramp',
      }),
    );
  });

  it('blocks duplicate submissions and cancellation while persistence is pending', async () => {
    let finish: (id: string) => void = () => {};
    createHotspot.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render(<MapView />);
    fillReport();
    const form = screen.getByRole('button', { name: 'Submit Report' }).closest('form')!;

    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(createHotspot).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(useMapStore.getState().reportFormOpen).toBe(true);

    await act(async () => {
      finish('saved-report-id');
    });
    expect(useMapStore.getState().reportFormOpen).toBe(false);
  });

  it('does not discard the draft when the API returns without a saved ID', async () => {
    createHotspot.mockResolvedValue(undefined);
    render(<MapView />);
    fillReport();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your report was not saved.');
    expect(useMapStore.getState().reportFormOpen).toBe(true);
  });

  it('shows a safe fallback for unexpected server errors', async () => {
    createHotspot.mockRejectedValue(
      new Error(
        '[CONVEX M(hotspots:create)] [Request ID: private-id] Server Error\nUncaught Error: internal database details',
      ),
    );
    render(<MapView />);
    fillReport();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your report could not be saved. Please try again.');
    expect(alert).not.toHaveTextContent('internal database details');
    expect(alert).not.toHaveTextContent('private-id');
  });
});
