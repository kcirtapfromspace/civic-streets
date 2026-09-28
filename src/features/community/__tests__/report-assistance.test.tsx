import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportAssistance } from '../ReportAssistance';
import { IssueReportForm } from '../IssueReportForm';
import { FOLLOW_UPS, type AssistanceResult } from '../../../../shared/report-assistance';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api/report-assistance', () => ({ requestReportAssistance: request }));
const input = { description: 'A car blocks the curb ramp each morning.', lat: 39.74, lng: -104.99 };
const advice: AssistanceResult = {
  id: 'advice-id' as AssistanceResult['id'], suggestedIssueType: 'vehicle-blocking', followUps: ['location'],
  relatedReports: [{ id: 'hotspot-id' as AssistanceResult['relatedReports'][number]['id'], title: 'Ramp obstruction' }],
};
function panel() {
  const onApply = vi.fn(), onResult = vi.fn();
  return { ...render(<ReportAssistance input={input} onApply={onApply} onResult={onResult} />), onApply, onResult };
}
function form(submit = vi.fn()) {
  const view = render(<IssueReportForm initialAddress="Colfax, Denver" initialLat={input.lat} initialLng={input.lng} onSubmit={submit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByText('Help choosing a category'));
  return { ...view, submit };
}
function describeIssue(description = input.description) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Describe what you noticed (optional)' }), { target: { value: description } });
}
beforeEach(() => { request.mockReset().mockResolvedValue(advice); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('resident report assistance', () => {
  it('waits for an explicit request, shows optional questions and opens related reports without losing the draft', async () => {
    const { onApply, onResult } = panel();
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(/sends your description/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(await screen.findByText('Vehicle Blocking')).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledWith(advice.id);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(FOLLOW_UPS.location)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Ramp obstruction/ });
    expect(link).toHaveAttribute('href', '/hotspot/hotspot-id');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(screen.getByRole('button', { name: 'Use suggestion' }));
    expect(onApply).toHaveBeenCalledWith('vehicle-blocking');
    expect(screen.getByRole('button', { name: 'Applied' })).toBeDisabled();
  });

  it.each([null, 'unknown-type'])('lets residents proceed when no usable type is suggested (%s)', async (suggestedIssueType) => {
    request.mockResolvedValueOnce({ ...advice, suggestedIssueType, followUps: [], relatedReports: [] });
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(await screen.findByText(/No clear issue suggestion/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).not.toBeInTheDocument();
    expect(screen.getByText(/No strong matches among/)).toBeInTheDocument();
    expect(screen.queryByText('Details you could add')).not.toBeInTheDocument();
  });

  it.each([new Error('Try again later.'), 'non-error failure'])('shows a recoverable error and supports retry', async (failure) => {
    request.mockRejectedValueOnce(failure);
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(await screen.findByRole('status')).toHaveTextContent(typeof failure === 'string' ? 'Suggestions are unavailable' : 'Try again later.');
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(await screen.findByText('Vehicle Blocking')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('requires enough text and suppresses repeat clicks while a request is pending', async () => {
    let resolve!: (value: AssistanceResult) => void;
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    form();
    expect(screen.getByRole('button', { name: 'Suggest' })).toBeDisabled();
    describeIssue();
    const button = screen.getByRole('button', { name: 'Suggest' });
    act(() => { button.click(); button.click(); });
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    await act(async () => resolve(advice));
    expect(screen.getByRole('button', { name: 'Use suggestion' })).toBeInTheDocument();
  });

  it('ignores a response for text that has since changed and allows a fresh request', async () => {
    let resolve!: (value: AssistanceResult) => void;
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    form(); describeIssue();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    describeIssue('A different concern about a faded crossing.');
    await act(async () => resolve(advice));
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(await screen.findByRole('button', { name: 'Use suggestion' })).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith({ ...input, description: 'A different concern about a faded crossing.' });
    describeIssue('Another edit after the suggestions appeared.');
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).not.toBeInTheDocument();
  });

  it('ignores a rejected request after the form closes', async () => {
    let reject!: (value: Error) => void;
    request.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    const { unmount, onResult } = panel();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    unmount();
    await act(async () => reject(new Error('late error')));
    expect(onResult).not.toHaveBeenCalled();
  });

  it('applies a category without changing the resident’s description, then records a manual override', async () => {
    const { submit } = form(); describeIssue();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use suggestion' }));
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vehicle Blocking' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sidewalk & Path' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blocked Sidewalk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add details' }));
    expect(screen.getByRole('textbox', { name: /Any details/ })).toHaveValue(input.description);
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      reportAssistanceId: advice.id, description: input.description, issueType: 'blocked-sidewalk', group: 'sidewalk', severity: 'medium',
    })));
  });

  it('allows ordinary submission after a provider failure without requiring assistance', async () => {
    request.mockRejectedValueOnce(new Error('Suggestions unavailable'));
    const { submit } = form(); describeIssue();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: 'Road & Surface' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pothole' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ issueType: 'pothole', description: input.description, reportAssistanceId: undefined })));
  });
});
