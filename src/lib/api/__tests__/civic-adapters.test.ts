import { expect, it, vi } from 'vitest';
import { getOpen311Services, submitToOpen311 } from '../civic/open311';
import { getSeeClickFixCategories, matchCategory, submitToSeeClickFix } from '../civic/seeclickfix';
import { getCityDeepLink, getAllDeepLinkCities } from '../civic/deeplinks';
import { getIssueTypeConfig } from '@/lib/config/issue-types';

const input = {
  lat: 41.88,
  lng: -87.63,
  address: 'Chicago & Main',
  title: 'Curb ramp',
  description: 'Missing & blocked',
  category: 'accessibility',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

it('loads Open311 services and returns an empty list when the provider is unavailable', async () => {
  const services = [
    { service_code: 'ramp', service_name: 'Curb ramp', description: 'Access', type: 'realtime' },
  ];
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json(services))
    .mockResolvedValueOnce(json({}, 503))
    .mockRejectedValueOnce(new Error('Offline'));
  vi.stubGlobal('fetch', fetcher);
  expect(await getOpen311Services()).toEqual(services);
  expect(fetcher.mock.calls[0][0]).toContain('/services.json?jurisdiction_id=cityofchicago.org');
  expect(await getOpen311Services()).toEqual([]);
  expect(await getOpen311Services()).toEqual([]);
});

it.each([undefined, 'broken-signal', 'flooding', 'unknown-type'])(
  'encodes Open311 reports and resolves the service code for %s',
  async (issueType) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json([{ service_request_id: 'case-1', status: 'open' }]));
    vi.stubGlobal('fetch', fetcher);
    expect(await submitToOpen311({ ...input, issueType })).toEqual({
      success: true,
      trackingId: 'case-1',
      trackingUrl: 'https://311.chicago.gov/s/servicerequest/case-1',
    });
    const options = fetcher.mock.calls[0][1];
    expect(options.method).toBe('POST');
    const body = new URLSearchParams(options.body);
    expect(Object.fromEntries(body)).toEqual({
      jurisdiction_id: 'cityofchicago.org',
      service_code:
        (issueType && getIssueTypeConfig(issueType)?.open311Hint) || '4fd6e4ece750840569000019',
      lat: '41.88',
      long: '-87.63',
      address_string: input.address,
      description: `${input.title}\n\n${input.description}`,
    });
  },
);

it('retains a batch token without inventing a service-request URL', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(json([{ token: 'batch-token', service_request_id: '', status: 'open' }])),
  );
  expect(await submitToOpen311({ ...input, category: 'unmapped' })).toEqual({
    success: true,
    trackingId: 'batch-token',
    trackingUrl: undefined,
  });
});

it('reports Open311 HTTP errors, empty responses, and transport failures without claiming submission', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('Denied', { status: 403 }))
      .mockResolvedValueOnce(json([]))
      .mockRejectedValueOnce(new Error('Offline'))
      .mockRejectedValueOnce('unknown'),
  );
  expect(await submitToOpen311(input)).toEqual({
    success: false,
    error: 'Open311 API error: 403 — Denied',
  });
  expect(await submitToOpen311(input)).toEqual({
    success: false,
    error: 'No service request returned from Open311.',
  });
  expect(await submitToOpen311(input)).toEqual({
    success: false,
    error: 'Failed to submit to Open311: Offline',
  });
  expect(await submitToOpen311(input)).toEqual({
    success: false,
    error: 'Failed to submit to Open311: Unknown error',
  });
});

it.each([
  {},
  { service_request_id: '   ' },
  { service_request_id: {} },
  { service_request_id: false },
])(
  'does not claim a confirmed Open311 submission from a malformed receipt (%j)',
  async (receipt) => {
    const response = [receipt];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(response)));
    expect(await submitToOpen311(input)).toMatchObject({
      success: false,
      error: expect.stringContaining('Check Chicago 311'),
    });
  },
);

it('accepts numeric Open311 IDs and a blackbox service notice without inventing tracking', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(json([{ service_request_id: 293944 }]))
      .mockResolvedValueOnce(json([{ service_notice: 'The city will inspect this location.' }])),
  );
  expect(await submitToOpen311(input)).toEqual({
    success: true,
    trackingId: '293944',
    trackingUrl: 'https://311.chicago.gov/s/servicerequest/293944',
  });
  expect(await submitToOpen311(input)).toEqual({
    success: true,
    trackingId: undefined,
    trackingUrl: undefined,
  });
});

