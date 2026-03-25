import { v } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { ensureUser } from './users';
import {
  ensureOrganizationForUser,
  getDefaultOrganizationContext,
} from './organizations';
import {
  buildOutreachCopy,
  inferJurisdictionFromLocation,
  inferJurisdictionFromName,
  inferOrganizationTypeFromPopulationBand,
  isSignedCoverageStatus,
  normalizeWorkEmail,
  type ContactType,
  type CoverageStatus,
  type GovernmentLeadStatus,
  type OutreachHotspotContext,
  type OutreachRequestStatus,
  type OutreachSourceAction,
  type PopulationBand,
} from './governmentShared';

type CoverageDoc = Doc<'jurisdictionCoverage'>;

const GOVERNMENT_LEAD_STATUSES: GovernmentLeadStatus[] = [
  'new',
  'reviewing',
  'contacted',
  'qualified',
  'closed',
];

const OUTREACH_REQUEST_STATUSES: OutreachRequestStatus[] = [
  'collecting_contacts',
  'queued_review',
  'ready',
  'sent',
  'blocked',
];

const OPEN_OUTREACH_REQUEST_STATUSES = new Set<OutreachRequestStatus>([
  'collecting_contacts',
  'queued_review',
  'ready',
  'blocked',
]);

const OUTREACH_REQUEST_STATUS_PRECEDENCE: Record<OutreachRequestStatus, number> = {
  collecting_contacts: 0,
  blocked: 1,
  queued_review: 2,
  ready: 3,
  sent: 4,
};

function ensureValidEmail(email: string) {
  const normalized = normalizeWorkEmail(email);
  if (!normalized.includes('@') || normalized.startsWith('@') || normalized.endsWith('@')) {
    throw new Error('Enter a valid work email');
  }
  return normalized;
}

function clipText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function coverageStatusPrecedence(status: CoverageStatus): number {
  switch (status) {
    case 'unsigned':
      return 0;
    case 'outreach':
      return 1;
    case 'pilot':
      return 2;
    case 'active':
      return 3;
    case 'paused':
      return 4;
    default:
      return 0;
  }
}

function mergeCoverageStatus(
  currentStatus: string | undefined,
  desiredStatus: CoverageStatus | undefined,
): CoverageStatus {
  const current = (currentStatus as CoverageStatus | undefined) ?? 'unsigned';
  if (!desiredStatus) return current;
  return coverageStatusPrecedence(desiredStatus) > coverageStatusPrecedence(current)
    ? desiredStatus
    : current;
}

function normalizeOptionalString(value: string | undefined) {
  return value ?? undefined;
}

function isOpenOutreachRequestStatus(status: string | undefined) {
  return status ? OPEN_OUTREACH_REQUEST_STATUSES.has(status as OutreachRequestStatus) : false;
}

function mergeOutreachRequestStatus(
  currentStatus: string | undefined,
  desiredStatus: string,
): OutreachRequestStatus {
  const current = OUTREACH_REQUEST_STATUS_PRECEDENCE[
    (currentStatus as OutreachRequestStatus) ?? 'collecting_contacts'
  ] ?? OUTREACH_REQUEST_STATUS_PRECEDENCE.collecting_contacts;
  const desired = OUTREACH_REQUEST_STATUS_PRECEDENCE[
    desiredStatus as OutreachRequestStatus
  ] ?? OUTREACH_REQUEST_STATUS_PRECEDENCE.collecting_contacts;

  return desired > current
    ? (desiredStatus as OutreachRequestStatus)
    : ((currentStatus as OutreachRequestStatus) ?? 'collecting_contacts');
}

async function findCoverageBySlug(
  ctx: QueryCtx | MutationCtx,
  slug: string,
) {
  return await ctx.db
    .query('jurisdictionCoverage')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique();
}

