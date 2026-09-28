import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntersectionBrief } from './IntersectionBrief';
import { IntersectionFlow } from './IntersectionFlow';
import { ImprovementPicker } from './steps/ImprovementPicker';
import { IntersectionReview } from './steps/IntersectionReview';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
import { INTERSECTION_IMPROVEMENTS } from '@/lib/presets/intersection-improvements';
import { filterNearbyCrashes, summarizeCrashes, suggestImprovements } from './suggestion-engine';
import type { NormalizedCrash } from '@/lib/types/safety-data';
import type { IntersectionImprovement } from '@/lib/types/intersection';

const generateObservationPDF = vi.hoisted(() => vi.fn());
vi.mock('@/features/export', () => ({ generateObservationPDF }));

const initialWorkspace = useWorkspaceStore.getState();
const conditions = INTERSECTION_PRESETS[0].conditions;
const crash = (fields: Partial<NormalizedCrash> = {}): NormalizedCrash => ({
  id: 'crash',
  source: 'denver',
  lat: 39.74,
  lng: -104.99,
  date: '2026-01-01',
  severity: 'severe-injury',
  modes: ['pedestrian'],
  injuries: 1,
  fatalities: 0,
  ...fields,
});
beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage);
  localStorage.clear();
  useWorkDraftsStore.setState(useWorkDraftsStore.getInitialState());
  useIntersectionStore.getState().reset();
  useWorkspaceStore.setState(initialWorkspace, true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('intersection proposal journey', () => {
  it('selects conditions, toggles improvements, reviews the actual selection, and returns to explore', () => {
    useWorkspaceStore.setState({ mode: 'propose-intersection' });
    useIntersectionStore.getState().initIntersection('Colfax at Broadway', { lat: 39.74, lng: -104.99 }, { lat: 39.74, lng: -104.99, address: 'Colfax at Broadway' });
    useIntersectionStore.setState({
      intersectionName: 'Colfax at Broadway',
      nearbyCrashes: [
        crash({ fatalities: 2, severity: 'fatal', modes: ['pedestrian', 'cyclist', 'motorist'] }),
        crash(),
      ],
      crashSummary: {
        totalCrashes: 2,
        fatalities: 2,
        severeInjuries: 1,
        pedestrianCrashes: 2,
        cyclistCrashes: 1,
        motoristCrashes: 1,
        radiusMeters: 75,
      },
    });
    render(<IntersectionFlow />);
    expect(screen.getByText(/2 crashes nearby/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Uncontrolled residential/ }));
    expect(useIntersectionStore.getState().conditions).toEqual(conditions);
    expect(
      (screen.getByRole('button', { name: 'Continue with 0 improvements' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    const eligible = suggestImprovements(conditions, [crash()], INTERSECTION_IMPROVEMENTS);
    const first = eligible[0].improvement;
    const second = eligible.find((i) => i.improvement.id !== first.id)!.improvement;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(first.label) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(second.label) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(second.label) }));
    expect(screen.getAllByText('DATA-SUGGESTED').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with 1 improvement' }));
    expect(screen.getByText('Intersection Proposal')).toBeTruthy();
    expect(screen.getAllByText(first.label).length).toBeGreaterThan(0);
    expect(screen.getByText('2 recorded fatalities')).toBeTruthy();
    expect(screen.getByText('1 severe')).toBeTruthy();
    expect(screen.getByText('1 cyclist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save and finish' }));
    expect(useIntersectionStore.getState().conditions).toBeNull();
    expect(Object.values(useWorkDraftsStore.getState().drafts)[0]).toMatchObject({ kind: 'intersection', step: 'review', selectedImprovements: [first.id] });
    expect(useWorkspaceStore.getState().mode).toBe('explore');
  });

  it('supports back/close, singular and absent crash summaries, and an empty-to-ready render', () => {
    const view = render(<IntersectionFlow />);
    expect(screen.getByText('Intersection Improvement')).toBeTruthy();
    act(() =>
      useIntersectionStore.setState({
        crashSummary: {
          totalCrashes: 1,
          fatalities: 0,
          severeInjuries: 0,
          pedestrianCrashes: 0,
          cyclistCrashes: 0,
          motoristCrashes: 1,
          radiusMeters: 75,
        },
      }),
    );
    expect(screen.getByText('1 crash nearby')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Two-way stop/ }));
    const back = screen.getByRole('button', { name: 'Back to conditions' });
    fireEvent.click(back);
    expect(screen.getByText(/What does this intersection/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save and close intersection' }));
    expect(useIntersectionStore.getState().crashSummary).toBeNull();
    view.unmount();
    const empty = render(
      <>
        <ImprovementPicker />
        <IntersectionReview />
      </>,
    );
    expect(empty.container.textContent).toBe('');
    act(() =>
      useIntersectionStore.setState({
        conditions,
        selectedImprovements: ['unknown', 'curb-ramps'],
        crashSummary: {
          totalCrashes: 1,
          fatalities: 0,
          severeInjuries: 0,
          pedestrianCrashes: 0,
          cyclistCrashes: 0,
          motoristCrashes: 1,
          radiusMeters: 75,
        },
      }),
    );
    expect(screen.getByText('Intersection Proposal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to improvements' }));
    act(() => useIntersectionStore.setState({ crashSummary: null }));
    expect(screen.queryByText(/crashes within/)).toBeNull();
  });
});

