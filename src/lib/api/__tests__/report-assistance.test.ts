import { ConvexError } from 'convex/values';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestReportAssistance } from '../report-assistance';
import { ASSISTANCE_UNAVAILABLE } from '../../../../shared/report-assistance';

const { action, created } = vi.hoisted(() => ({ action: vi.fn(), created: vi.fn() }));
vi.mock('convex/browser', () => ({ ConvexHttpClient: class {
  constructor(url: string) { created(url); }
  action = action;
} }));
const input = { description: 'Curb ramp blocked', lat: 39.74, lng: -104.99 };
const result = { id: 'advice', suggestedIssueType: 'vehicle-blocking', followUps: [], relatedReports: [] };
beforeEach(() => {
  vi.stubEnv('VITE_CONVEX_URL', 'https://test.convex.cloud/');
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'session') });
  action.mockReset().mockResolvedValue(result); created.mockClear();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('report assistance client', () => {
  it('calls only the server action with the current session and draft', async () => {
    expect(await requestReportAssistance(input)).toEqual(result);
    expect(created).toHaveBeenCalledWith('https://test.convex.cloud');
    expect(getFunctionName(action.mock.calls[0][0])).toBe('reportAssistance:suggest');
    expect(action.mock.calls[0][1]).toEqual({ ...input, sessionToken: 'session' });
  });
  it('supports no-backend mode without making a network request', async () => {
    vi.stubEnv('VITE_CONVEX_URL', '');
    await expect(requestReportAssistance(input)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
    expect(action).not.toHaveBeenCalled();
  });
  it.each([false, true])('requires a session even when storage throws: %s', async (throws) => {
    vi.stubGlobal('localStorage', { getItem: () => { if (throws) throw new Error('disabled'); return null; } });
    await expect(requestReportAssistance(input)).rejects.toThrow('session is still getting ready');
    expect(action).not.toHaveBeenCalled();
  });
  it('preserves controlled errors and masks unexpected data and provider messages', async () => {
    action.mockRejectedValueOnce(new ConvexError('Suggestion limit reached.'));
    await expect(requestReportAssistance(input)).rejects.toThrow('Suggestion limit reached.');
    action.mockRejectedValueOnce(new Error('private server detail'));
    await expect(requestReportAssistance(input)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
    action.mockRejectedValueOnce(new ConvexError({ secret: 'private' }));
    await expect(requestReportAssistance(input)).rejects.toThrow(ASSISTANCE_UNAVAILABLE);
  });
});
