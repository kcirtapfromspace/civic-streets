"use node";

import { action, type ActionCtx } from './_generated/server';
import { internal, api } from './_generated/api';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import {
  buildOutreachCopy,
  isSignedCoverageStatus,
  normalizePhone,
  type CoverageStatus,
  type ContactType,
  type OutreachSourceAction,
} from './governmentShared';

type CoverageSnapshot = {
  _id: Id<'jurisdictionCoverage'>;
  displayName: string;
  status: string;
  officialWebsiteUrl?: string;
  directoryUrls?: string[];
  districtDirectoryUrls?: string[];
};

type ContactSnapshot = {
  _id: Id<'jurisdictionContacts'>;
  contactType: string;
  officeType: string;
  districtLabel?: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  sourceUrl: string;
  sourceDomain: string;
  confidence: number;
  freshUntil: number;
  isActive: boolean;
};

type DiscoveryCandidate = {
  contactType: ContactType;
  officeType: string;
  districtLabel?: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  sourceUrl: string;
  sourceDomain: string;
  normalizedIdentity: string;
  confidence: number;
  freshUntil: number;
};

type UserSnapshot = Doc<'users'>;
type DiscoveryState = 'cached' | 'queued' | 'discovered';

type ResolveCoverageAndContactsResult = {
  user: UserSnapshot;
  coverage: CoverageSnapshot;
  contacts: ContactSnapshot[];
  discoveryState: DiscoveryState;
};

type EnsureJurisdictionContactsResult = {
  coverage: {
    coverageId: string;
    displayName: string;
    status: string;
    isSigned: boolean;
    officialWebsiteUrl: string | null;
  };
  discoveryState: DiscoveryState;
  contactCount: number;
  recipientPreview: Array<{
    contactId: string;
    title: string;
    email: string | null;
    phone: string | null;
  }>;
};

type UnsignedOutreachResult =
  | {
      status: 'signed';
      message: string;
      coverage: {
        coverageId: string;
        displayName: string;
        status: string;
      };
    }
  | {
      requestId: string | null;
      status: 'queued_review' | 'collecting_contacts';
      message: string;
      coverage: {
        coverageId: string;
        displayName: string;
        status: string;
        officialWebsiteUrl: string | null;
      };
      recipients: Array<{
        contactId: string;
        title: string;
        email: string | null;
        phone: string | null;
        sourceUrl: string;
      }>;
      draft: {
        subject: string;
        body: string;
        summary: string;
      };
    };

const EMAIL_REGEX =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const DISCOVERY_FRESHNESS_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FETCH_URLS = 6;

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeDiscoveryHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function buildAllowedDiscoveryHosts(seedUrls: string[]): Set<string> {
  const hosts = new Set<string>();
  for (const url of seedUrls) {
    const host = normalizeDiscoveryHost(url);
    if (host) {
      hosts.add(host);
    }
  }
  return hosts;
}

function isAllowedDiscoveryUrl(url: string, allowedHosts: Set<string>): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  for (const allowedHost of allowedHosts) {
    if (host === allowedHost || host.endsWith(`.${allowedHost}`)) {
      return true;
    }
  }

  return false;
}

function extractEmails(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) ?? [];
  return dedupe(
    matches
      .map((value) => value.trim().toLowerCase())
      .filter((value) => !value.endsWith('.png') && !value.includes('example.')),
  );
}

function extractPhones(html: string): string[] {
  const matches = html.match(PHONE_REGEX) ?? [];
  return dedupe(
    matches
      .map((value) => normalizePhone(value))
      .filter((value): value is string => Boolean(value)),
  );
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? 'Official contact page';
}

function absolutizeUrl(baseUrl: string, candidate: string): string | null {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractCandidateUrls(
  html: string,
  baseUrl: string,
  allowedHosts: Set<string>,
  officeScope: 'municipal' | 'district_representative' | 'both',
) {
  const keywordPattern =
    officeScope === 'municipal'
      ? /(contact|transport|public-works|publicworks|mayor|department|city-services)/i
      : officeScope === 'district_representative'
        ? /(council|district|representative|alder|commissioner|elected)/i
        : /(contact|transport|public-works|publicworks|mayor|department|council|district|representative|alder|commissioner)/i;

  const urls: string[] = [];
  const hrefMatches = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of hrefMatches) {
    const candidate = match[1];
    if (!candidate || candidate.startsWith('mailto:') || candidate.startsWith('tel:')) {
      continue;
    }
    if (!keywordPattern.test(candidate)) {
      continue;
    }
    const absolute = absolutizeUrl(baseUrl, candidate);
    if (absolute && isAllowedDiscoveryUrl(absolute, allowedHosts)) {
      urls.push(absolute);
    }
  }

  return dedupe(urls).slice(0, MAX_FETCH_URLS);
}

