import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { BriefPreview } from './BriefPreview';
import type { DiscussionBriefContext } from '@/lib/types';
const context: DiscussionBriefContext = { concern: 'Blocked ramp', desiredOutcome: 'Clear access', requestedNextStep: 'Move sign', dimensionBasis: 'assumed', dimensionSource: '' };
afterEach(cleanup);
it('provides semantic readable brief fields, actual source and a frozen evidence snapshot', () => {
  render(<BriefPreview context={{ ...context, briefId: 'brief-42', revisedAt: '2026-09-27', sourceUrl: 'https://curbwise.org/hotspot/id', observation: { id: 'id', title: 'Ramp', description: 'Sign blocks path', lat: 39.74, lng: -104.99, address: 'Main Street', createdAt: 0, source: 'community', photoUrls: ['https://example.test/photo.jpg'] }, supportingEvidence: { title: 'Recorded crashes', summary: '3 records in the search area', capturedAt: '2026-09-27', details: ['Incomplete source coverage'], sources: [{ label: 'City source', url: 'https://example.test/source' }] } }} />);
  expect(screen.getByRole('article')).toHaveAccessibleName('Readable discussion brief');
  expect(screen.getByText('Move sign')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open source observation' })).toHaveAttribute('href', 'https://curbwise.org/hotspot/id');
  expect(screen.getByRole('img')).toHaveAccessibleName(/Observation photo 1/);
  expect(screen.getByText('Incomplete source coverage')).toBeInTheDocument();
  expect(screen.getByText(/Revision: 2026/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'City source' })).toHaveAttribute('href', 'https://example.test/source');
});
it('keeps blank fields honest, typed place without invented coordinates and unpublished evidence without a public link', () => {
  const view = render(<BriefPreview title="Typed corner" location={{ address: 'Outside the library' }} context={{ ...context, concern: '', desiredOutcome: '', requestedNextStep: '', briefId: 'private' }} />);
  expect(screen.getAllByText(/Not provided/)).toHaveLength(3);
  expect(screen.getByText('Outside the library')).toBeInTheDocument();
  expect(screen.queryByText(/0.00000/)).not.toBeInTheDocument();
  view.rerender(<BriefPreview context={{ ...context, sourceUrl: 'https://invalid.test', observation: { id: 'local', title: 'Fallback title', description: '', lat: 0, lng: 0, address: '', createdAt: 0, source: 'example', photoUrls: [] } }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByText('Fallback title')).toBeInTheDocument();
  expect(screen.getByText(/Unpublished or example/)).toBeInTheDocument();
});