describe('crash evidence and improvement applicability', () => {
  it('filters geographic distance and counts recorded harms without inventing missing fatalities', () => {
    const near = crash();
    const far = crash({ id: 'far', lat: 40 });
    expect(filterNearbyCrashes([near, far], { lat: near.lat, lng: near.lng })).toEqual([near]);
    expect(filterNearbyCrashes([near], { lat: near.lat, lng: near.lng }, 0)).toEqual([near]);
    const summary = summarizeCrashes(
      [
        near,
        crash({ fatalities: null, severity: 'unknown', modes: [] }),
        crash({ fatalities: 3, severity: 'fatal', modes: ['cyclist', 'motorist'] }),
      ],
      200,
    );
    expect(summary).toEqual({
      totalCrashes: 3,
      fatalities: 3,
      severeInjuries: 1,
      pedestrianCrashes: 1,
      cyclistCrashes: 1,
      motoristCrashes: 1,
      radiusMeters: 200,
    });
    expect(summarizeCrashes([]).radiusMeters).toBe(75);
  });

  it('excludes already installed or signal-dependent improvements from each set of conditions', () => {
    const ids = (fields: Partial<typeof conditions>) =>
      suggestImprovements({ ...conditions, ...fields }, [], INTERSECTION_IMPROVEMENTS).map(
        (i) => i.improvement.id,
      );
    expect(ids({ trafficControl: 'signalized' })).not.toContain('upgrade-to-signal');
    expect(ids({ trafficControl: 'roundabout' })).not.toContain('convert-to-roundabout');
    expect(ids({ hasCurbRamps: true })).not.toContain('curb-ramps');
    expect(ids({ hasPedestrianSignal: true })).not.toContain('accessible-pedestrian-signal');
    for (const crossingType of ['raised-crosswalk', 'high-visibility-crosswalk'] as const)
      expect(ids({ crossingType })).not.toContain('add-crosswalks');
    expect(ids({ crossingType: 'high-visibility-crosswalk' })).not.toContain(
      'high-visibility-markings',
    );
    const signalDependent = INTERSECTION_IMPROVEMENTS.filter((i) =>
      i.requires?.includes('signalized'),
    );
    for (const imp of signalDependent) expect(ids({})).not.toContain(imp.id);
  });

  it('ranks evidence-backed improvements by severity score, then unsuggested work by complexity', () => {
    const base = INTERSECTION_IMPROVEMENTS[0];
    const items: IntersectionImprovement[] = [
      {
        ...base,
        id: 'major',
        complexity: 'major',
        relevantCrashModes: [],
        minimumCrashThreshold: 0,
      },
      {
        ...base,
        id: 'quick',
        complexity: 'quick-win',
        relevantCrashModes: [],
        minimumCrashThreshold: 0,
      },
      { ...base, id: 'ped', relevantCrashModes: ['pedestrian'], minimumCrashThreshold: 0.1 },
      {
        ...base,
        id: 'both',
        relevantCrashModes: ['pedestrian', 'cyclist'],
        minimumCrashThreshold: 0.1,
      },
      {
        ...base,
        id: 'moderate',
        complexity: 'moderate',
        relevantCrashModes: [],
        minimumCrashThreshold: 0,
      },
    ];
    const results = suggestImprovements(
      conditions,
      [crash({ severity: 'fatal' }), crash({ modes: ['cyclist'], severity: 'unknown' })],
      items,
    );
    expect(results.map((r) => r.improvement.id)).toEqual([
      'both',
      'ped',
      'quick',
      'moderate',
      'major',
    ]);
    expect(results.slice(0, 2).every((r) => r.isDataSuggested)).toBe(true);
    expect(results.slice(2).every((r) => !r.isDataSuggested)).toBe(true);
  });
});