function inferContactType(
  sourceUrl: string,
  officeScope: 'municipal' | 'district_representative' | 'both',
): ContactType {
  const normalized = sourceUrl.toLowerCase();
  if (
    officeScope !== 'municipal' &&
    /(council|district|representative|alder|commissioner)/.test(normalized)
  ) {
    return 'district_representative';
  }
  return 'municipal';
}

function inferOfficeType(sourceUrl: string): string {
  const normalized = sourceUrl.toLowerCase();
  if (/(transport|mobility|dot|street)/.test(normalized)) {
    return 'transportation';
  }
  if (/(public-works|publicworks|maintenance|service)/.test(normalized)) {
    return 'public_works';
  }
  if (/(mayor|executive)/.test(normalized)) {
    return 'mayor';
  }
  if (/(council|district|representative|alder|commissioner)/.test(normalized)) {
    return 'district_representative';
  }
  return 'general';
}

function officeTitle(officeType: string, pageTitle: string) {
  switch (officeType) {
    case 'transportation':
      return 'Transportation contact';
    case 'public_works':
      return 'Public works contact';
    case 'mayor':
      return 'Executive office contact';
    case 'district_representative':
      return 'District representative contact';
    default:
      return pageTitle;
  }
}

function candidateIdentity(args: {
  contactType: ContactType;
  officeType: string;
  email?: string;
  phone?: string;
  sourceUrl: string;
}) {
  const basis =
    args.email?.toLowerCase() ??
    normalizePhone(args.phone) ??
    args.sourceUrl.toLowerCase();
  return `${args.contactType}:${args.officeType}:${basis}`;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; CurbwiseContactDiscovery/1.0; +https://curbwise.dev)',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Discovery fetch failed for ${url} (${response.status})`);
  }

  return await response.text();
}

async function discoverContacts(
  coverage: CoverageSnapshot,
  officeScope: 'municipal' | 'district_representative' | 'both',
) {
  const seedUrls = dedupe(
    [
      coverage.officialWebsiteUrl,
      ...(coverage.directoryUrls ?? []),
      ...(officeScope === 'municipal'
        ? []
        : coverage.districtDirectoryUrls ?? []),
    ].filter((value): value is string => Boolean(value)),
  );

  const discoveryQueue = [...seedUrls];
  const allowedHosts = buildAllowedDiscoveryHosts(seedUrls);
  const visited = new Set<string>();
  const discovered: DiscoveryCandidate[] = [];
  const now = Date.now();

  while (discoveryQueue.length > 0 && visited.size < MAX_FETCH_URLS) {
    const url = discoveryQueue.shift();
    if (!url || visited.has(url) || !isAllowedDiscoveryUrl(url, allowedHosts)) {
      continue;
    }
    visited.add(url);

    try {
      const html = await fetchHtml(url);
      const emails = extractEmails(html);
      const phones = extractPhones(html);
      const pageTitle = extractTitle(html);
      const sourceDomain = new URL(url).hostname.replace(/^www\./, '');
      const contactType = inferContactType(url, officeScope);
      const officeType = inferOfficeType(url);

      if (emails.length === 0 && phones.length === 0) {
        discovered.push({
          contactType,
          officeType,
          name: coverage.displayName,
          title: officeTitle(officeType, pageTitle),
          sourceUrl: url,
          sourceDomain,
          normalizedIdentity: candidateIdentity({
            contactType,
            officeType,
            sourceUrl: url,
          }),
          confidence: 0.28,
          freshUntil: now + DISCOVERY_FRESHNESS_MS,
        });
      }

      const maxContacts = Math.max(emails.length, phones.length, 1);
      for (let index = 0; index < maxContacts; index += 1) {
        const email = emails[index];
        const phone = phones[index];
        if (!email && !phone) continue;
        discovered.push({
          contactType,
          officeType,
          name: coverage.displayName,
          title: officeTitle(officeType, pageTitle),
          email,
          phone,
          sourceUrl: url,
          sourceDomain,
          normalizedIdentity: candidateIdentity({
            contactType,
            officeType,
            email,
            phone,
            sourceUrl: url,
          }),
          confidence: email ? 0.9 : 0.62,
          freshUntil: now + DISCOVERY_FRESHNESS_MS,
        });
      }

      for (const candidateUrl of extractCandidateUrls(
        html,
        url,
        allowedHosts,
        officeScope,
      )) {
        if (!visited.has(candidateUrl)) {
          discoveryQueue.push(candidateUrl);
        }
      }
    } catch {
      // Keep discovery resilient; the job status will capture aggregate failure if nothing lands.
    }
  }

  const seen = new Set<string>();
  return discovered.filter((candidate) => {
    if (seen.has(candidate.normalizedIdentity)) {
      return false;
    }
    seen.add(candidate.normalizedIdentity);
    return true;
  });
}

