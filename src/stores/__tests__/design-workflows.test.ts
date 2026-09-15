import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useStreetStore } from '../street-store';
import { useProposalStore } from '../proposal-store';
import { useIntersectionStore } from '../intersection-store';
import { useDrawingStore } from '../drawing-store';
import { useWorkspaceStore } from '../workspace-store';
import { useSavedProposalsStore } from '../saved-proposals-store';
import { useLocalHotspotsStore } from '../local-hotspots-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { DEFAULT_CONSTRAINTS } from '@/lib/constants';
import { getTemplateById } from '@/lib/templates';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
import type { CrossSectionElement, StreetLocation } from '@/lib/types';

const location: StreetLocation = { lat: 39.74, lng: -104.99, address: 'Example Street' };
const template = getTemplateById('road-diet-4to3')!;
beforeEach(() => {
  useStreetStore.setState(useStreetStore.getInitialState());
  useProposalStore.setState(useProposalStore.getInitialState());
  useIntersectionStore.setState(useIntersectionStore.getInitialState());
  useDrawingStore.setState(useDrawingStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useSavedProposalsStore.setState(useSavedProposalsStore.getInitialState());
  useLocalHotspotsStore.setState(useLocalHotspotsStore.getInitialState());
  useSafetyDataStore.setState(useSafetyDataStore.getInitialState());
  useStreetStore.temporal.getState().clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const element = (
  side: CrossSectionElement['side'],
  label: string = side,
): Omit<CrossSectionElement, 'id'> => ({
  type: 'travel-lane',
  width: 10,
  side,
  label,
  locked: false,
  constraints: DEFAULT_CONSTRAINTS['travel-lane'],
});
const createStreet = () => {
  useStreetStore.getState().createNewStreet('Example Street', 60, 'local', 'two-way', location);
  return useStreetStore.getState().currentStreet!;
};

describe('street editing and undo', () => {
  it('handles editing commands before a street exists without creating a partial street', () => {
    const s = useStreetStore.getState();
    s.updateStreetName('Ignored');
    s.setROWWidth(50);
    s.setDirection('one-way');
    s.setFunctionalClass('collector');
    s.addElement(element('center'));
    s.removeElement('missing');
    s.updateElement('missing', { width: 20 });
    s.reorderElements(0, 1);
    expect(useStreetStore.getState().currentStreet).toBeNull();
  });

  it('creates an independent street, preserves location and updates metadata and dimensions through edits', () => {
    const initial = createStreet();
    expect(initial.location).toEqual(location);
    expect(new Set(initial.elements.map((e) => e.id)).size).toBe(initial.elements.length);
    const travel = initial.elements.find((e) => e.type === 'travel-lane')!;
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    const s = useStreetStore.getState();
    s.updateStreetName('Changed Street');
    s.setROWWidth(66);
    s.setDirection('one-way');
    s.setFunctionalClass('collector');
    s.updateElement(travel.id, { width: 12, locked: true });
    expect(useStreetStore.getState().currentStreet).toMatchObject({
      name: 'Changed Street',
      totalROWWidth: 66,
      direction: 'one-way',
      functionalClass: 'collector',
      curbToCurbWidth: 12,
      location,
      metadata: { updatedAt: '2026-09-15T12:00:00.000Z' },
    });
    expect(initial.name).toBe('Example Street');
    expect(initial.elements.find((e) => e.id === travel.id)?.locked).toBe(false);
    s.selectElement(travel.id);
    s.removeElement(travel.id);
    expect(useStreetStore.getState()).toMatchObject({
      selectedElementId: null,
      currentStreet: { curbToCurbWidth: 0 },
    });
    expect(
      useStreetStore.getState().currentStreet?.elements.every((e) => e.type !== 'travel-lane'),
    ).toBe(true);
    s.createNewStreet('Another Street', 40, 'local', 'two-way');
    expect(useStreetStore.getState().currentStreet?.id).not.toBe(initial.id);
    expect(useStreetStore.getState().currentStreet?.location).toBeUndefined();
  });

  it.each([
    { sides: ['left', 'right'], add: 'left', expected: ['left', 'new', 'right'] },
    { sides: ['left'], add: 'left', expected: ['left', 'new'] },
    { sides: ['left', 'right'], add: 'right', expected: ['left', 'new', 'right'] },
    { sides: ['right'], add: 'right', expected: ['new', 'right'] },
    { sides: ['left', 'right'], add: 'center', expected: ['left', 'new', 'right'] },
    { sides: ['left'], add: 'center', expected: ['left', 'new'] },
    {
      sides: ['left', 'center', 'right'],
      add: 'center',
      expected: ['left', 'center', 'new', 'right'],
    },
  ] as const)(
    'places a $add element within the cross-section side order $sides',
    ({ sides, add, expected }) => {
      const street = createStreet();
      useStreetStore.getState().setStreet({
        ...street,
        elements: sides.map((side, i) => ({ ...element(side), id: String(i) })),
      });
      useStreetStore.getState().addElement(element(add, 'new'));
      expect(useStreetStore.getState().currentStreet?.elements.map((e) => e.label)).toEqual(
        expected,
      );
      expect(useStreetStore.getState().currentStreet?.curbToCurbWidth).toBe(expected.length * 10);
    },
  );

  it('reorders, rejects invalid positions, keeps other selections, and restores edits with undo/redo', () => {
    const initial = createStreet();
    const ids = initial.elements.map((e) => e.id);
    const s = useStreetStore.getState();
    s.selectElement(ids[1]);
    s.removeElement(ids[0]);
    expect(useStreetStore.getState().selectedElementId).toBe(ids[1]);
    s.reorderElements(0, 2);
    const reordered = useStreetStore.getState().currentStreet!;
    expect(reordered.elements.map((e) => e.id)).toEqual([ids[2], ids[3], ids[1], ids[4]]);
    for (const [from, to] of [
      [-1, 0],
      [99, 0],
      [0, -1],
      [0, 99],
    ])
      s.reorderElements(from, to);
    expect(useStreetStore.getState().currentStreet).toBe(reordered);
    s.updateStreetName('Undo example');
    useStreetStore.temporal.getState().undo();
    expect(useStreetStore.getState().currentStreet?.name).toBe('Example Street');
    useStreetStore.temporal.getState().redo();
    expect(useStreetStore.getState().currentStreet?.name).toBe('Undo example');
  });

  it('fits templates, saves the before state, and clears stale selection and validation', () => {
    useStreetStore.getState().applyTemplate(template, 60);
    expect(useStreetStore.getState().beforeStreet).toBeNull();
    const original = createStreet();
    const s = useStreetStore.getState();
    s.setBeforeStreet(original);
    s.toggleBeforeAfter();
    s.setExporting(true);
    s.openTemplateGallery();
    expect(useStreetStore.getState()).toMatchObject({
      showBeforeAfter: true,
      isExporting: true,
      isTemplateGalleryOpen: true,
    });
    s.closeTemplateGallery();
    s.openTemplateGallery();
    s.selectElement(original.elements[0].id);
    s.setValidationResults([
      {
        elementId: original.elements[0].id,
        severity: 'error',
        message: 'Too narrow',
        valid: false,
        constraint: 'prowag',
        citation: 'Test rule',
        currentValue: 2,
        requiredValue: 4,
      },
    ]);
    s.applyTemplate(template, 66);
    expect(useStreetStore.getState()).toMatchObject({
      beforeStreet: original,
      selectedElementId: null,
      validationResults: [],
      isTemplateGalleryOpen: false,
      currentStreet: { name: original.name, totalROWWidth: 66 },
    });
    expect(
      useStreetStore.getState().currentStreet?.elements.reduce((n, e) => n + e.width, 0),
    ).toBeCloseTo(66, 1);
    s.setBeforeStreet(null);
    s.toggleBeforeAfter();
    s.setExporting(false);
    expect(useStreetStore.getState()).toMatchObject({
      beforeStreet: null,
      showBeforeAfter: false,
      isExporting: false,
    });
  });
});

describe('proposal, drawing and workspace workflows', () => {
  it('requires complete context, applies a transformation and preserves a saved proposal across load/remove', () => {
    const p = useProposalStore.getState();
    p.applyTransformation(template);
    p.goBack();
    expect(p.getProposal()).toBeNull();
    p.selectPreset(BEFORE_PRESETS[0]);
    expect(useProposalStore.getState().beforeStreet?.location).toBeUndefined();
    p.initProposal('Example Street', location);
    p.setRoadPath(
      [
        { lat: 39.74, lng: -104.99 },
        { lat: 39.75, lng: -104.99 },
      ],
      0,
    );
    p.selectPreset(BEFORE_PRESETS[0]);
    expect(p.getProposal()).toBeNull();
    p.applyTransformation(template);
    p.toggleMapView();
    const proposal = p.getProposal()!;
    expect(proposal).toMatchObject({
      streetName: 'Example Street',
      location,
      bearing: 0,
      beforePresetId: BEFORE_PRESETS[0].id,
      transformationTemplateId: template.id,
    });
    expect(proposal.afterStreet.location).toEqual(location);
    const saved = useSavedProposalsStore.getState();
    saved.saveProposal(proposal);
    saved.saveProposal({ ...proposal, streetName: 'Revised' });
    expect(Object.keys(useSavedProposalsStore.getState().proposals)).toEqual([proposal.id]);
    p.reset();
    p.loadProposal(saved.getProposal(proposal.id)!);
    expect(useProposalStore.getState()).toMatchObject({
      streetName: 'Revised',
      step: 'review',
      showBeforeOnMap: false,
    });
    p.goBack();
    expect(useProposalStore.getState()).toMatchObject({
      step: 'before-selected',
      afterStreet: null,
      showBeforeOnMap: true,
    });
    p.goBack();
    expect(useProposalStore.getState()).toMatchObject({
      step: 'street-selected',
      beforeStreet: null,
    });
    saved.removeProposal(proposal.id);
    saved.removeProposal('missing');
    expect(saved.getProposal(proposal.id)).toBeUndefined();
    p.reset();
    expect(useProposalStore.getState()).toMatchObject({
      location: null,
      roadPath: [],
      streetName: '',
    });
  });

  it('commits a drawn road with its name, midpoint and bearing, then clears temporary drawing state', () => {
    const d = useDrawingStore.getState();
    d.commitToProposal();
    d.setSelectedPath([{ lat: 0, lng: 0 }]);
    d.commitToProposal();
    expect(useWorkspaceStore.getState().mode).toBe('explore');
    d.setActiveTool('road');
    d.setIsDragging(true);
    d.setIsSnapping(true);
    d.setStreetName('Painted Road');
    const path = [
      { lat: 39.7, lng: -105 },
      { lat: 39.7, lng: -104.99 },
      { lat: 39.7, lng: -104.98 },
    ];
    d.setSelectedPath(path);
    d.commitToProposal();
    expect(useProposalStore.getState()).toMatchObject({
      streetName: 'Painted Road',
      roadPath: path,
      location: { ...path[1], address: 'Painted Road' },
    });
    expect(useProposalStore.getState().bearing).toBeCloseTo(90, 0);
    expect(useDrawingStore.getState()).toMatchObject({
      activeTool: 'select',
      selectedPath: null,
      streetName: null,
    });
    expect(useWorkspaceStore.getState().mode).toBe('propose');
    d.setActiveTool('newroad');
    d.setSelectedPath(path);
    d.commitToProposal();
    expect(useProposalStore.getState().streetName).toBe('New Road');
    d.setActiveTool('road');
    d.setSelectedPath(path);
    d.commitToProposal();
    expect(useProposalStore.getState().streetName).toBe('Selected Road');
    d.setIsDragging(true);
    d.setIsSnapping(true);
    d.clear();
    expect(useDrawingStore.getState()).toMatchObject({
      isDragging: false,
      isSnapping: false,
      selectedPath: null,
    });
  });

  it('builds an intersection proposal, supports back/edit, and resets selection for another location', () => {
    const d = useDrawingStore.getState();
    const p = useIntersectionStore.getState();
    expect(p.getProposal()).toBeNull();
    p.goBack();
    d.setActiveTool('intersection');
    d.setIntersectionCenter(location);
    d.commitToProposal();
    expect(useIntersectionStore.getState().intersectionName).toBe('Intersection');
    expect(useWorkspaceStore.getState().mode).toBe('propose-intersection');
    p.selectConditions(INTERSECTION_PRESETS[0].conditions);
    p.toggleImprovement('curb-ramps');
    p.toggleImprovement('crosswalk');
    p.toggleImprovement('crosswalk');
    p.advanceToReview();
    expect(p.getProposal()).toMatchObject({
      selectedImprovements: ['curb-ramps'],
      nearbyCrashSummary: { totalCrashes: 0 },
    });
    useIntersectionStore.setState({ crashSummary: null });
    expect(p.getProposal()?.nearbyCrashSummary.totalCrashes).toBe(0);
    p.goBack();
    expect(useIntersectionStore.getState().step).toBe('improvements');
    p.goBack();
    expect(useIntersectionStore.getState()).toMatchObject({
      step: 'conditions',
      conditions: null,
      selectedImprovements: [],
    });
    d.setActiveTool('intersection');
    d.setStreetName('Named Crossing');
    d.setIntersectionCenter(location);
    d.commitToProposal();
    expect(useIntersectionStore.getState().intersectionName).toBe('Named Crossing');
    p.reset();
    expect(p.getProposal()).toBeNull();
  });

  it('restores editing panels when entering design mode and closes street view when exploring', () => {
    const w = useWorkspaceStore.getState();
    w.enterConfigureMode(location);
    w.toggleElementPanel();
    w.toggleValidationPanel();
    w.toggleDock();
    w.toggleStreetViewPip();
    expect(useWorkspaceStore.getState()).toMatchObject({
      mode: 'configure',
      showElementPanel: false,
      showValidationPanel: false,
      dockExpanded: false,
      showStreetViewPip: true,
    });
    w.enterDesignMode();
    expect(useWorkspaceStore.getState()).toMatchObject({
      mode: 'design',
      designLocation: location,
      showElementPanel: true,
      showValidationPanel: true,
      dockExpanded: true,
    });
    const second = { ...location, address: 'Second Street' };
    w.enterDesignMode(second);
    w.setDockExpanded(false);
    w.exitToExplore();
    expect(useWorkspaceStore.getState()).toMatchObject({
      mode: 'explore',
      designLocation: second,
      showStreetViewPip: false,
      dockExpanded: false,
    });
  });

  it('keeps local demo votes isolated to their selected record', () => {
    const s = useLocalHotspotsStore.getState();
    const input = {
      title: 'Concern',
      description: 'Crossing',
      category: 'other' as const,
      severity: 'low' as const,
      ...location,
      photoUrls: [],
    };
    const first = s.addHotspot(input);
    const second = s.addHotspot({ ...input, title: 'Second concern' });
    s.voteOnHotspot(first, 1);
    s.voteOnHotspot(first, -1);
    s.voteOnHotspot('missing', 1);
    expect(useLocalHotspotsStore.getState().hotspots.map((h) => h.id)).toEqual([second, first]);
    expect(useLocalHotspotsStore.getState().hotspots.find((h) => h.id === first)).toMatchObject({
      upvotes: 1,
      downvotes: 1,
    });
    expect(useLocalHotspotsStore.getState().hotspots.find((h) => h.id === second)).toMatchObject({
      upvotes: 0,
      downvotes: 0,
    });
  });
});
