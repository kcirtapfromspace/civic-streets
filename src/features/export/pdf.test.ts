// @vitest-environment node
import { inflateSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateObservationPDF, generatePDF } from './index';
import { adaptTemplate } from '@/lib/templates/adapter';
import { MOCK_TEMPLATES } from '@/features/gallery/mock-templates';
import type { DiscussionBriefContext, StreetSegment, ValidationResult } from '@/lib/types';

const street = (): StreetSegment => ({
  ...adaptTemplate(MOCK_TEMPLATES[0], 66),
  name: 'Main Street',
  metadata: { createdAt: '2026-09-14T12:00:00Z', updatedAt: '2026-09-14T12:00:00Z' },
});
const context = (): DiscussionBriefContext => ({
  concern: 'The narrow sidewalk makes passing difficult.',
  desiredOutcome: 'More room for people walking or using a wheelchair.',
  requestedNextStep: 'Please walk the block with our neighborhood group.',
  dimensionBasis: 'estimated',
  dimensionSource: 'Rough estimate from a neighborhood walk.',
  observation: {
    id: 'observation-1', title: 'A difficult sidewalk', description: 'People step into the road to pass.',
    lat: 39.75, lng: -104.99, address: 'Main Street at First Avenue', photoUrls: [],
    createdAt: Date.parse('2026-09-14T12:00:00Z'), source: 'community',
  },
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
beforeEach(() => {
  // Yoga's bundled WASM and evidence images use isolated fixtures; no network is permitted.
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith('data:application/octet-stream;base64,')) {
      return new Response(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'), {
        headers: { 'content-type': 'application/wasm' },
      });
    }
    if (url === 'https://photos.example/sidewalk.png') return new Response(png, { headers: { 'content-type': 'image/png' } });
    if (url === 'https://photos.example/expired.png') return new Response(null, { status: 404 });
    throw new Error(`Unexpected PDF resource request: ${url.slice(0, 100)}`);
  }));
});

// Inspect the real renderer's PDF text streams rather than replacing the document with a mock.
async function inspectPdf(blob: Blob) {
  const binary = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  expect(binary.startsWith('%PDF-')).toBe(true);
  expect(binary.trimEnd().endsWith('%%EOF')).toBe(true);
  const texts: string[] = [];
  for (const match of binary.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try { content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); }
    catch { content = match[1]; }
    for (const text of content.matchAll(/<([a-f\d]+)>/gi)) texts.push(Buffer.from(text[1], 'hex').toString('latin1'));
  }
  return { binary, text: texts.join('').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, '') };
}

function includesText(text: string, phrases: string[]) {
  for (const phrase of phrases) expect(text).toContain(phrase.replace(/\s+/g, ''));
}

