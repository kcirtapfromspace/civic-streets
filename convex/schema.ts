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
    title: v.string(),
    description: v.string(),
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
    .index('by_hotspot', ['hotspotId'])
    .index('by_upvotes', ['upvotes'])
    .searchIndex('search_designs', {
      searchField: 'title',
    }),

  // ── Rep Reports ────────────────────────────────────────────────────────
  // Packages sent to local government representatives
  reports: defineTable({
    userId: v.id('users'),
    designId: v.optional(v.id('designs')),
    hotspotId: v.optional(v.id('hotspots')),
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
    .index('by_design', ['designId'])
    .index('by_hotspot', ['hotspotId'])
    .index('by_status', ['status']),
});
