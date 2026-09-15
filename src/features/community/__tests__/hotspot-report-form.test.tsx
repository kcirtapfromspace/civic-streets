import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HotspotReportForm } from '../HotspotReportForm';

afterEach(cleanup);
describe('street hotspot report draft', () => {
  it('requires a title and location, trims the draft, and removes accessibility subtype when the category changes', () => {
    const submit = vi.fn(),
      cancel = vi.fn();
    const { container } = render(<HotspotReportForm onSubmit={submit} onCancel={cancel} />);
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), {
      target: { value: '  Colfax, Denver  ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: '  Curb ramp missing  ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: '  No accessible crossing  ' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'accessibility' },
    });
    const subtype = screen.getByRole('combobox', {
      name: 'Accessibility Issue Type',
    }) as HTMLSelectElement;
    const subtypeValue = subtype.options[1].value;
    fireEvent.change(subtype, { target: { value: subtypeValue } });
    fireEvent.click(screen.getByRole('radio', { name: 'High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Report This Hotspot' }));
    expect(submit).toHaveBeenLastCalledWith({
      address: 'Colfax, Denver',
      title: 'Curb ramp missing',
      description: 'No accessible crossing',
      category: 'accessibility',
      severity: 'high',
      accessibilitySubtype: subtypeValue,
      photoDataUrls: [],
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'speeding' },
    });
    expect(
      screen.queryByRole('combobox', { name: 'Accessibility Issue Type' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Report This Hotspot' }));
    expect(submit.mock.calls[1][0].accessibilitySubtype).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('accepts an image from file input or drop, ignores nonimages, and lets a user remove a preview', async () => {
    const submit = vi.fn();
    const { container } = render(<HotspotReportForm initialAddress="Denver" onSubmit={submit} />);
    const input = container.querySelector('input[type="file"]')!;
    const drop = screen.getByRole('button', { name: 'Upload photos by clicking or dragging' });
    const picker = vi.spyOn(input as HTMLInputElement, 'click');
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
    fireEvent.change(input, {
      target: {
        files: [
          new File(['hello'], 'notes.txt', { type: 'text/plain' }),
          new File(['photo'], 'one.png', { type: 'image/png' }),
        ],
      },
    });
    expect(await screen.findByRole('img', { name: 'Upload 1' })).toHaveAttribute(
      'src',
      'data:image/png;base64,cGhvdG8=',
    );
    fireEvent.drop(drop, {
      dataTransfer: { files: [new File(['second'], 'two.jpeg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByRole('img', { name: 'Upload 2' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(screen.queryByRole('img', { name: 'Upload 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Upload 1' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,c2Vjb25k',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Crossing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Report This Hotspot' }));
    expect(submit.mock.calls[0][0].photoDataUrls).toEqual(['data:image/jpeg;base64,c2Vjb25k']);
  });
});
