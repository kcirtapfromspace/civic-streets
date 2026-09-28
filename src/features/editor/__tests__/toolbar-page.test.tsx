import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Toolbar } from '../Toolbar';
import { EditorDock } from '../EditorDock';
import { EditorPage } from '../index';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
import { street, validation } from './fixtures';
const service = vi.hoisted(() => ({
  canExport: true,
  pdf: vi.fn(),
  validate: vi.fn(),
  standards: vi.fn(),
}));
vi.mock('@/lib/billing/access', () => ({
  useBillingAccess: () => ({ canAccess: service.canExport, contactHref: '/contact?feature=pdf' }),
}));
vi.mock('@/features/export', () => ({ generatePDF: service.pdf }));
vi.mock('@/lib/standards', () => ({
  validateStreet: service.validate,
  loadStandards: service.standards,
}));
let downloads: string[] = [];
const createURL = vi.fn(() => 'blob:pdf-fixture');
const revokeURL = vi.fn();
function Route() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}
beforeEach(() => {
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  localStorage.clear();
  useStreetStore.setState(useStreetStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useProposalStore.getState().reset();
  useStreetStore.temporal.getState().clear();
  service.canExport = true;
  service.pdf.mockReset().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  service.validate.mockReset().mockReturnValue([]);
  service.standards.mockReset().mockReturnValue({});
  downloads = [];
  createURL.mockClear();
  revokeURL.mockClear();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createURL;
      static revokeObjectURL = revokeURL;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('places an existing standalone layout on the map without replacing its draft or context', () => {
  useStreetStore.getState().setStreet(street());
  useStreetStore.getState().setBeforeStreet(street());
  render(<MemoryRouter><Toolbar /><Route /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'View on map' }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/map');
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'place-street', designProposalId: street().id });
  expect(useProposalStore.getState()).toMatchObject({ proposalId: street().id, roadPath: [], afterStreet: { name: 'Broadway' } });
  expect(Object.keys(useWorkDraftsStore.getState().drafts)).toEqual([street().id]);
});

it('opens an already placed layout in live map editing and keeps failed saves in the editor', () => {
  useStreetStore.getState().setStreet(street());
  const view = render(<MemoryRouter><Toolbar /><Route /></MemoryRouter>);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.click(screen.getByRole('button', { name: 'View on map' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
  expect(useWorkspaceStore.getState().mode).toBe('explore');
  write.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'View on map' }));
  const location = { lat: 39.7, lng: -104.9, address: 'Broadway' };
  act(() => {
    useProposalStore.setState({ location, roadPath: [location, { lat: 39.701, lng: -104.9 }] });
    useWorkspaceStore.setState({ mode: 'explore' });
  });
  fireEvent.click(screen.getByRole('button', { name: 'View on map' }));
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'design', designLocation: location, designProposalId: street().id });
  view.unmount();
});

