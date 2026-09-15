import { beforeEach, describe, expect, it } from 'vitest';
import { useCommunityStore } from '../community-store';
import { useExplorerStore } from '../explorer-store';
import {
  buildHotspotPopupElement,
  computePinBounds,
  createHotspotSvg,
  upvoteScale,
} from '../pin-utils';
import type { HotspotPin } from '@/lib/types';

const pin: HotspotPin = {
  id: 'crossing',
  lat: 39.74,
  lng: -104.99,
  category: 'accessibility',
  title: '<img src=x onerror=alert(1)>',
  severity: 'high',
  status: 'open',
  upvotes: 42,
  commentCount: 3,
};

describe('community state and map pin contracts', () => {
  beforeEach(() => {
    useCommunityStore.setState(useCommunityStore.getInitialState());
    useExplorerStore.setState(useExplorerStore.getInitialState());
  });
  it('preserves unrelated feed filters and keeps card, design, and map selection independent', () => {
    const state = useCommunityStore.getState();
    state.setFeedFilter({ category: 'accessibility' });
    state.setFeedFilter({ sort: 'newest', status: 'open' });
    state.setSearchQuery('Colfax');
    state.setActiveHotspot('crossing');
    state.setActiveDesign('design');
    state.setHoveredHotspot('hovered');
    state.setSelectedHotspot('selected');
    expect(useCommunityStore.getState()).toMatchObject({
      feedFilter: { category: 'accessibility', sort: 'newest', status: 'open' },
      searchQuery: 'Colfax',
      activeHotspotId: 'crossing',
      activeDesignId: 'design',
      hoveredHotspotId: 'hovered',
      selectedHotspotId: 'selected',
    });
    state.setActiveHotspot(null);
    state.setActiveDesign(null);
    state.setHoveredHotspot(null);
    state.setSelectedHotspot(null);
    expect(useCommunityStore.getState()).toMatchObject({
      activeHotspotId: null,
      activeDesignId: null,
      hoveredHotspotId: null,
      selectedHotspotId: null,
      searchQuery: 'Colfax',
    });
  });
  it('opens a fresh save dialog with optional location data and clears it when dismissed', () => {
    const state = useCommunityStore.getState();
    state.openSaveDesign({ title: 'Colfax redesign', address: 'Denver' });
    expect(useCommunityStore.getState()).toMatchObject({
      isSaveDesignOpen: true,
      saveDesignData: { title: 'Colfax redesign', address: 'Denver' },
    });
    state.closeSaveDesign();
    expect(useCommunityStore.getState()).toMatchObject({
      isSaveDesignOpen: false,
      saveDesignData: null,
    });
    state.openSaveDesign();
    expect(useCommunityStore.getState()).toMatchObject({
      isSaveDesignOpen: true,
      saveDesignData: null,
    });
  });
  it('commits a viewport search and clears spatial filters without changing drawing mode', () => {
    const state = useExplorerStore.getState();
    const bounds = { minLat: 39.7, maxLat: 39.8, minLng: -105, maxLng: -104.9 };
    state.setShowSearchButton(true);
    state.setIsDrawing(true);
    state.setBoundsFilter(bounds);
    state.setPolygonFilter([
      [-105, 39.7],
      [-104.9, 39.7],
      [-105, 39.8],
    ]);
    expect(useExplorerStore.getState()).toMatchObject({
      boundsFilter: bounds,
      showSearchButton: false,
      isDrawing: true,
    });
    state.clearSpatialFilters();
    expect(useExplorerStore.getState()).toMatchObject({
      boundsFilter: null,
      polygonFilter: null,
      showSearchButton: false,
      isDrawing: true,
    });
    state.setIsDrawing(false);
    expect(useExplorerStore.getState().isDrawing).toBe(false);
  });
  it('keeps popup text inert and links to the selected community report', () => {
    const popup = buildHotspotPopupElement(pin);
    expect(popup.querySelector('h3')?.textContent).toBe(pin.title);
    expect(popup.querySelector('img')).toBeNull();
    expect(popup.textContent).toContain('42 upvotes');
    expect(popup.textContent).toContain('3 comments');
    expect(popup.querySelector('a')?.getAttribute('href')).toBe('/hotspot/crossing');
    const svg = createHotspotSvg('#123456', upvoteScale(42)).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('22');
    expect(svg?.querySelector('circle')?.getAttribute('fill')).toBe('#123456');
  });
  it.each([
    [0, 9],
    [29, 9],
    [30, 11],
    [74, 11],
    [75, 14],
    [149, 14],
    [150, 18],
  ])('scales %i votes to a bounded %i-pixel radius', (votes, radius) =>
    expect(upvoteScale(votes)).toBe(radius),
  );
  it('fits all pin coordinates, including a single pin and an empty result', () => {
    expect(computePinBounds([])).toBeNull();
    expect(computePinBounds([pin])).toEqual([
      [-104.99, 39.74],
      [-104.99, 39.74],
    ]);
    expect(computePinBounds([pin, { ...pin, id: 'other', lat: 40, lng: -105.2 }])).toEqual([
      [-105.2, 39.74],
      [-104.99, 40],
    ]);
  });
});
