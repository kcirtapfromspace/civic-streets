import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectCivicService,
  getCivicCategories,
  submitCivicReport,
  getCategoriesForCivicService,
  submitToCivicService,
  type CivicServiceTier,
} from '../civic-report';
import { getCityDeepLink } from '../civic/deeplinks';

const { submitToSeeClickFix, getSeeClickFixCategories, submitToOpen311, getOpen311Services } =
  vi.hoisted(() => ({
    submitToSeeClickFix: vi.fn(),
    getSeeClickFixCategories: vi.fn(),
    submitToOpen311: vi.fn(),
    getOpen311Services: vi.fn(),
  }));

vi.mock('../civic/seeclickfix', () => ({ submitToSeeClickFix, getSeeClickFixCategories }));
vi.mock('../civic/open311', () => ({ submitToOpen311, getOpen311Services }));

const denverReport = {
  lat: 39.7392,
  lng: -104.9903,
  address: 'Broadway & Colfax, Denver, CO',
  category: 'accessibility',
  title: 'Missing curb ramp',
  description: 'The crossing needs an accessible curb ramp.',
};
const denverPortal = 'https://www.denvergov.org/Online-Services-Hub/Report-an-Issue';

describe('civic reporting routes', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the official Denver portal without claiming submission or contacting an API', async () => {
    expect(detectCivicService(denverReport.lat, denverReport.lng)).toMatchObject({
      id: 'deeplink',
      name: 'Denver 311',
      city: 'Denver',
    });
    await expect(submitCivicReport(denverReport)).resolves.toEqual({
      success: false,
      deepLinkUrl: denverPortal,
    });
    await expect(getCivicCategories(denverReport.lat, denverReport.lng)).resolves.toEqual([]);
    expect(submitToSeeClickFix).not.toHaveBeenCalled();
    expect(getSeeClickFixCategories).not.toHaveBeenCalled();
    expect(submitToOpen311).not.toHaveBeenCalled();
    expect(getOpen311Services).not.toHaveBeenCalled();
  });

  it.each([
    [39.599, -104.99],
    [39.901, -104.99],
    [39.739, -105.101],
    [39.739, -104.799],
    [40.015, -105.271], // Boulder is outside the existing Denver routing hint.
  ])('does not expand Denver routing to %s, %s', (lat, lng) => {
    expect(detectCivicService(lat, lng)).toBeNull();
    expect(getCityDeepLink(lat, lng)).toBeNull();
  });

  it('preserves Chicago API submission', async () => {
    const report = { ...denverReport, lat: 41.8781, lng: -87.6298, address: 'Chicago, IL' };
    submitToOpen311.mockResolvedValue({ success: true, trackingId: 'chicago-case-1' });
    await expect(submitCivicReport(report)).resolves.toEqual({
      success: true,
      trackingId: 'chicago-case-1',
    });
    expect(submitToOpen311).toHaveBeenCalledWith(report);
    expect(submitToSeeClickFix).not.toHaveBeenCalled();
  });

  it('does not describe another city portal handoff as a submitted report', async () => {
    await expect(
      submitCivicReport({ ...denverReport, lat: 40.7128, lng: -74.006 }),
    ).resolves.toEqual({
      success: false,
      deepLinkUrl: 'https://portal.311.nyc.gov/sr-step1/',
    });
  });

  it('maps categories using the selected provider contract', async () => {
    getOpen311Services.mockResolvedValue([
      { service_code: 'ramp', service_name: 'Curb Ramp', description: 'Access' },
    ]);
    await expect(getCivicCategories(41.88, -87.63)).resolves.toEqual([
      { id: 'ramp', name: 'Curb Ramp', description: 'Access' },
    ]);
    getSeeClickFixCategories.mockResolvedValue([
      { id: 42, title: 'Pothole', description: 'Road repair' },
    ]);
    await expect(getCategoriesForCivicService('seeclickfix', 1, 2)).resolves.toEqual([
      { id: '42', name: 'Pothole', description: 'Road repair' },
    ]);
    expect(getSeeClickFixCategories).toHaveBeenCalledWith(1, 2);
    await expect(getCivicCategories(0, 0)).resolves.toEqual([]);
  });

  it('dispatches an explicitly configured SeeClickFix integration without changing city coverage', async () => {
    submitToSeeClickFix.mockResolvedValue({ success: true, trackingId: '42' });
    await expect(submitToCivicService('seeclickfix', denverReport)).resolves.toEqual({
      success: true,
      trackingId: '42',
    });
    expect(submitToSeeClickFix).toHaveBeenCalledWith(denverReport);
    expect(detectCivicService(denverReport.lat, denverReport.lng)?.id).toBe('deeplink');
  });

  it('fails clearly when neither an integration nor an official portal covers the location', async () => {
    const uncovered = { ...denverReport, lat: 0, lng: 0 };
    await expect(submitCivicReport(uncovered)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('No civic reporting service'),
    });
    await expect(submitToCivicService('deeplink', uncovered)).resolves.toEqual({
      success: false,
      error: 'No deep link available for this location.',
    });
    await expect(
      submitToCivicService('unsupported' as CivicServiceTier, uncovered),
    ).resolves.toEqual({ success: false, error: 'Unknown service tier.' });
  });
});
