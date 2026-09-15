import { describe, expect, it } from 'vitest';
import {
  buildOutreachCopy,
  inferJurisdictionFromLocation,
  inferJurisdictionFromName,
  inferOrganizationTypeFromPopulationBand,
  isSignedCoverageStatus,
  normalizePhone,
  normalizeWorkEmail,
  slugifyGovernmentName,
} from './governmentShared';

describe('government jurisdiction inference and outreach copy', () => {
  it.each([
    ['Portland, OR', 45.5, -122.7, 'portland-or'],
    ['Chicago, IL', 41.8, -87.6, 'chicago-il'],
    ['Denver, CO', 39.7, -104.9, 'denver-co'],
    ['New York City', 40.7, -74, 'new-york-ny'],
  ])(
    'infers %s from coordinates and alias without inventing a signed partnership',
    (address, lat, lng, slug) => {
      const inferred = inferJurisdictionFromLocation({ address: '', lat, lng });
      expect(inferred.slug).toBe(slug);
      expect(inferred.officialWebsiteUrl).toMatch(/^https:/);
      expect(inferJurisdictionFromLocation({ address, lat: 0, lng: 0 }).slug).toBe(slug);
      expect(inferJurisdictionFromName(address).slug).toBe(slug);
      inferred.directoryUrls.length = 0;
      expect(inferJurisdictionFromName(address).directoryUrls.length).toBeGreaterThan(0);
    },
  );

  it('handles unseeded addresses, unknown municipalities and population-dependent jurisdiction types', () => {
    expect(
      inferJurisdictionFromLocation({ address: '12 Main St, Boulder, CO 80301', lat: 0, lng: 0 }),
    ).toMatchObject({ displayName: 'Boulder, CO', stateCode: 'CO', officialWebsiteUrl: null });
    expect(inferJurisdictionFromLocation({ address: 'Town', lat: 0, lng: 0 })).toMatchObject({
      displayName: 'Town',
      stateCode: null,
    });
    expect(inferJurisdictionFromLocation({ address: ' ', lat: 0, lng: 0 }).displayName).toBe(
      'Unknown municipality',
    );
    expect(inferJurisdictionFromName('Small Town, CO', 'under_50k')).toMatchObject({
      jurisdictionType: 'town',
      stateCode: 'CO',
    });
    expect(inferJurisdictionFromName('Unnamed')).toMatchObject({
      jurisdictionType: 'city',
      stateCode: null,
    });
    expect(inferOrganizationTypeFromPopulationBand('under_50k')).toBe('town');
    expect(inferOrganizationTypeFromPopulationBand(undefined)).toBe('city');
    expect(slugifyGovernmentName('  A Town!!! ')).toBe('a-town');
    expect(slugifyGovernmentName('a'.repeat(100))).toHaveLength(64);
  });

  it('normalizes contacts and recognizes only pilot/active coverage as signed', () => {
    expect(normalizeWorkEmail(' Jane@Town.gov ')).toBe('jane@town.gov');
    expect(normalizePhone('+1 (303) 555-0100')).toBe('13035550100');
    for (const value of [null, undefined, '', 'letters']) expect(normalizePhone(value)).toBeNull();
    for (const status of [null, undefined, '', 'outreach', 'paused', 'unsigned', 'unknown'])
      expect(isSignedCoverageStatus(status)).toBe(false);
    for (const status of ['pilot', 'active']) expect(isSignedCoverageStatus(status)).toBe(true);
  });

  it('builds an explicit outreach draft with appropriate office fallback and support count', () => {
    const hotspot = {
      title: 'Curb ramp',
      description: 'Wheelchair access blocked',
      category: 'accessibility',
      address: 'Main Street',
      lat: 0,
      lng: 0,
    };
    const city = buildOutreachCopy({
      coverageName: 'Town',
      sourceAction: 'report_to_city',
      hotspot,
      officeTargets: [],
    });
    expect(city.subject).toContain('Street safety report');
    expect(city.body).toContain('0 votes');
    expect(city.body).toContain('transportation and council teams');
    const rep = buildOutreachCopy({
      coverageName: 'Town',
      sourceAction: 'send_to_rep',
      hotspot: { ...hotspot, upvotes: 9 },
      officeTargets: ['Council', 'Public works'],
    });
    expect(rep.subject).toContain('Representative outreach');
    expect(rep.body).toContain('9 votes');
    expect(rep.body).toContain('Council, Public works');
    expect(rep.summary).toContain('municipal onboarding outreach');
  });
});
