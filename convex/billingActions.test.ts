// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const stripe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  prices: { list: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));
vi.mock('stripe', () => ({
  default: class Stripe {
    customers = stripe.customers;
    prices = stripe.prices;
    checkout = stripe.checkout;
    billingPortal = stripe.billingPortal;
  },
}));
const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const checkout = {
  planKey: 'town_essential' as const,
  interval: 'year' as const,
  successUrl: 'https://curbwise.app/billing/success',
  cancelUrl: 'https://curbwise.app/billing',
};
async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  return { t, owner };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture_only');
  vi.stubEnv('STRIPE_TOWN_ESSENTIAL_ANNUAL_PRICE_LOOKUP_KEY', undefined);
  vi.stubEnv('STRIPE_PRO_ANNUAL_PRICE_LOOKUP_KEY', undefined);
  stripe.customers.create.mockResolvedValue({ id: 'cus_fixture' });
  stripe.prices.list.mockResolvedValue({ data: [{ id: 'price_fixture' }] });
  stripe.checkout.sessions.create.mockResolvedValue({
    id: 'cs_fixture',
    url: 'https://checkout.stripe.test/session',
  });
  stripe.billingPortal.sessions.create.mockResolvedValue({
    url: 'https://billing.stripe.test/session',
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('Stripe checkout action boundary', () => {
  it('requires a valid local session and configured provider key before calling Stripe', async () => {
    const { t, owner } = await setup();
    await expect(
      t.action(api.billingActions.createCheckoutSession, { ...checkout, sessionToken: 'bad' }),
    ).rejects.toThrow('active user session');
    await expect(
      t.action(api.billingActions.createPortalSession, {
        returnUrl: checkout.cancelUrl,
        sessionToken: 'bad',
      }),
    ).rejects.toThrow('active user session');
    vi.stubEnv('STRIPE_SECRET_KEY', undefined);
    await expect(
      t.action(api.billingActions.createCheckoutSession, {
        ...checkout,
        sessionToken: owner.sessionToken,
      }),
    ).rejects.toThrow('STRIPE_SECRET_KEY');
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it.each([
    ['default', 'curbwise-town-essential-annual'],
    ['legacy', 'legacy_annual'],
    ['configured', 'configured_annual'],
  ])('creates one customer and uses the %s lookup key for checkout', async (source, lookupKey) => {
    const { t, owner } = await setup();
    if (source === 'legacy') vi.stubEnv('STRIPE_PRO_ANNUAL_PRICE_LOOKUP_KEY', lookupKey);
    if (source === 'configured') {
      vi.stubEnv('STRIPE_TOWN_ESSENTIAL_ANNUAL_PRICE_LOOKUP_KEY', lookupKey);
      vi.stubEnv('STRIPE_PRO_ANNUAL_PRICE_LOOKUP_KEY', 'ignored_legacy');
    }
    await t.run((ctx) => ctx.db.patch(owner.user._id, { email: 'billing@example.test' }));
    const result = await t.action(api.billingActions.createCheckoutSession, {
      ...checkout,
      sessionToken: owner.sessionToken,
    });
    expect(result).toMatchObject({
      checkoutSessionId: 'cs_fixture',
      url: 'https://checkout.stripe.test/session',
    });
    const state = (await t.query(api.billing.getBillingState, {
      sessionToken: owner.sessionToken,
    }))!;
    expect(state).toMatchObject({
      stripeCustomerId: 'cus_fixture',
      billingStatus: 'pending',
      planKey: 'town_essential',
      billingEmail: 'billing@example.test',
      isActive: false,
    });
    expect(stripe.prices.list).toHaveBeenCalledWith({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });
    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'billing@example.test',
        metadata: {
          userId: owner.user._id,
          billingAccountId: result.billingAccountId,
          organizationId: state.organization!.organizationId,
        },
      }),
      { idempotencyKey: `billing-customer-${result.billingAccountId}` },
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_fixture',
        success_url: checkout.successUrl,
        cancel_url: checkout.cancelUrl,
        line_items: [{ price: 'price_fixture', quantity: 1 }],
        subscription_data: {
          metadata: expect.objectContaining({ userId: owner.user._id, planKey: 'town_essential' }),
        },
      }),
      { idempotencyKey: `checkout-${result.billingAccountId}-town_essential-year` },
    );
    stripe.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_no_url', url: null });
    expect(
      await t.action(api.billingActions.createCheckoutSession, {
        ...checkout,
        sessionToken: owner.sessionToken,
      }),
    ).toMatchObject({ url: null });
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
  });

  it('surfaces missing prices and provider failures without claiming active billing or losing a customer mapping', async () => {
    const { t, owner } = await setup();
    stripe.prices.list.mockResolvedValueOnce({ data: [] });
    await expect(
      t.action(api.billingActions.createCheckoutSession, {
        ...checkout,
        sessionToken: owner.sessionToken,
      }),
    ).rejects.toThrow('No active Stripe price');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('Stripe unavailable'));
    await expect(
      t.action(api.billingActions.createCheckoutSession, {
        ...checkout,
        sessionToken: owner.sessionToken,
      }),
    ).rejects.toThrow('Stripe unavailable');
    expect(
      await t.query(api.billing.getBillingState, { sessionToken: owner.sessionToken }),
    ).toMatchObject({ stripeCustomerId: 'cus_fixture', billingStatus: 'inactive' });
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
  });

  it('creates and reuses an anonymous customer for portal access, honoring the requested return URL', async () => {
    const { t, owner } = await setup();
    const args = { sessionToken: owner.sessionToken, returnUrl: checkout.cancelUrl };
    const first = await t.action(api.billingActions.createPortalSession, args);
    expect(first).toMatchObject({
      stripeCustomerId: 'cus_fixture',
      url: 'https://billing.stripe.test/session',
    });
    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined }),
      expect.any(Object),
    );
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      { customer: 'cus_fixture', return_url: checkout.cancelUrl },
      { idempotencyKey: `portal-${first.billingAccountId}` },
    );
    await t.action(api.billingActions.createPortalSession, args);
    await t.action(api.billingActions.createCheckoutSession, {
      ...checkout,
      sessionToken: owner.sessionToken,
    });
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(await t.run((ctx) => ctx.db.query('billingAccounts').collect())).toHaveLength(1);
    await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
      ownerUserId: owner.user._id,
      billingEmail: 'new@example.test',
    });
    stripe.billingPortal.sessions.create.mockRejectedValueOnce(new Error('Portal unavailable'));
    await expect(t.action(api.billingActions.createPortalSession, args)).rejects.toThrow(
      'Portal unavailable',
    );
  });
});
