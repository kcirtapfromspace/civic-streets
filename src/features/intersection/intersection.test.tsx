import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntersectionFlow } from './IntersectionFlow';
import { ImprovementPicker } from './steps/ImprovementPicker';
import { IntersectionReview } from './steps/IntersectionReview';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
import { INTERSECTION_IMPROVEMENTS } from '@/lib/presets/intersection-improvements';
import { filterNearbyCrashes, summarizeCrashes, suggestImprovements } from './suggestion-engine';
import type { NormalizedCrash } from '@/lib/types/safety-data';
import type { IntersectionImprovement } from '@/lib/types/intersection';

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
  useIntersectionStore.getState().reset();
  useWorkspaceStore.setState(initialWorkspace, true);
});
afterEach(cleanup);

describe('intersection proposal journey', () => {
  it('selects conditions, toggles improvements, reviews the actual selection, and returns to explore', () => {
    useWorkspaceStore.setState({ mode: 'propose-intersection' });
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
    expect(screen.getByText(first.label)).toBeTruthy();
    expect(screen.getByText('2 recorded fatalities')).toBeTruthy();
    expect(screen.getByText('1 severe')).toBeTruthy();
    expect(screen.getByText('1 cyclist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(useIntersectionStore.getState().conditions).toBeNull();
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
    const back = screen.getAllByRole('button', { name: '' }).slice(-1)[0]!;
    fireEvent.click(back);
    expect(screen.getByText(/What does this intersection/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]);
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
    fireEvent.click(screen.getAllByRole('button', { name: '' }).slice(-1)[0]!);
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