async function listCoverageContacts(
  ctx: QueryCtx | MutationCtx,
  coverageId: Id<'jurisdictionCoverage'>,
  contactType?: ContactType,
) {
  const contacts = contactType
    ? await ctx.db
        .query('jurisdictionContacts')
        .withIndex('by_coverage_and_contact_type', (q) =>
          q.eq('coverageId', coverageId).eq('contactType', contactType),
        )
        .take(32)
    : await ctx.db
        .query('jurisdictionContacts')
        .withIndex('by_coverage', (q) => q.eq('coverageId', coverageId))
        .take(64);

  return contacts
    .filter((contact) => contact.isActive)
    .sort((a, b) => b.confidence - a.confidence || b.freshUntil - a.freshUntil);
}

async function findLatestLeadForOrganization(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'> | undefined,
) {
  if (!organizationId) return null;
  const leads = await ctx.db
    .query('governmentLeads')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .order('desc')
    .take(1);
  return leads[0] ?? null;
}

async function findLatestLeadForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
) {
  const leads = await ctx.db
    .query('governmentLeads')
    .withIndex('by_submitted_by_user', (q) => q.eq('submittedByUserId', userId))
    .order('desc')
    .take(1);
  return leads[0] ?? null;
}

async function findLeadByEmailAndJurisdiction(
  ctx: QueryCtx | MutationCtx,
  jurisdictionSlug: string,
  normalizedWorkEmail: string,
) {
  return await ctx.db
    .query('governmentLeads')
    .withIndex('by_jurisdiction_slug_and_normalized_work_email', (q) =>
      q.eq('jurisdictionSlug', jurisdictionSlug).eq('normalizedWorkEmail', normalizedWorkEmail),
    )
    .unique();
}

async function buildCoverageSummary(
  ctx: QueryCtx | MutationCtx,
  coverage: CoverageDoc | null,
  fallback: {
    slug: string;
    displayName: string;
    jurisdictionType: string;
    stateCode: string | null;
    officialWebsiteUrl: string | null;
  },
) {
  if (!coverage) {
    return {
      coverageId: null,
      slug: fallback.slug,
      displayName: fallback.displayName,
      jurisdictionType: fallback.jurisdictionType,
      stateCode: fallback.stateCode,
      status: 'unsigned',
      isSigned: false,
      officialWebsiteUrl: fallback.officialWebsiteUrl,
      contactCount: 0,
      freshContactCount: 0,
      topContacts: [],
      lastContactSyncAt: null,
      lastDiscoveryAttemptAt: null,
    };
  }

  const contacts = await listCoverageContacts(ctx, coverage._id);
  const now = Date.now();

  return {
    coverageId: coverage._id,
    slug: coverage.slug,
    displayName: coverage.displayName,
    jurisdictionType: coverage.jurisdictionType,
    stateCode: coverage.stateCode ?? null,
    status: coverage.status,
    isSigned: isSignedCoverageStatus(coverage.status),
    officialWebsiteUrl: coverage.officialWebsiteUrl ?? null,
    contactCount: contacts.length,
    freshContactCount: contacts.filter((contact) => contact.freshUntil > now).length,
    topContacts: contacts.slice(0, 4).map((contact) => ({
      contactId: contact._id,
      contactType: contact.contactType,
      officeType: contact.officeType,
      districtLabel: contact.districtLabel ?? null,
      name: contact.name,
      title: contact.title,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      sourceUrl: contact.sourceUrl,
      confidence: contact.confidence,
      freshUntil: contact.freshUntil,
    })),
    lastContactSyncAt: coverage.lastContactSyncAt ?? null,
    lastDiscoveryAttemptAt: coverage.lastDiscoveryAttemptAt ?? null,
  };
}

