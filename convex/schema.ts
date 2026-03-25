import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ── Users ──────────────────────────────────────────────────────────────
  // Anonymous-first: every visitor gets a session. Can optionally upgrade
  // to email/OAuth for persistent identity.
  users: defineTable({
    // Anonymous users get a random display name; authenticated users set theirs
    displayName: v.string(),
    // null = anonymous session, string = authenticated
    email: v.optional(v.string()),
    authProvider: v.optional(v.string()), // 'email' | 'google' | 'github'
    authId: v.optional(v.string()),       // provider-specific ID
    // Anonymous session token (stored in localStorage on client)
    sessionToken: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    reputation: v.number(),               // earned through contributions
    createdAt: v.number(),
  })
    .index('by_session', ['sessionToken'])
    .index('by_auth', ['authProvider', 'authId'])
    .index('by_email', ['email']),

  // ── Organizations ───────────────────────────────────────────────────────
  organizations: defineTable({
    ownerUserId: v.id('users'),
    name: v.string(),
    slug: v.string(),
    organizationType: v.string(), // 'individual' | 'town' | 'city' | 'transit_agency' | 'consultancy' | 'advocacy'
    jurisdictionName: v.optional(v.string()),
    populationBand: v.string(), // 'individual' | 'under_50k' | '50k_to_500k' | 'over_500k_or_regional'
    contractTier: v.string(), // 'civic_free' | 'town_essential' | 'city_standard' | 'agency_enterprise'
    procurementState: v.string(), // 'none' | 'pilot' | 'security_review' | 'contracting' | 'active'
    invoiceMode: v.string(), // 'self_serve' | 'annual_invoice' | 'purchase_order'
    purchaseOrderNumber: v.optional(v.string()),
    contractRenewalDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_user', ['ownerUserId'])
    .index('by_slug', ['slug'])
    .index('by_contract_tier', ['contractTier']),

  organizationMembers: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    role: v.string(), // 'owner' | 'admin' | 'member' | 'billing_admin'
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId']),

  workspaces: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    slug: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_slug', ['organizationId', 'slug']),

  projects: defineTable({
    organizationId: v.id('organizations'),
    workspaceId: v.id('workspaces'),
    ownerUserId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.string(), // 'public' | 'private'
    sourceType: v.string(), // 'design' | 'report' | 'mixed'
    linkedDesignId: v.optional(v.id('designs')),
    linkedReportId: v.optional(v.id('reports')),
    status: v.string(), // 'draft' | 'in_review' | 'approved'
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_owner_user', ['ownerUserId'])
    .index('by_design', ['linkedDesignId'])
    .index('by_report', ['linkedReportId']),

  projectShares: defineTable({
    projectId: v.id('projects'),
    shareToken: v.string(),
    access: v.string(), // 'read_only'
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_share_token', ['shareToken']),

  reviewThreads: defineTable({
    organizationId: v.id('organizations'),
    workspaceId: v.optional(v.id('workspaces')),
    projectId: v.optional(v.id('projects')),
    authorUserId: v.id('users'),
    status: v.string(), // 'open' | 'resolved'
    targetType: v.string(), // 'project' | 'design' | 'report'
    targetId: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index('by_org', ['organizationId'])
    .index('by_project', ['projectId'])
    .index('by_status', ['status']),

  auditEvents: defineTable({
    organizationId: v.id('organizations'),
    workspaceId: v.optional(v.id('workspaces')),
    projectId: v.optional(v.id('projects')),
    actorUserId: v.optional(v.id('users')),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_project', ['projectId'])
    .index('by_event_type', ['eventType']),

  // ── Billing Accounts ───────────────────────────────────────────────────
  // One billing account per user for self-serve subscriptions.
  billingAccounts: defineTable({
    ownerUserId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    stripeCustomerId: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    planKey: v.string(), // 'free' | 'pro' | 'team'
    billingStatus: v.string(), // 'inactive' | 'pending' | 'active' | 'trialing' | 'past_due' | 'canceled'
    entitlementSummary: v.record(v.string(), v.boolean()),
    organizationType: v.optional(v.string()),
    jurisdictionName: v.optional(v.string()),
    populationBand: v.optional(v.string()),
    contractTier: v.optional(v.string()),
    procurementState: v.optional(v.string()),
    billingAdminUserIds: v.optional(v.array(v.id('users'))),
    invoiceMode: v.optional(v.string()),
    purchaseOrderNumber: v.optional(v.string()),
    contractRenewalDate: v.optional(v.number()),
    lastCheckoutSessionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_user', ['ownerUserId'])
    .index('by_organization', ['organizationId'])
    .index('by_stripe_customer_id', ['stripeCustomerId']),

  // ── Billing Subscriptions ───────────────────────────────────────────────
  // Current subscription projection from Stripe webhooks.
  billingSubscriptions: defineTable({
    billingAccountId: v.id('billingAccounts'),
    organizationId: v.optional(v.id('organizations')),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.optional(v.string()),
    stripePriceLookupKey: v.optional(v.string()),
    stripeProductId: v.optional(v.string()),
    planKey: v.string(),
    billingStatus: v.string(),
    entitlementSummary: v.record(v.string(), v.boolean()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    latestInvoiceId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_billing_account', ['billingAccountId'])
    .index('by_stripe_subscription_id', ['stripeSubscriptionId']),

  // ── Billing Events ──────────────────────────────────────────────────────
  // Stripe webhook idempotency ledger.
  billingEvents: defineTable({
    stripeEventId: v.string(),
    eventType: v.string(),
    payloadSummary: v.string(),
    status: v.string(),
    processedAt: v.number(),
  })
    .index('by_stripe_event_id', ['stripeEventId']),

  // ── Government Leads ───────────────────────────────────────────────────
  governmentLeads: defineTable({
    submittedByUserId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    jurisdictionSlug: v.string(),
    jurisdictionName: v.string(),
    workEmail: v.string(),
    normalizedWorkEmail: v.string(),
    roleTitle: v.string(),
    phone: v.optional(v.string()),
    populationBand: v.optional(v.string()),
    notes: v.optional(v.string()),
    sourceSurface: v.string(), // 'landing' | 'account'
    requestedFeature: v.optional(v.string()),
    hotspotId: v.optional(v.string()),
    reportId: v.optional(v.string()),
    designId: v.optional(v.string()),
    status: v.string(), // 'new' | 'reviewing' | 'contacted' | 'qualified' | 'closed'
    submissionCount: v.number(),
    lastSubmittedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_jurisdiction_slug_and_normalized_work_email', [
      'jurisdictionSlug',
      'normalizedWorkEmail',
    ])
    .index('by_organization', ['organizationId'])
    .index('by_submitted_by_user', ['submittedByUserId'])
    .index('by_status', ['status']),

  // ── Jurisdiction Coverage ──────────────────────────────────────────────
  jurisdictionCoverage: defineTable({
    slug: v.string(),
    displayName: v.string(),
    jurisdictionType: v.string(), // 'town' | 'city' | 'transit_agency'
    stateCode: v.optional(v.string()),
    status: v.string(), // 'unsigned' | 'outreach' | 'pilot' | 'active' | 'paused'
    officialWebsiteUrl: v.optional(v.string()),
    directoryUrls: v.optional(v.array(v.string())),
    districtDirectoryUrls: v.optional(v.array(v.string())),
    activeOrganizationId: v.optional(v.id('organizations')),
    lastContactSyncAt: v.optional(v.number()),
    lastDiscoveryAttemptAt: v.optional(v.number()),
    lastHotspotAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_active_organization', ['activeOrganizationId']),

  // ── Jurisdiction Contacts ──────────────────────────────────────────────
  jurisdictionContacts: defineTable({
    coverageId: v.id('jurisdictionCoverage'),
    contactType: v.string(), // 'municipal' | 'district_representative'
    officeType: v.string(), // 'general' | 'mayor' | 'transportation' | 'public_works' | 'city_council' | 'district_representative'
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
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_coverage', ['coverageId'])
    .index('by_coverage_and_contact_type', ['coverageId', 'contactType'])
    .index('by_coverage_and_normalized_identity', [
      'coverageId',
      'normalizedIdentity',
    ])
    .index('by_email', ['email']),

  // ── Contact Discovery Jobs ─────────────────────────────────────────────
  contactDiscoveryJobs: defineTable({
    coverageId: v.id('jurisdictionCoverage'),
    requestedByUserId: v.optional(v.id('users')),
    hotspotId: v.optional(v.string()),
    officeScope: v.string(), // 'municipal' | 'district_representative' | 'both'
    trigger: v.string(), // 'seed' | 'hotspot_action' | 'lead_capture'
    status: v.string(), // 'queued' | 'running' | 'completed' | 'failed'
    attempts: v.number(),
    errorMessage: v.optional(v.string()),
    queuedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_coverage_and_status', ['coverageId', 'status'])
    .index('by_status', ['status'])
    .index('by_hotspot', ['hotspotId']),

  // ── Outreach Requests ──────────────────────────────────────────────────
  outreachRequests: defineTable({
    requestedByUserId: v.id('users'),
    coverageId: v.id('jurisdictionCoverage'),
    hotspotId: v.optional(v.string()),
    reportId: v.optional(v.string()),
    designId: v.optional(v.string()),
    sourceAction: v.string(), // 'report_to_city' | 'send_to_rep'
    status: v.string(), // 'collecting_contacts' | 'queued_review' | 'ready' | 'sent' | 'blocked'
    jurisdictionName: v.string(),
    officeTargets: v.array(v.string()),
    recipientContactIds: v.array(v.id('jurisdictionContacts')),
    subject: v.string(),
    body: v.string(),
    summary: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_coverage', ['coverageId'])
    .index('by_status', ['status'])
    .index('by_requested_by_user', ['requestedByUserId'])
    .index('by_hotspot', ['hotspotId']),

  // ── Hotspots ───────────────────────────────────────────────────────────
  // Community-reported street safety/improvement hotspots
  hotspots: defineTable({
    userId: v.id('users'),
    title: v.string(),
    description: v.string(),
    category: v.string(), // 'dangerous-intersection' | 'needs-bike-lane' | 'speeding' | 'poor-sidewalk' | 'transit-gap' | 'accessibility' | 'other'
    severity: v.string(), // 'low' | 'medium' | 'high' | 'critical'
    // Location
    lat: v.number(),
    lng: v.number(),
    address: v.string(),
    // Optional photo URLs (stored externally or as Convex file references)
    photoUrls: v.array(v.string()),
    // Community engagement
    upvotes: v.number(),
    commentCount: v.number(),
    // Status tracking
    status: v.string(), // 'open' | 'acknowledged' | 'in-progress' | 'resolved'
    // Link to a design if someone created one for this hotspot
    designId: v.optional(v.id('designs')),
    // Civic report integration (SeeClickFix, Open311, etc.)
    civicReportId: v.optional(v.string()),
    civicReportUrl: v.optional(v.string()),
    // Accessibility subtype for structured ADA reporting
    accessibilitySubtype: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_location', ['lat', 'lng'])
    .index('by_category', ['category'])
    .index('by_status', ['status'])
    .index('by_upvotes', ['upvotes'])
    .index('by_user', ['userId'])
    .searchIndex('search_hotspots', {
      searchField: 'title',
      filterFields: ['category', 'status'],
    }),

  // ── Hotspot Votes ──────────────────────────────────────────────────────
  hotspotVotes: defineTable({
    hotspotId: v.id('hotspots'),
    userId: v.id('users'),
    value: v.number(), // +1 or -1
    createdAt: v.number(),
  })
    .index('by_hotspot', ['hotspotId'])
    .index('by_user_hotspot', ['userId', 'hotspotId']),

  // ── Comments ───────────────────────────────────────────────────────────
  comments: defineTable({
    hotspotId: v.optional(v.id('hotspots')),
    designId: v.optional(v.id('designs')),
    userId: v.id('users'),
    parentId: v.optional(v.id('comments')), // for threaded replies
    body: v.string(),
    upvotes: v.number(),
    createdAt: v.number(),
  })
    .index('by_hotspot', ['hotspotId', 'createdAt'])
    .index('by_design', ['designId', 'createdAt'])
    .index('by_parent', ['parentId']),

  // ── Designs ────────────────────────────────────────────────────────────
  // Street cross-section designs saved to the community
  designs: defineTable({
    userId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    workspaceId: v.optional(v.id('workspaces')),
    projectId: v.optional(v.id('projects')),
    title: v.string(),
    description: v.string(),
    visibility: v.optional(v.string()), // 'public' | 'private'
    reviewStatus: v.optional(v.string()), // 'draft' | 'in_review' | 'approved'
    // The full StreetSegment JSON (before and after)
    streetData: v.string(),       // JSON stringified StreetSegment
    beforeStreetData: v.optional(v.string()),
    // Location context
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    address: v.optional(v.string()),
    // Validation summary
    prowagPass: v.boolean(),
    nactoPass: v.boolean(),
    errorCount: v.number(),
    warningCount: v.number(),
    // Community engagement
    upvotes: v.number(),
    commentCount: v.number(),
    // Template info
    templateId: v.optional(v.string()),
    // Linked hotspot
    hotspotId: v.optional(v.id('hotspots')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_location', ['lat', 'lng'])
    .index('by_user', ['userId'])
    .index('by_workspace', ['workspaceId'])
    .index('by_visibility', ['visibility'])
    .index('by_hotspot', ['hotspotId'])
    .index('by_upvotes', ['upvotes'])
    .searchIndex('search_designs', {
      searchField: 'title',
    }),

  // ── Rep Reports ────────────────────────────────────────────────────────
  // Packages sent to local government representatives
  reports: defineTable({
    userId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    workspaceId: v.optional(v.id('workspaces')),
    projectId: v.optional(v.id('projects')),
    designId: v.optional(v.id('designs')),
    hotspotId: v.optional(v.id('hotspots')),
    visibility: v.optional(v.string()), // 'public' | 'private'
    reviewStatus: v.optional(v.string()), // 'draft' | 'in_review' | 'approved'
    // Representative info
    repName: v.string(),
    repTitle: v.string(),      // "City Council Member, District 5"
    repEmail: v.optional(v.string()),
    repPhone: v.optional(v.string()),
    // Location
    address: v.string(),
    // Report content
    subject: v.string(),
    body: v.string(),
    // Community backing
    communityVotes: v.number(),
    supporterCount: v.number(),
    // Status
    status: v.string(), // 'draft' | 'sent' | 'delivered' | 'responded'
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_workspace', ['workspaceId'])
    .index('by_design', ['designId'])
    .index('by_hotspot', ['hotspotId'])
    .index('by_status', ['status']),
});
