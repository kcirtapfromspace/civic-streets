import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EditorPage from '../EditorPage';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useStreetStore } from '@/stores/street-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { street } from '@/features/editor/__tests__/fixtures';
import { useDesignById, type DesignLoadResult } from '@/lib/api/use-designs';
import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
const design = vi.hoisted(() => ({ result: { id: 'community-design', status: 'unavailable' } as DesignLoadResult }));
vi.mock('@/lib/api/use-designs', () => ({ useDesignById: vi.fn(() => design.result) }));
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
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  design.result = { id: 'community-design', status: 'unavailable' };
  useStreetStore.setState(useStreetStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useSafetyDataStore.setState(useSafetyDataStore.getInitialState());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('loads the requested community concept instead of showing an unrelated existing street', async () => {
  useStreetStore.getState().setStreet({ ...street(), id: 'unrelated', name: 'Unrelated local work' });
  design.result = { id: 'community-design', status: 'ready', street: street(), beforeStreet: { ...street(), name: 'Before' } };
  view('/editor/community-design');
  expect(await screen.findByRole('region', { name: 'Street cross-section editor' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Curbwise — Editing Broadway' })).toBeInTheDocument();
  expect(useStreetStore.getState().beforeStreet?.name).toBe('Before');
  expect(screen.queryByText(/Unrelated local work/)).not.toBeInTheDocument();
});
it.each(['loading', 'missing', 'error', 'unavailable'] as const)('explains %s links without exposing a stale local design', (status) => {
  useStreetStore.getState().setStreet(street());
  design.result = { id: 'community-design', status };
  view('/editor/community-design');
  expect(screen.queryByRole('region', { name: 'Street cross-section editor' })).not.toBeInTheDocument();
  if (status === 'loading') expect(screen.getByRole('status')).toHaveTextContent('Loading shared street concept');
  else {
    expect(screen.getByRole('heading', { name: 'This street concept is unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open local editor' })).toHaveAttribute('href', '/editor');
    expect(screen.getByRole('link', { name: 'Return to map' })).toHaveAttribute('href', '/map');
    if (status === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(useDesignById).toHaveBeenLastCalledWith('community-design', 1);
    }
  }
});
it('lets a resident create a street from the page entry point', async () => {
  view();
  expect(await screen.findByLabelText('Street Name')).toHaveValue('Main Street');
  fireEvent.change(screen.getByLabelText('Street Name'), { target: { value: 'Broadway' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Street' }));
  expect(
    await screen.findByRole('region', { name: 'Street cross-section editor' }),
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
  expect(useIntersectionStore.getState().center).toBeNull();
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
  expect(await screen.findByRole('button', { name: 'Save and finish' })).toBeInTheDocument();
  expect(useIntersectionStore.getState().step).toBe('review');
  fireEvent.click(screen.getByRole('button', { name: 'Reset intersection review' }));
  expect(screen.getByLabelText('Intersection Name')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Intersection Name'), { target: { value: ' ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start Intersection Review' }));
  expect(useIntersectionStore.getState().intersectionName).toBe('Unnamed Intersection');
});

it('keeps an intersection open when its latest work cannot be saved', async () => {
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Intersection' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start Intersection Review' }));
  const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage is full'); });
  fireEvent.click(await screen.findByRole('button', { name: 'Reset intersection review' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
  expect(useIntersectionStore.getState().intersectionName).toBe('Unnamed Intersection');
  save.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Reset intersection review' }));
  expect(await screen.findByLabelText('Intersection Name')).toBeInTheDocument();
});


it('edits and preserves the intersection purpose from the standalone entry through a download-ready review', async () => {
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Intersection' }));
  fireEvent.change(await screen.findByLabelText('Intersection Name'), { target: { value: 'Library crossing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start Intersection Review' }));
  fireEvent.change(await screen.findByLabelText('What is happening here?'), { target: { value: 'The crossing has no step-free route.' } });
  fireEvent.change(screen.getByLabelText('What would you like to improve?'), { target: { value: 'An accessible crossing to the library.' } });
  fireEvent.change(screen.getByLabelText('What next step are you asking for?'), { target: { value: 'Please arrange a site visit.' } });
  const id = useIntersectionStore.getState().proposalId!;
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(INTERSECTION_PRESETS[0].label) }));
  fireEvent.click(await screen.findByRole('button', { name: /ADA curb ramps/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with 1 improvement' }));
  expect(await screen.findByRole('button', { name: 'Download brief PDF' })).toBeEnabled();
  fireEvent.click(screen.getByText('Purpose and request'));
  fireEvent.change(screen.getByLabelText('What next step are you asking for?'), { target: { value: 'Please inspect the northeast corner.' } });
  expect(useIntersectionStore.getState().briefContext).toMatchObject({
    concern: 'The crossing has no step-free route.',
    desiredOutcome: 'An accessible crossing to the library.',
    requestedNextStep: 'Please inspect the northeast corner.',
  });
  expect(useWorkDraftsStore.getState().drafts[id]).toMatchObject({
    kind: 'intersection', step: 'review', location: null,
    briefContext: { requestedNextStep: 'Please inspect the northeast corner.' },
    selectedImprovements: ['curb-ramps'],
  });
});
