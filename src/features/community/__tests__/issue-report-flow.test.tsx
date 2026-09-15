import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { IssueReportForm } from '../IssueReportForm';

const { processImages } = vi.hoisted(() => ({ processImages: vi.fn() }));
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
  it('requires location and an issue, supports back/cancel, and derives severity from issue type and blocking', async () => {
    const submit = vi.fn().mockResolvedValue(undefined),
      cancel = vi.fn();
    const { container } = render(<IssueReportForm onSubmit={submit} onCancel={cancel} />);
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
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'No Curb Ramp' }));
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('No Curb Ramp near Colfax');
    expect(screen.getByText('Blocking')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip details & submit' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][0]).toMatchObject({
      location: { lat: 0, lng: 0, address: 'Colfax, Denver' },
      group: 'sidewalk',
      issueType: 'no-curb-ramp',
      severity: 'low',
      isBlocking: true,
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: '  Large pothole at crossing  ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Any details/ }), {
      target: { value: '  Wheelchair route blocked  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).toHaveBeenCalledOnce();
    await act(async () => rejectFirst(new Error('Please sign in again.\nInternal stack trace')));
    expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Internal stack trace');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      '  Large pothole at crossing  ',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][0]).toMatchObject({
      title: 'Large pothole at crossing',
      description: 'Wheelchair route blocked',
      honeypotValue: 'bot-field',
      formOpenedAt: expect.any(Number),
      location: { lat: 39.74, lng: -104.99, address: 'Colfax, Denver' },
    });
  });
  it.each([
    [new ConvexError('Add a photo before submitting.'), 'Add a photo before submitting.'],
    [new ConvexError({ code: 'INTERNAL' }), 'Your report could not be saved. Please try again.'],
    [
      new Error('[CONVEX M(reports)] internal details'),
      'Your report could not be saved. Please try again.',
    ],
    ['unstructured provider failure', 'Your report could not be saved. Please try again.'],
  ])('shows safe actionable feedback for a rejected report', async (error, message) => {
    render(<IssueReportForm initialAddress="Denver" onSubmit={vi.fn().mockRejectedValue(error)} />);
    choosePothole();
    fireEvent.click(screen.getByRole('button', { name: 'Skip details & submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Skip details & submit' })).toBeEnabled();
  });
  it('uses the suggested title when a user clears an edited title', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<IssueReportForm initialAddress="Colfax, Denver" onSubmit={submit} />);
    choosePothole();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][0].title).toBe('Pothole near Colfax');
  });
});

describe('issue photo preparation interactions', () => {
  it('releases prepared previews when the form closes and does not create previews for late decoding results', async () => {
    const first = render(<IssueReportForm initialAddress="Denver" onSubmit={vi.fn()} />);
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
    const second = render(<IssueReportForm initialAddress="Denver" onSubmit={vi.fn()} />);
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
    const { container } = render(<IssueReportForm initialAddress="Denver" onSubmit={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const drop = screen.getByRole('button', { name: 'Upload photos by clicking or dragging' });
    const picker = vi.spyOn(input, 'click');
    fireEvent.click(drop);
    fireEvent.keyDown(drop, { key: 'Enter' });
    fireEvent.keyDown(drop, { key: ' ' });
    fireEvent.keyDown(drop, { key: 'Tab' });
    expect(picker).toHaveBeenCalledTimes(3);
    fireEvent.dragOver(drop);
    expect(drop).toHaveClass('bg-blue-50');
    fireEvent.dragLeave(drop);
    expect(drop).not.toHaveClass('bg-blue-50');
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('1 photo attached')).toBeInTheDocument();
  });
  it('offers retry after decoding failure and rejects an invalid prepared upload', async () => {
    processImages
      .mockRejectedValueOnce(new Error('Decode failed'))
      .mockResolvedValueOnce([{ ...photo(), blob: new Blob(['svg'], { type: 'image/svg+xml' }) }])
      .mockResolvedValueOnce([photo()]);
    const { container } = render(<IssueReportForm initialAddress="Denver" onSubmit={vi.fn()} />);
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
