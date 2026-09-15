import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MapPage from '../MapPage';
vi.mock('@/features/map/MapView', () => {
  throw new Error('map bundle unavailable');
});
afterEach(cleanup);
it('keeps the page placeholder when the map bundle fails to load', async () => {
  render(<MapPage />);
  await act(() => vi.dynamicImportSettled());
  expect(screen.getByText('Loading map experience...')).toBeInTheDocument();
});
