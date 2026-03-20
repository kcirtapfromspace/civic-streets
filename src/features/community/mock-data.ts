// Mock data for community features — will be replaced by Convex queries

import type {
  HotspotCategory,
  HotspotSeverity,
  HotspotStatus,
  IssueGroup,
  IssueType,
} from '@/lib/types/community';

// ── Local interfaces (mirrors future Convex schema) ───────────────────────

export interface MockUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface MockHotspot {
  id: string;
  title: string;
  description: string;
  category: HotspotCategory;
  severity: HotspotSeverity;
  status: HotspotStatus;
  address: string;
  lat: number;
  lng: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  photoUrls: string[];
  authorId: string;
  createdAt: number; // epoch ms
  linkedDesignIds: string[];
  issueGroup?: IssueGroup;
  issueType?: IssueType;
  isBlocking?: boolean;
}

export interface MockDesign {
  id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  upvotes: number;
  prowagPass: boolean;
  nactoPass: boolean;
  authorId: string;
  createdAt: number;
  linkedHotspotId?: string;
  /** Simplified cross-section: element name + proportion (0-1) + color */
  elements: { name: string; proportion: number; color: string }[];
}

export interface MockComment {
  id: string;
  hotspotId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  upvotes: number;
  createdAt: number;
}

// ── Mock Users ────────────────────────────────────────────────────────────

export const MOCK_USERS: MockUser[] = [
  { id: 'u1', displayName: 'Alex R.' },
  { id: 'u2', displayName: 'Maria T.' },
  { id: 'u3', displayName: 'Jordan K.' },
];

// ── Mock Hotspots ─────────────────────────────────────────────────────────

const now = Date.now();
const hour = 3_600_000;
const day = 24 * hour;