it('normalizes SeeClickFix category formats and handles malformed or unavailable discovery', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        json({
          request_types: [
            { id: 1, title: 'Sidewalk', description: 'Repair' },
            { id: 2, name: 'Ramp' },
            { id: 3 },
          ],
        }),
      )
      .mockResolvedValueOnce(json([{ id: 4, title: 'Road' }]))
      .mockResolvedValueOnce(json(null))
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new Error('Offline')),
  );
  expect(await getSeeClickFixCategories(1, 2)).toEqual([
    { id: 1, title: 'Sidewalk', description: 'Repair' },
    { id: 2, title: 'Ramp', description: '' },
    { id: 3, title: 'Unknown', description: '' },
  ]);
  expect(await getSeeClickFixCategories(1, 2)).toEqual([{ id: 4, title: 'Road', description: '' }]);
  expect(await getSeeClickFixCategories(1, 2)).toEqual([]);
  expect(await getSeeClickFixCategories(1, 2)).toEqual([]);
  expect(await getSeeClickFixCategories(1, 2)).toEqual([]);
});

it('matches specific issue keywords before legacy categories and falls back deterministically', () => {
  const categories = [
    { id: 1, title: 'General', description: '' },
    { id: 2, title: 'Curb Ramp', description: '' },
    { id: 3, title: 'Repair', description: 'Damaged SIDEWALK' },
  ];
  expect(matchCategory('other', categories, 'no-curb-ramp')).toEqual(categories[1]);
  expect(matchCategory('poor-sidewalk', categories, 'unknown-type')).toEqual(categories[2]);
  expect(matchCategory('unknown', categories)).toEqual(categories[0]);
  expect(matchCategory('needs-bike-lane', categories)).toEqual(categories[0]);
  expect(matchCategory('other', [])).toBeNull();
});

it('submits the matched request type and returns the provider tracking result', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ request_types: [{ id: 42, title: 'ADA' }] }))
    .mockResolvedValueOnce(json({ id: 123, html_url: 'https://seeclickfix.com/issues/123' }));
  vi.stubGlobal('fetch', fetcher);
  expect(await submitToSeeClickFix(input)).toEqual({
    success: true,
    trackingId: '123',
    trackingUrl: 'https://seeclickfix.com/issues/123',
  });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    summary: input.title,
    description: input.description,
    request_type_id: 42,
  });
});

it('omits an unavailable request type and reports submission failures', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json([]))
    .mockResolvedValueOnce(new Response('Denied', { status: 403 }))
    .mockResolvedValueOnce(json([]))
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(json([]))
    .mockRejectedValueOnce('unknown');
  vi.stubGlobal('fetch', fetcher);
  expect(await submitToSeeClickFix(input)).toEqual({
    success: false,
    error: 'SeeClickFix API error: 403 — Denied',
  });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).not.toHaveProperty('request_type_id');
  expect(await submitToSeeClickFix(input)).toEqual({
    success: false,
    error: 'Failed to submit to SeeClickFix: Offline',
  });
  expect(await submitToSeeClickFix(input)).toEqual({
    success: false,
    error: 'Failed to submit to SeeClickFix: Unknown error',
  });
});

it.each([{}, null, { id: -1 }, { id: 0 }, { id: 'undefined' }, { id: 1.5 }])(
  'does not claim a confirmed SeeClickFix submission without a valid issue ID (%j)',
  async (response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json(response)),
    );
    expect(await submitToSeeClickFix(input)).toMatchObject({
      success: false,
      error: expect.stringContaining('Check SeeClickFix'),
    });
  },
);

it('provides official portal links for every configured city and none outside coverage', () => {
  for (const city of getAllDeepLinkCities()) {
    const [south, west, north, east] = city.bounds;
    const link = getCityDeepLink((south + north) / 2, (west + east) / 2, 'Main & 1st', 'Curb ramp');
    expect(link?.city).toBe(city.name);
    expect(link?.url).toMatch(/^https:\/\//);
  }
  expect(getCityDeepLink(0, 0)).toBeNull();
});
