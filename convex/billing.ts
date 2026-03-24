import { v } from 'convex/values';
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

type BillingPlanKey = 'free' | 'pro' | 'team';
type BillingInterval = 'month' | 'year';
type BillingStatus = 'inactive' | 'pending' | 'active' | 'trialing' | 'past_due' | 'canceled';
type EntitlementSummary = Record<string, boolean>;

const DEFAULT_ENTITLEMENTS: Record<BillingPlanKey, EntitlementSummary> = {
  free: {},
  pro: {
    private_projects: true,
    unwatermarked_exports: true,
    branded_exports: true,
    advanced_templates: true,
  },
  team: {
    private_projects: true,
    unwatermarked_exports: true,
    branded_exports: true,
    advanced_templates: true,
    team_collaboration: true,
    custom_templates: true,
    priority_support: true,
  },
};

export const PLAN_PRICE_LOOKUP_KEYS: Record<
  Exclude<BillingPlanKey, 'free'>,
  Record<BillingInterval, string>
> = {
  pro: {
    month: 'curbwise-pro-monthly',
    year: 'curbwise-pro-annual',
  },
  team: {
    month: 'curbwise-team-monthly',
    year: 'curbwise-team-annual',
  },
};

const PLAN_KEY_BY_PRICE_LOOKUP_KEY = new Map<string, BillingPlanKey>([
  [PLAN_PRICE_LOOKUP_KEYS.pro.month, 'pro'],
  [PLAN_PRICE_LOOKUP_KEYS.pro.year, 'pro'],
  [PLAN_PRICE_LOOKUP_KEYS.team.month, 'team'],
  [PLAN_PRICE_LOOKUP_KEYS.team.year, 'team'],
]);

function getDefaultEntitlements(planKey: BillingPlanKey): EntitlementSummary {
  return { ...DEFAULT_ENTITLEMENTS[planKey] };
}