export const MOCK_HOTSPOTS: MockHotspot[] = [
  {
    id: 'h1',
    title: 'No crosswalk at Oak & 5th',
    description:
      'This intersection has heavy pedestrian traffic from the school but no marked crosswalk or signal. Cars blow through here at 40 mph during drop-off times. Multiple near-misses reported by parents.',
    category: 'dangerous-intersection',
    severity: 'critical',
    status: 'open',
    address: '500 Oak St & 5th Ave, Portland, OR',
    lat: 45.5231,
    lng: -122.6765,
    upvotes: 47,
    downvotes: 2,
    commentCount: 12,
    photoUrls: [],
    authorId: 'u1',
    createdAt: now - 2 * day,
    linkedDesignIds: ['d1'],
  },
  {
    id: 'h2',
    title: 'Bike lane ends abruptly on Division',
    description:
      'The protected bike lane on Division St simply ends at 39th Ave, dumping cyclists into a 4-lane road with no transition. Extremely dangerous during rush hour.',
    category: 'needs-bike-lane',
    severity: 'high',
    status: 'acknowledged',
    address: '3900 SE Division St, Portland, OR',
    lat: 45.5052,
    lng: -122.6244,
    upvotes: 34,
    downvotes: 5,
    commentCount: 8,
    photoUrls: [],
    authorId: 'u2',
    createdAt: now - 5 * day,
    linkedDesignIds: ['d2'],
  },
  {
    id: 'h3',
    title: 'Constant speeding on Hawthorne',
    description:
      'Drivers regularly exceed 40 mph on Hawthorne Blvd between 20th and 30th. Speed bumps or a road diet would make this neighborhood street safe for families.',
    category: 'speeding',
    severity: 'high',
    status: 'open',
    address: 'SE Hawthorne Blvd & 25th, Portland, OR',
    lat: 45.5118,
    lng: -122.6427,
    upvotes: 28,
    downvotes: 3,
    commentCount: 6,
    photoUrls: [],
    authorId: 'u3',
    createdAt: now - 1 * day,
    linkedDesignIds: [],
  },
  {
    id: 'h4',
    title: 'Broken sidewalk near senior center',
    description:
      'The sidewalk along Morrison between 10th and 12th is severely cracked with tree root heaves. Wheelchair users and seniors from the nearby center can\'t use it safely.',
    category: 'poor-sidewalk',
    severity: 'medium',
    status: 'in-progress',
    address: '1100 SW Morrison St, Portland, OR',
    lat: 45.5205,
    lng: -122.6842,
    upvotes: 19,
    downvotes: 0,
    commentCount: 4,
    photoUrls: [],
    authorId: 'u1',
    createdAt: now - 10 * day,
    linkedDesignIds: [],
  },
  {
    id: 'h5',
    title: 'No bus stop shelter on MLK & Alberta',
    description:
      'Riders wait in the rain with no shelter, bench, or even a proper sign. This stop serves a major transfer point. We need real transit infrastructure here.',
    category: 'transit-gap',
    severity: 'medium',
    status: 'open',
    address: 'NE MLK Jr Blvd & Alberta St, Portland, OR',
    lat: 45.5588,
    lng: -122.6615,
    upvotes: 22,
    downvotes: 1,
    commentCount: 5,
    photoUrls: [],
    authorId: 'u2',
    createdAt: now - 3 * day,
    linkedDesignIds: [],
  },
  {
    id: 'h6',
    title: 'Wheelchair ramp missing at Broadway bridge',
    description:
      'The east side approach to the Broadway Bridge has no ADA-compliant ramp. Wheelchair users are forced to use the vehicle lane to access the bridge path.',
    category: 'accessibility',
    severity: 'critical',
    status: 'acknowledged',
    address: 'N Broadway & Larrabee Ave, Portland, OR',
    lat: 45.5346,
    lng: -122.674,
    upvotes: 41,
    downvotes: 0,
    commentCount: 9,
    photoUrls: [],
    authorId: 'u3',
    createdAt: now - 7 * day,
    linkedDesignIds: ['d3'],
  },
  {
    id: 'h7',
    title: 'Dangerous blind corner on Clinton',
    description:
      'Overgrown hedges and parked cars create a blind corner for cyclists at SE Clinton & 26th. Several crashes have happened here in the past year.',
    category: 'dangerous-intersection',
    severity: 'high',
    status: 'open',
    address: 'SE Clinton St & 26th Ave, Portland, OR',
    lat: 45.5029,
    lng: -122.6389,
    upvotes: 15,
    downvotes: 1,
    commentCount: 3,
    photoUrls: [],
    authorId: 'u1',
    createdAt: now - 12 * hour,
    linkedDesignIds: [],
  },
  {
    id: 'h8',
    title: 'School zone needs traffic calming',
    description:
      'Abernethy Elementary has no traffic calming at all. Parents have organized their own crossing guard but it is not enough. Need curb extensions and a raised crosswalk.',
    category: 'speeding',
    severity: 'high',
    status: 'open',
    address: '2421 SE Orange Ave, Portland, OR',
    lat: 45.4892,
    lng: -122.6463,
    upvotes: 31,
    downvotes: 2,
    commentCount: 7,
    photoUrls: [],
    authorId: 'u2',
    createdAt: now - 4 * day,
    linkedDesignIds: ['d4'],
  },
  {
    id: 'h9',
    title: 'Missing curb ramp at Foster & 82nd',
    description:
      'No curb ramp on the NW corner of Foster & 82nd. This is one of the busiest intersections in outer SE and is completely inaccessible for wheelchair users.',
    category: 'accessibility',
    severity: 'medium',
    status: 'resolved',
    address: 'SE Foster Rd & 82nd Ave, Portland, OR',
    lat: 45.4826,
    lng: -122.5781,
    upvotes: 12,
    downvotes: 0,
    commentCount: 2,
    photoUrls: [],
    authorId: 'u3',
    createdAt: now - 30 * day,
    linkedDesignIds: [],
  },
  {
    id: 'h10',
    title: 'Flooding makes sidewalk impassable',
    description:
      'Storm drain on NE Glisan & 33rd is perpetually clogged causing the entire sidewalk to flood. Pedestrians have to walk in the street. Problem has existed for years.',
    category: 'poor-sidewalk',
    severity: 'low',
    status: 'open',
    address: 'NE Glisan St & 33rd Ave, Portland, OR',
    lat: 45.5268,
    lng: -122.6313,
    upvotes: 8,
    downvotes: 1,
    commentCount: 1,
    photoUrls: [],
    authorId: 'u1',
    createdAt: now - 15 * day,
    linkedDesignIds: [],
  },
];

// ── Mock Designs ──────────────────────────────────────────────────────────

