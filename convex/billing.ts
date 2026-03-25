import { v } from 'convex/values';
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { ensureOrganizationForUser } from './organizations';

type BillingPlanKey =
  | 'civic_free'
  | 'town_essential'
  | 'city_standard'
  | 'agency_enterprise';
type BillingStatus =
  | 'inactive'
  | 'pending'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled';
type EntitlementSummary = Record<string, boolean>;

const DEFAULT_ENTITLEMENTS: Record<BillingPlanKey, EntitlementSummary> = {
  civic_free: {
    public_hotspots: true,
    public_issue_reports: true,
    public_proposals: true,
    public_share_links: true,
    basic_public_exports: true,
  },
  town_essential: {
    public_hotspots: true,
    public_issue_reports: true,
    public_proposals: true,
    public_share_links: true,
    basic_public_exports: true,
    private_workspaces: true,
    private_projects: true,
    branded_exports: true,
    advanced_templates: true,
    review_threads: true,
  },
  city_standard: {
    public_hotspots: true,
    public_issue_reports: true,
    public_proposals: true,
    public_share_links: true,
    basic_public_exports: true,
    private_workspaces: true,
    private_projects: true,
    branded_exports: true,
    advanced_templates: true,
    review_threads: true,
    approval_states: true,
    member_roles: true,
    invoice_mode: true,
    priority_support: true,
  },
  agency_enterprise: {
    public_hotspots: true,
    public_issue_reports: true,
    public_proposals: true,
    public_share_links: true,
    basic_public_exports: true,
    private_workspaces: true,
    private_projects: true,
    branded_exports: true,
    advanced_templates: true,
    review_threads: true,
    approval_states: true,
    member_roles: true,
    billing_admin: true,
    invoice_mode: true,
    audit_logs: true,
    sso: true,
    custom_overlays: true,
    retention_controls: true,
    priority_support: true,
  },
};

export const PLAN_PRICE_LOOKUP_KEYS = {
  town_essential: {
    year: 'curbwise-town-essential-annual',
  },
} as const;

const PLAN_KEY_BY_PRICE_LOOKUP_KEY = new Map<string, BillingPlanKey>([
  [PLAN_PRICE_LOOKUP_KEYS.town_essential.year, 'town_essential'],
  ['curbwise-pro-annual', 'town_essential'],
  ['curbwise-pro-monthly', 'town_essential'],
  ['curbwise-team-annual', 'city_standard'],
  ['curbwise-team-monthly', 'city_standard'],
]);

function getDefaultEntitlements(planKey: BillingPlanKey): EntitlementSummary {
  return { ...DEFAULT_ENTITLEMENTS[planKey] };
}

function mergeEntitlements(...summaries: Array<EntitlementSummary | undefined>) {
  const merged: EntitlementSummary = {};
  for (const summary of summaries) {
    if (!summary) continue;
    for (const [feature, enabled] of Object.entries(summary)) {
      if (enabled) {
        merged[feature] = true;
      }
    }
  }
  return merged;
}

function normalizePlanKey(planKey: string | undefined): BillingPlanKey {
  if (planKey === 'town_essential' || planKey === 'pro') {
    return 'town_essential';
  }
  if (planKey === 'city_standard' || planKey === 'team') {
    return 'city_standard';
  }
  if (planKey === 'agency_enterprise' || planKey === 'enterprise') {
    return 'agency_enterprise';
  }
  return 'civic_free';
}

function normalizeBillingStatus(status: string | undefined): BillingStatus {
  if (
    status === 'inactive' ||
    status === 'pending' ||
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'canceled'
  ) {
    return status;
  }
  return 'inactive';
}

function isActiveBillingStatus(status: BillingStatus): boolean {
  return status === 'active' || status === 'trialing';
}

