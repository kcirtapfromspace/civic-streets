import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BriefDownload } from './BriefDownload';
import { adaptTemplate } from '@/lib/templates/adapter';
import { MOCK_TEMPLATES } from '@/features/gallery/mock-templates';
const pdf = vi.hoisted(() => ({ observation: vi.fn(), street: vi.fn() }));
vi.mock('@/features/export', () => ({ generateObservationPDF: pdf.observation, generatePDF: pdf.street }));
const context = { concern: 'Sign blocks ramp', desiredOutcome: 'Keep ramp clear', requestedNextStep: 'Move the sign', dimensionBasis: 'assumed' as const, dimensionSource: '' };
beforeEach(() => {
  pdf.observation.mockReset().mockResolvedValue(new Blob(['pdf'])); pdf.street.mockReset().mockResolvedValue(new Blob(['street']));
  URL.createObjectURL = vi.fn().mockReturnValue('blob:actual-pdf'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('creates a real free PDF and tells the person to attach it manually', async () => {
  const view = render(<BriefDownload context={context} />);
  expect(screen.getByText(/does not attach a file/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare PDF for download' }));
  expect(await screen.findByRole('link')).toHaveAttribute('href', 'blob:actual-pdf');
  expect(screen.getByRole('link')).toHaveAttribute('download', 'curbwise-discussion-brief.pdf');
  expect(pdf.observation).toHaveBeenCalledWith(context);
  view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:actual-pdf');
});
it('exports linked geometry with real selected validation results', async () => {
  const street = adaptTemplate(MOCK_TEMPLATES[0], 66);
  render(<BriefDownload street={street} beforeStreet={street} context={context} />);
  fireEvent.click(screen.getByRole('button'));
  await screen.findByRole('link');
  expect(pdf.street).toHaveBeenCalledWith(street, street, expect.any(Array), context);
});
it('keeps errors recoverable and prevents duplicate preparation', async () => {
  let reject!: (reason: Error) => void;
  pdf.observation.mockReturnValueOnce(new Promise<Blob>((_, fail) => { reject = fail; }));
  render(<BriefDownload context={context} />);
  const button = screen.getByRole('button'); act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(pdf.observation).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button')).toBeDisabled();
  await act(async () => reject(new Error('renderer')));
  expect(screen.getByRole('alert')).toHaveTextContent('Your message is still here');
  fireEvent.click(screen.getByRole('button'));
  await screen.findByRole('link');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it.each(['success', 'failure'])('ignores late %s after navigating away', async (outcome) => {
  let resolve!: (blob: Blob) => void; let reject!: (error: Error) => void;
  pdf.observation.mockReturnValueOnce(new Promise<Blob>((done, fail) => { resolve = done; reject = fail; }));
  const view = render(<BriefDownload context={context} />); fireEvent.click(screen.getByRole('button')); view.unmount();
  await act(async () => outcome === 'success' ? resolve(new Blob()) : reject(new Error('late')));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('does not offer a phantom PDF when neither evidence nor geometry is linked', () => {
  render(<BriefDownload />);
  expect(screen.getByText(/No brief is linked/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
