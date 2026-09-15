import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedAreas, promptAndSaveArea, saveArea } from '../SavedAreas';
import { MobileMapDrawer } from '../MobileMapDrawer';
import { SearchThisArea } from '../SearchThisArea';

const storedAreas = new Map<string, string>();
const storage = {
  getItem: (key: string) => storedAreas.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storedAreas.set(key, value);
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('saved area persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
    render(<SavedAreas onApply={() => {}} />);
    for (const button of screen.queryAllByRole('button', { name: '✕' })) fireEvent.click(button);
    cleanup();
  });
  it('stores an area, immediately exposes it to mounted views, and deletes without applying it', () => {
    const apply = vi.fn();
    render(<SavedAreas onApply={apply} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const area = {
      name: 'School route',
      bounds: { minLat: 39.7, maxLat: 39.8, minLng: -105, maxLng: -104.9 },
    };
    act(() => {
      expect(saveArea(area)).toBe(true);
    });
    expect(JSON.parse(localStorage.getItem('curbwise-saved-areas')!)).toEqual([area]);
    fireEvent.click(screen.getByRole('button', { name: 'School route✕' }));
    expect(apply).toHaveBeenCalledWith(area);
    apply.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('curbwise-saved-areas')!)).toEqual([]);
  });
  it('requires a nonblank name and preserves a drawn polygon through the prompt flow', () => {
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('   ')
      .mockReturnValueOnce('  Park path  ');
    const polygon: [number, number][] = [
      [-105, 39.7],
      [-104.9, 39.7],
      [-105, 39.8],
    ];
    expect(promptAndSaveArea({ polygon })).toBe(false);
    expect(promptAndSaveArea({ polygon })).toBe(false);
    expect(promptAndSaveArea({ polygon })).toBe(true);
    expect(prompt).toHaveBeenCalledWith('Name this area:');
    expect(JSON.parse(localStorage.getItem('curbwise-saved-areas')!)).toEqual([
      { name: 'Park path', polygon },
    ]);
  });
  it('keeps existing saved areas when the ten-area limit is reached', () => {
    for (let index = 0; index < 10; index++) expect(saveArea({ name: `Area ${index}` })).toBe(true);
    expect(saveArea({ name: 'Overflow' })).toBe(false);
    expect(JSON.parse(localStorage.getItem('curbwise-saved-areas')!)).toHaveLength(10);
  });
});

describe('mobile map drawer', () => {
  it('opens at half height, snaps a drag to the nearest height, and resets on reopen', () => {
    vi.stubGlobal('innerHeight', 1000);
    const close = vi.fn();
    const { container, rerender } = render(
      <MobileMapDrawer open={false} onClose={close}>
        Map content
      </MobileMapDrawer>,
    );
    expect(screen.queryByText('Map content')).not.toBeInTheDocument();
    rerender(
      <MobileMapDrawer open onClose={close}>
        Map content
      </MobileMapDrawer>,
    );
    const drawer = screen.getByRole('button', { name: 'Close map' }).parentElement!;
    const handle = drawer.firstElementChild!;
    expect(drawer).toHaveStyle({ transform: 'translateY(50%)' });
    fireEvent.touchMove(handle, { touches: [{ clientY: 50 }] });
    fireEvent.touchEnd(handle);
    expect(drawer).toHaveStyle({ transform: 'translateY(50%)' });
    fireEvent.touchStart(handle, { touches: [{ clientY: 500 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 120 }] });
    fireEvent.touchEnd(handle);
    expect(Number(drawer.style.transform.match(/[\d.]+/)?.[0])).toBeCloseTo(10);
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.click(container.firstElementChild!);
    expect(close).toHaveBeenCalledTimes(2);
    rerender(<MobileMapDrawer open={false} onClose={close} />);
    rerender(<MobileMapDrawer open onClose={close} />);
    expect(screen.getByRole('button', { name: 'Close map' }).parentElement).toHaveStyle({
      transform: 'translateY(50%)',
    });
    vi.unstubAllGlobals();
  });
  it('closes after a downward drag below the dismissal threshold', () => {
    vi.stubGlobal('innerHeight', 1000);
    const close = vi.fn();
    render(<MobileMapDrawer open onClose={close} />);
    const handle = screen.getByRole('button', { name: 'Close map' }).parentElement!
      .firstElementChild!;
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 700 }] });
    fireEvent.touchEnd(handle);
    expect(close).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it('only offers a viewport search after the map requests one', () => {
    const search = vi.fn();
    const { rerender } = render(<SearchThisArea visible={false} onSearch={search} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<SearchThisArea visible onSearch={search} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search this area' }));
    expect(search).toHaveBeenCalledOnce();
  });
});
