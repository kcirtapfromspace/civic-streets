import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProposalFlow } from './ProposalFlow';
import { ProposalReview } from './steps/ProposalReview';
import { BeforeSelector } from './steps/BeforeSelector';
import { TransformationPicker } from './steps/TransformationPicker';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStreetStore } from '@/stores/street-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useCommunityStore } from '@/features/community/community-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { loadTemplates } from '@/lib/templates';
import { getTransformationsForPreset } from '@/lib/presets/transformation-cards';
import type { NormalizedCrash } from '@/lib/types/safety-data';
const generatePDF = vi.hoisted(() => vi.fn());
vi.mock('@/features/export', () => ({ generatePDF }));
vi.mock('@/features/renderer/CrossSectionSVG', () => ({
  CrossSectionSVG: ({ street }: { street: { name: string } }) => (
    <svg role="img" aria-label={`${street.name} section`} />
  ),
}));
const initialWorkspace = useWorkspaceStore.getState();
const initialStreet = useStreetStore.getState();
const location = { lat: 39.74, lng: -104.99, address: 'Main Street, Denver' };
const crash = (fields: Partial<NormalizedCrash> = {}): NormalizedCrash => ({
  id: 'crash',
  source: 'denver',
  ...location,
  date: '2026-01-01',
  severity: 'fatal',
  modes: ['pedestrian'],
  fatalities: 1,
  injuries: 2,
  ...fields,
});
function initialize() {
  useProposalStore.getState().initProposal('Main Street', location);
  useProposalStore.getState().setRoadPath([location, { lat: 39.741, lng: -104.99 }], 0);
  useWorkspaceStore.getState().enterProposeMode(location);
}
function ready() {
  initialize();
  useProposalStore.getState().selectPreset(BEFORE_PRESETS[0]);
  useProposalStore.getState().applyTransformation(loadTemplates()[0]);
  return {
    before: useProposalStore.getState().beforeStreet!,
    after: useProposalStore.getState().afterStreet!,
  };
}
beforeEach(() => {
  useProposalStore.getState().reset();
  useWorkspaceStore.setState(initialWorkspace, true);
  useStreetStore.setState(initialStreet, true);
  useSavedProposalsStore.setState({ proposals: {} });
  useCommunityStore.getState().closeSaveDesign();
  useSafetyDataStore.setState({ crashes: [], enabled: false, isLoading: false });
  generatePDF.mockReset().mockResolvedValue(new Blob(['PDF']));
  vi.stubGlobal('URL', URL);
  URL.createObjectURL = vi.fn(() => 'blob:proposal');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('proposal wizard lifecycle', () => {
  it('walks the real preset/transformation flow and transfers the completed design to community sharing', async () => {
    initialize();
    useStreetStore.getState().applyTemplate(loadTemplates().slice(-1)[0]!, 80);
    const oldDesign = useStreetStore.getState().currentStreet;
    render(<ProposalFlow />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(BEFORE_PRESETS[0].label) }));
    expect(useProposalStore.getState().step).toBe('before-selected');
    const card = getTransformationsForPreset(BEFORE_PRESETS[0].suggestedTransformations)[0];
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(card.label.replace(/[()]/g, '\\$&')) }),
    );
    expect(useProposalStore.getState().step).toBe('review');
    await screen.findAllByRole('img');
    const before = useProposalStore.getState().beforeStreet!;
    const after = useProposalStore.getState().afterStreet!;
    fireEvent.click(screen.getByRole('button', { name: 'After' }));
    expect(useProposalStore.getState().showBeforeOnMap).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Before' }));
    fireEvent.click(screen.getByRole('button', { name: 'Before' }));
    expect(useProposalStore.getState().showBeforeOnMap).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'After' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(useSavedProposalsStore.getState().proposals).toEqual({
      [Object.keys(useSavedProposalsStore.getState().proposals)[0]]: expect.objectContaining({
        afterStreet: after,
        beforeStreet: before,
        streetName: 'Main Street',
      }),
    });
    expect(useStreetStore.getState().currentStreet).toEqual(after);
    expect(useStreetStore.getState().currentStreet).not.toEqual(oldDesign);
    expect(useStreetStore.getState().beforeStreet).toEqual(before);
    expect(useCommunityStore.getState()).toMatchObject({
      isSaveDesignOpen: true,
      saveDesignData: { title: 'Main Street', address: location.address },
    });
    expect(useProposalStore.getState().afterStreet).toBeNull();
    expect(useWorkspaceStore.getState().mode).toBe('explore');
  });

  it('can render an initially incomplete review then edit actual before/after streets without changing hook order', async () => {
    const view = render(<ProposalReview />);
    expect(view.container.textContent).toBe('');
    let proposal: ReturnType<typeof ready>;
    act(() => {
      proposal = ready();
    });
    await screen.findByRole('button', { name: 'Edit Details' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Details' }));
    expect(useStreetStore.getState().currentStreet).toEqual(proposal!.after);
    expect(useStreetStore.getState().beforeStreet).toEqual(proposal!.before);
    expect(useWorkspaceStore.getState()).toMatchObject({
      mode: 'design',
      designLocation: location,
    });
    act(() => useWorkspaceStore.setState({ designLocation: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Details' }));
    expect(useWorkspaceStore.getState().mode).toBe('design');
  });

  it('validates PDF content, disables repeat export while pending, cleans up the download, and surfaces retryable failures', async () => {
    const proposal = ready();
    const narrow = {
      ...proposal.after,
      elements: proposal.after.elements.map((e, i) => (i === 0 ? { ...e, width: 1 } : e)),
    };
    useProposalStore.setState({ afterStreet: narrow });
    let resolve!: (blob: Blob) => void;
    generatePDF.mockImplementationOnce(
      () =>
        new Promise<Blob>((r) => {
          resolve = r;
        }),
    );
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<ProposalReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Save PDF' }));
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(generatePDF).toHaveBeenCalledWith(
      narrow,
      proposal.before,
      expect.arrayContaining([expect.objectContaining({ severity: 'error' })]),
    );
    await act(async () => resolve(new Blob(['PDF'])));
    expect(download).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:proposal');
    expect(document.querySelector('a[download]')).toBeNull();
    generatePDF.mockRejectedValueOnce(new Error('Renderer failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Save PDF' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The PDF could not be generated. Please try again.',
    );
    act(() => useProposalStore.setState({ streetName: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save PDF' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(generatePDF).toHaveBeenCalledTimes(3);
  });

  it('navigates back through stages and closes only complete proposals into the saved list', async () => {
    const view = render(<ProposalFlow />);
    expect(screen.getByText('Street Proposal')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]);
    expect(useSavedProposalsStore.getState().proposals).toEqual({});
    act(() => {
      ready();
      useProposalStore.setState({ step: 'transform-selected' });
    });
    await screen.findByRole('button', { name: 'Done' });
    act(() => useProposalStore.setState({ step: 'review' }));
    fireEvent.click(screen.getAllByRole('button', { name: '' }).slice(-1)[0]!);
    expect(useProposalStore.getState().step).toBe('before-selected');
    fireEvent.click(screen.getAllByRole('button', { name: '' }).slice(-1)[0]!);
    expect(useProposalStore.getState().step).toBe('street-selected');
    act(() => ready());
    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]);
    expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
    view.unmount();
  });

  it('still shares a renderable draft without optional location metadata or a saved-proposal snapshot', async () => {
    ready();
    useProposalStore.setState({ location: null, streetName: '' });
    useWorkspaceStore.setState({ designLocation: null });
    render(<ProposalReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(useCommunityStore.getState().saveDesignData).toEqual({
      title: 'Street Proposal',
      address: '',
    });
    expect(useSavedProposalsStore.getState().proposals).toEqual({});
  });

  it('shows only nearby recorded crash evidence, singular/plural counts, and loading state', () => {
    const view = render(<BeforeSelector />);
    expect(screen.queryByText(/recorded crash/)).toBeNull();
    act(() => {
      initialize();
      useSafetyDataStore.setState({ enabled: true, isLoading: true });
    });
    expect(screen.getByText('Loading safety data...')).toBeTruthy();
    act(() =>
      useSafetyDataStore.setState({
        crashes: [crash(), crash({ id: 'far', lat: 0 })],
        isLoading: false,
      }),
    );
    expect(screen.getByText(/1 recorded crash nearby/)).toBeTruthy();
    expect(screen.getByText(/1 with recorded injuries/)).toBeTruthy();
    act(() =>
      useSafetyDataStore.setState({
        crashes: [
          crash({ severity: 'unknown', injuries: null }),
          crash({ id: 'second', severity: 'minor', injuries: 0 }),
        ],
      }),
    );
    expect(screen.getByText(/2 recorded crashes nearby/)).toBeTruthy();
    expect(screen.queryByText(/fatal/)).toBeNull();
    act(() => useSafetyDataStore.setState({ crashes: [crash({ lat: 0 })] }));
    expect(screen.queryByText(/recorded crash/)).toBeNull();
    view.unmount();
    render(<TransformationPicker />);
    expect(screen.getByText('What would you like to do?')).toBeTruthy();
  });
});
