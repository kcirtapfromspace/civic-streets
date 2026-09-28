import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProposalFlow } from './ProposalFlow';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
const generateObservationPDF = vi.hoisted(() => vi.fn());
vi.mock('@/features/export', () => ({ generateObservationPDF }));
const place = { lat: 39.7, lng: -104.9, address: 'Broadway' };
beforeEach(() => {
  localStorage.clear();
  useProposalStore.getState().reset();
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  generateObservationPDF.mockReset().mockResolvedValue(new Blob(['PDF']));
  URL.createObjectURL = vi.fn(() => 'blob:brief');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([place, null])('prepares a private brief with location %s without geometry or publication', async (location) => {
  useProposalStore.getState().initProposal('North library entrance', location);
  render(<ProposalFlow />);
  expect(screen.getByRole('button', { name: 'Prepare a brief' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('What is happening here?'), { target: { value: 'A sign blocks the ramp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Prepare a brief' }));
  expect(screen.getByRole('button', { name: 'Download brief PDF' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('What next step are you asking for?'), { target: { value: 'Move the sign' } });
  fireEvent.click(screen.getByText('Read the brief'));
  expect(screen.getByRole('article', { name: 'Readable discussion brief' })).toHaveTextContent('Move the sign');
  fireEvent.click(screen.getByRole('button', { name: 'Download brief PDF' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('nothing has been sent'));
  expect(generateObservationPDF).toHaveBeenCalledWith(expect.objectContaining({ concern: 'A sign blocks the ramp', requestedNextStep: 'Move the sign' }), { ...(location ?? {}), name: 'North library entrance' });
  expect(screen.getByRole('link', { name: 'Download PDF again' })).toHaveAttribute('href', 'blob:brief');
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(useProposalStore.getState().getProposal()).toBeNull();
  expect(Object.values(useWorkDraftsStore.getState().drafts)[0]).toMatchObject({ kind: 'street', step: 'brief' });
  const explore = screen.getByRole('button', { name: 'Explore a street layout' });
  if (location) { fireEvent.click(explore); expect(useProposalStore.getState().step).toBe('street-selected'); }
  else expect(explore).toBeDisabled();
});

it('keeps purpose editable after PDF failure and prevents duplicate download requests', async () => {
  useProposalStore.getState().initConcern('');
  useProposalStore.getState().setBriefContext({ concern: 'Blocked path', requestedNextStep: 'Site visit' });
  useProposalStore.getState().prepareBrief();
  let reject!: (error: Error) => void;
  generateObservationPDF.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  render(<ProposalFlow />);
  const download = screen.getByRole('button', { name: 'Download brief PDF' });
  act(() => { download.click(); download.click(); });
  await waitFor(() => expect(generateObservationPDF).toHaveBeenCalledOnce());
  expect(screen.getByRole('button', { name: 'Preparing brief…' })).toBeDisabled();
  await act(async () => reject(new Error('Renderer unavailable')));
  expect(screen.getByRole('alert')).toHaveTextContent('notes are still here');
  expect(screen.getByLabelText('What is happening here?')).toHaveValue('Blocked path');
});

it('keeps an unsaved concern open when storage fails, then saves and closes after retry', () => {
  useProposalStore.getState().initConcern('Near the school');
  useWorkspaceStore.setState({ mode: 'propose' });
  render(<ProposalFlow />);
  const block = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.change(screen.getByLabelText('What is happening here?'), { target: { value: 'No safe passage' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  block.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(useWorkspaceStore.getState().mode).toBe('explore');
});


it.each(['resolve', 'reject'] as const)('ignores PDF %s after the concern changes or the reader leaves', async (result) => {
  useProposalStore.getState().initConcern('School crossing');
  useProposalStore.getState().setBriefContext({ concern: 'Crossing obstruction', requestedNextStep: 'Site visit' });
  useProposalStore.getState().prepareBrief();
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  generateObservationPDF.mockReturnValue(new Promise((ok, fail) => { resolve = ok; reject = fail; }));
  const view = render(<ProposalFlow />);
  fireEvent.click(screen.getByRole('button', { name: 'Download brief PDF' }));
  await waitFor(() => expect(generateObservationPDF).toHaveBeenCalledOnce());
  if (result === 'resolve') fireEvent.change(screen.getByLabelText('What next step are you asking for?'), { target: { value: 'Different next step' } });
  else view.unmount();
  await act(async () => result === 'resolve' ? resolve(new Blob(['Old brief'])) : reject(new Error('Old error')));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Download PDF again' })).not.toBeInTheDocument();
});

it('retains a prepared link, releases it when revised, and releases a replacement when leaving', async () => {
  useProposalStore.getState().initConcern('Crossing');
  useProposalStore.getState().setBriefContext({ concern: 'Crossing obstruction', requestedNextStep: 'Site visit' });
  useProposalStore.getState().prepareBrief();
  const view = render(<ProposalFlow />);
  fireEvent.click(screen.getByRole('button', { name: 'Download brief PDF' }));
  await screen.findByRole('link', { name: 'Download PDF again' });
  fireEvent.click(screen.getByRole('button', { name: 'Download brief PDF' }));
  await waitFor(() => expect(generateObservationPDF).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('What next step are you asking for?'), { target: { value: 'Repair request' } });
  expect(screen.queryByRole('link', { name: 'Download PDF again' })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Download brief PDF' }));
  await screen.findByRole('link', { name: 'Download PDF again' });
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
});