function contactsAreFresh(contacts: ContactSnapshot[]) {
  const now = Date.now();
  return contacts.some((contact) => contact.freshUntil > now);
}

function selectRecipients(
  contacts: ContactSnapshot[],
  sourceAction: OutreachSourceAction,
) {
  const preferred =
    sourceAction === 'report_to_city'
      ? contacts.filter((contact) => contact.contactType === 'municipal')
      : [
          ...contacts.filter(
            (contact) => contact.contactType === 'district_representative',
          ),
          ...contacts.filter((contact) => contact.contactType === 'municipal'),
        ];

  const deduped: ContactSnapshot[] = [];
  const seen = new Set<string>();
  for (const contact of preferred) {
    if (seen.has(contact._id)) continue;
    seen.add(contact._id);
    deduped.push(contact);
  }
  return deduped.slice(0, 3);
}

async function resolveCoverageAndContacts(
  ctx: ActionCtx,
  args: {
    address: string;
    lat: number;
    lng: number;
    sessionToken: string;
    hotspotId?: string;
    officeScope: 'municipal' | 'district_representative' | 'both';
    desiredCoverageStatus?: CoverageStatus;
  },
): Promise<ResolveCoverageAndContactsResult> {
  const user = (await ctx.runQuery(api.users.getCurrentUser, {
    sessionToken: args.sessionToken,
  })) as UserSnapshot | null;
  if (!user) {
    throw new Error('Government outreach requires an active session');
  }

  const coverage = (await ctx.runMutation(internal.government.ensureCoverageForLocation, {
    address: args.address,
    lat: args.lat,
    lng: args.lng,
    desiredStatus: args.desiredCoverageStatus,
  })) as CoverageSnapshot | null;

  if (!coverage) {
    throw new Error('Unable to resolve jurisdiction coverage');
  }

  let contacts = (await ctx.runQuery(internal.government.getCoverageContacts, {
    coverageId: coverage._id,
  })) as ContactSnapshot[];

  if (contactsAreFresh(contacts) || isSignedCoverageStatus(coverage.status)) {
    return { user, coverage, contacts, discoveryState: 'cached' as const };
  }

  const job = await ctx.runMutation(internal.government.queueContactDiscoveryJob, {
    coverageId: coverage._id,
    requestedByUserId: user._id,
    hotspotId: args.hotspotId,
    officeScope: args.officeScope,
    trigger: 'hotspot_action',
  });

  if (!job) {
    return { user, coverage, contacts, discoveryState: 'queued' as const };
  }

  await ctx.runMutation(internal.government.updateContactDiscoveryJob, {
    jobId: job._id,
    status: 'running',
  });

  const discovered = await discoverContacts(coverage, args.officeScope);

  if (discovered.length > 0) {
    await ctx.runMutation(internal.government.saveDiscoveredContacts, {
      coverageId: coverage._id,
      contacts: discovered,
    });
    await ctx.runMutation(internal.government.updateContactDiscoveryJob, {
      jobId: job._id,
      status: 'completed',
    });
  } else {
    await ctx.runMutation(internal.government.updateContactDiscoveryJob, {
      jobId: job._id,
      status: 'failed',
      errorMessage: 'No official public contacts were found yet',
    });
  }

  contacts = (await ctx.runQuery(internal.government.getCoverageContacts, {
    coverageId: coverage._id,
  })) as ContactSnapshot[];

  return {
    user,
    coverage,
    contacts,
    discoveryState: discovered.length > 0 ? ('discovered' as const) : ('queued' as const),
  };
}

