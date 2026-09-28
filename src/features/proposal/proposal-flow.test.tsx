import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProposalFlow } from './ProposalFlow';
import { ProposalReview } from './steps/ProposalReview';
import { BeforeSelector } from './steps/BeforeSelector';
import { TransformationPicker } from './steps/TransformationPicker';
import { ConcernFields } from './steps/ConcernStep';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
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
  localStorage.clear();
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

it('can place or reposition an existing brief without replacing its purpose or geometry', () => {
  ready();
  render(<ProposalReview />);
  const original = useProposalStore.getState().getWork();
  fireEvent.click(screen.getByRole('button', { name: 'Adjust map placement' }));
  expect(useWorkspaceStore.getState().mode).toBe('place-street');
  expect(useProposalStore.getState().getWork()).toEqual({ ...original, updatedAt: expect.any(String) });
  act(() => useProposalStore.setState({ roadPath: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Place this layout on the map' }));
  expect(useWorkspaceStore.getState().designProposalId).toBe(original!.id);
});

describe('proposal wizard lifecycle', () => {
  it('walks the real preset/transformation flow and explicitly saves a private draft while keeping review open', async () => {
    initialize();
    useStreetStore.getState().applyTemplate(loadTemplates().slice(-1)[0]!, 80);
    const oldDesign = useStreetStore.getState().currentStreet;
    render(<ProposalFlow />);
    const panel = screen.getByRole('region', { name: 'Street proposal' });
    expect(document.activeElement).toBe(panel);
    fireEvent.change(screen.getByLabelText('What is happening here?'), { target: { value: 'People have to step into the street.' } });
    fireEvent.change(screen.getByLabelText('What would you like to improve?'), { target: { value: 'More space on the sidewalk.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to explore' }));
    const layoutChoice = screen.getByRole('button', { name: new RegExp(BEFORE_PRESETS[0].label) });
    layoutChoice.focus();
    fireEvent.click(layoutChoice);
    expect(document.activeElement).toBe(panel);
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
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(useSavedProposalsStore.getState().proposals).toEqual({
      [Object.keys(useSavedProposalsStore.getState().proposals)[0]]: expect.objectContaining({
        afterStreet: after,
        beforeStreet: before,
        streetName: 'Main Street',
        briefContext: expect.objectContaining({ concern: 'People have to step into the street.', desiredOutcome: 'More space on the sidewalk.' }),
      }),
    });
    expect(useStreetStore.getState().currentStreet).toEqual(oldDesign);
    expect(useCommunityStore.getState().isSaveDesignOpen).toBe(false);
    expect(useProposalStore.getState().afterStreet).toEqual(after);
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    expect(screen.getByRole('status').textContent).toContain('Draft saved in this browser');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
  });

  it('can render an initially incomplete review then edit actual before/after streets without changing hook order', async () => {
    const view = render(<ProposalReview />);
    expect(view.container.textContent).toBe('');
    let proposal: ReturnType<typeof ready>;
    act(() => {
      proposal = ready();
    });
    await screen.findByRole('button', { name: 'Edit street layout' });
    act(() => useStreetStore.getState().createNewStreet('Unrelated old street', 80, 'local', 'two-way'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit street layout' }));
    act(() => useStreetStore.temporal.getState().undo());
    expect(useStreetStore.getState().currentStreet).toEqual(proposal!.after);
    expect(useStreetStore.getState().beforeStreet).toEqual(proposal!.before);
    expect(useWorkspaceStore.getState()).toMatchObject({
      mode: 'design',
      designLocation: location,
      designProposalId: useProposalStore.getState().proposalId,
    });
    act(() => useStreetStore.getState().updateStreetName('Edited street name'));
    expect(useStreetStore.getState().currentStreet?.name).toBe('Edited street name');
    act(() => useStreetStore.temporal.getState().undo());
    expect(useStreetStore.getState().currentStreet).toEqual(proposal!.after);
    act(() => useWorkspaceStore.setState({ designLocation: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit street layout' }));
    expect(useWorkspaceStore.getState().mode).toBe('design');
  });

  it('prepares a persistent PDF link, rejects duplicate export, and preserves the prepared file through retryable failures', async () => {
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
    URL.createObjectURL = vi.fn().mockReturnValueOnce('blob:proposal').mockReturnValueOnce('blob:replacement');
    const view = render(<ProposalReview />);
    const exportButton = screen.getByRole('button', { name: 'Download discussion brief' });
    act(() => { fireEvent.click(exportButton); fireEvent.click(exportButton); });
    expect(generatePDF).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Preparing…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(generatePDF).toHaveBeenCalledWith(
      narrow,
      proposal.before,
      expect.arrayContaining([expect.objectContaining({ severity: 'error' })]),
      useProposalStore.getState().briefContext,
    );
    await act(async () => resolve(new Blob(['PDF'])));
    expect(download).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Discussion brief ready. Download again after making changes.');
    const link = screen.getByRole('link', { name: 'Download prepared brief' });
    expect(link.getAttribute('href')).toBe('blob:proposal');
    expect(link.getAttribute('download')).toBe('Main Street-discussion-brief.pdf');
    expect(document.querySelectorAll('a[download]')).toHaveLength(1);
    generatePDF.mockRejectedValueOnce(new Error('Renderer failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The PDF could not be generated. Please try again.',
    );
    expect(screen.getByRole('link', { name: 'Download prepared brief' }).getAttribute('href')).toBe('blob:proposal');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => useProposalStore.setState({ streetName: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(generatePDF).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Download prepared brief' }).getAttribute('href')).toBe('blob:replacement'));
    expect(screen.getByRole('link', { name: 'Download prepared brief' }).getAttribute('download')).toBe('proposal-discussion-brief.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:proposal');
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith('blob:replacement');
  });

  it('navigates back through stages and closes only complete proposals into the saved list', async () => {
    const view = render(<ProposalFlow />);
    expect(screen.getByText('Street Proposal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
    expect(useSavedProposalsStore.getState().proposals).toEqual({});
    act(() => {
      ready();
      useProposalStore.setState({ step: 'transform-selected' });
    });
    await screen.findByRole('button', { name: 'Save draft' });
    act(() => useProposalStore.setState({ step: 'review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose another improvement' }));
    expect(useProposalStore.getState().step).toBe('before-selected');
    fireEvent.click(screen.getByRole('button', { name: 'Back to street layout' }));
    expect(useProposalStore.getState().step).toBe('street-selected');
    fireEvent.click(screen.getByRole('button', { name: '← Back to concern' }));
    expect(useProposalStore.getState().step).toBe('concern');
    act(() => ready());
    fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
    expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
    view.unmount();
  });

  it('saves private street work without requiring a mapped location', async () => {
    ready();
    useProposalStore.setState({ location: null, streetName: '' });
    useWorkspaceStore.setState({ designLocation: null });
    render(<ProposalReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Draft saved');
    expect(useCommunityStore.getState().isSaveDesignOpen).toBe(false);
    expect(useProposalStore.getState().afterStreet).not.toBeNull();
    expect(useSavedProposalsStore.getState().proposals).toEqual({});
  });

  it('preserves a sourced crash snapshot only when the resident includes it', () => {
    initialize();
    useSafetyDataStore.setState({ enabled: true, isLoading: true });
    const view = render(<BeforeSelector />);
    expect(screen.getByText(/Crash evidence and source coverage/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Include this snapshot in brief' })).toBeNull();
    act(() => useSafetyDataStore.setState({
      coverage: 'municipal', lastBounds: { north: 40, south: 39, east: -104, west: -105 },
      sources: [{ sourceId: 'denver', status: 'loaded', count: 2, warnings: [] }],
      crashes: [crash(), crash({ id: 'far', lat: 0 })], isLoading: false,
    }));
    expect(screen.getByText(/1 mapped record within 200 m/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Include this snapshot in brief' }));
    const snapshot = useProposalStore.getState().briefContext.supportingEvidence;
    expect(snapshot?.sources[0].label).toContain('Denver');
    act(() => useSafetyDataStore.setState({ crashes: [] }));
    expect(useProposalStore.getState().briefContext.supportingEvidence).toEqual(snapshot);
    fireEvent.click(screen.getByRole('button', { name: 'Update snapshot in brief' }));
    expect(useProposalStore.getState().briefContext.supportingEvidence?.summary).toContain('0 mapped records');
    fireEvent.click(screen.getByRole('button', { name: 'Remove snapshot' }));
    expect(useProposalStore.getState().briefContext.supportingEvidence).toBeUndefined();
    view.unmount();
    render(<TransformationPicker />);
    expect(screen.getByText('What would you like to do?')).toBeTruthy();
  });
});

it('preserves the active proposal when storage is full and allows saving or closing after recovery', async () => {
  const proposal = ready();
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
  render(<ProposalFlow />);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('could not be saved'))).toBe(true);
  expect(useSavedProposalsStore.getState().proposals).toEqual({});
  expect(useProposalStore.getState().afterStreet).toEqual(proposal.after);
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState().afterStreet).toEqual(proposal.after);
  storage.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  expect(Object.keys(useSavedProposalsStore.getState().proposals)).toHaveLength(1);
});

it('saves incomplete work durably when closing the proposal', () => {
  initialize();
  useProposalStore.getState().selectPreset(BEFORE_PRESETS[0]);
  render(<ProposalFlow />);
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(useProposalStore.getState().beforeStreet).toBeNull();
  expect(Object.values(useWorkDraftsStore.getState().drafts).some((draft) => draft.kind === 'street' && draft.beforeStreet !== null)).toBe(true);
  expect(useWorkspaceStore.getState().mode).toBe('explore');
});


it.each(['resolve', 'reject'] as const)('does not create a download after leaving review during PDF %s', async (outcome) => {
  ready();
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  generatePDF.mockImplementationOnce(() => new Promise<Blob>((accept, fail) => { resolve = accept; reject = fail; }));
  const view = render(<ProposalReview />);
  fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
  view.unmount();
  await act(async () => {
    if (outcome === 'resolve') resolve(new Blob(['PDF']));
    else reject(new Error('PDF failed'));
  });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Download prepared brief' })).toBeNull();
});

it('keeps the prepared PDF link usable when an automatic download is blocked', async () => {
  ready();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('Download blocked'); });
  const view = render(<ProposalReview />);
  fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
  expect((await screen.findByRole('link', { name: 'Download prepared brief' })).getAttribute('href')).toBe('blob:proposal');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:proposal');
});

it('carries the observation evidence through concern, exploration, saving, and export without clearing the design', async () => {
  initialize();
  const observation = { id: 'observation-1', title: 'Narrow passage', description: 'Two people cannot pass with a stroller.', photoUrls: ['https://example.test/sidewalk.jpg'], ...location, createdAt: 1_800_000_000_000, source: 'community' as const };
  useProposalStore.getState().setBriefContext({ observation, concern: observation.description });
  const view = render(<ProposalFlow />);
  expect(screen.getByText('From observation: Narrow passage')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Observation photo 1' }).getAttribute('src')).toBe(observation.photoUrls[0]);
  expect(screen.getByRole('link', { name: 'Open observation photo 1' }).getAttribute('href')).toBe(observation.photoUrls[0]);
  fireEvent.change(screen.getByLabelText('What would you like to improve?'), { target: { value: 'Room for people to pass.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to explore' }));
  expect(screen.getByText('Explore').getAttribute('class')).toContain('font-semibold');
  fireEvent.click(screen.getByRole('button', { name: new RegExp(BEFORE_PRESETS[0].label) }));
  const card = getTransformationsForPreset(BEFORE_PRESETS[0].suggestedTransformations)[0];
  fireEvent.click(screen.getByRole('button', { name: new RegExp(card.label.replace(/[()]/g, '\\$&')) }));
  const after = useProposalStore.getState().afterStreet;
  fireEvent.click(screen.getByText('Concern & evidence'));
  fireEvent.change(screen.getByLabelText('What is happening here?'), { target: { value: 'Strollers and people using wheelchairs cannot pass.' } });
  fireEvent.change(screen.getByLabelText('What are you asking for?'), { target: { value: 'Discuss this option during a site visit.' } });
  expect(useProposalStore.getState().afterStreet).toBe(after);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  const saved = Object.values(useSavedProposalsStore.getState().proposals)[0];
  expect(saved.briefContext).toEqual(expect.objectContaining({ observation, desiredOutcome: 'Room for people to pass.', requestedNextStep: 'Discuss this option during a site visit.' }));
  expect(screen.getByRole('status').textContent).toContain('Draft saved');
  fireEvent.change(screen.getByLabelText('What are you asking for?'), { target: { value: 'Review the walking space.' } });
  expect(screen.queryByRole('status')).toBeNull();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
  await screen.findByRole('link', { name: 'Download prepared brief' });
  expect(generatePDF.mock.calls[0][3]).toEqual(useProposalStore.getState().briefContext);
  expect(generatePDF.mock.calls[0][3].observation).toEqual(observation);
  view.unmount();
});

it('keeps unfinished measurement notes in drafts and requires their source before exporting measured dimensions', async () => {
  ready();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  render(<ProposalReview />);
  expect(screen.getByText('Existing dimensions: assumed. Proposed widths are a concept for discussion.')).toBeTruthy();
  fireEvent.click(screen.getByText('Dimensions & selected checks'));
  expect(screen.getByText('Selected dimension checks')).toBeTruthy();
  expect(screen.getByText(/Site conditions, crossings, traffic operations/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Existing layout dimensions are'), { target: { value: 'measured' } });
  expect((screen.getByRole('button', { name: 'Download discussion brief' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(Object.values(useSavedProposalsStore.getState().proposals)[0].briefContext?.dimensionBasis).toBe('measured');
  fireEvent.change(screen.getByLabelText('Dimension source or method (required)'), { target: { value: 'Tape measurement on September 27; widths rounded to nearest foot.' } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByRole('button', { name: 'Download discussion brief' }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText(/not independently verified/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
  await screen.findByRole('link', { name: 'Download prepared brief' });
  expect(generatePDF.mock.calls[0][3]).toEqual(expect.objectContaining({ dimensionBasis: 'measured', dimensionSource: 'Tape measurement on September 27; widths rounded to nearest foot.' }));
  fireEvent.change(screen.getByLabelText('Existing layout dimensions are'), { target: { value: 'estimated' } });
  expect(screen.getByText('Existing dimensions: estimated. Proposed widths are a concept for discussion.')).toBeTruthy();
});

it.each([
  ['example', 'Example observation'],
  ['browser-session', 'Saved for this browser session'],
] as const)('identifies %s evidence honestly, including a location with no street address', (source, label) => {
  useProposalStore.getState().initProposal('Untitled street', { ...location, address: '' });
  useProposalStore.getState().setBriefContext({ observation: { id: 'sample', title: 'Rough surface', description: '', photoUrls: [], ...location, createdAt: 1, source } });
  render(<ConcernFields />);
  expect(screen.getByText('39.74000, -104.99000')).toBeTruthy();
  expect(screen.getByText(new RegExp(label))).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});

it.each(['resolve', 'reject'] as const)('discards a stale PDF %s after the purpose changes, and hides prepared briefs after geometry edits', async (outcome) => {
  ready();
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  generatePDF.mockImplementationOnce(() => new Promise<Blob>((accept, fail) => { resolve = accept; reject = fail; }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const view = render(<ProposalReview />);
  fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
  fireEvent.change(screen.getByLabelText('What are you asking for?'), { target: { value: 'New purpose while generating.' } });
  await act(async () => {
    if (outcome === 'resolve') resolve(new Blob(['outdated PDF']));
    else reject(new Error('outdated failure'));
  });
  expect(screen.queryByRole('link', { name: 'Download prepared brief' })).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Download discussion brief' }));
  await screen.findByRole('link', { name: 'Download prepared brief' });
  act(() => {
    const after = useProposalStore.getState().afterStreet!;
    useProposalStore.setState({ afterStreet: { ...after, elements: after.elements.map((element, index) => index === 0 ? { ...element, width: element.width + 1 } : element) } });
  });
  expect(screen.queryByRole('link', { name: 'Download prepared brief' })).toBeNull();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:proposal');
});

it('reports actual allocation changes and keeps no-flags language limited to the checks performed', () => {
  const proposal = ready();
  const sidewalk = proposal.before.elements.find((element) => element.type === 'sidewalk')!;
  const before = { ...proposal.before, elements: [{ ...sidewalk, width: 10 }], totalROWWidth: 10, curbToCurbWidth: 0 };
  const after = { ...proposal.after, elements: [{ ...sidewalk, width: 12 }], totalROWWidth: 12, curbToCurbWidth: 0 };
  useProposalStore.setState({ beforeStreet: before, afterStreet: after });
  render(<ProposalReview />);
  expect(screen.getByText('Sidewalks: 1 → 1; 10 → 12 ft total.')).toBeTruthy();
  fireEvent.click(screen.getByText('Dimensions & selected checks'));
  expect(screen.getByText('No flags from the selected checks. This is not a compliance determination.')).toBeTruthy();
  act(() => useProposalStore.setState({ afterStreet: { ...after, elements: before.elements, totalROWWidth: 10 } }));
  expect(screen.getByText('The allocated widths and element counts are unchanged.')).toBeTruthy();
});