describe.each([
  {
    name: 'toolbar',
    Component: Toolbar,
    widthLabel: 'ROW Width',
    directionLabel: 'Direction',
    classLabel: 'Functional Class',
    pdfLabel: 'Export PDF',
  },
  {
    name: 'dock',
    Component: EditorDock,
    widthLabel: 'ROW',
    directionLabel: 'Dir',
    classLabel: 'Class',
    pdfLabel: 'PDF',
  },
])('$name', ({ Component, widthLabel, directionLabel, classLabel, pdfLabel }) => {
  it('edits metadata with undo/redo, opens templates, and compares a previous design', () => {
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('Street name')).not.toBeInTheDocument();
    act(() => useStreetStore.getState().setStreet(street()));
    useStreetStore.temporal.getState().clear();
    fireEvent.change(screen.getByLabelText('Street name'), { target: { value: 'Safer Broadway' } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Street name')).toHaveValue('Broadway');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByLabelText('Street name')).toHaveValue('Safer Broadway');
    fireEvent.change(screen.getByLabelText(widthLabel), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(directionLabel), { target: { value: 'one-way' } });
    fireEvent.change(screen.getByLabelText(classLabel), { target: { value: 'collector' } });
    expect(useStreetStore.getState().currentStreet).toMatchObject({
      name: 'Safer Broadway',
      totalROWWidth: 80,
      direction: 'one-way',
      functionalClass: 'collector',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(useStreetStore.getState().isTemplateGalleryOpen).toBe(true);
    act(() => useStreetStore.getState().setBeforeStreet(street()));
    fireEvent.click(
      screen.getByRole('button', {
        name: Component === Toolbar ? 'Showing after view — click to show before' : 'After',
      }),
    );
    expect(useStreetStore.getState().showBeforeAfter).toBe(true);
    fireEvent.click(
      screen.getByRole('button', {
        name: Component === Toolbar ? 'Showing before view — click to show after' : 'Before',
      }),
    );
    expect(useStreetStore.getState().showBeforeAfter).toBe(false);
  });
  it('exports a named PDF, prevents repeated clicks while pending, and releases the blob URL', async () => {
    let finish!: (blob: Blob) => void;
    service.pdf.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    useStreetStore.getState().setStreet(street());
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: pdfLabel }));
    await waitFor(() => expect(service.pdf).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();
    expect(service.pdf).toHaveBeenCalledWith(useStreetStore.getState().currentStreet, null, [], undefined, 'pending');
    await act(async () => finish(new Blob(['pdf'])));
    expect(downloads).toEqual(['broadway-cross-section.pdf']);
    expect(revokeURL).toHaveBeenCalledWith('blob:pdf-fixture');
    expect(useStreetStore.getState().isExporting).toBe(false);
  });
  it.each([new Error('Renderer unavailable'), 'unknown failure'])(
    'restores controls and explains PDF generation failure',
    async (error) => {
      service.pdf.mockRejectedValueOnce(error);
      useStreetStore.getState().setStreet(street());
      render(
        <MemoryRouter>
          <Component />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: pdfLabel }));
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          `PDF could not be downloaded: ${error instanceof Error ? error.message : 'PDF export failed'}`,
        ),
      );
      expect(useStreetStore.getState().isExporting).toBe(false);
      expect(createURL).not.toHaveBeenCalled();
    },
  );
  it('downloads a basic resident PDF even without a paid export entitlement', async () => {
    service.canExport = false;
    useStreetStore.getState().setStreet(street());
    render(
      <MemoryRouter>
        <Component />
        <Route />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: pdfLabel }));
    await waitFor(() => expect(service.pdf).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    expect(screen.getByText('PDF downloaded. Review it before sharing.')).toBeInTheDocument();
  });
});
it('collapses the dock, selects a rendered element, and exits to the map', () => {
  useStreetStore.getState().setStreet(street());
  useWorkspaceStore.getState().enterDesignMode();
  render(
    <MemoryRouter>
      <EditorDock />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sidewalk, 6 feet wide' }));
  expect(useStreetStore.getState().selectedElementId).toBe('sidewalk');
  fireEvent.click(screen.getByRole('button', { name: 'Collapse editor dock' }));
  expect(useWorkspaceStore.getState().dockExpanded).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Expand editor dock' }));
  expect(useWorkspaceStore.getState().dockExpanded).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Exit design mode' }));
  expect(useWorkspaceStore.getState().mode).toBe('explore');
});

it('returns linked edits to the brief before export so evidence and measurement-source checks remain available', () => {
  const location = { lat: 39.7, lng: -104.9, address: 'Broadway' };
  const before = street();
  useProposalStore.getState().initProposal('Broadway', location);
  useProposalStore.getState().setBriefContext({ concern: 'Narrow sidewalk', dimensionBasis: 'measured', dimensionSource: '' });
  useProposalStore.setState({ beforeStreet: before, afterStreet: before, beforePresetId: 'local', selectedTemplateId: 'test' });
  const proposalId = useProposalStore.getState().proposalId!;
  useWorkspaceStore.getState().enterDesignMode(location, proposalId);
  useStreetStore.getState().setStreet({ ...before, id: 'replacement-template-id', name: 'Broadway revised' });
  service.canExport = false;
  render(<MemoryRouter><EditorDock /><Route /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review & export brief' }));
  expect(service.pdf).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
  expect(useWorkspaceStore.getState()).toMatchObject({ mode: 'propose', designLocation: location, designProposalId: null });
  expect(useProposalStore.getState()).toMatchObject({ step: 'review', proposalId, streetName: 'Broadway revised', afterStreet: { id: 'replacement-template-id', location }, beforeStreet: before, briefContext: { concern: 'Narrow sidewalk', dimensionBasis: 'measured', dimensionSource: '' } });
});
it('shows the editor empty state, validates changes, and suppresses after-view warnings during comparison', async () => {
  render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  act(() => useStreetStore.getState().setStreet(street([])));
  expect(screen.getByText(/No elements in this cross-section/)).toBeInTheDocument();
  service.validate.mockReturnValue([
    validation('__street__', 'error', 'dimensional'),
    validation('sidewalk', 'warning', 'nacto'),
  ]);
  act(() => useStreetStore.getState().setStreet(street()));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('exceeds the available right-of-way'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sidewalk, 6 feet wide' }));
  expect(useStreetStore.getState().selectedElementId).toBe('sidewalk');
  expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#street-editor-content',
  );
  act(() => {
    useStreetStore.getState().setBeforeStreet({ ...street(), name: 'Before Broadway' });
    useStreetStore.getState().toggleBeforeAfter();
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Showing before view from template application')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAccessibleName(expect.stringContaining('Before Broadway'));
  act(() => useStreetStore.getState().toggleBeforeAfter());
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
it('explains unavailable standards without claiming checks passed', async () => {
  service.standards.mockImplementation(() => {
    throw new Error('offline');
  });
  useStreetStore.getState().setStreet(street());
  render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('region')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Dimension checks could not run');
  expect(screen.queryByText('No flags from selected checks')).not.toBeInTheDocument();
});

it('preserves a linked purpose in standalone export and offers mobile sections', async () => {
  const current = street();
  useStreetStore.getState().setStreet(current);
  useProposalStore.setState({ afterStreet: current });
  useProposalStore.getState().setBriefContext({ concern: 'Cannot pass the pole', requestedNextStep: 'Measure the clearance' });
  render(<MemoryRouter><EditorPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Street settings' }));
  expect(screen.getByRole('button', { name: 'Street settings' })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Edit elements' }));
  expect(screen.getByRole('button', { name: 'Edit elements' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /^Checks$/ }));
  expect(screen.getByRole('button', { name: /^Checks$/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Street view' }));
  await waitFor(() => expect(useStreetStore.getState().validationStatus).toBe('complete'));
  fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
  await waitFor(() => expect(service.pdf).toHaveBeenCalledWith(current, null, [], useProposalStore.getState().briefContext, 'complete'));
});

it.each([false, true])('ignores a dimension check that finishes after leaving the editor (failure=%s)', async (failed) => {
  if (failed) service.standards.mockImplementation(() => { throw new Error('Module unavailable'); });
  useStreetStore.getState().setStreet(street());
  const { unmount } = render(<MemoryRouter><EditorPage /></MemoryRouter>);
  unmount();
  useStreetStore.getState().setValidationStatus('idle');
  await act(async () => { await Promise.resolve(); });
  expect(useStreetStore.getState().validationStatus).toBe('idle');
});
it('does not present an element-specific width flag as a total street overflow', async () => {
  service.validate.mockReturnValue([validation('sidewalk', 'error', 'prowag')]);
  useStreetStore.getState().setStreet(street());
  render(<MemoryRouter><EditorPage /></MemoryRouter>);
  await waitFor(() => expect(useStreetStore.getState().validationStatus).toBe('complete'));
  expect(screen.queryByText(/This design exceeds/)).not.toBeInTheDocument();
});

it('retains the linked brief after a replacement template changes the street identity', async () => {
  useProposalStore.getState().initProposal('Broadway', { lat: 39.7, lng: -104.9, address: 'Broadway' });
  useProposalStore.setState({ afterStreet: street() });
  useProposalStore.getState().setBriefContext({ concern: 'Keep the school crossing usable' });
  useWorkspaceStore.getState().enterDesignMode(undefined, useProposalStore.getState().proposalId!);
  const replacement = { ...street(), id: 'new-template' };
  useStreetStore.getState().setStreet(replacement);
  render(<MemoryRouter><Toolbar /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
  await waitFor(() => expect(service.pdf).toHaveBeenCalledWith(replacement, null, [], useProposalStore.getState().briefContext, 'pending'));
});
it('carries purpose through a direct dock export when the current geometry matches the draft', async () => {
  useStreetStore.getState().setStreet(street());
  useProposalStore.setState({ afterStreet: street() });
  useProposalStore.getState().setBriefContext({ requestedNextStep: 'Arrange a walk audit' });
  render(<MemoryRouter><EditorDock /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
  await waitFor(() => expect(service.pdf).toHaveBeenCalledWith(street(), null, [], useProposalStore.getState().briefContext, 'pending'));
});

describe.each([{ Component: Toolbar, label: 'Export PDF' }, { Component: EditorDock, label: 'PDF' }])('pending $label', ({ Component, label }) => {
  it.each(['street', 'before', 'checks', 'status', 'purpose', 'leave'] as const)('does not download a stale snapshot after %s changes', async (change) => {
    let finish!: (value: Blob) => void;
    service.pdf.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    useStreetStore.getState().setStreet(street());
    useProposalStore.setState({ afterStreet: street() });
    const { unmount } = render(<MemoryRouter><Component /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(service.pdf).toHaveBeenCalledOnce());
    act(() => {
      if (change === 'street') useStreetStore.getState().updateStreetName('Revised Broadway');
      else if (change === 'before') useStreetStore.getState().setBeforeStreet(street());
      else if (change === 'checks') useStreetStore.getState().setValidationResults([validation()]);
      else if (change === 'status') useStreetStore.setState({ validationStatus: 'error' });
      else if (change === 'purpose') useProposalStore.getState().setBriefContext({ concern: 'Updated request' });
      else unmount();
    });
    await act(async () => finish(new Blob(['old pdf'])));
    expect(createURL).not.toHaveBeenCalled();
    expect(useStreetStore.getState().isExporting).toBe(false);
    if (change !== 'leave') expect(screen.getByRole('alert')).toHaveTextContent('Your work changed');
  });
  it('clears the busy state when a failed export finishes after navigation', async () => {
    let fail!: (reason: Error) => void;
    service.pdf.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    useStreetStore.getState().setStreet(street());
    const { unmount } = render(<MemoryRouter><Component /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(service.pdf).toHaveBeenCalledOnce());
    unmount();
    await act(async () => fail(new Error('Late render failure')));
    expect(useStreetStore.getState().isExporting).toBe(false);
    expect(createURL).not.toHaveBeenCalled();
  });
});
