const eligibility = vi.hoisted(() => ({ value: 'ready' }));
vi.mock('@/lib/api/use-report-eligibility', () => ({ useReportEligibility: () => eligibility.value }));
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { IssueReportForm } from '../IssueReportForm';

const { processImages, captureAnalytics } = vi.hoisted(() => ({ processImages: vi.fn(), captureAnalytics: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ captureAnalytics }));
vi.mock('@/lib/images/process-image', () => ({ processImages }));
const sourcePhoto = new File(['jpeg'], 'crossing.jpg', { type: 'image/jpeg' });
const photo = () => ({
  blob: new Blob(['prepared'], { type: 'image/jpeg' }),
  width: 640,
  height: 480,
});
function choosePothole() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Road & Surface' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pothole' }));
}
beforeEach(() => {
  eligibility.value = 'ready';
  captureAnalytics.mockClear();
  processImages.mockReset().mockResolvedValue([photo()]);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:prepared-photo');
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('community issue draft and submission', () => {
  it('starts with capture fields and requires a location before continuing', () => {
    const submit = vi.fn();
    render(<IssueReportForm initialLat={39.74} initialLng={-104.99} onSubmit={submit} />);
    expect(screen.getByRole('heading', { name: 'Location & photo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /reporting|311/i })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it.each([[34.05, -118.24], [42.36, -71.06], [0, 0]])('blocks reporting outside the pilots (%s, %s)', (lat, lng) => {
    const submit = vi.fn();
    const { container } = render(<IssueReportForm initialLat={lat} initialLng={lng} initialAddress="Selected place" onSubmit={submit} />);
    expect(screen.getByRole('alert')).toHaveTextContent('You can search anywhere in the US');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).not.toHaveBeenCalled();
  });
  it.each([[39.74, -104.99], [41.88, -87.63], [40.71, -74.01]])('allows the reporting tools in a pilot (%s, %s)', (lat, lng) => {
    render(<IssueReportForm initialLat={lat} initialLng={lng} initialAddress="Selected place" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    choosePothole();
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeEnabled();
  });

  it('captures an uncategorized observation directly without extra details or a city request', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Colfax, Denver" onSubmit={submit} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [sourcePhoto] } });
    await screen.findByRole('img', { name: 'Upload 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe what you noticed (optional)' }), {
      target: { value: 'Sand collects on this turn after rain.' },
    });
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeDisabled();
    expect(screen.getByText('Help choosing a category').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      location: { lat: 39.74, lng: -104.99, address: 'Colfax, Denver' },
      group: 'other', issueType: 'other', title: 'Other near Colfax',
      description: 'Sand collects on this turn after rain.',
      severity: 'medium', isBlocking: false,
      processedImages: [expect.objectContaining({ width: 640, height: 480 })],
    }));
    expect(screen.queryByRole('link', { name: /reporting|311/i })).not.toBeInTheDocument();
  });

  it('requires location and an issue, supports back/cancel, and derives severity from issue type and blocking', async () => {
    const submit = vi.fn().mockResolvedValue(undefined),
      cancel = vi.fn();
    const { container } = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} onSubmit={submit} onCancel={cancel} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), {
      target: { value: '  Colfax, Denver  ' },
    });
    choosePothole();
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Damaged Utility Cover' }));
    expect(screen.getByRole('button', { name: 'Critical' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Low' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sidewalk & Path' }));
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'No Curb Ramp' }));
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add details' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('No Curb Ramp near Colfax');
    expect(screen.getByText('Blocking')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][0]).toMatchObject({
      location: { lat: 39.74, lng: -104.99, address: 'Colfax, Denver' },
      group: 'sidewalk',
      issueType: 'no-curb-ramp',
      severity: 'low',
      isBlocking: true,
    });
    expect(captureAnalytics).toHaveBeenCalledExactlyOnceWith('issue_report_submitted', {
      issue_group: 'sidewalk', issue_type: 'no-curb-ramp', severity: 'low',
      is_blocking: true, photo_count: 0,
    });
  });
  it('preserves a custom draft on failure, blocks duplicate submissions while pending, and retries without stale errors', async () => {
    let rejectFirst: (error: Error) => void = () => {};
    const submit = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const { container } = render(
      <IssueReportForm
        initialAddress="Colfax, Denver"
        initialLat={39.74}
        initialLng={-104.99}
        onSubmit={submit}
      />,
    );
    fireEvent.change(container.querySelector('input[name="website"]')!, {
      target: { value: 'bot-field' },
    });
    choosePothole();
    fireEvent.click(screen.getByRole('button', { name: 'Add details' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: '  Large pothole at crossing  ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Any details/ }), {
      target: { value: '  Wheelchair route blocked  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).toHaveBeenCalledOnce();
    await act(async () => rejectFirst(new Error('Please sign in again.\nInternal stack trace')));
    expect(captureAnalytics).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Internal stack trace');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      '  Large pothole at crossing  ',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(submit).toHaveBeenCalledTimes(2);
    expect(captureAnalytics).toHaveBeenCalledOnce();
    expect(submit.mock.calls[1][0]).toMatchObject({
      title: 'Large pothole at crossing',
      description: 'Wheelchair route blocked',
      honeypotValue: 'bot-field',
      formOpenedAt: expect.any(Number),
      location: { lat: 39.74, lng: -104.99, address: 'Colfax, Denver' },
    });
  });
  it.each([
    [new ConvexError('A report can include up to three different photos.'), 'A report can include up to three different photos.'],
    [new ConvexError({ code: 'INTERNAL' }), 'Your observation could not be saved. Please try again.'],
    [
      new Error('[CONVEX M(reports)] internal details'),
      'Your observation could not be saved. Please try again.',
    ],
    ['unstructured provider failure', 'Your observation could not be saved. Please try again.'],
  ])('shows safe actionable feedback for a rejected report', async (error, message) => {
    render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Denver" onSubmit={vi.fn().mockRejectedValue(error)} />);
    choosePothole();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(captureAnalytics).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeEnabled();
  });
  it('uses the suggested title when a user clears an edited title', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Colfax, Denver" onSubmit={submit} />);
    choosePothole();
    fireEvent.click(screen.getByRole('button', { name: 'Add details' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][0].title).toBe('Pothole near Colfax');
  });
});

describe('issue photo preparation interactions', () => {
  it('releases prepared previews when the form closes and does not create previews for late decoding results', async () => {
    const first = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Denver" onSubmit={vi.fn()} />);
    fireEvent.change(first.container.querySelector('input[type="file"]')!, {
      target: { files: [sourcePhoto] },
    });
    await screen.findByRole('img', { name: 'Upload 1' });
    first.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prepared-photo');
    let finish: (value: unknown) => void = () => {};
    processImages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const second = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Denver" onSubmit={vi.fn()} />);
    fireEvent.change(second.container.querySelector('input[type="file"]')!, {
      target: { files: [sourcePhoto] },
    });
    second.unmount();
    await act(async () => finish([photo()]));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });
  it('supports keyboard and drop upload, prevents concurrent decoding, and removes prepared photo data with its preview', async () => {
    let finish: (value: unknown) => void = () => {};
    processImages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { container } = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Denver" onSubmit={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const drop = screen.getByRole('button', { name: 'Upload photos by clicking or dragging' });
    const picker = vi.spyOn(input, 'click');
    fireEvent.click(drop);
    fireEvent.keyDown(drop, { key: 'Enter' });
    fireEvent.keyDown(drop, { key: ' ' });
    fireEvent.keyDown(drop, { key: 'Tab' });
    expect(picker).toHaveBeenCalledTimes(3);
    fireEvent.dragOver(drop);
    expect(drop).toHaveClass('bg-civic-wash');
    fireEvent.dragLeave(drop);
    expect(drop).not.toHaveClass('bg-civic-wash');
    fireEvent.drop(drop, { dataTransfer: { files: [] } });
    fireEvent.change(input, { target: { files: [] } });
    fireEvent.drop(drop, { dataTransfer: { files: [sourcePhoto] } });
    expect(screen.getByText('Compressing photos...')).toBeInTheDocument();
    fireEvent.drop(drop, { dataTransfer: { files: [sourcePhoto] } });
    expect(processImages).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await act(async () => finish([photo(), photo()]));
    expect(screen.getByText('2 photos added')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prepared-photo');
    expect(screen.getByText('1 photo added')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Road & Surface' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pothole' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add details' }));
    expect(screen.getByText('1 photo attached')).toBeInTheDocument();
  });
  it('offers retry after decoding failure and rejects an invalid prepared upload', async () => {
    processImages
      .mockRejectedValueOnce(new Error('Decode failed'))
      .mockResolvedValueOnce([{ ...photo(), blob: new Blob(['svg'], { type: 'image/svg+xml' }) }])
      .mockResolvedValueOnce([photo()]);
    const { container } = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Denver" onSubmit={vi.fn()} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [sourcePhoto] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('A photo could not be prepared.');
    fireEvent.change(input, { target: { files: [sourcePhoto] } });
    await waitFor(() => expect(processImages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    expect(screen.getByRole('alert')).toHaveTextContent('A photo could not be prepared.');
    fireEvent.change(input, { target: { files: [sourcePhoto] } });
    expect(await screen.findByRole('img', { name: 'Upload 1' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});


it('saves a public observation without photos and rechecks the session at submission', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const { container, rerender } = render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Grant Street" onSubmit={submit} />);
  expect(screen.getByText('Optional, but photos help others see the problem.')).toBeInTheDocument();
  choosePothole();
  fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0]).toMatchObject({ photoDataUrls: [], processedImages: [] });
  submit.mockClear();
  eligibility.value = 'unavailable';
  rerender(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Grant Street" onSubmit={submit} />);
  expect(screen.getByRole('button', { name: 'Save observation' })).toBeDisabled();
  fireEvent.submit(container.querySelector('form')!);
  expect(submit).not.toHaveBeenCalled();
});

it.each(['loading', 'unavailable'])('explains session %s before the resident completes public reporting', (state) => {
  eligibility.value = state;
  render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Grant Street" onSubmit={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByText(state === 'loading' ? /Checking your reporting session/ : /Your reporting session is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Keep as a private concern' })).toBeEnabled();
});

it('keeps the resident’s notes as a private concern without publishing or requiring photos', async () => {
  const { useProposalStore } = await import('@/stores/proposal-store');
  const { useWorkDraftsStore } = await import('@/stores/work-drafts-store');
  localStorage.clear();
  useProposalStore.getState().reset();
  useWorkDraftsStore.getState().load();
  const submit = vi.fn(), cancel = vi.fn();
  render(<IssueReportForm initialLat={39.74} initialLng={-104.99} initialAddress="Grant Street" onSubmit={submit} onCancel={cancel} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByLabelText('Describe what you noticed (optional)'), { target: { value: 'A temporary sign blocks the ramp.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Keep as a private concern' }));
  expect(useProposalStore.getState().briefContext.concern).toBe('A temporary sign blocks the ramp.');
  expect(Object.values(useWorkDraftsStore.getState().drafts)[0].briefContext.concern).toBe('A temporary sign blocks the ramp.');
  expect(submit).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});
