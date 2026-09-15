import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InstitutionalDashboard } from './InstitutionalDashboard';
import InstitutionalDashboardPage from '@/pages/InstitutionalDashboardPage';

const { query, areas, reports } = vi.hoisted(() => ({
  query: vi.fn(),
  areas: vi.fn(),
  reports: vi.fn(),
}));
vi.mock('convex/react', () => ({ useQuery: query }));
vi.mock('@/lib/api/use-service-areas', () => ({
  useServiceAreas: areas,
  useHotspotsByServiceArea: reports,
}));
const organization = { _id: 'org-denver', name: 'Denver Streets' };
const serviceAreas = [
  { _id: 'school-route', name: 'School routes' },
  { _id: 'downtown', name: 'Downtown' },
];
const now = Date.now();
const ages = [30_000, 5 * 60_000, 2 * 3_600_000, 5 * 86_400_000, 60 * 86_400_000];
const hotspots = ages.map((age, index) => ({
  _id: `h${index}`,
  title: `Report ${index}`,
  description: 'Crossing concern',
  category: index === 4 ? 'new-category' : 'accessibility',
  severity: ['critical', 'high', 'medium', 'low', 'unclassified'][index],
  status: ['open', 'acknowledged', 'in-progress', 'resolved', 'new-status'][index],
  address: 'Denver',
  lat: 39.74,
  lng: -104.99,
  upvotes: index,
  commentCount: index,
  createdAt: now - age,
  photoUrls: index === 0 ? ['https://example.test/photo.jpg'] : undefined,
}));
function DashboardRoute() {
  return (
    <MemoryRouter initialEntries={['/institutional/denver-streets']}>
      <Routes>
        <Route path="/institutional/:orgSlug" element={<InstitutionalDashboardPage />} />
        <Route path="/hotspot/:id" element={<h1>Selected report</h1>} />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  query.mockReturnValue(organization);
  areas.mockReturnValue(serviceAreas);
  reports.mockReturnValue(hotspots);
});
afterEach(cleanup);

describe('institutional community report dashboard', () => {
  it('sorts actual reports newest first, summarizes their categories and severity, and links to report details', () => {
    reports.mockReturnValue([...hotspots].reverse());
    render(<DashboardRoute />);
    expect(screen.getByRole('heading', { name: 'Denver Streets Dashboard' })).toBeInTheDocument();
    expect(areas).toHaveBeenCalledWith('org-denver');
    expect(reports).toHaveBeenCalledWith('school-route');
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .filter((heading) => heading.textContent?.startsWith('Report'))
        .map((heading) => heading.textContent),
    ).toEqual(['Report 0', 'Report 1', 'Report 2', 'Report 3', 'Report 4']);
    for (const age of ['just now', '5m ago', '2h ago', '5d ago', '2mo ago'])
      expect(screen.getByText(age)).toBeInTheDocument();
    expect(screen.getByText('Total Reports').parentElement).toHaveTextContent('5');
    expect(screen.getByText('This Week').parentElement).toHaveTextContent('4');
    expect(screen.getByRole('heading', { name: 'By Category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By Severity' })).toBeInTheDocument();
    expect(screen.getAllByText('new category')).toHaveLength(2);
    expect(screen.getByText('unclassified')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /^Report 0 / }));
    expect(screen.getByRole('heading', { name: 'Selected report' })).toBeInTheDocument();
  });
  it('changes service areas and distinguishes report loading from a confirmed empty area', () => {
    reports.mockReturnValue(undefined);
    const { rerender } = render(<DashboardRoute />);
    expect(screen.getByText('Loading reports...')).toBeInTheDocument();
    expect(screen.queryByText('No community reports yet')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'downtown' } });
    expect(reports).toHaveBeenLastCalledWith('downtown');
    reports.mockReturnValue([]);
    rerender(<DashboardRoute />);
    expect(screen.getByText('No community reports yet')).toBeInTheDocument();
    expect(screen.getByText('0 reports')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'By Category' })).not.toBeInTheDocument();
    reports.mockReturnValue([hotspots[0]]);
    rerender(<DashboardRoute />);
    expect(screen.getByText('1 report')).toBeInTheDocument();
  });
  it('shows the loading skeleton while service areas resolve and supports an explicit organization override', () => {
    areas.mockReturnValue(undefined);
    const { container, rerender } = render(
      <MemoryRouter>
        <InstitutionalDashboard organizationId="provided-org" />
      </MemoryRouter>,
    );
    expect(areas).toHaveBeenCalledWith('provided-org');
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('No community reports yet')).not.toBeInTheDocument();
    areas.mockReturnValue([]);
    reports.mockReturnValue([]);
    query.mockReturnValue(null);
    rerender(
      <MemoryRouter>
        <InstitutionalDashboard organizationId="provided-org" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Organization Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('uses a readable route name before organization details are available and skips empty area queries', () => {
    query.mockReturnValue(null);
    areas.mockReturnValue([]);
    reports.mockReturnValue([]);
    render(<DashboardRoute />);
    expect(screen.getByRole('heading', { name: 'Denver Streets Dashboard' })).toBeInTheDocument();
    expect(areas).toHaveBeenCalledWith(undefined);
    expect(reports).toHaveBeenCalledWith(undefined);
  });
});
