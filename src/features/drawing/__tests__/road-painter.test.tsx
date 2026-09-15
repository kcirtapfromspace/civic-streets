import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DrawingLayer } from '../DrawingLayer';
import { useDrawingStore } from '@/stores/drawing-store';
import { MapFake, mouse } from '@/features/map/__tests__/map-fake';
const providers = vi.hoisted(() => ({ snap: vi.fn(), road: vi.fn(), reverse: vi.fn() }));
vi.mock('@/features/proposal/utils/road-snap', () => ({ snapToRoad: providers.snap }));
vi.mock('@/features/proposal/utils/road-geometry', () => ({ fetchRoadPath: providers.road }));
vi.mock('@/lib/api/geocoding', () => ({ reverseGeocodeLocation: providers.reverse }));
const path = [
  { lat: 39.7, lng: -104.9 },
  { lat: 39.701, lng: -104.9 },
  { lat: 39.702, lng: -104.9 },
];
beforeEach(() => {
  useDrawingStore.setState(useDrawingStore.getInitialState());
  providers.snap.mockReset().mockResolvedValue(path);
  providers.road.mockReset().mockResolvedValue({ path });
  providers.reverse.mockReset().mockResolvedValue({ road: 'Broadway' });
});
afterEach(cleanup);
async function start(map: MapFake) {
  await act(() => map.emit('mousedown', mouse()));
  await act(() => map.emit('mousemove', mouse(39.701)));
  await act(() => map.emit('mousemove', mouse(39.702)));
}
it('paints a free road with jitter filtering, selected geometry, and reversible Escape cancellation', async () => {
  const map = new MapFake();
  const { rerender, unmount } = render(<DrawingLayer map={null} />);
  act(() => useDrawingStore.getState().setActiveTool('newroad'));
  rerender(<DrawingLayer map={map.asMap()} />);
  expect(map.canvas.style.cursor).toBe('crosshair');
  await act(() => map.emit('mouseup'));
  await act(() => map.emit('mousemove', mouse()));
  await act(() => map.emit('mousedown', mouse(39.7, -104.9, 2)));
  expect(map.dragPan.disable).not.toHaveBeenCalled();
  await act(() => map.emit('mousedown', mouse()));
  await act(() => map.emit('mousemove', mouse(39.700001)));
  expect(map.getSource('road-painter-trail')!.setData).not.toHaveBeenCalled();
  await act(() => map.emit('mousemove', mouse(39.701)));
  await act(() => map.emit('mousemove', mouse(39.702)));
  expect(map.getSource('road-painter-trail')!.data.geometry.coordinates).toEqual(
    path.map((p) => [p.lng, p.lat]),
  );
  await act(() => map.emit('mouseup'));
  expect(providers.snap).not.toHaveBeenCalled();
  expect(useDrawingStore.getState()).toMatchObject({ selectedPath: path, isDragging: false });
  expect(map.getLayer('road-painter-selected-line')!.paint['line-color']).toBe('#8B5CF6');
  expect(map.getSource('road-painter-trail')).toBeUndefined();
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(useDrawingStore.getState().selectedPath).toEqual(path);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useDrawingStore.getState().selectedPath).toBeNull();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useDrawingStore.getState().activeTool).toBe('select');
  fireEvent.keyDown(window, { key: 'Escape' });
  unmount();
  expect(map.listeners.get('mousedown')?.size).toBe(0);
  expect(map.canvas.style.cursor).toBe('');
});
it('ignores too-short trails and cancels active drags using context menu and Escape', async () => {
  const map = new MapFake();
  useDrawingStore.getState().setActiveTool('road');
  render(<DrawingLayer map={map.asMap()} />);
  await act(() => map.emit('mousedown', mouse()));
  await act(() => map.emit('mouseup'));
  expect(useDrawingStore.getState().isDragging).toBe(false);
  expect(providers.snap).not.toHaveBeenCalled();
  await start(map);
  const context = mouse();
  await act(() => map.emit('contextmenu', context));
  expect(context.preventDefault).toHaveBeenCalled();
  expect(useDrawingStore.getState().selectedPath).toBeNull();
  expect(map.sources.size).toBe(0);
  await act(() => map.emit('contextmenu', mouse()));
  await start(map);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(map.dragPan.enable).toHaveBeenCalled();
  expect(useDrawingStore.getState().isDragging).toBe(false);
});
it.each(['named', 'unnamed', 'offline', 'snap-error'])(
  'snaps a road and handles %s providers',
  async (kind) => {
    if (kind === 'unnamed') providers.reverse.mockResolvedValue(null);
    if (kind === 'offline') providers.reverse.mockRejectedValue(new Error('offline'));
    if (kind === 'snap-error') providers.snap.mockRejectedValue(new Error('offline'));
    const map = new MapFake();
    useDrawingStore.getState().setActiveTool('road');
    render(<DrawingLayer map={map.asMap()} />);
    await start(map);
    await act(() => map.emit('mouseup'));
    expect(providers.snap).toHaveBeenCalledWith(path);
    expect(useDrawingStore.getState()).toMatchObject({
      selectedPath: path,
      isSnapping: false,
      streetName: kind === 'named' ? 'Broadway' : null,
    });
    expect(map.getLayer('road-painter-selected-line')!.paint['line-color']).toBe('#3B82F6');
  },
);
it('ignores a cancelled pending snap and does not let an earlier drag replace a newer selection', async () => {
  const map = new MapFake();
  useDrawingStore.getState().setActiveTool('road');
  render(<DrawingLayer map={map.asMap()} />);
  let finish!: (value: typeof path) => void;
  providers.snap.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await start(map);
  let pending!: Promise<void>;
  act(() => {
    pending = map.emit('mouseup');
  });
  expect(useDrawingStore.getState().isSnapping).toBe(true);
  act(() => useDrawingStore.getState().clear());
  await act(async () => {
    finish(path);
    await pending;
  });
  expect(useDrawingStore.getState().selectedPath).toBeNull();
  providers.snap.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await start(map);
  act(() => {
    pending = map.emit('mouseup');
  });
  act(() => useDrawingStore.getState().setActiveTool('newroad'));
  await start(map);
  await act(() => map.emit('mouseup'));
  const newest = useDrawingStore.getState().selectedPath;
  await act(async () => {
    finish([
      { lat: 1, lng: 2 },
      { lat: 2, lng: 3 },
    ]);
    await pending;
  });
  expect(useDrawingStore.getState().selectedPath).toBe(newest);
});
it('does not attach a late road name after clearing its selection', async () => {
  let finish!: (value: unknown) => void;
  providers.reverse.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const map = new MapFake();
  useDrawingStore.getState().setActiveTool('road');
  render(<DrawingLayer map={map.asMap()} />);
  await start(map);
  await act(() => map.emit('mouseup'));
  act(() => useDrawingStore.getState().clear());
  await act(async () => finish({ road: 'Old road' }));
  expect(useDrawingStore.getState().streetName).toBeNull();
});
it.each([false, true])(
  'selects an intersection, with optional road geometry failure=%s',
  async (failure) => {
    const map = new MapFake();
    if (failure) {
      providers.road.mockRejectedValueOnce(new Error('offline'));
      map.styleLoaded = false;
    }
    useDrawingStore.getState().setActiveTool('intersection');
    const { unmount } = render(<DrawingLayer map={map.asMap()} />);
    await act(() => map.emit('click', mouse()));
    expect(useDrawingStore.getState()).toMatchObject({
      intersectionCenter: path[0],
      isSnapping: false,
      streetName: failure ? null : 'Broadway',
    });
    expect(useDrawingStore.getState().selectedPath).toHaveLength(failure ? 2 : 3);
    if (!failure)
      expect(map.getSource('intersection-marker')!.data.geometry.coordinates).toEqual([
        -104.9, 39.7,
      ]);
    unmount();
    expect(map.sources.size).toBe(0);
    expect(map.listeners.get('click')?.size).toBe(0);
  },
);
it('ignores out-of-order intersection fetches and cancellation during reverse geocoding', async () => {
  const map = new MapFake();
  let finish!: (value: unknown) => void;
  providers.road.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  useDrawingStore.getState().setActiveTool('intersection');
  render(<DrawingLayer map={map.asMap()} />);
  let pending!: Promise<void>;
  act(() => {
    pending = map.emit('click', mouse());
  });
  await act(() => map.emit('click', mouse(40, -105)));
  const latest = useDrawingStore.getState().selectedPath;
  await act(async () => {
    finish({
      path: [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
      ],
    });
    await pending;
  });
  expect(useDrawingStore.getState().selectedPath).toBe(latest);
  providers.reverse.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    pending = map.emit('click', mouse());
    await Promise.resolve();
  });
  act(() => useDrawingStore.getState().clear());
  await act(async () => {
    finish({ road: 'Old intersection' });
    await pending;
  });
  expect(useDrawingStore.getState().streetName).toBeNull();
});
it('handles unloaded styles and cancels deferred selected layers when cleared', async () => {
  const map = new MapFake();
  map.styleLoaded = false;
  useDrawingStore.getState().setActiveTool('newroad');
  const { unmount } = render(<DrawingLayer map={map.asMap()} />);
  await start(map);
  await act(() => map.emit('mouseup'));
  expect(map.sources.size).toBe(0);
  act(() => useDrawingStore.getState().clear());
  await act(() => map.emit('styledata'));
  expect(map.sources.size).toBe(0);
  act(() => useDrawingStore.getState().setSelectedPath(path));
  await act(() => map.emit('styledata'));
  expect(map.getSource('road-painter-selected')).toBeDefined();
  map.layers.clear();
  map.sources.clear();
  map.styleLoaded = true;
  await act(() => map.emit('style.load'));
  expect(map.getSource('road-painter-selected')!.data.geometry.coordinates).toHaveLength(3);
  act(() => useDrawingStore.getState().setSelectedPath([path[0]]));
  expect(map.sources.size).toBe(0);
  unmount();
});