async function ensureCoverageFromInference(
  ctx: MutationCtx,
  inferred: ReturnType<typeof inferJurisdictionFromLocation>,
  desiredStatus?: CoverageStatus,
  activeOrganizationId?: Id<'organizations'>,
) {
  const existing = await findCoverageBySlug(ctx, inferred.slug);
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      displayName: existing.displayName || inferred.displayName,
      jurisdictionType: existing.jurisdictionType || inferred.jurisdictionType,
      stateCode: existing.stateCode ?? inferred.stateCode ?? undefined,
      status: mergeCoverageStatus(existing.status as CoverageStatus, desiredStatus),
      officialWebsiteUrl:
        existing.officialWebsiteUrl ?? inferred.officialWebsiteUrl ?? undefined,
      directoryUrls:
        existing.directoryUrls && existing.directoryUrls.length > 0
          ? existing.directoryUrls
          : inferred.directoryUrls.length > 0
            ? inferred.directoryUrls
            : undefined,
      districtDirectoryUrls:
        existing.districtDirectoryUrls && existing.districtDirectoryUrls.length > 0
          ? existing.districtDirectoryUrls
          : inferred.districtDirectoryUrls.length > 0
            ? inferred.districtDirectoryUrls
            : undefined,
      activeOrganizationId: activeOrganizationId ?? existing.activeOrganizationId,
      lastHotspotAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(existing._id);
  }

  const coverageId = await ctx.db.insert('jurisdictionCoverage', {
    slug: inferred.slug,
    displayName: inferred.displayName,
    jurisdictionType: inferred.jurisdictionType,
    stateCode: inferred.stateCode ?? undefined,
    status: desiredStatus ?? 'unsigned',
    officialWebsiteUrl: inferred.officialWebsiteUrl ?? undefined,
    directoryUrls:
      inferred.directoryUrls.length > 0 ? inferred.directoryUrls : undefined,
    districtDirectoryUrls:
      inferred.districtDirectoryUrls.length > 0
        ? inferred.districtDirectoryUrls
        : undefined,
    activeOrganizationId,
    lastHotspotAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(coverageId);
}

export const getJurisdictionSummaryForLocation = query({
  args: {
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const inferred = inferJurisdictionFromLocation(args);
    const coverage = await findCoverageBySlug(ctx, inferred.slug);
    return await buildCoverageSummary(ctx, coverage, inferred);
  },
});

export const getGovernmentHubContext = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_session', (q) => q.eq('sessionToken', args.sessionToken))
      .unique();

    if (!user) {
      return null;
    }

    const organizationContext = await getDefaultOrganizationContext(ctx, user._id);
    const membership = organizationContext?.membership ?? null;
    const organization = organizationContext?.organization ?? null;

    const latestLead =
      (organization
        ? await findLatestLeadForOrganization(ctx, organization._id)
        : null) ?? (await findLatestLeadForUser(ctx, user._id));

    const inferredCoverage = organization?.jurisdictionName
      ? inferJurisdictionFromName(
          organization.jurisdictionName,
          organization.populationBand as PopulationBand | undefined,
        )
      : latestLead
        ? inferJurisdictionFromName(
            latestLead.jurisdictionName,
            latestLead.populationBand as PopulationBand | undefined,
          )
        : null;

    const coverage = inferredCoverage
      ? await findCoverageBySlug(ctx, inferredCoverage.slug)
      : null;
    const coverageSummary = inferredCoverage
      ? await buildCoverageSummary(ctx, coverage, inferredCoverage)
      : null;

    return {
      coverage: coverageSummary,
      latestLead: latestLead
        ? {
            leadId: latestLead._id,
            jurisdictionName: latestLead.jurisdictionName,
            workEmail: latestLead.workEmail,
            roleTitle: latestLead.roleTitle,
            sourceSurface: latestLead.sourceSurface,
            requestedFeature: latestLead.requestedFeature ?? null,
            status: latestLead.status,
            submissionCount: latestLead.submissionCount,
            lastSubmittedAt: latestLead.lastSubmittedAt,
          }
        : null,
    };
  },
});

