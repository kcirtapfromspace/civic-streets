import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ObservationBrief } from '../ObservationBrief';
import type { MockHotspot } from '../mock-data';

const exportPDF = vi.hoisted(() => vi.fn());
vi.mock('@/features/export', () => ({ generateObservationPDF: exportPDF }));

const hotspot: MockHotspot = {
  id: 'local-observation', title: 'Blocked sidewalk', description: 'Branches block the path.',
  photoUrls: ['https://example.test/path.jpg'], lat: 39.74, lng: -104.98,
  address: 'Broadway, Denver', createdAt: 1_790_000_000_000, category: 'poor-sidewalk',
  severity: 'medium', status: 'open', authorId: 'local', upvotes: 0, downvotes: 0,
  commentCount: 0, linkedDesignIds: [],
};

beforeEach(() => {
  exportPDF.mockReset().mockResolvedValue(new Blob(['PDF']));
  URL.createObjectURL = vi.fn().mockReturnValue('blob:brief');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function openBrief() {
  fireEvent.click(screen.getByText('Make a brief from this observation'));
}

it('keeps evidence-only preparation optional and exports the actual observation and requested outcome', async () => {
  render(<ObservationBrief hotspot={hotspot} source="browser-session" />);
  for (const field of screen.queryAllByRole('textbox')) expect(field).not.toBeVisible();
  openBrief();
  fireEvent.change(screen.getByLabelText(/What would you like to improve/), { target: { value: '  A clear walking path  ' } });
  fireEvent.change(screen.getByLabelText(/What are you asking for/), { target: { value: '  A site visit  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
  const link = await screen.findByRole('link', { name: 'Download discussion brief' });
  expect(link).toHaveAttribute('href', 'blob:brief');
  expect(link).toHaveAttribute('download', 'observation-discussion-brief.pdf');
  expect(exportPDF).toHaveBeenCalledExactlyOnceWith({
    concern: hotspot.description, desiredOutcome: 'A clear walking path', requestedNextStep: 'A site visit',
    dimensionBasis: 'assumed', dimensionSource: '',
    observation: {
      id: hotspot.id, title: hotspot.title, description: hotspot.description,
      photoUrls: hotspot.photoUrls, lat: hotspot.lat, lng: hotspot.lng, address: hotspot.address,
      createdAt: hotspot.createdAt, source: 'browser-session',
    },
  });
  expect(exportPDF.mock.calls[0][0].observation.photoUrls).not.toBe(hotspot.photoUrls);
  expect(screen.getByText(/Nothing is sent automatically/)).toBeVisible();
});

it('uses the title when there are no notes and permits an observation-only brief', async () => {
  render(<ObservationBrief hotspot={{ ...hotspot, description: '' }} source="example" />);
  openBrief();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
  await screen.findByRole('link', { name: 'Download discussion brief' });
  expect(exportPDF).toHaveBeenCalledWith(expect.objectContaining({
    concern: hotspot.title, desiredOutcome: '', requestedNextStep: '',
    observation: expect.objectContaining({ source: 'example' }),
  }));
});

it('invalidates a prepared PDF when either input changes, so the download cannot contain stale notes', async () => {
  const view = render(<ObservationBrief hotspot={hotspot} source="community" />);
  openBrief();
  for (const field of [/What would you like to improve/, /What are you asking for/]) {
    fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
    await screen.findByRole('link', { name: 'Download discussion brief' });
    fireEvent.change(screen.getByLabelText(field), { target: { value: 'Updated notes' } });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  }
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
  await screen.findByRole('link', { name: 'Download discussion brief' });
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
});

it('retains notes after export failure and allows retry', async () => {
  exportPDF.mockRejectedValueOnce(new Error('Renderer unavailable'));
  render(<ObservationBrief hotspot={hotspot} source="community" />);
  openBrief();
  fireEvent.change(screen.getByLabelText(/What are you asking for/), { target: { value: 'Please visit this spot.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your notes are still here');
  expect(screen.getByLabelText(/What are you asking for/)).toHaveValue('Please visit this spot.');
  fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
  await screen.findByRole('link', { name: 'Download discussion brief' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('prevents duplicate preparation and locks inputs while the PDF is being prepared', async () => {
  let resolve!: (blob: Blob) => void;
  exportPDF.mockReturnValue(new Promise<Blob>((done) => { resolve = done; }));
  render(<ObservationBrief hotspot={hotspot} source="community" />);
  openBrief();
  const button = screen.getByRole('button', { name: 'Prepare discussion brief' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(exportPDF).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Preparing brief…' })).toBeDisabled();
  expect(screen.getByLabelText(/What are you asking for/)).toBeDisabled();
  await act(async () => resolve(new Blob(['PDF'])));
  expect(screen.getByRole('link')).toBeInTheDocument();
});

it.each(['resolve', 'reject'])('discards a late %s after leaving the observation', async (outcome) => {
  let resolve!: (blob: Blob) => void;
  let reject!: (reason: Error) => void;
  exportPDF.mockReturnValue(new Promise<Blob>((done, fail) => { resolve = done; reject = fail; }));
  const view = render(<ObservationBrief hotspot={hotspot} source="community" />);
  openBrief();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare discussion brief' }));
  view.unmount();
  await act(async () => {
    if (outcome === 'resolve') resolve(new Blob(['PDF']));
    else reject(new Error('Late failure'));
  });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
