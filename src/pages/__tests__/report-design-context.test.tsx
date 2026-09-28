import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProposalStore } from '@/stores/proposal-store';
import ReportPage from '../ReportPage';
import { adaptTemplate } from '@/lib/templates/adapter';
import { MOCK_TEMPLATES } from '@/features/gallery/mock-templates';
const fixture = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/api/use-designs', () => ({ useDesignById: fixture.load }));
vi.mock('@/features/report/ReportBuilder', () => ({ ReportBuilder: ({ street, onClose }: {street: { name: string };onClose: () => void}) => <button onClick={onClose}>{street.name}</button> }));
const page = () => render(<MemoryRouter initialEntries={['/map', '/report/public-design']}><Routes><Route path="/map" element={<p>Back on map</p>} /><Route path="/report/:designId" element={<ReportPage />} /></Routes></MemoryRouter>);
beforeEach(() => fixture.load.mockReset());
afterEach(cleanup);
it.each(['loading', 'missing', 'error', 'unavailable'])('gives a truthful %s state before drafting from a design', (status) => {
  fixture.load.mockReturnValue({ id: 'public-design', status }); page();
  expect(fixture.load).toHaveBeenCalledWith('public-design');
  if (status === 'loading') expect(screen.getByRole('status')).toHaveTextContent('Loading the street concept');
  else expect(screen.getByRole('heading')).toHaveTextContent('Street concept unavailable');
});
it('requires the loaded concept location instead of borrowing an unrelated map address', () => {
  fixture.load.mockReturnValue({ id: 'public-design', status: 'ready', street: adaptTemplate(MOCK_TEMPLATES[0], 66), beforeStreet: null }); page();
  expect(screen.getByRole('heading')).toHaveTextContent('Add a location');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/editor/public-design');
});
it('passes actual loaded geometry for preparing a manual PDF attachment', () => {
  const street = { ...adaptTemplate(MOCK_TEMPLATES[0], 66), name: 'Loaded concept', location: { lat: 39.74, lng: -104.99, address: 'Denver' } };
  useProposalStore.setState({ afterStreet: street });
  fixture.load.mockReturnValue({ id: 'public-design', status: 'ready', street, beforeStreet: null }); page();
  expect(screen.getByRole('button')).toHaveTextContent('Loaded concept');
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Back on map')).toBeInTheDocument();
});
