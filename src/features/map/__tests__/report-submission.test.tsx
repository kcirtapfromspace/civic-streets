vi.mock('@/lib/api/use-report-eligibility', () => ({ usePhotoRequirement: () => 'optional' }));
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MapView } from '../MapView';
import { useMapStore } from '../map-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { MOCK_HOTSPOTS } from '@/features/community/mock-data';

const { createHotspot, lookup, backend } = vi.hoisted(() => ({ createHotspot: vi.fn(), lookup: vi.fn(), backend: { available: true } }));
vi.mock('@/lib/api/convex-provider', () => ({ get convexAvailable() { return backend.available; } }));

vi.mock('../useMapLibre', () => ({
  useMapLibre: () => ({ map: null, isLoaded: true, error: null }),
  isProgrammaticMove: false,
}));
vi.mock('@/lib/api/use-hotspots', () => ({ useCreateHotspot: () => createHotspot, useHotspotById: lookup }));

const savedObservation = { ...MOCK_HOTSPOTS[0], id: 'saved-report-id', photoUrls: ['https://storage.example/saved-photo.jpg'], description: 'Saved server notes' };

function renderMap() {
  return render(<MemoryRouter initialEntries={['/map']}><Routes>
    <Route path="/map" element={<MapView />} />
    <Route path="/hotspot/:id" element={<p>Saved report details</p>} />
  </Routes></MemoryRouter>);
}