export const MOCK_DESIGNS: MockDesign[] = [
  {
    id: 'd1',
    title: 'Protected intersection at Oak & 5th',
    description:
      'Full Dutch-style protected intersection with raised crosswalks and corner refuge islands.',
    address: '500 Oak St & 5th Ave, Portland, OR',
    lat: 45.5231,
    lng: -122.6765,
    upvotes: 23,
    prowagPass: true,
    nactoPass: true,
    authorId: 'u2',
    createdAt: now - 1 * day,
    linkedHotspotId: 'h1',
    elements: [
      { name: 'Sidewalk', proportion: 0.15, color: '#9CA3AF' },
      { name: 'Buffer', proportion: 0.05, color: '#22C55E' },
      { name: 'Bike Lane', proportion: 0.1, color: '#3B82F6' },
      { name: 'Travel Lane', proportion: 0.2, color: '#374151' },
      { name: 'Median', proportion: 0.05, color: '#22C55E' },
      { name: 'Travel Lane', proportion: 0.2, color: '#374151' },
      { name: 'Bike Lane', proportion: 0.1, color: '#3B82F6' },
      { name: 'Buffer', proportion: 0.05, color: '#22C55E' },
      { name: 'Sidewalk', proportion: 0.1, color: '#9CA3AF' },
    ],
  },
  {
    id: 'd2',
    title: 'Division St bike lane extension',
    description: 'Continue the protected bike lane from 39th to 50th with concrete barriers.',
    address: '3900 SE Division St, Portland, OR',
    lat: 45.5052,
    lng: -122.6244,
    upvotes: 18,
    prowagPass: true,
    nactoPass: false,
    authorId: 'u1',
    createdAt: now - 3 * day,
    linkedHotspotId: 'h2',
    elements: [
      { name: 'Sidewalk', proportion: 0.12, color: '#9CA3AF' },
      { name: 'Bike Lane', proportion: 0.12, color: '#3B82F6' },
      { name: 'Buffer', proportion: 0.04, color: '#22C55E' },
      { name: 'Travel Lane', proportion: 0.22, color: '#374151' },
      { name: 'Travel Lane', proportion: 0.22, color: '#374151' },
      { name: 'Buffer', proportion: 0.04, color: '#22C55E' },
      { name: 'Bike Lane', proportion: 0.12, color: '#3B82F6' },
      { name: 'Sidewalk', proportion: 0.12, color: '#9CA3AF' },
    ],
  },
  {
    id: 'd3',
    title: 'Broadway Bridge accessible approach',
    description:
      'ADA ramp with tactile paving and gentle grade to connect sidewalk to bridge path.',
    address: 'N Broadway & Larrabee Ave, Portland, OR',
    lat: 45.5346,
    lng: -122.674,
    upvotes: 15,
    prowagPass: true,
    nactoPass: true,
    authorId: 'u3',
    createdAt: now - 5 * day,
    linkedHotspotId: 'h6',
    elements: [
      { name: 'Sidewalk', proportion: 0.2, color: '#9CA3AF' },
      { name: 'Ramp', proportion: 0.15, color: '#F59E0B' },
      { name: 'Buffer', proportion: 0.05, color: '#22C55E' },
      { name: 'Shared Path', proportion: 0.3, color: '#3B82F6' },
      { name: 'Buffer', proportion: 0.05, color: '#22C55E' },
      { name: 'Travel Lane', proportion: 0.25, color: '#374151' },
    ],
  },
  {
    id: 'd4',
    title: 'School zone traffic calming package',
    description:
      'Raised crosswalks, curb extensions, and 20 mph chicanes around Abernethy Elementary.',
    address: '2421 SE Orange Ave, Portland, OR',
    lat: 45.4892,
    lng: -122.6463,
    upvotes: 9,
    prowagPass: false,
    nactoPass: true,
    authorId: 'u1',
    createdAt: now - 2 * day,
    linkedHotspotId: 'h8',
    elements: [
      { name: 'Sidewalk', proportion: 0.15, color: '#9CA3AF' },
      { name: 'Chicane', proportion: 0.1, color: '#F59E0B' },
      { name: 'Travel Lane', proportion: 0.25, color: '#374151' },
      { name: 'Travel Lane', proportion: 0.25, color: '#374151' },
      { name: 'Chicane', proportion: 0.1, color: '#F59E0B' },
      { name: 'Sidewalk', proportion: 0.15, color: '#9CA3AF' },
    ],
  },
  {
    id: 'd5',
    title: 'Hawthorne road diet concept',
    description: 'Reduce Hawthorne to 2 travel lanes + center turn lane and add bike lanes.',
    address: 'SE Hawthorne Blvd & 25th, Portland, OR',
    lat: 45.5118,
    lng: -122.6427,
    upvotes: 14,
    prowagPass: true,
    nactoPass: true,
    authorId: 'u2',
    createdAt: now - 6 * day,
    elements: [
      { name: 'Sidewalk', proportion: 0.12, color: '#9CA3AF' },
      { name: 'Bike Lane', proportion: 0.1, color: '#3B82F6' },
      { name: 'Travel Lane', proportion: 0.18, color: '#374151' },
      { name: 'Turn Lane', proportion: 0.1, color: '#F59E0B' },
      { name: 'Travel Lane', proportion: 0.18, color: '#374151' },
      { name: 'Bike Lane', proportion: 0.1, color: '#3B82F6' },
      { name: 'Sidewalk', proportion: 0.12, color: '#9CA3AF' },
      { name: 'Planter', proportion: 0.1, color: '#22C55E' },
    ],
  },
];