export const submitGovernmentLead = mutation({
  args: {
    sessionToken: v.string(),
    jurisdictionName: v.string(),
    workEmail: v.string(),
    roleTitle: v.string(),
    phone: v.optional(v.string()),
    populationBand: v.optional(v.string()),
    notes: v.optional(v.string()),
    sourceSurface: v.string(),
    requestedFeature: v.optional(v.string()),
    hotspotId: v.optional(v.string()),
    reportId: v.optional(v.string()),
    designId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    const organizationContext = await ensureOrganizationForUser(ctx, user);
    const jurisdictionName = clipText(args.jurisdictionName, 120);
    const roleTitle = clipText(args.roleTitle, 120);
    const workEmail = clipText(args.workEmail, 200);
    const normalizedWorkEmail = ensureValidEmail(workEmail);
    const notes = args.notes ? clipText(args.notes, 1500) : undefined;
    const populationBand = args.populationBand
      ? (args.populationBand as PopulationBand)
      : undefined;

    if (!jurisdictionName) {
      throw new Error('Jurisdiction name is required');
    }
    if (!roleTitle) {
      throw new Error('Role or title is required');
    }

    const inferred = inferJurisdictionFromName(jurisdictionName, populationBand);
    const coverage = await ensureCoverageFromInference(
      ctx,
      inferred,
      'outreach',
      undefined,
    );
    if (!coverage) {
      throw new Error('Unable to create jurisdiction coverage record');
    }

    const existingLead = await findLeadByEmailAndJurisdiction(
      ctx,
      inferred.slug,
      normalizedWorkEmail,
    );
    const now = Date.now();

    if (
      organizationContext.organization.jurisdictionName !== jurisdictionName ||
      organizationContext.organization.populationBand !==
        (populationBand ?? organizationContext.organization.populationBand)
    ) {
      await ctx.db.patch(organizationContext.organization._id, {
        jurisdictionName,
        populationBand:
          populationBand ?? organizationContext.organization.populationBand,
        organizationType:
          organizationContext.organization.organizationType === 'individual'
            ? inferOrganizationTypeFromPopulationBand(populationBand)
            : organizationContext.organization.organizationType,
        updatedAt: now,
      });
    }

    if (existingLead && GOVERNMENT_LEAD_STATUSES.includes(existingLead.status as GovernmentLeadStatus)) {
      await ctx.db.patch(existingLead._id, {
        organizationId: existingLead.organizationId ?? organizationContext.organization._id,
        jurisdictionName,
        workEmail,
        normalizedWorkEmail,
        roleTitle,
        phone: args.phone ? clipText(args.phone, 32) : existingLead.phone,
        populationBand: populationBand ?? existingLead.populationBand,
        notes: notes ?? existingLead.notes,
        sourceSurface: args.sourceSurface,
        requestedFeature: args.requestedFeature ?? existingLead.requestedFeature,
        hotspotId: args.hotspotId ?? existingLead.hotspotId,
        reportId: args.reportId ?? existingLead.reportId,
        designId: args.designId ?? existingLead.designId,
        status:
          existingLead.status === 'closed'
            ? 'new'
            : existingLead.status,
        submissionCount: existingLead.submissionCount + 1,
        lastSubmittedAt: now,
        updatedAt: now,
      });

      const updatedLead = await ctx.db.get(existingLead._id);
      const coverageSummary = await buildCoverageSummary(ctx, coverage, inferred);
      return {
        leadId: updatedLead?._id ?? existingLead._id,
        created: false,
        status: updatedLead?.status ?? existingLead.status,
        coverage: coverageSummary,
      };
    }

    const leadId = await ctx.db.insert('governmentLeads', {
      submittedByUserId: user._id,
      organizationId: organizationContext.organization._id,
      jurisdictionSlug: inferred.slug,
      jurisdictionName,
      workEmail,
      normalizedWorkEmail,
      roleTitle,
      phone: args.phone ? clipText(args.phone, 32) : undefined,
      populationBand,
      notes,
      sourceSurface: args.sourceSurface,
      requestedFeature: args.requestedFeature,
      hotspotId: args.hotspotId,
      reportId: args.reportId,
      designId: args.designId,
      status: 'new',
      submissionCount: 1,
      lastSubmittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const coverageSummary = await buildCoverageSummary(ctx, coverage, inferred);
    return {
      leadId,
      created: true,
      status: 'new',
      coverage: coverageSummary,
    };
  },
});

export const getCoverageContacts = internalQuery({
  args: {
    coverageId: v.id('jurisdictionCoverage'),
    contactType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await listCoverageContacts(
      ctx,
      args.coverageId,
      args.contactType as ContactType | undefined,
    );
  },
});

export const getCoverageById = internalQuery({
  args: {
    coverageId: v.id('jurisdictionCoverage'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.coverageId);
  },
});

export const ensureCoverageForLocation = internalMutation({
  args: {
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    desiredStatus: v.optional(v.string()),
    activeOrganizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const inferred = inferJurisdictionFromLocation(args);
    return await ensureCoverageFromInference(
      ctx,
      inferred,
      args.desiredStatus as CoverageStatus | undefined,
      args.activeOrganizationId,
    );
  },
});

export const ensureCoverageForJurisdiction = internalMutation({
  args: {
    jurisdictionName: v.string(),
    populationBand: v.optional(v.string()),
    desiredStatus: v.optional(v.string()),
    activeOrganizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const inferred = inferJurisdictionFromName(
      args.jurisdictionName,
      args.populationBand as PopulationBand | undefined,
    );
    return await ensureCoverageFromInference(
      ctx,
      inferred,
      args.desiredStatus as CoverageStatus | undefined,
      args.activeOrganizationId,
    );
  },
});

export const queueContactDiscoveryJob = internalMutation({
  args: {
    coverageId: v.id('jurisdictionCoverage'),
    requestedByUserId: v.optional(v.id('users')),
    hotspotId: v.optional(v.string()),
    officeScope: v.string(),
    trigger: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('contactDiscoveryJobs')
      .withIndex('by_coverage_and_status', (q) =>
        q.eq('coverageId', args.coverageId).eq('status', 'queued'),
      )
      .take(8);

    const openJob = existing.find(
      (job) => job.officeScope === args.officeScope || job.officeScope === 'both',
    );
    if (openJob) {
      return openJob;
    }

    const now = Date.now();
    const jobId = await ctx.db.insert('contactDiscoveryJobs', {
      coverageId: args.coverageId,
      requestedByUserId: args.requestedByUserId,
      hotspotId: args.hotspotId,
      officeScope: args.officeScope,
      trigger: args.trigger,
      status: 'queued',
      attempts: 0,
      queuedAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(jobId);
  },
});

export const updateContactDiscoveryJob = internalMutation({
  args: {
    jobId: v.id('contactDiscoveryJobs'),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: args.status,
      attempts: job.attempts + (args.status === 'running' ? 1 : 0),
      errorMessage: args.errorMessage,
      startedAt: args.status === 'running' ? now : job.startedAt,
      completedAt:
        args.status === 'completed' || args.status === 'failed'
          ? now
          : job.completedAt,
      updatedAt: now,
    });

    return await ctx.db.get(args.jobId);
  },
});

export const saveDiscoveredContacts = internalMutation({
  args: {
    coverageId: v.id('jurisdictionCoverage'),
    contacts: v.array(
      v.object({
        contactType: v.string(),
        officeType: v.string(),
        districtLabel: v.optional(v.string()),
        name: v.string(),
        title: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        sourceUrl: v.string(),
        sourceDomain: v.string(),
        normalizedIdentity: v.string(),
        confidence: v.number(),
        freshUntil: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const savedIds: Id<'jurisdictionContacts'>[] = [];
    const now = Date.now();

    for (const contact of args.contacts) {
      const existing = await ctx.db
        .query('jurisdictionContacts')
        .withIndex('by_coverage_and_normalized_identity', (q) =>
          q
            .eq('coverageId', args.coverageId)
            .eq('normalizedIdentity', contact.normalizedIdentity),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          contactType: contact.contactType,
          officeType: contact.officeType,
          districtLabel: contact.districtLabel,
          name: contact.name,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          sourceUrl: contact.sourceUrl,
          sourceDomain: contact.sourceDomain,
          confidence: contact.confidence,
          freshUntil: contact.freshUntil,
          isActive: true,
          updatedAt: now,
        });
        savedIds.push(existing._id);
        continue;
      }

      const contactId = await ctx.db.insert('jurisdictionContacts', {
        coverageId: args.coverageId,
        contactType: contact.contactType,
        officeType: contact.officeType,
        districtLabel: contact.districtLabel,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        sourceUrl: contact.sourceUrl,
        sourceDomain: contact.sourceDomain,
        normalizedIdentity: contact.normalizedIdentity,
        confidence: contact.confidence,
        freshUntil: contact.freshUntil,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      savedIds.push(contactId);
    }

    await ctx.db.patch(args.coverageId, {
      lastContactSyncAt: now,
      updatedAt: now,
    });

    return savedIds;
  },
});

export const createOutreachRequest = internalMutation({
  args: {
    requestedByUserId: v.id('users'),
    coverageId: v.id('jurisdictionCoverage'),
    hotspotId: v.optional(v.string()),
    reportId: v.optional(v.string()),
    designId: v.optional(v.string()),
    sourceAction: v.string(),
    status: v.string(),
    jurisdictionName: v.string(),
    officeTargets: v.array(v.string()),
    recipientContactIds: v.array(v.id('jurisdictionContacts')),
    subject: v.string(),
    body: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedStatus = OUTREACH_REQUEST_STATUSES.includes(
      args.status as OutreachRequestStatus,
    )
      ? (args.status as OutreachRequestStatus)
      : 'collecting_contacts';
    const openRequests = await ctx.db
      .query('outreachRequests')
      .withIndex('by_requested_by_user', (q) =>
        q.eq('requestedByUserId', args.requestedByUserId),
      )
      .order('desc')
      .take(32);

    const existing = openRequests.find(
      (request) =>
        isOpenOutreachRequestStatus(request.status) &&
        request.requestedByUserId === args.requestedByUserId &&
        request.coverageId === args.coverageId &&
        request.sourceAction === args.sourceAction &&
        normalizeOptionalString(request.hotspotId) === normalizeOptionalString(args.hotspotId) &&
        normalizeOptionalString(request.reportId) === normalizeOptionalString(args.reportId) &&
        normalizeOptionalString(request.designId) === normalizeOptionalString(args.designId),
    );

    if (existing) {
      const mergedStatus = mergeOutreachRequestStatus(existing.status, normalizedStatus);
      await ctx.db.patch(existing._id, {
        hotspotId: args.hotspotId,
        reportId: args.reportId,
        designId: args.designId,
        status: mergedStatus,
        jurisdictionName: args.jurisdictionName,
        officeTargets: args.officeTargets,
        recipientContactIds: args.recipientContactIds,
        subject: args.subject,
        body: args.body,
        summary: args.summary,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const requestId = await ctx.db.insert('outreachRequests', {
      requestedByUserId: args.requestedByUserId,
      coverageId: args.coverageId,
      hotspotId: args.hotspotId,
      reportId: args.reportId,
      designId: args.designId,
      sourceAction: args.sourceAction,
      status: normalizedStatus,
      jurisdictionName: args.jurisdictionName,
      officeTargets: args.officeTargets,
      recipientContactIds: args.recipientContactIds,
      subject: args.subject,
      body: args.body,
      summary: args.summary,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(requestId);
  },
});

export const buildUnsignedOutreachPreview = internalQuery({
  args: {
    coverageId: v.id('jurisdictionCoverage'),
    sourceAction: v.string(),
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
  handler: async (ctx, args) => {
    const coverage = await ctx.db.get(args.coverageId);
    if (!coverage) return null;

    const contacts = await listCoverageContacts(ctx, coverage._id);
    const officeTargets = contacts
      .slice(0, 3)
      .map((contact) => contact.title)
      .filter(Boolean);
    return buildOutreachCopy({
      coverageName: coverage.displayName,
      sourceAction: args.sourceAction as OutreachSourceAction,
      hotspot: args.hotspot as OutreachHotspotContext,
      officeTargets,
    });
  },
});