function fillReport() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sidewalk & Path' }));
  fireEvent.click(screen.getByRole('button', { name: 'No Curb Ramp' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add details' }));
  fireEvent.change(screen.getByLabelText('Any details that would help? (optional)'), {
    target: { value: 'A wheelchair cannot reach the crossing.' },
  });
}

describe('map issue reporting', () => {
  beforeEach(() => {
    createHotspot.mockReset();
    lookup.mockReset().mockImplementation((id: string | undefined) => ({ hotspot: id ? savedObservation : null, isLoading: false }));
    useProposalStore.getState().reset();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    backend.available = true;
    useMapStore.getState().openReportForm({
      lat: 39.7392,
      lng: -104.9903,
      address: 'Broadway & Colfax, Denver, CO',
    });
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keeps the draft and shows the reason after failure, then closes after a successful retry', async () => {
    createHotspot.mockRejectedValueOnce(
      new ConvexError('New reporters must include at least one photo'),
    );
    createHotspot.mockResolvedValueOnce('saved-report-id');
    renderMap();
    fillReport();

    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'New reporters must include at least one photo',
    );
    expect(useMapStore.getState().reportFormOpen).toBe(true);
    expect(screen.getByLabelText('Any details that would help? (optional)')).toHaveValue(
      'A wheelchair cannot reach the crossing.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(useMapStore.getState().reportFormOpen).toBe(false));
    expect(screen.queryByRole('heading', { name: 'Mark a problem' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Observation saved');
    expect(screen.getByRole('status')).toHaveTextContent('Your observation is on the public map.');
    expect(screen.getByRole('link', { name: 'View observation' })).toHaveAttribute('href', '/hotspot/saved-report-id');
    expect(createHotspot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: 'A wheelchair cannot reach the crossing.',
        lat: 39.7392,
        lng: -104.9903,
        issueType: 'no-curb-ramp',
      }),
    );
    fireEvent.click(screen.getByRole('link', { name: 'View observation' }));
    expect(screen.getByText('Saved report details')).toBeInTheDocument();
  });

  it('blocks duplicate submissions and cancellation while persistence is pending', async () => {
    let finish: (id: string) => void = () => {};
    createHotspot.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    renderMap();
    fillReport();
    const form = screen.getByRole('button', { name: 'Save observation' }).closest('form')!;

    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(createHotspot).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    fireEvent.click(screen.getByRole('dialog'));
    expect(useMapStore.getState().reportFormOpen).toBe(true);

    await act(async () => {
      finish('saved-report-id');
    });
    expect(useMapStore.getState().reportFormOpen).toBe(false);
  });

  it('does not discard the draft when the API returns without a saved ID', async () => {
    createHotspot.mockResolvedValue(undefined);
    renderMap();
    fillReport();

    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your observation was not saved.');
    expect(useMapStore.getState().reportFormOpen).toBe(true);
    expect(screen.queryByRole('link', { name: 'View observation' })).not.toBeInTheDocument();
  });

  it('shows a safe fallback for unexpected server errors', async () => {
    createHotspot.mockRejectedValue(
      new Error(
        '[CONVEX M(hotspots:create)] [Request ID: private-id] Server Error\nUncaught Error: internal database details',
      ),
    );
    renderMap();
    fillReport();

    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your observation could not be saved. Please try again.');
    expect(alert).not.toHaveTextContent('internal database details');
    expect(alert).not.toHaveTextContent('private-id');
  });

  it('labels local saves honestly and lets residents dismiss the confirmation', async () => {
    backend.available = false;
    createHotspot.mockResolvedValue('local-h1');
    renderMap();
    expect(screen.getByText(/Demo mode: your observation stays/)).toBeInTheDocument();
    fillReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Demo observation saved');
    expect(status).toHaveTextContent('this browser session only');
    expect(status).toHaveTextContent('has not been published');
    expect(screen.getByRole('link', { name: 'View observation' })).toHaveAttribute('href', '/hotspot/local-h1');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss saved observation' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('continues from the persisted observation with its returned evidence and offers Done without starting a proposal', async () => {
    createHotspot.mockResolvedValue('saved-report-id');
    renderMap();
    fillReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Explore a change here' }));
    expect(useProposalStore.getState()).toMatchObject({
      step: 'concern', location: { lat: savedObservation.lat, lng: savedObservation.lng, address: savedObservation.address },
      briefContext: { concern: 'Saved server notes', observation: { id: 'saved-report-id', photoUrls: ['https://storage.example/saved-photo.jpg'], source: 'community' } },
    });
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => {
      useProposalStore.getState().reset();
      useWorkspaceStore.getState().exitToExplore();
      useMapStore.getState().openReportForm({ lat: 39.7392, lng: -104.9903, address: 'Broadway, Denver' });
    });
    fillReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(useProposalStore.getState().location).toBeNull();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits for saved evidence instead of building a proposal from unsaved form input', async () => {
    lookup.mockReturnValue({ hotspot: null, isLoading: true });
    createHotspot.mockResolvedValue('saved-report-id');
    const view = renderMap();
    fillReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    expect(await screen.findByRole('button', { name: 'Explore a change here' })).toBeDisabled();
    expect(screen.getByText('Loading your saved observation…')).toBeInTheDocument();
    lookup.mockReturnValue({ hotspot: null, isLoading: false });
    view.rerender(<MemoryRouter initialEntries={['/map']}><Routes><Route path="/map" element={<MapView />} /></Routes></MemoryRouter>);
    expect(screen.getByText('Open the observation to continue when it becomes available.')).toBeInTheDocument();
    expect(useProposalStore.getState().location).toBeNull();
  });

  it('protects edits that failed to save and labels copied local evidence as browser-session', async () => {
    backend.available = false;
    createHotspot.mockResolvedValue('local-h42');
    lookup.mockImplementation((id: string | undefined) => ({ hotspot: id ? { ...savedObservation, id: 'local-h42', address: '' } : null, isLoading: false }));
    useProposalStore.getState().initProposal('', { lat: 39.7, lng: -104.9, address: 'Existing' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    useProposalStore.getState().setBriefContext({ concern: 'Do not lose this edit' });
    renderMap();
    fillReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Explore a change here' }));
    expect(screen.getByRole('dialog', { name: 'Replace unsaved work?' })).toHaveTextContent('your current proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
    expect(useProposalStore.getState().location?.address).toBe('Existing');
    fireEvent.click(screen.getByRole('button', { name: 'Explore a change here' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and start proposal' }));
    expect(useProposalStore.getState()).toMatchObject({ streetName: savedObservation.title, briefContext: { observation: { source: 'browser-session' } } });
  });
});
