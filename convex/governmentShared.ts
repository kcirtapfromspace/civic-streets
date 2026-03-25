export type CoverageStatus =
  | 'unsigned'
  | 'outreach'
  | 'pilot'
  | 'active'
  | 'paused';

export type JurisdictionType = 'town' | 'city' | 'transit_agency';
export type ContactType = 'municipal' | 'district_representative';
export type ContactOfficeType =
  | 'general'
  | 'mayor'
  | 'transportation'
  | 'public_works'
  | 'city_council'
  | 'district_representative';
export type GovernmentLeadStatus =
  | 'new'
  | 'reviewing'
  | 'contacted'
  | 'qualified'
  | 'closed';
export type ContactDiscoveryStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';
export type ContactDiscoveryTrigger = 'seed' | 'hotspot_action' | 'lead_capture';
export type OutreachRequestStatus =
  | 'collecting_contacts'
  | 'queued_review'
  | 'ready'
  | 'sent'
  | 'blocked';
export type OutreachSourceAction = 'report_to_city' | 'send_to_rep';
export type PopulationBand =
  | 'individual'
  | 'under_50k'
  | '50k_to_500k'
  | 'over_500k_or_regional';

export interface JurisdictionSeed {
  slug: string;
  displayName: string;
  jurisdictionType: JurisdictionType;
  stateCode: string;
  aliases: string[];
  bounds?: [number, number, number, number];
  officialWebsiteUrl: string;
  directoryUrls: string[];
  districtDirectoryUrls: string[];
}

export interface InferredJurisdiction {
  slug: string;
  displayName: string;
  jurisdictionType: JurisdictionType;
  stateCode: string | null;
  officialWebsiteUrl: string | null;
  directoryUrls: string[];
  districtDirectoryUrls: string[];
}

export interface OutreachHotspotContext {
  id?: string | null;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  upvotes?: number | null;
}

export const GOVERNMENT_SIGNED_STATUSES: CoverageStatus[] = ['pilot', 'active'];

