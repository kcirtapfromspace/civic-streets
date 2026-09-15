import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MapPage from '../MapPage';
const boundary = vi.hoisted(() => ({ mounted: vi.fn() }));
vi.mock('@/features/map/MapView', () => ({
  MapView: () => {
    boundary.mounted();
    return <div>Interactive map loaded</div>;
  },
}));
afterEach(cleanup);
it('loads the named map export after showing its placeholder', async () => {
  render(<MapPage />);
  expect(screen.getByText('Loading map experience...')).toBeInTheDocument();
  expect(await screen.findByText('Interactive map loaded')).toBeInTheDocument();
  expect(screen.queryByText('Loading map experience...')).not.toBeInTheDocument();
});
it('does not mount a late-loaded map after route navigation unmounts the page', async () => {
  boundary.mounted.mockClear();
  const { unmount } = render(<MapPage />);
  unmount();
  await act(() => vi.dynamicImportSettled());
  expect(boundary.mounted).not.toHaveBeenCalled();
});
