import { create } from 'zustand';
import type { HotspotCategory, HotspotSeverity, IssueGroup, IssueType } from '@/lib/types/community';
import type { MockHotspot } from '@/features/community/mock-data';

interface LocalHotspotsState {
  hotspots: MockHotspot[];
  addHotspot: (data: {
    title: string;
    description: string;
    category: HotspotCategory;
    severity: HotspotSeverity;
    lat: number;
    lng: number;
    address: string;
    photoUrls: string[];
    issueGroup?: IssueGroup;
    issueType?: IssueType;
    isBlocking?: boolean;
  }) => string;
  voteOnHotspot: (id: string, value: 1 | -1) => void;
}

let nextId = 1;

export const useLocalHotspotsStore = create<LocalHotspotsState>()((set) => ({
  hotspots: [],

  addHotspot: (data) => {
    const id = `local-h${nextId++}`;
    const hotspot: MockHotspot = {
      id,
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity,
      status: 'open',
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      upvotes: 0,
      downvotes: 0,
      commentCount: 0,
      photoUrls: data.photoUrls,
      authorId: 'local-user',
      createdAt: Date.now(),
      linkedDesignIds: [],
      issueGroup: data.issueGroup,
      issueType: data.issueType,
      isBlocking: data.isBlocking,
    };
    set((state) => ({ hotspots: [hotspot, ...state.hotspots] }));
    return id;
  },

  voteOnHotspot: (id, value) => {
    set((state) => ({
      hotspots: state.hotspots.map((h) =>
        h.id === id
          ? {
              ...h,
              upvotes: h.upvotes + (value === 1 ? 1 : 0),
              downvotes: h.downvotes + (value === -1 ? 1 : 0),
            }
          : h,
      ),
    }));
  },
}));