it('keeps intersection purpose through a blocked close/finish, retries, then exports the actual selected ideas', async () => {
  const store = useIntersectionStore.getState();
  const place = { lat: 39.74, lng: -104.99, address: 'Broadway at Colfax' };
  store.initIntersection('Broadway at Colfax', place, place);
  useWorkspaceStore.getState().enterIntersectionMode(place);
  generateObservationPDF.mockResolvedValue(new Blob(['PDF']));
  URL.createObjectURL = vi.fn(() => 'blob:intersection');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<IntersectionFlow />);
  fireEvent.change(screen.getByLabelText('What is happening here?'), { target: { value: 'The ramp is blocked' } });
  fireEvent.change(screen.getByLabelText('What would you like to improve?'), { target: { value: 'Step-free crossing' } });
  fireEvent.change(screen.getByLabelText('What next step are you asking for?'), { target: { value: 'Please inspect the ramp' } });
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.click(screen.getByRole('button', { name: 'Save and close intersection' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose-intersection');
  expect(screen.getByRole('alert').textContent).toContain('could not be saved');
  blocked.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }));
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Uncontrolled residential/ }));
  fireEvent.click(screen.getByRole('button', { name: /ADA curb ramps/ }));
  expect(screen.getByRole('button', { name: /ADA curb ramps/ }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Continue with 1 improvement' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download brief PDF' }));
  await waitFor(() => expect(generateObservationPDF).toHaveBeenCalledOnce());
  expect(generateObservationPDF).toHaveBeenCalledWith(expect.objectContaining({ concern: 'The ramp is blocked', requestedNextStep: 'Please inspect the ramp', supportingEvidence: expect.objectContaining({ title: 'Intersection conditions and ideas to discuss', details: [expect.stringContaining('ADA curb ramps')] }) }), { ...place, name: 'Broadway at Colfax' });
  await screen.findByRole('link', { name: 'Download PDF again' });
  const failAgain = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  fireEvent.click(screen.getByRole('button', { name: 'Save and finish' }));
  expect(useIntersectionStore.getState().conditions).not.toBeNull();
  failAgain.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Save and finish' }));
  expect(useWorkspaceStore.getState().mode).toBe('explore');
});

it('keeps a readable unnamed intersection brief honest when its conditions and purpose are incomplete', () => {
  render(<IntersectionBrief />);
  expect(screen.getByRole('article', { name: 'Intersection discussion brief' }).textContent).toContain('Conditions have not been selected');
  expect(screen.getByText('Draft reference: Not yet saved')).toBeTruthy();
  expect(screen.getAllByText('Add this before sharing.')).toHaveLength(3);
});