function planKeyFromLookupKey(lookupKey?: string): BillingPlanKey {
  if (!lookupKey) return 'civic_free';
  return PLAN_KEY_BY_PRICE_LOOKUP_KEY.get(lookupKey) ?? 'civic_free';
}

export function getPriceLookupKey(
  planKey: Extract<BillingPlanKey, 'town_essential'>,
  interval: 'year',
): string {
  return PLAN_PRICE_LOOKUP_KEYS[planKey][interval];
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function safeObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function extractPriceLookupKey(price: unknown): string | undefined {
  const priceObj = safeObject(price);
  if (!priceObj) return undefined;
  return safeString(priceObj.lookup_key) ?? safeString(priceObj.lookupKey);
}

function extractProductId(price: unknown): string | undefined {
  const priceObj = safeObject(price);
  if (!priceObj) return undefined;
  const product = priceObj.product;
  if (typeof product === 'string') return product;
  const productObj = safeObject(product);
  return productObj ? safeString(productObj.id) : undefined;
}

function extractEntitlementSummary(summaryObject: unknown): EntitlementSummary {
  const summary = safeObject(summaryObject);
  if (!summary) return {};

  const activeEntitlements =
    summary.active_entitlements ??
    summary.activeEntitlementSummary ??
    summary.entitlements;

  if (!Array.isArray(activeEntitlements)) {
    return {};
  }

  const entitlements: EntitlementSummary = {};
  for (const entry of activeEntitlements) {
    const entryObject = safeObject(entry);
    if (!entryObject) continue;

    const featureObject =
      safeObject(entryObject.feature) ??
      safeObject(entryObject.entitlement_feature) ??
      safeObject(entryObject.entitlementFeature);

    const lookupKey =
      safeString(featureObject?.lookup_key) ??
      safeString(featureObject?.lookupKey) ??
      safeString(entryObject.lookup_key) ??
      safeString(entryObject.lookupKey) ??
      safeString(entryObject.feature_key) ??
      safeString(entryObject.featureKey);

    if (lookupKey) {
      entitlements[lookupKey] = true;
    }
  }

  return entitlements;
}

async function findBillingAccountByOwner(
  ctx: QueryCtx | MutationCtx,
  ownerUserId: Id<'users'>,
) {
  return await ctx.db
    .query('billingAccounts')
    .withIndex('by_owner_user', (q) => q.eq('ownerUserId', ownerUserId))
    .unique();
}

async function findBillingAccountByCustomerId(
  ctx: QueryCtx | MutationCtx,
  stripeCustomerId: string,
) {
  return await ctx.db
    .query('billingAccounts')
    .withIndex('by_stripe_customer_id', (q) => q.eq('stripeCustomerId', stripeCustomerId))
    .unique();
}

async function findBillingSubscriptionByAccount(
  ctx: QueryCtx | MutationCtx,
  billingAccountId: Id<'billingAccounts'>,
) {
  return await ctx.db
    .query('billingSubscriptions')
    .withIndex('by_billing_account', (q) => q.eq('billingAccountId', billingAccountId))
    .unique();
}

function getOrganizationMetadata(organization: Doc<'organizations'>) {
  return {
    organizationId: organization._id,
    organizationType: organization.organizationType,
    jurisdictionName: organization.jurisdictionName,
    populationBand: organization.populationBand,
    contractTier: organization.contractTier,
    procurementState: organization.procurementState,
    invoiceMode: organization.invoiceMode,
    purchaseOrderNumber: organization.purchaseOrderNumber,
    contractRenewalDate: organization.contractRenewalDate,
  };
}

async function ensureBillingAccount(
  ctx: MutationCtx,
  ownerUserId: Id<'users'>,
) {
  const existing = await findBillingAccountByOwner(ctx, ownerUserId);
  const user = await ctx.db.get(ownerUserId);
  if (!user) {
    throw new Error('Billing owner user not found');
  }

  const organizationContext = await ensureOrganizationForUser(ctx, user);
  const organizationMetadata = getOrganizationMetadata(
    organizationContext.organization,
  );

  if (existing) {
    const updates: Partial<Doc<'billingAccounts'>> = {
      organizationId: existing.organizationId ?? organizationContext.organization._id,
      organizationType: existing.organizationType ?? organizationMetadata.organizationType,
      jurisdictionName: existing.jurisdictionName ?? organizationMetadata.jurisdictionName,
      populationBand: existing.populationBand ?? organizationMetadata.populationBand,
      contractTier: existing.contractTier ?? organizationMetadata.contractTier,
      procurementState: existing.procurementState ?? organizationMetadata.procurementState,
      invoiceMode: existing.invoiceMode ?? organizationMetadata.invoiceMode,
      purchaseOrderNumber:
        existing.purchaseOrderNumber ?? organizationMetadata.purchaseOrderNumber,
      contractRenewalDate:
        existing.contractRenewalDate ?? organizationMetadata.contractRenewalDate,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(existing._id, updates);
    return await ctx.db.get(existing._id);
  }

  const now = Date.now();
  const billingAccountId = await ctx.db.insert('billingAccounts', {
    ownerUserId,
    organizationId: organizationContext.organization._id,
    planKey: 'civic_free',
    billingStatus: 'inactive',
    entitlementSummary: getDefaultEntitlements('civic_free'),
    organizationType: organizationMetadata.organizationType,
    jurisdictionName: organizationMetadata.jurisdictionName,
    populationBand: organizationMetadata.populationBand,
    contractTier: organizationMetadata.contractTier,
    procurementState: organizationMetadata.procurementState,
    billingAdminUserIds: [ownerUserId],
    invoiceMode: organizationMetadata.invoiceMode,
    purchaseOrderNumber: organizationMetadata.purchaseOrderNumber,
    contractRenewalDate: organizationMetadata.contractRenewalDate,
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(billingAccountId);
}

async function upsertBillingAccountSnapshotRecord(
  ctx: MutationCtx,
  args: {
    billingAccountId?: Id<'billingAccounts'>;
    ownerUserId?: Id<'users'>;
    organizationId?: Id<'organizations'>;
    stripeCustomerId?: string;
    billingEmail?: string;
    planKey?: string;
    billingStatus?: BillingStatus;
    entitlementSummary?: EntitlementSummary;
    organizationType?: string;
    jurisdictionName?: string;
    populationBand?: string;
    contractTier?: string;
    procurementState?: string;
    billingAdminUserIds?: Id<'users'>[];
    invoiceMode?: string;
    purchaseOrderNumber?: string;
    contractRenewalDate?: number;
    lastCheckoutSessionId?: string;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
  },
) {
  let account =
    args.billingAccountId ? await ctx.db.get(args.billingAccountId) : null;

  if (!account && args.ownerUserId) {
    account = await findBillingAccountByOwner(ctx, args.ownerUserId);
  }

  if (!account && args.stripeCustomerId) {
    account = await findBillingAccountByCustomerId(ctx, args.stripeCustomerId);
  }

  if (!account) {
    if (!args.ownerUserId) {
      throw new Error('Cannot create billing account snapshot without an owner');
    }
    const ensured = await ensureBillingAccount(ctx, args.ownerUserId);
    if (!ensured) {
      throw new Error('Unable to provision billing account');
    }
    account = ensured;
  }

  const updates: Partial<Doc<'billingAccounts'>> = {
    updatedAt: Date.now(),
  };

  if (args.organizationId !== undefined) updates.organizationId = args.organizationId;
  if (args.stripeCustomerId !== undefined) updates.stripeCustomerId = args.stripeCustomerId;
  if (args.billingEmail !== undefined) updates.billingEmail = args.billingEmail;
  if (args.planKey !== undefined) updates.planKey = normalizePlanKey(args.planKey);
  if (args.billingStatus !== undefined) updates.billingStatus = args.billingStatus;
  if (args.entitlementSummary !== undefined) {
    updates.entitlementSummary = args.entitlementSummary;
  }
  if (args.organizationType !== undefined) updates.organizationType = args.organizationType;
  if (args.jurisdictionName !== undefined) updates.jurisdictionName = args.jurisdictionName;
  if (args.populationBand !== undefined) updates.populationBand = args.populationBand;
  if (args.contractTier !== undefined) updates.contractTier = args.contractTier;
  if (args.procurementState !== undefined) updates.procurementState = args.procurementState;
  if (args.billingAdminUserIds !== undefined) {
    updates.billingAdminUserIds = args.billingAdminUserIds;
  }
  if (args.invoiceMode !== undefined) updates.invoiceMode = args.invoiceMode;
  if (args.purchaseOrderNumber !== undefined) {
    updates.purchaseOrderNumber = args.purchaseOrderNumber;
  }
  if (args.contractRenewalDate !== undefined) {
    updates.contractRenewalDate = args.contractRenewalDate;
  }
  if (args.lastCheckoutSessionId !== undefined) {
    updates.lastCheckoutSessionId = args.lastCheckoutSessionId;
  }
  if (args.currentPeriodEnd !== undefined) {
    updates.currentPeriodEnd = args.currentPeriodEnd;
  }
  if (args.cancelAtPeriodEnd !== undefined) {
    updates.cancelAtPeriodEnd = args.cancelAtPeriodEnd;
  }

  await ctx.db.patch(account._id, updates);
  return await ctx.db.get(account._id);
}

async function upsertBillingSubscriptionSnapshotRecord(
  ctx: MutationCtx,
  args: {
    billingAccountId: Id<'billingAccounts'>;
    organizationId?: Id<'organizations'>;
    stripeSubscriptionId: string;
    stripePriceId?: string;
    stripePriceLookupKey?: string;
    stripeProductId?: string;
    planKey: string;
    billingStatus: BillingStatus;
    entitlementSummary: EntitlementSummary;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
    trialEnd?: number;
    cancelAtPeriodEnd: boolean;
    latestInvoiceId?: string;
  },
) {
  const existing = await findBillingSubscriptionByAccount(ctx, args.billingAccountId);
  const now = Date.now();

  if (!existing) {
    const billingSubscriptionId = await ctx.db.insert('billingSubscriptions', {
      billingAccountId: args.billingAccountId,
      organizationId: args.organizationId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripePriceLookupKey: args.stripePriceLookupKey,
      stripeProductId: args.stripeProductId,
      planKey: normalizePlanKey(args.planKey),
      billingStatus: args.billingStatus,
      entitlementSummary: args.entitlementSummary,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEnd: args.trialEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      latestInvoiceId: args.latestInvoiceId,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(billingSubscriptionId);
  }

  await ctx.db.patch(existing._id, {
    organizationId: args.organizationId ?? existing.organizationId,
    stripeSubscriptionId: args.stripeSubscriptionId,
    stripePriceId: args.stripePriceId,
    stripePriceLookupKey: args.stripePriceLookupKey,
    stripeProductId: args.stripeProductId,
    planKey: normalizePlanKey(args.planKey),
    billingStatus: args.billingStatus,
    entitlementSummary: args.entitlementSummary,
    currentPeriodStart: args.currentPeriodStart,
    currentPeriodEnd: args.currentPeriodEnd,
    trialEnd: args.trialEnd,
    cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    latestInvoiceId: args.latestInvoiceId,
    updatedAt: now,
  });
  return await ctx.db.get(existing._id);
}

function buildEventSummary(event: { id: string; type: string; data: { object: unknown } }) {
  const object = safeObject(event.data.object);
  const customerId =
    safeString(object?.customer) ??
    safeString(object?.customer_id) ??
    safeString(object?.customerId);
  const subscriptionId =
    safeString(object?.subscription) ??
    safeString(object?.subscription_id) ??
    safeString(object?.subscriptionId);
  const status = safeString(object?.status);
  const lookupKey = extractPriceLookupKey(object?.price ?? object?.plan);
  return JSON.stringify({
    id: event.id,
    type: event.type,
    customerId,
    subscriptionId,
    status,
    lookupKey,
  });
}

export const getBillingState = query({
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

    const account = await findBillingAccountByOwner(ctx, user._id);
    if (!account) {
      return {
        userId: user._id,
        planKey: 'civic_free' as BillingPlanKey,
        billingStatus: 'inactive' as BillingStatus,
        stripeCustomerId: null,
        billingEmail: user.email ?? null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        entitlementSummary: getDefaultEntitlements('civic_free'),
        canManageBilling: false,
        isActive: false,
        subscription: null,
      };
    }

    const subscription = await findBillingSubscriptionByAccount(ctx, account._id);
    const billingStatus = normalizeBillingStatus(
      subscription?.billingStatus ?? account.billingStatus,
    );
    const effectivePlanKey = isActiveBillingStatus(billingStatus)
      ? normalizePlanKey(subscription?.planKey ?? account.planKey)
      : normalizePlanKey(account.planKey);
    const mergedEntitlements = isActiveBillingStatus(billingStatus)
      ? mergeEntitlements(
          getDefaultEntitlements(effectivePlanKey),
          account.entitlementSummary,
          subscription?.entitlementSummary,
        )
      : mergeEntitlements(
          getDefaultEntitlements('civic_free'),
          normalizePlanKey(account.planKey) === 'civic_free'
            ? account.entitlementSummary
            : undefined,
        );

    return {
      userId: user._id,
      billingAccountId: account._id,
      planKey: effectivePlanKey,
      billingStatus,
      stripeCustomerId: account.stripeCustomerId ?? null,
      billingEmail: account.billingEmail ?? user.email ?? null,
      currentPeriodEnd:
        subscription?.currentPeriodEnd ?? account.currentPeriodEnd ?? null,
      cancelAtPeriodEnd:
        subscription?.cancelAtPeriodEnd ?? account.cancelAtPeriodEnd ?? false,
      entitlementSummary: mergedEntitlements,
      organization: account.organizationId
        ? {
            organizationId: account.organizationId,
            organizationType: account.organizationType ?? null,
            jurisdictionName: account.jurisdictionName ?? null,
            populationBand: account.populationBand ?? null,
            contractTier: account.contractTier ?? effectivePlanKey,
            procurementState: account.procurementState ?? null,
            invoiceMode: account.invoiceMode ?? null,
            purchaseOrderNumber: account.purchaseOrderNumber ?? null,
            contractRenewalDate: account.contractRenewalDate ?? null,
          }
        : null,
      canManageBilling:
        Boolean(account.stripeCustomerId) &&
        normalizePlanKey(account.planKey) !== 'agency_enterprise',
      isActive: isActiveBillingStatus(billingStatus),
      subscription: subscription
        ? {
            billingSubscriptionId: subscription._id,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            stripePriceId: subscription.stripePriceId ?? null,
            stripePriceLookupKey: subscription.stripePriceLookupKey ?? null,
            stripeProductId: subscription.stripeProductId ?? null,
            planKey: normalizePlanKey(subscription.planKey),
            billingStatus: normalizeBillingStatus(subscription.billingStatus),
            currentPeriodStart: subscription.currentPeriodStart ?? null,
            currentPeriodEnd: subscription.currentPeriodEnd ?? null,
            trialEnd: subscription.trialEnd ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            latestInvoiceId: subscription.latestInvoiceId ?? null,
            entitlementSummary: subscription.entitlementSummary,
          }
        : null,
    };
  },
});

export const ensureBillingAccountForUser = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ensureBillingAccount(ctx, args.userId);
  },
});

export const upsertBillingAccountSnapshot = internalMutation({
  args: {
    billingAccountId: v.optional(v.id('billingAccounts')),
    ownerUserId: v.optional(v.id('users')),
    organizationId: v.optional(v.id('organizations')),
    stripeCustomerId: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    planKey: v.optional(v.string()),
    billingStatus: v.optional(
      v.union(
        v.literal('inactive'),
        v.literal('pending'),
        v.literal('active'),
        v.literal('trialing'),
        v.literal('past_due'),
        v.literal('canceled'),
      ),
    ),
    entitlementSummary: v.optional(v.record(v.string(), v.boolean())),
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
  },
  handler: async (ctx, args) => {
    return await upsertBillingAccountSnapshotRecord(ctx, args);
  },
});

export const upsertBillingSubscriptionSnapshot = internalMutation({
  args: {
    billingAccountId: v.id('billingAccounts'),
    organizationId: v.optional(v.id('organizations')),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.optional(v.string()),
    stripePriceLookupKey: v.optional(v.string()),
    stripeProductId: v.optional(v.string()),
    planKey: v.string(),
    billingStatus: v.union(
      v.literal('inactive'),
      v.literal('pending'),
      v.literal('active'),
      v.literal('trialing'),
      v.literal('past_due'),
      v.literal('canceled'),
    ),
    entitlementSummary: v.record(v.string(), v.boolean()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    latestInvoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await upsertBillingSubscriptionSnapshotRecord(ctx, args);
  },
});

export const handleStripeEvent = internalMutation({
  args: {
    eventJson: v.string(),
  },
  handler: async (ctx, args) => {
    const event = JSON.parse(args.eventJson) as {
      id: string;
      type: string;
      data: { object: unknown };
    };

    const existingEvent = await ctx.db
      .query('billingEvents')
      .withIndex('by_stripe_event_id', (q) => q.eq('stripeEventId', event.id))
      .unique();

    if (existingEvent) {
      return {
        received: true,
        duplicate: true,
        eventId: event.id,
        eventType: event.type,
      };
    }

    const eventSummary = buildEventSummary(event);
    const object = safeObject(event.data.object);
    const now = Date.now();

    switch (event.type) {
      case 'checkout.session.completed': {
        const metadata = safeObject(object?.metadata);
        const billingAccountId = safeString(metadata?.billingAccountId);
        const ownerUserId = safeString(metadata?.userId);
        const organizationId = safeString(metadata?.organizationId);
        const stripeCustomerId =
          safeString(object?.customer) ??
          safeString(object?.customer_id) ??
          safeString(object?.customerId);
        const billingEmail =
          safeString(safeObject(object?.customer_details)?.email) ??
          safeString(object?.customer_email) ??
          undefined;

        await upsertBillingAccountSnapshotRecord(ctx, {
          billingAccountId: billingAccountId as Id<'billingAccounts'> | undefined,
          ownerUserId: ownerUserId as Id<'users'> | undefined,
          organizationId: organizationId as Id<'organizations'> | undefined,
          stripeCustomerId,
          billingEmail,
          billingStatus: 'pending',
          lastCheckoutSessionId: safeString(object?.id),
        });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const metadata = safeObject(object?.metadata);
        const billingAccountId = safeString(metadata?.billingAccountId);
        const ownerUserId = safeString(metadata?.userId);
        const organizationId = safeString(metadata?.organizationId);
        const stripeCustomerId =
          safeString(object?.customer) ??
          safeString(object?.customer_id) ??
          safeString(object?.customerId);
        const billingAccount =
          (billingAccountId
            ? await ctx.db.get(billingAccountId as Id<'billingAccounts'>)
            : null) ??
          (ownerUserId
            ? await findBillingAccountByOwner(ctx, ownerUserId as Id<'users'>)
            : null) ??
          (stripeCustomerId ? await findBillingAccountByCustomerId(ctx, stripeCustomerId) : null);

        if (billingAccount) {
          const itemsObject = safeObject(object?.items);
          const item = Array.isArray(itemsObject?.data)
            ? (itemsObject.data[0] as Record<string, unknown> | undefined)
            : undefined;
          const price = safeObject(item?.price);
          const priceLookupKey = extractPriceLookupKey(price);
          const planKey = normalizePlanKey(
            safeString(metadata?.planKey) ?? planKeyFromLookupKey(priceLookupKey),
          );
          const entitlementSummary = mergeEntitlements(
            getDefaultEntitlements(planKey),
            accountEntitlementsFromMetadata(metadata),
          );
          const subscriptionStatus = normalizeBillingStatus(safeString(object?.status));
          const subscriptionId = safeString(object?.id);
          if (!subscriptionId) {
            throw new Error('Stripe subscription event missing id');
          }

          await upsertBillingAccountSnapshotRecord(ctx, {
            billingAccountId: billingAccount._id,
            ownerUserId: billingAccount.ownerUserId,
            organizationId:
              (organizationId as Id<'organizations'> | undefined) ??
              billingAccount.organizationId,
            stripeCustomerId: billingAccount.stripeCustomerId ?? stripeCustomerId,
            billingEmail: billingAccount.billingEmail,
            planKey,
            billingStatus: subscriptionStatus,
            entitlementSummary,
            contractTier: planKey,
            currentPeriodEnd: safeNumber(object?.current_period_end),
            cancelAtPeriodEnd: safeBoolean(object?.cancel_at_period_end),
          });

          await upsertBillingSubscriptionSnapshotRecord(ctx, {
            billingAccountId: billingAccount._id,
            organizationId:
              (organizationId as Id<'organizations'> | undefined) ??
              billingAccount.organizationId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: safeString(price?.id),
            stripePriceLookupKey: priceLookupKey,
            stripeProductId: extractProductId(price),
            planKey,
            billingStatus: subscriptionStatus,
            entitlementSummary,
            currentPeriodStart: safeNumber(object?.current_period_start),
            currentPeriodEnd: safeNumber(object?.current_period_end),
            trialEnd: safeNumber(object?.trial_end),
            cancelAtPeriodEnd: Boolean(object?.cancel_at_period_end),
            latestInvoiceId: safeString(object?.latest_invoice),
          });
        }
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.updated': {
        const stripeCustomerId =
          safeString(object?.customer) ??
          safeString(object?.customer_id) ??
          safeString(object?.customerId);
        const billingAccount = stripeCustomerId
          ? await findBillingAccountByCustomerId(ctx, stripeCustomerId)
          : null;
        if (billingAccount) {
          const latestInvoiceId = safeString(object?.id);
          const subscription = await findBillingSubscriptionByAccount(ctx, billingAccount._id);
          const billingStatus =
            event.type === 'invoice.payment_failed'
              ? 'past_due'
              : subscription?.billingStatus ?? billingAccount.billingStatus;

          await upsertBillingAccountSnapshotRecord(ctx, {
            billingAccountId: billingAccount._id,
            ownerUserId: billingAccount.ownerUserId,
            organizationId: billingAccount.organizationId,
            stripeCustomerId: billingAccount.stripeCustomerId ?? stripeCustomerId,
            billingEmail: billingAccount.billingEmail,
            planKey: normalizePlanKey(subscription?.planKey ?? billingAccount.planKey),
            billingStatus: normalizeBillingStatus(billingStatus),
            entitlementSummary:
              subscription?.entitlementSummary ?? billingAccount.entitlementSummary,
            currentPeriodEnd: safeNumber(object?.period_end) ?? subscription?.currentPeriodEnd,
            cancelAtPeriodEnd:
              subscription?.cancelAtPeriodEnd ?? billingAccount.cancelAtPeriodEnd ?? false,
          });

          if (subscription) {
            await upsertBillingSubscriptionSnapshotRecord(ctx, {
              billingAccountId: billingAccount._id,
              organizationId: billingAccount.organizationId,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              stripePriceId: subscription.stripePriceId ?? undefined,
              stripePriceLookupKey: subscription.stripePriceLookupKey ?? undefined,
              stripeProductId: subscription.stripeProductId ?? undefined,
              planKey: normalizePlanKey(subscription.planKey),
              billingStatus: normalizeBillingStatus(billingStatus),
              entitlementSummary: subscription.entitlementSummary,
              currentPeriodStart: subscription.currentPeriodStart ?? undefined,
              currentPeriodEnd:
                safeNumber(object?.period_end) ??
                subscription.currentPeriodEnd ??
                undefined,
              trialEnd: subscription.trialEnd ?? undefined,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              latestInvoiceId,
            });
          }
        }
        break;
      }
      case 'entitlements.active_entitlement_summary.updated': {
        const stripeCustomerId =
          safeString(object?.customer) ??
          safeString(object?.customer_id) ??
          safeString(object?.customerId);
        const billingAccount = stripeCustomerId
          ? await findBillingAccountByCustomerId(ctx, stripeCustomerId)
          : null;
        if (billingAccount) {
          const entitlementSummary = mergeEntitlements(
            billingAccount.entitlementSummary,
            extractEntitlementSummary(object),
          );
          await upsertBillingAccountSnapshotRecord(ctx, {
            billingAccountId: billingAccount._id,
            ownerUserId: billingAccount.ownerUserId,
            organizationId: billingAccount.organizationId,
            stripeCustomerId: billingAccount.stripeCustomerId ?? stripeCustomerId,
            billingEmail: billingAccount.billingEmail,
            planKey: normalizePlanKey(billingAccount.planKey),
            billingStatus: normalizeBillingStatus(billingAccount.billingStatus),
            entitlementSummary,
            currentPeriodEnd: billingAccount.currentPeriodEnd,
            cancelAtPeriodEnd: billingAccount.cancelAtPeriodEnd ?? false,
          });

          const subscription = await findBillingSubscriptionByAccount(ctx, billingAccount._id);
          if (subscription) {
            await upsertBillingSubscriptionSnapshotRecord(ctx, {
              billingAccountId: billingAccount._id,
              organizationId: billingAccount.organizationId,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              stripePriceId: subscription.stripePriceId ?? undefined,
              stripePriceLookupKey: subscription.stripePriceLookupKey ?? undefined,
              stripeProductId: subscription.stripeProductId ?? undefined,
              planKey: normalizePlanKey(subscription.planKey),
              billingStatus: normalizeBillingStatus(subscription.billingStatus),
              entitlementSummary,
              currentPeriodStart: subscription.currentPeriodStart ?? undefined,
              currentPeriodEnd: subscription.currentPeriodEnd ?? undefined,
              trialEnd: subscription.trialEnd ?? undefined,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              latestInvoiceId: subscription.latestInvoiceId ?? undefined,
            });
          }
        }
        break;
      }
      default:
        break;
    }

    await ctx.db.insert('billingEvents', {
      stripeEventId: event.id,
      eventType: event.type,
      payloadSummary: eventSummary,
      status: 'processed',
      processedAt: now,
    });

    return {
      received: true,
      duplicate: false,
      eventId: event.id,
      eventType: event.type,
    };
  },
});

function accountEntitlementsFromMetadata(
  metadata: Record<string, unknown> | undefined,
) {
  if (!metadata) return {};
  const source = safeString(metadata.entitlementSummary);
  if (!source) return {};
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>;
    const entitlements: EntitlementSummary = {};
    for (const [feature, enabled] of Object.entries(parsed)) {
      if (enabled === true) {
        entitlements[feature] = true;
      }
    }
    return entitlements;
  } catch {
    return {};
  }
}