// ── Mock Comments ─────────────────────────────────────────────────────────

export const MOCK_COMMENTS: MockComment[] = [
  // h1 comments (thread)
  {
    id: 'c1',
    hotspotId: 'h1',
    parentId: null,
    authorId: 'u2',
    body: 'I walk my kids through this intersection every morning. It is terrifying. We need a traffic signal at minimum.',
    upvotes: 14,
    createdAt: now - 2 * day + 2 * hour,
  },
  {
    id: 'c2',
    hotspotId: 'h1',
    parentId: 'c1',
    authorId: 'u3',
    body: 'Agree 100%. I filed a request with PBOT six months ago and never heard back. Maybe community pressure will help.',
    upvotes: 8,
    createdAt: now - 2 * day + 4 * hour,
  },
  {
    id: 'c3',
    hotspotId: 'h1',
    parentId: 'c1',
    authorId: 'u1',
    body: 'Have you tried contacting your neighborhood association? They might be able to escalate this.',
    upvotes: 5,
    createdAt: now - 2 * day + 5 * hour,
  },
  {
    id: 'c4',
    hotspotId: 'h1',
    parentId: 'c3',
    authorId: 'u2',
    body: 'Good idea. I will bring it up at the next meeting.',
    upvotes: 3,
    createdAt: now - 2 * day + 6 * hour,
  },
  {
    id: 'c5',
    hotspotId: 'h1',
    parentId: null,
    authorId: 'u3',
    body: 'Someone created a great design proposal for this — check the linked designs above. It is very thorough.',
    upvotes: 7,
    createdAt: now - 1 * day,
  },
  // h2 comments
  {
    id: 'c6',
    hotspotId: 'h2',
    parentId: null,
    authorId: 'u1',
    body: 'This is where my friend got hit last year. The abrupt ending is a death trap.',
    upvotes: 11,
    createdAt: now - 4 * day,
  },
  {
    id: 'c7',
    hotspotId: 'h2',
    parentId: 'c6',
    authorId: 'u3',
    body: 'I hope they are okay. This really needs to be fixed before someone else gets hurt.',
    upvotes: 6,
    createdAt: now - 4 * day + 3 * hour,
  },
  // h3 comments
  {
    id: 'c8',
    hotspotId: 'h3',
    parentId: null,
    authorId: 'u2',
    body: 'I have a speed radar sign in my yard and regularly see cars at 45+ mph. The data is alarming.',
    upvotes: 9,
    createdAt: now - 20 * hour,
  },
  {
    id: 'c9',
    hotspotId: 'h3',
    parentId: 'c8',
    authorId: 'u1',
    body: 'Could you share that data? It would be powerful in a report to city council.',
    upvotes: 4,
    createdAt: now - 18 * hour,
  },
  // h5 comments
  {
    id: 'c10',
    hotspotId: 'h5',
    parentId: null,
    authorId: 'u3',
    body: 'I waited 25 minutes in the pouring rain here last Tuesday. This is a basic equity issue.',
    upvotes: 10,
    createdAt: now - 2 * day,
  },
  // h6 comments
  {
    id: 'c11',
    hotspotId: 'h6',
    parentId: null,
    authorId: 'u1',
    body: 'This has been an issue for years. How is this still not ADA compliant?',
    upvotes: 15,
    createdAt: now - 6 * day,
  },
  {
    id: 'c12',
    hotspotId: 'h6',
    parentId: 'c11',
    authorId: 'u2',
    body: 'Filed an ADA complaint with the city. They said it is "on the list" but no timeline.',
    upvotes: 12,
    createdAt: now - 6 * day + 5 * hour,
  },
  {
    id: 'c13',
    hotspotId: 'h6',
    parentId: null,
    authorId: 'u3',
    body: 'The design someone posted looks great and would solve this. Shared it with my council rep.',
    upvotes: 8,
    createdAt: now - 4 * day,
  },
  // h8 comments
  {
    id: 'c14',
    hotspotId: 'h8',
    parentId: null,
    authorId: 'u2',
    body: 'Parent here. We formed a volunteer crossing patrol but it should not be on us to keep our kids safe from cars.',
    upvotes: 13,
    createdAt: now - 3 * day,
  },
  {
    id: 'c15',
    hotspotId: 'h8',
    parentId: 'c14',
    authorId: 'u1',
    body: 'The school board should be pressuring the city on this. Have they made any statements?',
    upvotes: 5,
    createdAt: now - 3 * day + 2 * hour,
  },
];
