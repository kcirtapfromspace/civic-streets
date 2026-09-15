import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MapPage from '../MapPage';
vi.mock('@/features/map/MapView', () => ({ default: () => <div>Default map export loaded</div> }));
afterEach(cleanup);
it('supports a map bundle exposing its component as the default export', async () => {
  render(<MapPage />);
  expect(await screen.findByText('Default map export loaded')).toBeInTheDocument();
  expect(screen.queryByText('Loading map experience...')).not.toBeInTheDocument();
});