describe('real discussion brief export', () => {
  it('keeps legacy calls usable and states missing context and limited check scope', async () => {
    const result = await inspectPdf(await generatePDF(street(), null, []));
    includesText(result.text, ['Discussion brief', 'Main Street', 'The concern', 'Not provided.',
      'No linked observation supplied.', 'Existing-condition dimension basis: Assumed.', 'No before layout supplied.',
      'No findings were reported by the selected dimensional checks.', 'not a count of checks performed',
      'Still to be assessed', 'Local requirements', 'broader accessibility', 'not a comprehensive engineering']);
    expect(result.text).not.toContain('PASS');
    expect(result.text).not.toContain('StandardsCompliance');
    expect(result.text).not.toContain('proposedrule');
    expect(result.text.indexOf('Theconcern')).toBeLessThan(result.text.indexOf('After'));
    expect(result.text.indexOf('After')).toBeLessThan(result.text.indexOf('Selecteddimensionalchecks'));
  }, 15000);

  it('preserves concern, provenance, photos and requested next step ahead of diagrams and findings', async () => {
    const current = street();
    current.direction = 'one-way';
    current.metadata.templateId = 'accessible-pilot';
    current.elements = current.elements.slice(0, 3).map((element, index) => ({ ...element, label: index === 0 ? 'Accessible sidewalk' : undefined }));
    const before: StreetSegment = {
      ...current,
      elements: current.elements.map((element, index) => ({ ...element, width: element.width + (index === 0 ? 1 : index === 1 ? -1 : 0) })),
    };
    const brief = context();
    brief.observation!.photoUrls = ['https://photos.example/sidewalk.png', 'https://photos.example/expired.png', 'https://photos.example/expired.png', 'https://photos.example/not-fetched.png'];
    brief.dimensionBasis = 'measured';
    const validation: ValidationResult[] = [
      { valid: false, severity: 'error', elementId: current.elements[0].id, constraint: 'prowag', message: 'Sidewalk too narrow', citation: 'PROWAG R302.3', currentValue: 3, requiredValue: 4 },
      { valid: false, severity: 'warning', elementId: current.elements[1].id, constraint: 'nacto', message: 'Recommended width unmet', citation: 'NACTO', currentValue: 4, requiredValue: 5 },
      { valid: true, severity: 'info', elementId: current.elements[2].id, constraint: 'dimensional', message: 'Planning guidance', citation: 'Planning', currentValue: 1, requiredValue: 1 },
    ];
    const result = await inspectPdf(await generatePDF(current, before, validation, brief));
    includesText(result.text, ['The narrow sidewalk makes passing difficult.', 'More room for people walking',
      'Please walk the block', 'Main Street at First Avenue', '39.75000, -104.99000', 'Community observation',
      'observation-1', 'September 14, 2026', 'People step into the road', 'Observation photo 1',
      'Observation photo 2 unavailable', 'additional photos remain', 'Existing-condition dimension basis: Measured',
      'Curbwise has not verified the measurements', 'Rough estimate from a neighborhood walk.',
      'Before', 'After', 'Space allocation changes', '+1.0 ft', '-1.0 ft',
      '1 errors', '1 warnings', '1 guidance notes', 'Sidewalk too narrow', 'Recommended width unmet',
      'Planning guidance', 'PROWAG R302.3', 'accessible-pilot']);
    expect(result.binary).toContain('/Subtype /Image');
    expect(result.text.indexOf('Pleasewalktheblock')).toBeLessThan(result.text.indexOf('Spaceallocationchanges'));
    expect(fetch).not.toHaveBeenCalledWith('https://photos.example/not-fetched.png', expect.anything());
    expect(result.text).not.toContain('PASS');
  }, 15000);

  it('exports an evidence-only brief with clearly labeled example evidence and no fake geometry', async () => {
    const brief = context();
    brief.observation!.source = 'example';
    const result = await inspectPdf(await generateObservationPDF(brief));
    includesText(result.text, ['A difficult sidewalk', 'Example observation', 'Not a verified community submission',
      'No photos attached.', 'Evidence-only brief.', 'No street geometry or standards checks are included.',
      'does not submit a request to an agency']);
    expect(result.text).not.toContain('Dimensionbasis');
    expect(result.text).not.toContain('Selecteddimensionalchecks');
    expect(result.text).not.toContain('After');
    expect(result.binary).toContain('/Count 1');
  }, 15000);

  it('retains draft provenance, handles unavailable dates and notes, and distinguishes unchanged allocation', async () => {
    const current = street();
    const brief = context();
    brief.observation = { ...brief.observation!, source: 'browser-session', createdAt: NaN, address: '', description: '' };
    const result = await inspectPdf(await generatePDF(current, current, [], brief));
    includesText(result.text, ['Browser-session observation', 'Not a published community submission', 'Date unavailable',
      'Address not provided', 'No original notes supplied', 'Existing-condition dimension basis: Estimated',
      'No width allocation changes by element type']);
  }, 15000);

  it('supports an unlinked brief and uses street location without inventing a concern', async () => {
    const current = street();
    current.location = { lat: 41.9, lng: -87.7, address: 'Test block' };
    const brief = { ...context(), observation: undefined, concern: '  ', dimensionSource: '' };
    const result = await inspectPdf(await generatePDF(current, null, [], brief));
    includesText(result.text, ['Test block', '41.90000, -87.70000', 'The concernNot provided.', 'Source or method: Not provided.']);
    const evidence = await inspectPdf(await generateObservationPDF(brief));
    includesText(evidence.text, ['Street concern', 'No linked observation supplied']);
  }, 15000);

  it('refuses misleading proportional diagrams when widths are invalid or absent', async () => {
    const current = street();
    current.elements[0].width = -1;
    const before = { ...street(), elements: [] };
    const result = await inspectPdf(await generatePDF(current, before, []));
    expect(result.text.match(/Diagramunavailable/g)).toHaveLength(2);
    includesText(result.text, ['every element needs a positive, finite width', 'Width', '-1 ft']);
  }, 15000);
  it('keeps private text-first places, brief revisions and optional evidence without invented coordinates', async () => {
    const brief = { ...context(), observation: undefined, briefId: 'private-42', revisedAt: '2026-09-27T10:00:00Z', supportingEvidence: { title: 'Recorded crash snapshot', capturedAt: '2026-09-27', summary: '3 records in the search area', details: ['Coverage is incomplete'], sources: [{ label: 'City source', url: 'https://example.test/crashes' }] } };
    const result = await inspectPdf(await generateObservationPDF(brief, { name: 'Library entrance', address: 'Outside the library' }));
    includesText(result.text, ['Library entrance', 'Outside the library', 'private-42', 'Revision:', 'Recorded crash snapshot', '3 records', 'Coverage is incomplete', 'City source']);
    expect(result.text).not.toContain('0.00000');
    expect(result.binary).toContain('https://example.test/crashes');
  }, 15000);
  it('includes a public source link only for published evidence and repeats the header on overflow pages', async () => {
    const brief = { ...context(), briefId: 'brief-42', sourceUrl: 'https://curbwise.org/hotspot/observation-1', concern: 'A long observation with details. '.repeat(150) };
    const result = await inspectPdf(await generateObservationPDF(brief));
    expect(result.binary).toContain('https://curbwise.org/hotspot/observation-1');
    expect((result.text.match(/DiscussionbriefCurbwise/g) || []).length).toBeGreaterThan(1);
    brief.observation!.source = 'browser-session';
    const unpublished = await inspectPdf(await generateObservationPDF(brief));
    expect(unpublished.binary).not.toContain('https://curbwise.org/hotspot/observation-1');
  }, 15000);
  it('does not turn incomplete validation into a no-findings claim', async () => {
    const result = await inspectPdf(await generatePDF(street(), null, [], undefined, 'error'));
    includesText(result.text, ['Checks not completed', 'No compliance assessment is available']);
    expect(result.text).not.toContain('Nofindingswerereported');
    expect(result.text).not.toContain('Reportedfindings:');
  }, 15000);

});
