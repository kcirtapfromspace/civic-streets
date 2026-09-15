import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueReportForm } from '../IssueReportForm';

const { processImages } = vi.hoisted(() => ({ processImages: vi.fn() }));
vi.mock('../../../lib/images/process-image', () => ({ processImages }));

function choose(files: File[]) {
  const { container } = render(<IssueReportForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files } });
}

beforeEach(() => processImages.mockReset());
afterEach(() => cleanup());

describe('photo preparation limits', () => {
  it('rejects more than three source photos before decoding', () => {
    choose(
      Array.from({ length: 4 }, (_, i) => new File(['jpeg'], `${i}.jpg`, { type: 'image/jpeg' })),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('up to three photos');
    expect(processImages).not.toHaveBeenCalled();
  });

  it('rejects active SVG content before decoding', () => {
    choose([new File(['<svg/>'], 'vector.svg', { type: 'image/svg+xml' })]);
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG, or WebP');
    expect(processImages).not.toHaveBeenCalled();
  });

  it('rejects a source file over the memory guard before decoding', () => {
    const file = new File(['jpeg'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
    choose([file]);
    expect(screen.getByRole('alert')).toHaveTextContent('10 MiB');
    expect(processImages).not.toHaveBeenCalled();
  });
});
