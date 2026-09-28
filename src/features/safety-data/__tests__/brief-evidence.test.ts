import { beforeEach, describe, expect, it } from 'vitest';
import { crashBriefEvidence, distanceMeters } from '../brief-evidence';
import { useSafetyDataStore } from '../safety-data-store';
import type { NormalizedCrash } from '@/lib/types/safety-data';
const location = { lat: 39.74, lng: -104.99, address: 'Denver' };
const crash: NormalizedCrash = { ...location, id: 'nearby', date: '2026-01-01', source: 'denver', modes: ['pedestrian'], severity: 'fatal', fatalities: 1, injuries: null };
beforeEach(() => useSafetyDataStore.setState({ ...useSafetyDataStore.getInitialState(), enabled: true, coverage: 'municipal', lastBounds: { north: 40, south: 39, east: -104, west: -105 }, sources: [{ sourceId: 'denver', status: 'loaded', count: 1, warnings: [] }], crashes: [crash] }));
describe('dated nearby evidence', () => {
  it('uses real distance at Denver latitude and includes provenance plus filter scope', () => {
    expect(distanceMeters(location, { ...location, lng: location.lng + 0.002 })).toBeLessThan(200);
    expect(distanceMeters(location, { ...location, lng: location.lng + 0.003 })).toBeGreaterThan(200);
    useSafetyDataStore.setState({ crashes: [crash, { ...crash, id: 'east', lng: location.lng + 0.002 }, { ...crash, id: 'far', lat: 40 }] });
    const evidence = crashBriefEvidence(location, useSafetyDataStore.getState())!;
    expect(evidence.summary).toContain('2 mapped records within 200 m');
    expect(evidence.details.join(' ')).toContain('not a risk estimate');
    expect(evidence.sources).toEqual([expect.objectContaining({ label: expect.stringContaining('Denver'), url: expect.stringContaining('https://') })]);
    expect(Date.parse(evidence.capturedAt)).not.toBeNaN();
  });
  it('captures incomplete source limits, dates, unavailable sources and a zero for selected filters only', () => {
    const state = useSafetyDataStore.getState();
    useSafetyDataStore.setState({ error: 'network', filters: { ...state.filters, modes: new Set(), severities: new Set(), dateRange: { start: '2026-01-01', end: '2026-02-01' } }, sources: [
      { sourceId: 'denver', status: 'partial', count: 1, warnings: ['Import delayed.'] },
      { sourceId: 'chi', status: 'error', count: 0, warnings: [] },
      { sourceId: 'unknown', status: 'loaded', count: 0, warnings: [] },
    ] });
    const evidence = crashBriefEvidence(location, useSafetyDataStore.getState())!;
    expect(evidence.summary).toContain('0 mapped records');
    expect(evidence.details.join(' ')).toMatch(/2026-01-01.*none.*incomplete.*Import delayed.*unavailable/);
  });
  it('excludes records hidden by severity or mode and preserves singular grammar', () => {
    const state = useSafetyDataStore.getState();
    useSafetyDataStore.setState({ crashes: [crash, { ...crash, severity: 'minor' }, { ...crash, modes: ['cyclist'] }], filters: { ...state.filters, modes: new Set(['pedestrian']), severities: new Set(['fatal']) } });
    expect(crashBriefEvidence(location, useSafetyDataStore.getState())!.summary).toContain('1 mapped record within');
  });
  it.each([{ enabled: false }, { isLoading: true }, { coverage: null }, { coverage: 'unsupported' as const }, { lastBounds: null }, { sources: [{ sourceId: 'denver', status: 'error' as const, count: 0, warnings: [] }] }])('does not turn unknown data into zero (%j)', (patch) => {
    expect(crashBriefEvidence(location, { ...useSafetyDataStore.getState(), ...patch })).toBeNull();
  });
  it.each([{ lat: 38, lng: -104.5 }, { lat: 41, lng: -104.5 }, { lat: 39.5, lng: -106 }, { lat: 39.5, lng: -103 }])('rejects a snapshot from another viewport (%j)', (point) => {
    expect(crashBriefEvidence({ ...point, address: '' }, useSafetyDataStore.getState())).toBeNull();
  });
});


it('does not imply zero crashes for a place outside the connected dataset boundary', () => {
  useSafetyDataStore.setState({ lastBounds: { north: 45, south: 30, east: -100, west: -110 }, crashes: [] });
  for (const point of [{lat: 35,lng:-104.99},{lat:42,lng:-104.99},{lat:39.74,lng:-109},{lat:39.74,lng:-101}]) {
    expect(crashBriefEvidence({...point,address:'Beyond the city'},useSafetyDataStore.getState())).toBeNull();
  }
});

it('records archive history scope as a snapshot rather than a live promise', () => {
  useSafetyDataStore.setState({ sources: [{ sourceId: 'denver', count: 1, warnings: [], status: 'loaded', history: { months: [], latestRecord: null, lastSuccess: null } }] });
  expect(crashBriefEvidence(location, useSafetyDataStore.getState())?.details.join(' ')).toContain('One-year archive; monthly imports.');
});
