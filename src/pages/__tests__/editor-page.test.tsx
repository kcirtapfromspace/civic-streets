import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EditorPage from '../EditorPage';
import { useStreetStore } from '@/stores/street-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { street } from '@/features/editor/__tests__/fixtures';
import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
vi.mock('@/lib/billing/access', () => ({
  useBillingAccess: () => ({ canAccess: false, contactHref: '/institutions' }),
}));
function view(path = '/editor') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/editor/:id?" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  useStreetStore.setState(useStreetStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useSafetyDataStore.setState(useSafetyDataStore.getInitialState());
});
afterEach(cleanup);
it('waits for the requested community design and shows the editor once its street is available', async () => {
  view('/editor/community-design');
  expect(screen.getByText('Loading design community-design...')).toBeInTheDocument();
  act(() => useStreetStore.getState().setStreet(street()));
  expect(
    await screen.findByRole('main', { name: 'Street cross-section editor' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Curbwise — Editing Broadway' })).toBeInTheDocument();
});
it('lets a resident create a street from the page entry point', async () => {
  view();
  expect(await screen.findByLabelText('Street Name')).toHaveValue('Main Street');
  fireEvent.change(screen.getByLabelText('Street Name'), { target: { value: 'Broadway' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Street' }));
  expect(
    await screen.findByRole('main', { name: 'Street cross-section editor' }),
  ).toBeInTheDocument();
  expect(useStreetStore.getState().currentStreet?.name).toBe('Broadway');
});
it('switches editor modes and runs an inline intersection review with a reset action', async () => {
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Intersection' }));
  expect(await screen.findByLabelText('Intersection Name')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Street Design' }));
  expect(await screen.findByLabelText('Street Name')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Intersection' }));
  fireEvent.change(screen.getByLabelText('Intersection Name'), {
    target: { value: '  Broadway & Colfax  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Start Intersection Review' }));
  expect(
    await screen.findByText('What does this intersection look like today?'),
  ).toBeInTheDocument();
  expect(useIntersectionStore.getState().intersectionName).toBe('Broadway & Colfax');
  fireEvent.click(screen.getByRole('button', { name: new RegExp(INTERSECTION_PRESETS[0].label) }));
  expect(
    await screen.findByRole('button', { name: /Continue with 0 improvements/ }),
  ).toBeDisabled();
  const improvement = screen
    .getAllByRole('button')
    .find((button) => button.textContent?.includes('Curb extensions'));
  expect(improvement).toBeDefined();
  fireEvent.click(improvement!);
  fireEvent.click(screen.getByRole('button', { name: /Continue with 1 improvement/ }));
  expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
  expect(useIntersectionStore.getState().step).toBe('review');
  fireEvent.click(screen.getByRole('button', { name: 'Reset intersection review' }));
  expect(screen.getByLabelText('Intersection Name')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Intersection Name'), { target: { value: ' ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start Intersection Review' }));
  expect(useIntersectionStore.getState().intersectionName).toBe('Unnamed Intersection');
});
