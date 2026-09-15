import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Toolbar } from '../Toolbar';
import { EditorDock } from '../EditorDock';
import { EditorPage } from '../index';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
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
  useStreetStore.setState(useStreetStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
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
    expect(service.pdf).toHaveBeenCalledWith(useStreetStore.getState().currentStreet, null, []);
    await act(async () => finish(new Blob(['pdf'])));
    expect(downloads).toEqual(['broadway-cross-section.pdf']);
    expect(revokeURL).toHaveBeenCalledWith('blob:pdf-fixture');
    expect(useStreetStore.getState().isExporting).toBe(false);
  });
  it.each([new Error('Renderer unavailable'), 'unknown failure'])(
    'restores controls and explains PDF generation failure',
    async (error) => {
      const alert = vi.fn();
      vi.stubGlobal('alert', alert);
      service.pdf.mockRejectedValueOnce(error);
      useStreetStore.getState().setStreet(street());
      render(
        <MemoryRouter>
          <Component />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: pdfLabel }));
      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          `Export not available yet: ${error instanceof Error ? error.message : 'PDF export failed'}`,
        ),
      );
      expect(useStreetStore.getState().isExporting).toBe(false);
      expect(createURL).not.toHaveBeenCalled();
    },
  );
  it('routes restricted exports to contact without starting PDF generation', () => {
    service.canExport = false;
    useStreetStore.getState().setStreet(street());
    render(
      <MemoryRouter>
        <Component />
        <Route />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: pdfLabel }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/contact');
    expect(service.pdf).not.toHaveBeenCalled();
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
it('shows the editor empty state, validates changes, and suppresses after-view warnings during comparison', async () => {
  render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('main')).not.toBeInTheDocument();
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
    '#main-content',
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
it('announces export completion briefly and handles unavailable standards', async () => {
  vi.useFakeTimers();
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
  expect(screen.getByRole('main')).toBeInTheDocument();
  act(() => useStreetStore.getState().setExporting(true));
  act(() => useStreetStore.getState().setExporting(false));
  expect(screen.getByText('PDF export complete.')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.queryByText('PDF export complete.')).not.toBeInTheDocument();
});