it('does not leave a snapping indicator active when the drawing surface unmounts', async () => {
  const map = new MapFake();
  let finish!: (value: typeof path) => void;
  providers.snap.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  useDrawingStore.getState().setActiveTool('road');
  const { unmount } = render(<DrawingLayer map={map.asMap()} />);
  await start(map);
  let pending!: Promise<void>;
  act(() => {
    pending = map.emit('mouseup');
  });
  expect(useDrawingStore.getState().isSnapping).toBe(true);
  unmount();
  expect(useDrawingStore.getState()).toMatchObject({ isSnapping: false, isDragging: false });
  await act(async () => {
    finish(path);
    await pending;
  });
  expect(useDrawingStore.getState().selectedPath).toBeNull();
});
it('keeps a second completed road when the first request later fails', async () => {
  const map = new MapFake();
  let reject!: (error: Error) => void;
  providers.snap.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  useDrawingStore.getState().setActiveTool('road');
  render(<DrawingLayer map={map.asMap()} />);
  await start(map);
  let first!: Promise<void>;
  act(() => {
    first = map.emit('mouseup');
  });
  await start(map);
  await act(() => map.emit('mouseup'));
  expect(useDrawingStore.getState().selectedPath).toBe(path);
  await act(async () => {
    reject(new Error('old request timed out'));
    await first;
  });
  expect(useDrawingStore.getState().selectedPath).toBe(path);
  expect(useDrawingStore.getState().streetName).toBe('Broadway');
});