const JURISDICTION_SEEDS: JurisdictionSeed[] = [
  {
    slug: 'portland-or',
    displayName: 'Portland, OR',
    jurisdictionType: 'city',
    stateCode: 'OR',
    aliases: ['portland, or', 'portland or', 'city of portland'],
    bounds: [45.35, -122.95, 45.72, -122.45],
    officialWebsiteUrl: 'https://www.portland.gov',
    directoryUrls: [
      'https://www.portland.gov/transportation',
      'https://www.portland.gov/council',
    ],
    districtDirectoryUrls: ['https://www.portland.gov/council'],
  },
  {
    slug: 'chicago-il',
    displayName: 'Chicago, IL',
    jurisdictionType: 'city',
    stateCode: 'IL',
    aliases: ['chicago, il', 'chicago il', 'city of chicago'],
    bounds: [41.6, -87.95, 42.1, -87.45],
    officialWebsiteUrl: 'https://www.chicago.gov',
    directoryUrls: [
      'https://www.chicago.gov/city/en/depts/cdot.html',
      'https://www.chicago.gov/city/en/about/council.html',
    ],
    districtDirectoryUrls: ['https://www.chicago.gov/city/en/about/council.html'],
  },
  {
    slug: 'denver-co',
    displayName: 'Denver, CO',
    jurisdictionType: 'city',
    stateCode: 'CO',
    aliases: ['denver, co', 'denver co', 'city and county of denver'],
    bounds: [39.55, -105.15, 39.95, -104.7],
    officialWebsiteUrl: 'https://www.denvergov.org',
    directoryUrls: [
      'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Transportation-and-Infrastructure',
      'https://www.denvergov.org/Government/Denver-City-Council',
    ],
    districtDirectoryUrls: ['https://www.denvergov.org/Government/Denver-City-Council'],
  },
  {
    slug: 'new-york-ny',
    displayName: 'New York, NY',
    jurisdictionType: 'city',
    stateCode: 'NY',
    aliases: ['new york, ny', 'new york ny', 'new york city', 'city of new york'],
    bounds: [40.45, -74.3, 40.95, -73.65],
    officialWebsiteUrl: 'https://www.nyc.gov',
    directoryUrls: [
      'https://www.nyc.gov/html/dot/html/home/home.shtml',
      'https://council.nyc.gov',
    ],
    districtDirectoryUrls: ['https://council.nyc.gov'],
  },
];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function slugifyGovernmentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function parseAddressSegments(address: string): string[] {
  return address
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractStateCode(address: string): string | null {
  const segments = parseAddressSegments(address);
  const lastSegment = segments[segments.length - 1] ?? '';
  const stateMatch = lastSegment.match(/\b([A-Z]{2})\b/);
  return stateMatch?.[1] ?? null;
}

function extractCityName(address: string): string | null {
  const segments = parseAddressSegments(address);
  if (segments.length >= 2) {
    return segments[segments.length - 2] ?? null;
  }
  return null;
}

function seedToInferred(seed: JurisdictionSeed): InferredJurisdiction {
  return {
    slug: seed.slug,
    displayName: seed.displayName,
    jurisdictionType: seed.jurisdictionType,
    stateCode: seed.stateCode,
    officialWebsiteUrl: seed.officialWebsiteUrl,
    directoryUrls: [...seed.directoryUrls],
    districtDirectoryUrls: [...seed.districtDirectoryUrls],
  };
}

function findSeedByLocation(address: string, lat: number, lng: number) {
  const normalizedAddress = normalizeToken(address);
  const boundsMatch = JURISDICTION_SEEDS.find((seed) => {
    if (!seed.bounds) return false;
    const [south, west, north, east] = seed.bounds;
    return lat >= south && lat <= north && lng >= west && lng <= east;
  });
  if (boundsMatch) return boundsMatch;

  return JURISDICTION_SEEDS.find((seed) =>
    seed.aliases.some((alias) => normalizedAddress.includes(normalizeToken(alias))),
  );
}

function findSeedByName(name: string) {
  const normalizedName = normalizeToken(name);
  return JURISDICTION_SEEDS.find((seed) =>
    seed.aliases.some((alias) => normalizedName.includes(normalizeToken(alias))),
  );
}

export function inferJurisdictionFromLocation(args: {
  address: string;
  lat: number;
  lng: number;
}): InferredJurisdiction {
  const seed = findSeedByLocation(args.address, args.lat, args.lng);
  if (seed) {
    return seedToInferred(seed);
  }

  const cityName =
    (extractCityName(args.address) ?? args.address.trim()) ||
    'Unknown municipality';
  const stateCode = extractStateCode(args.address);
  const displayName = stateCode ? `${cityName}, ${stateCode}` : cityName;

  return {
    slug: slugifyGovernmentName(displayName),
    displayName,
    jurisdictionType: 'city',
    stateCode,
    officialWebsiteUrl: null,
    directoryUrls: [],
    districtDirectoryUrls: [],
  };
}

export function inferJurisdictionFromName(
  jurisdictionName: string,
  populationBand?: PopulationBand | null,
): InferredJurisdiction {
  const seed = findSeedByName(jurisdictionName);
  if (seed) {
    return seedToInferred(seed);
  }

  const stateMatch = jurisdictionName.match(/\b([A-Z]{2})\b/);
  const stateCode = stateMatch?.[1] ?? null;
  const jurisdictionType =
    populationBand === 'under_50k' ? 'town' : 'city';
  const displayName = jurisdictionName.trim();

  return {
    slug: slugifyGovernmentName(displayName),
    displayName,
    jurisdictionType,
    stateCode,
    officialWebsiteUrl: null,
    directoryUrls: [],
    districtDirectoryUrls: [],
  };
}

export function isSignedCoverageStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return GOVERNMENT_SIGNED_STATUSES.includes(status as CoverageStatus);
}

export function normalizeWorkEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  return digits || null;
}

export function inferOrganizationTypeFromPopulationBand(
  populationBand: PopulationBand | null | undefined,
): JurisdictionType {
  if (populationBand === 'under_50k') {
    return 'town';
  }
  return 'city';
}

export function buildOutreachCopy(args: {
  coverageName: string;
  sourceAction: OutreachSourceAction;
  hotspot: OutreachHotspotContext;
  officeTargets: string[];
}) {
  const officeLine =
    args.officeTargets.length > 0
      ? args.officeTargets.join(', ')
      : 'the transportation and council teams';
  const subject =
    args.sourceAction === 'report_to_city'
      ? `Street safety report from ${args.coverageName} residents`
      : `Representative outreach for ${args.coverageName} street safety demand`;
  const summary =
    args.sourceAction === 'report_to_city'
      ? `Resident city-report action rerouted into municipal onboarding outreach for ${args.coverageName}.`
      : `Resident representative contact rerouted into municipal onboarding outreach for ${args.coverageName}.`;

  const body = [
    `Hello ${args.coverageName} team,`,
    '',
    `A resident attempted to use Curbwise for a street safety issue at ${args.hotspot.address}.`,
    '',
    `Hotspot: ${args.hotspot.title}`,
    `Issue type: ${args.hotspot.category}`,
    `Community support: ${args.hotspot.upvotes ?? 0} votes`,
    '',
    `${args.hotspot.description}`,
    '',
    `Instead of dropping this request into a dead end, we want to connect ${args.coverageName} with Curbwise so your staff can review resident safety hotspots, generate concept work, and coordinate internal follow-through in one place.`,
    '',
    `Suggested recipients: ${officeLine}.`,
    '',
    'Curbwise',
  ].join('\n');

  return { subject, body, summary };
}