function mergeEntitlements(...summaries: Array<EntitlementSummary | undefined>): EntitlementSummary {
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
  if (planKey === 'pro' || planKey === 'team') {
    return planKey;
  }
  return 'free';
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

function planKeyFromLookupKey(lookupKey?: string): BillingPlanKey {
  if (!lookupKey) return 'free';
  return PLAN_KEY_BY_PRICE_LOOKUP_KEY.get(lookupKey) ?? 'free';
}

export function getPriceLookupKey(planKey: Exclude<BillingPlanKey, 'free'>, interval: BillingInterval): string {
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

async function ensureBillingAccount(
  ctx: MutationCtx,
  ownerUserId: Id<'users'>,
) {
  const existing = await findBillingAccountByOwner(ctx, ownerUserId);
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const billingAccountId = await ctx.db.insert('billingAccounts', {
    ownerUserId,
    planKey: 'free',
    billingStatus: 'inactive',
    entitlementSummary: getDefaultEntitlements('free'),
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
    stripeCustomerId?: string;
    billingEmail?: string;
    planKey?: BillingPlanKey;
    billingStatus?: BillingStatus;
    entitlementSummary?: EntitlementSummary;
    lastCheckoutSessionId?: string;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
  },
) {
  let account =
    args.billingAccountId
      ? await ctx.db.get(args.billingAccountId)
      : null;

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
    const now = Date.now();
    const billingAccountId = await ctx.db.insert('billingAccounts', {
      ownerUserId: args.ownerUserId,
      stripeCustomerId: args.stripeCustomerId,
      billingEmail: args.billingEmail,
      planKey: args.planKey ?? 'free',
      billingStatus: args.billingStatus ?? 'inactive',
      entitlementSummary: args.entitlementSummary ?? getDefaultEntitlements(args.planKey ?? 'free'),
      lastCheckoutSessionId: args.lastCheckoutSessionId,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(billingAccountId);
  }

  const updates: Partial<Doc<'billingAccounts'>> = {
    updatedAt: Date.now(),
  };
  if (args.stripeCustomerId !== undefined) {
    updates.stripeCustomerId = args.stripeCustomerId;
  }
  if (args.billingEmail !== undefined) {
    updates.billingEmail = args.billingEmail;
  }
  if (args.planKey !== undefined) {
    updates.planKey = args.planKey;
  }
  if (args.billingStatus !== undefined) {
    updates.billingStatus = args.billingStatus;
  }
  if (args.entitlementSummary !== undefined) {
    updates.entitlementSummary = args.entitlementSummary;
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
    stripeSubscriptionId: string;
    stripePriceId?: string;
    stripePriceLookupKey?: string;
    stripeProductId?: string;
    planKey: BillingPlanKey;
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
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripePriceLookupKey: args.stripePriceLookupKey,
      stripeProductId: args.stripeProductId,
      planKey: args.planKey,
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
    stripeSubscriptionId: args.stripeSubscriptionId,
    stripePriceId: args.stripePriceId,
    stripePriceLookupKey: args.stripePriceLookupKey,
    stripeProductId: args.stripeProductId,
    planKey: args.planKey,
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
        planKey: 'free' as BillingPlanKey,
        billingStatus: 'inactive' as BillingStatus,
        stripeCustomerId: null,
        billingEmail: user.email ?? null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        entitlementSummary: getDefaultEntitlements('free'),
        canManageBilling: false,
        isActive: false,
        subscription: null,
      };
    }

    const subscription = await findBillingSubscriptionByAccount(ctx, account._id);
    const mergedEntitlements = mergeEntitlements(
      getDefaultEntitlements(normalizePlanKey(account.planKey)),
      account.entitlementSummary,
      subscription?.entitlementSummary,
    );
    const billingStatus = normalizeBillingStatus(
      subscription?.billingStatus ?? account.billingStatus,
    );

    return {
      userId: user._id,
      billingAccountId: account._id,
      planKey: normalizePlanKey(account.planKey),
      billingStatus,
      stripeCustomerId: account.stripeCustomerId ?? null,
      billingEmail: account.billingEmail ?? user.email ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? account.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? account.cancelAtPeriodEnd ?? false,
      entitlementSummary: mergedEntitlements,
      canManageBilling: Boolean(account.stripeCustomerId),
      isActive: billingStatus === 'active' || billingStatus === 'trialing',
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
    stripeCustomerId: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    planKey: v.optional(v.union(v.literal('free'), v.literal('pro'), v.literal('team'))),
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
    lastCheckoutSessionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await upsertBillingAccountSnapshotRecord(ctx, {
      billingAccountId: args.billingAccountId,
      ownerUserId: args.ownerUserId,
      stripeCustomerId: args.stripeCustomerId,
      billingEmail: args.billingEmail,
      planKey: args.planKey,
      billingStatus: args.billingStatus,
      entitlementSummary: args.entitlementSummary,
      lastCheckoutSessionId: args.lastCheckoutSessionId,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    });
  },
});

export const upsertBillingSubscriptionSnapshot = internalMutation({
  args: {
    billingAccountId: v.id('billingAccounts'),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.optional(v.string()),
    stripePriceLookupKey: v.optional(v.string()),
    stripeProductId: v.optional(v.string()),
    planKey: v.union(v.literal('free'), v.literal('pro'), v.literal('team')),
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
    return await upsertBillingSubscriptionSnapshotRecord(ctx, {
      billingAccountId: args.billingAccountId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripePriceLookupKey: args.stripePriceLookupKey,
      stripeProductId: args.stripeProductId,
      planKey: args.planKey,
      billingStatus: args.billingStatus,
      entitlementSummary: args.entitlementSummary,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEnd: args.trialEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      latestInvoiceId: args.latestInvoiceId,
    });
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
        const planKey = normalizePlanKey(safeString(metadata?.planKey));
        const stripeCustomerId =
          safeString(object?.customer) ??
          safeString(object?.customer_id) ??
          safeString(object?.customerId);
        const billingEmail =
          safeString(safeObject(object?.customer_details)?.email) ??
          safeString(object?.customer_email) ??
          undefined;
        const currentPeriodEnd = safeNumber(safeObject(object?.subscription)?.current_period_end);

        await upsertBillingAccountSnapshotRecord(ctx, {
          billingAccountId: billingAccountId as Id<'billingAccounts'> | undefined,
          ownerUserId: ownerUserId as Id<'users'> | undefined,
          stripeCustomerId,
          billingEmail,
          planKey,
          billingStatus: 'pending',
          lastCheckoutSessionId: safeString(object?.id),
          currentPeriodEnd,
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
            ? (itemsObject?.data?.[0] as Record<string, unknown> | undefined)
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
            stripeCustomerId: billingAccount.stripeCustomerId ?? stripeCustomerId,
            billingEmail: billingAccount.billingEmail,
            planKey,
            billingStatus: subscriptionStatus,
            entitlementSummary,
            currentPeriodEnd: safeNumber(object?.current_period_end),
            cancelAtPeriodEnd: safeBoolean(object?.cancel_at_period_end),
          });

          await upsertBillingSubscriptionSnapshotRecord(ctx, {
            billingAccountId: billingAccount._id,
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
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              stripePriceId: subscription.stripePriceId ?? undefined,
              stripePriceLookupKey: subscription.stripePriceLookupKey ?? undefined,
              stripeProductId: subscription.stripeProductId ?? undefined,
              planKey: normalizePlanKey(subscription.planKey),
              billingStatus: normalizeBillingStatus(billingStatus),
              entitlementSummary: subscription.entitlementSummary,
              currentPeriodStart: subscription.currentPeriodStart ?? undefined,
              currentPeriodEnd: safeNumber(object?.period_end) ?? subscription.currentPeriodEnd ?? undefined,
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

function accountEntitlementsFromMetadata(metadata: Record<string, unknown> | undefined): EntitlementSummary {
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
