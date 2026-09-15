// @vitest-environment node
import { inflateSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePDF } from './index';
import { adaptTemplate } from '@/lib/templates/adapter';
import { MOCK_TEMPLATES } from '@/features/gallery/mock-templates';
import type { StreetSegment, ValidationResult } from '@/lib/types';

const street = (): StreetSegment => ({
  ...adaptTemplate(MOCK_TEMPLATES[0], 66),
  name: 'Main Street',
  metadata: { createdAt: '2026-09-14T12:00:00Z', updatedAt: '2026-09-14T12:00:00Z' },
});
beforeEach(() => {
  // Yoga loads its bundled WASM via a data URL; supply those embedded bytes without network access.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.startsWith('data:application/octet-stream;base64,'))
        throw new Error(`Unexpected PDF resource request: ${url.slice(0, 100)}`);
      return new Response(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'), {
        headers: { 'content-type': 'application/wasm' },
      });
    }),
  );
});
// Inspect real PDF content streams, including deflated text operators, without mocking the renderer.
async function inspectPdf(blob: Blob) {
  const binary = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  expect(binary.startsWith('%PDF-')).toBe(true);
  expect(binary.trimEnd().endsWith('%%EOF')).toBe(true);
  const texts: string[] = [];
  for (const match of binary.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      content = match[1];
    }
    for (const text of content.matchAll(/<([a-f\d]+)>/gi))
      texts.push(Buffer.from(text[1], 'hex').toString('latin1'));
  }
  return {
    binary,
    text: texts
      .join('')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/\s+/g, ''),
  };
}

describe('real PDF report export', () => {
  it('produces a complete no-comparison document with its actual design and compliance summary', async () => {
    const current = street();
    const result = await inspectPdf(await generatePDF(current, null, []));
    expect(result.binary).toContain('/Count 5');
    expect(result.text).toContain('MainStreet');
    expect(result.text).toContain('All elements meet PROWAG and NACTO standards'.replace(/ /g, ''));
    expect(result.text).toContain('ConceptReport');
    expect(result.text).not.toContain('Before/AfterComparison');
  }, 15000);

  it('includes before/after changes and preserves error, warning and informational evidence', async () => {
    const current = street();
    current.direction = 'one-way';
    current.metadata.templateId = 'accessible-pilot';
    current.elements = current.elements
      .slice(0, 3)
      .map((e, i) => ({ ...e, label: i === 0 ? 'Accessible sidewalk' : undefined }));
    const before: StreetSegment = {
      ...current,
      elements: current.elements.map((e, i) => ({
        ...e,
        width: e.width + (i === 0 ? 1 : i === 1 ? -1 : 0),
      })),
    };
    before.elements.push({ ...current.elements[1], id: 'removed', label: undefined });
    const validation: ValidationResult[] = [
      {
        valid: false,
        severity: 'error',
        elementId: current.elements[0].id,
        constraint: 'prowag',
        message: 'Sidewalk too narrow',
        citation: 'PROWAG R302.3',
        currentValue: 3,
        requiredValue: 4,
      },
      {
        valid: false,
        severity: 'warning',
        elementId: current.elements[1].id,
        constraint: 'nacto',
        message: 'Recommended width unmet',
        citation: 'NACTO',
        currentValue: 4,
        requiredValue: 5,
      },
      {
        valid: true,
        severity: 'info',
        elementId: current.elements[2].id,
        constraint: 'dimensional',
        message: 'Planning guidance',
        citation: 'Planning',
        currentValue: 1,
        requiredValue: 1,
      },
    ];
    const result = await inspectPdf(await generatePDF(current, before, validation));
    expect(result.binary).toContain('/Count 6');
    for (const phrase of [
      'Before/AfterComparison',
      'Sidewalktoonarrow',
      'Recommendedwidthunmet',
      'Planningguidance',
      'PROWAGR302.3',
      'accessible-pilot',
      'FAIL',
      'WARN',
      'INFO',
      '(removed)',
    ])
      expect(result.text).toContain(phrase);
    expect(result.text).not.toContain('AllelementsmeetPROWAG');
    expect(result.text).toContain('+1.0');
    expect(result.text).toContain('-1.0');
  }, 15000);

  it('exports newly added elements and keeps recommendations separate from PROWAG failures', async () => {
    const current = street();
    const before = { ...current, elements: current.elements.slice(0, 1) };
    const result = await inspectPdf(await generatePDF(current, before, []));
    expect(result.text).toContain('Before/AfterComparison');
    expect(result.text).toContain('PROWAGCompliance');
    expect(result.text).toContain('PASS');
  }, 15000);
});
