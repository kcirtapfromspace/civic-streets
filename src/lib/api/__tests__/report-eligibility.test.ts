import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ connected: true, user: null as null | { reputation: number }, isLoading: false }));
vi.mock('../convex-provider', () => ({ get convexAvailable() { return fixture.connected; } }));
vi.mock('../auth', () => ({ useAuth: () => fixture }));
beforeEach(() => { vi.resetModules(); fixture.connected = true; fixture.user = null; fixture.isLoading = false; });
afterEach(cleanup);
it('reflects the current public reporter eligibility, including loading and unavailable sessions', async () => {
  const { usePhotoRequirement } = await import('../use-report-eligibility');
  const { result, rerender } = renderHook(usePhotoRequirement);
  expect(result.current).toBe('unavailable');
  fixture.isLoading = true; rerender(); expect(result.current).toBe('loading');
  fixture.isLoading = false; fixture.user = { reputation: 9 }; rerender(); expect(result.current).toBe('required');
  fixture.user = { reputation: 10 }; rerender(); expect(result.current).toBe('optional');
});
it('never requires a photo or an account for a demo observation', async () => {
  fixture.connected = false;
  const { usePhotoRequirement } = await import('../use-report-eligibility');
  expect(renderHook(usePhotoRequirement).result.current).toBe('optional');
});
