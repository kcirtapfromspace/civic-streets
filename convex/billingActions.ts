"use node";

import Stripe from 'stripe';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { action } from './_generated/server';
import { getPriceLookupKey } from './billing';

type CheckoutSessionResult = {
  checkoutSessionId: string;
  url: string | null;
  billingAccountId: string;
};

type PortalSessionResult = {
  url: string | null;
  stripeCustomerId: string;
  billingAccountId: string;
};

function getStripeSecretKey(): string {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return secret;
}

function getStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey());
}

type BillingAccountDoc = Doc<'billingAccounts'>;
type UserDoc = Doc<'users'>;

function getPriceLookupKeyFromEnvironment(
  planKey: 'pro' | 'team',
  interval: 'month' | 'year',
): string {
  const envKey =
    planKey === 'pro'
      ? interval === 'month'
        ? process.env.STRIPE_PRO_MONTHLY_PRICE_LOOKUP_KEY
        : process.env.STRIPE_PRO_ANNUAL_PRICE_LOOKUP_KEY
      : interval === 'month'
        ? process.env.STRIPE_TEAM_MONTHLY_PRICE_LOOKUP_KEY
        : process.env.STRIPE_TEAM_ANNUAL_PRICE_LOOKUP_KEY;
  return envKey ?? getPriceLookupKey(planKey, interval);
}

export const createCheckoutSession = action({
  args: {
    sessionToken: v.string(),
    planKey: v.union(v.literal('pro'), v.literal('team')),
    interval: v.union(v.literal('month'), v.literal('year')),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<CheckoutSessionResult> => {
    const user: UserDoc | null = await ctx.runQuery(api.users.getCurrentUser, {
      sessionToken: args.sessionToken,
    });
    if (!user) {
      throw new Error('Billing requires an active user session');
    }

    const billingAccount: BillingAccountDoc | null = await ctx.runMutation(
      internal.billing.ensureBillingAccountForUser,
      {
        userId: user._id,
      },
    );
    if (!billingAccount) {
      throw new Error('Unable to resolve billing account');
    }

    const stripe = getStripeClient();
    let stripeCustomerId: string = billingAccount.stripeCustomerId ?? '';

    if (!stripeCustomerId) {
      const createdCustomer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: {
            userId: user._id,
            billingAccountId: billingAccount._id,
          },
        },
        {
          idempotencyKey: `billing-customer-${billingAccount._id}`,
        },
      );
      stripeCustomerId = createdCustomer.id;

      const updatedAccount: BillingAccountDoc | null = await ctx.runMutation(
        internal.billing.upsertBillingAccountSnapshot,
        {
          billingAccountId: billingAccount._id,
          stripeCustomerId,
          billingEmail: user.email ?? undefined,
        },
      );
      if (!updatedAccount) {
        throw new Error('Unable to persist Stripe customer mapping');
      }
    }

    const lookupKey = getPriceLookupKeyFromEnvironment(args.planKey, args.interval);
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });
    const price: Stripe.Price | undefined = prices.data[0];
    if (!price) {
      throw new Error(`No active Stripe price found for lookup key "${lookupKey}"`);
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        client_reference_id: String(user._id),
        allow_promotion_codes: true,
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        metadata: {
          userId: String(user._id),
          billingAccountId: String(billingAccount._id),
          planKey: args.planKey,
          interval: args.interval,
        },
        subscription_data: {
          metadata: {
            userId: String(user._id),
            billingAccountId: String(billingAccount._id),
            planKey: args.planKey,
            interval: args.interval,
          },
        },
      },
      {
        idempotencyKey: `checkout-${billingAccount._id}-${args.planKey}-${args.interval}`,
      },
    );

    const updatedAccount = await ctx.runMutation(
      internal.billing.upsertBillingAccountSnapshot,
      {
        billingAccountId: billingAccount._id,
        stripeCustomerId,
        billingEmail: user.email ?? undefined,
        billingStatus: 'pending',
        lastCheckoutSessionId: checkoutSession.id,
      },
    );

    return {
      checkoutSessionId: checkoutSession.id,
      url: checkoutSession.url,
      billingAccountId: updatedAccount?._id ?? billingAccount._id,
    };
  },
});

export const createPortalSession = action({
  args: {
    sessionToken: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<PortalSessionResult> => {
    const user: UserDoc | null = await ctx.runQuery(api.users.getCurrentUser, {
      sessionToken: args.sessionToken,
    });
    if (!user) {
      throw new Error('Billing requires an active user session');
    }

    const billingAccount: BillingAccountDoc | null = await ctx.runMutation(
      internal.billing.ensureBillingAccountForUser,
      {
        userId: user._id,
      },
    );
    if (!billingAccount) {
      throw new Error('Unable to resolve billing account');
    }

    const stripe = getStripeClient();
    let stripeCustomerId: string = billingAccount.stripeCustomerId ?? '';
    if (!stripeCustomerId) {
      const createdCustomer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: {
            userId: user._id,
            billingAccountId: billingAccount._id,
          },
        },
        {
          idempotencyKey: `billing-customer-${billingAccount._id}`,
        },
      );
      stripeCustomerId = createdCustomer.id;
      await ctx.runMutation(internal.billing.upsertBillingAccountSnapshot, {
        billingAccountId: billingAccount._id,
        stripeCustomerId,
        billingEmail: user.email ?? undefined,
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: stripeCustomerId,
        return_url: args.returnUrl,
      },
      {
        idempotencyKey: `portal-${billingAccount._id}`,
      },
    );

    return {
      url: portalSession.url,
      stripeCustomerId,
      billingAccountId: billingAccount._id,
    };
  },
});