export const ensureJurisdictionContacts = action({
  args: {
    sessionToken: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    hotspotId: v.optional(v.string()),
    officeScope: v.optional(
      v.union(
        v.literal('municipal'),
        v.literal('district_representative'),
        v.literal('both'),
      ),
    ),
  },
  handler: async (ctx, args): Promise<EnsureJurisdictionContactsResult> => {
    const result = await resolveCoverageAndContacts(ctx, {
      ...args,
      officeScope: args.officeScope ?? 'both',
    });

    const recipientPreview = selectRecipients(result.contacts, 'send_to_rep').map(
      (contact) => ({
        contactId: contact._id,
        title: contact.title,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
      }),
    );

    return {
      coverage: {
        coverageId: result.coverage._id,
        displayName: result.coverage.displayName,
        status: result.coverage.status,
        isSigned: isSignedCoverageStatus(result.coverage.status),
        officialWebsiteUrl: result.coverage.officialWebsiteUrl ?? null,
      },
      discoveryState: result.discoveryState,
      contactCount: result.contacts.length,
      recipientPreview,
    };
  },
});

export const queueUnsignedOutreach = action({
  args: {
    sessionToken: v.string(),
    sourceAction: v.union(
      v.literal('report_to_city'),
      v.literal('send_to_rep'),
    ),
    hotspot: v.object({
      id: v.optional(v.string()),
      title: v.string(),
      description: v.string(),
      address: v.string(),
      lat: v.number(),
      lng: v.number(),
      category: v.string(),
      upvotes: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args): Promise<UnsignedOutreachResult> => {
    const officeScope =
      args.sourceAction === 'report_to_city' ? 'municipal' : 'both';
    const result = await resolveCoverageAndContacts(ctx, {
      sessionToken: args.sessionToken,
      address: args.hotspot.address,
      lat: args.hotspot.lat,
      lng: args.hotspot.lng,
      hotspotId: args.hotspot.id,
      officeScope,
      desiredCoverageStatus: 'outreach',
    });

    if (isSignedCoverageStatus(result.coverage.status)) {
      return {
        status: 'signed',
        message: `${result.coverage.displayName} is already configured for the live workflow.`,
        coverage: {
          coverageId: result.coverage._id,
          displayName: result.coverage.displayName,
          status: result.coverage.status,
        },
      };
    }

    const recipients = selectRecipients(result.contacts, args.sourceAction);
    const outreachCopy = buildOutreachCopy({
      coverageName: result.coverage.displayName,
      sourceAction: args.sourceAction,
      hotspot: args.hotspot,
      officeTargets: recipients.map((contact) => contact.title),
    });

    const request = await ctx.runMutation(internal.government.createOutreachRequest, {
      requestedByUserId: result.user._id,
      coverageId: result.coverage._id,
      hotspotId: args.hotspot.id,
      sourceAction: args.sourceAction,
      status: recipients.length > 0 ? 'queued_review' : 'collecting_contacts',
      jurisdictionName: result.coverage.displayName,
      officeTargets: recipients.map((contact) => contact.title),
      recipientContactIds: recipients.map((contact) => contact._id),
      subject: outreachCopy.subject,
      body: outreachCopy.body,
      summary: outreachCopy.summary,
    });

    return {
      requestId: request?._id ?? null,
      status: recipients.length > 0 ? 'queued_review' : 'collecting_contacts',
      message:
        recipients.length > 0
          ? 'Queued for Curbwise outreach review.'
          : 'We are collecting the right official contacts before Curbwise follows up.',
      coverage: {
        coverageId: result.coverage._id,
        displayName: result.coverage.displayName,
        status: result.coverage.status,
        officialWebsiteUrl: result.coverage.officialWebsiteUrl ?? null,
      },
      recipients: recipients.map((contact) => ({
        contactId: contact._id,
        title: contact.title,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        sourceUrl: contact.sourceUrl,
      })),
      draft: outreachCopy,
    };
  },
});
