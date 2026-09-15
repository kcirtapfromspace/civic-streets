// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import { getPriceLookupKey } from './billing';
import schema from './schema';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
async function setup() {
  const t = convexTest(schema, modules);
  const owner = await t.mutation(api.users.createAnonymousUser, {});
  const account = (await t.mutation(internal.billing.ensureBillingAccountForUser, {
    userId: owner.user._id,
  }))!;
  const event = (type: string, object: unknown, id: string = crypto.randomUUID()) =>
    t.mutation(internal.billing.handleStripeEvent, {
      eventJson: JSON.stringify({ id, type, data: { object } }),
    });
  const state = () => t.query(api.billing.getBillingState, { sessionToken: owner.sessionToken });
  return { t, owner, account, event, state };
}

describe('billing snapshots and entitlements', () => {
  it('returns a free anonymous state, fails closed for unknown sessions, and refuses a deleted account owner', async () => {
    const t = convexTest(schema, modules);
    const owner = await t.mutation(api.users.createAnonymousUser, {});
    expect(await t.query(api.billing.getBillingState, { sessionToken: 'bad' })).toBeNull();
    expect(
      await t.query(api.billing.getBillingState, { sessionToken: owner.sessionToken }),
    ).toMatchObject({
      planKey: 'civic_free',
      billingEmail: null,
      isActive: false,
      canManageBilling: false,
      subscription: null,
    });
    await t.run((ctx) => ctx.db.patch(owner.user._id, { email: 'owner@example.test' }));
    expect(
      await t.query(api.billing.getBillingState, { sessionToken: owner.sessionToken }),
    ).toMatchObject({ billingEmail: 'owner@example.test' });
    await t.run((ctx) => ctx.db.delete(owner.user._id));
    await expect(
      t.mutation(internal.billing.ensureBillingAccountForUser, { userId: owner.user._id }),
    ).rejects.toThrow('Billing owner user not found');
    await expect(t.mutation(internal.billing.upsertBillingAccountSnapshot, {})).rejects.toThrow(
      'without an owner',
    );
  });

  it('provisions through snapshots, preserves existing account identity, and updates explicit organization/invoice fields', async () => {
    const t = convexTest(schema, modules);
    const { user } = await t.mutation(api.users.createAnonymousUser, {});
    const account = (await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
      ownerUserId: user._id,
      stripeCustomerId: 'cus_snapshot',
    }))!;
    const fields = {
      billingAccountId: account._id,
      organizationId: account.organizationId,
      billingEmail: 'billing@example.test',
      organizationType: 'city',
      jurisdictionName: 'Denver',
      populationBand: 'over_500k_or_regional',
      contractTier: 'city_standard',
      procurementState: 'active',
      billingAdminUserIds: [user._id],
      invoiceMode: 'purchase_order',
      purchaseOrderNumber: 'PO-12',
      contractRenewalDate: 2000,
      lastCheckoutSessionId: 'cs_1',
      currentPeriodEnd: 1000,
      cancelAtPeriodEnd: false,
      entitlementSummary: { custom: true, disabled: false },
      planKey: 'team',
      billingStatus: 'active' as const,
    };
    const { billingAccountId, ...expectedFields } = fields;
    expect(await t.mutation(internal.billing.upsertBillingAccountSnapshot, fields)).toMatchObject({
      ...expectedFields,
      _id: billingAccountId,
      planKey: 'city_standard',
    });
    expect(
      (
        await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
          stripeCustomerId: 'cus_snapshot',
        })
      )?._id,
    ).toBe(account._id);
    expect(
      (await t.mutation(internal.billing.upsertBillingAccountSnapshot, { ownerUserId: user._id }))
        ?._id,
    ).toBe(account._id);
    expect(
      await t.mutation(internal.billing.ensureBillingAccountForUser, { userId: user._id }),
    ).toMatchObject({
      jurisdictionName: 'Denver',
      purchaseOrderNumber: 'PO-12',
      organizationType: 'city',
    });
    await t.run((ctx) =>
      ctx.db.patch(account._id, {
        organizationId: undefined,
        organizationType: undefined,
        jurisdictionName: undefined,
        populationBand: undefined,
        contractTier: undefined,
        procurementState: undefined,
        invoiceMode: undefined,
        purchaseOrderNumber: undefined,
        contractRenewalDate: undefined,
      }),
    );
    expect(
      await t.mutation(internal.billing.ensureBillingAccountForUser, { userId: user._id }),
    ).toMatchObject({ organizationId: account.organizationId, organizationType: 'individual' });
  });

  it.each([
    ['civic_free', 'civic_free'],
    ['pro', 'town_essential'],
    ['town_essential', 'town_essential'],
    ['team', 'city_standard'],
    ['city_standard', 'city_standard'],
    ['enterprise', 'agency_enterprise'],
    ['agency_enterprise', 'agency_enterprise'],
    ['unknown', 'civic_free'],
  ])(
    'normalizes %s and restricts paid entitlements when the subscription is inactive',
    async (stored, expected) => {
      const { t, account, state } = await setup();
      await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
        billingAccountId: account._id,
        stripeCustomerId: 'cus_1',
        planKey: stored,
        billingStatus: 'active',
        entitlementSummary: { custom: true, disabled: false },
      });
      expect(await state()).toMatchObject({
        planKey: expected,
        isActive: true,
        canManageBilling: expected !== 'agency_enterprise',
        entitlementSummary: { custom: true },
      });
      expect((await state())!.entitlementSummary).not.toHaveProperty('disabled');
      await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
        billingAccountId: account._id,
        billingStatus: 'canceled',
      });
      expect(await state()).toMatchObject({ isActive: false });
      if (expected !== 'civic_free')
        expect((await state())!.entitlementSummary).not.toHaveProperty('custom');
    },
  );

  it('uses subscription dates/status/features over the account and tolerates legacy absent metadata', async () => {
    const { t, account, owner, state } = await setup();
    await t.run((ctx) => ctx.db.patch(owner.user._id, { email: 'fallback@example.test' }));
    await t.run((ctx) =>
      ctx.db.patch(account._id, {
        organizationId: undefined,
        billingStatus: 'legacy-status',
        planKey: 'unknown',
      }),
    );
    expect(await state()).toMatchObject({
      organization: null,
      billingStatus: 'inactive',
      billingEmail: 'fallback@example.test',
    });
    await t.run((ctx) =>
      ctx.db.patch(account._id, {
        organizationId: account.organizationId,
        organizationType: undefined,
        populationBand: undefined,
        contractTier: undefined,
        procurementState: undefined,
        invoiceMode: undefined,
      }),
    );
    const args = {
      billingAccountId: account._id,
      stripeSubscriptionId: 'sub_1',
      planKey: 'town_essential',
      billingStatus: 'trialing' as const,
      entitlementSummary: { subscription_feature: true },
      cancelAtPeriodEnd: true,
    };
    const subscription = await t.mutation(internal.billing.upsertBillingSubscriptionSnapshot, args);
    expect(await state()).toMatchObject({
      isActive: true,
      planKey: 'town_essential',
      cancelAtPeriodEnd: true,
      entitlementSummary: { private_workspaces: true, subscription_feature: true },
      subscription: { stripePriceId: null, trialEnd: null },
    });
    expect(
      await t.mutation(internal.billing.upsertBillingSubscriptionSnapshot, {
        ...args,
        organizationId: account.organizationId,
        stripePriceId: 'price_1',
        stripePriceLookupKey: 'lookup',
        stripeProductId: 'prod_1',
        currentPeriodStart: 10,
        currentPeriodEnd: 20,
        trialEnd: 15,
        latestInvoiceId: 'in_1',
      }),
    ).toMatchObject({ _id: subscription!._id, organizationId: account.organizationId });
    expect(await state()).toMatchObject({
      currentPeriodEnd: 20,
      subscription: {
        currentPeriodStart: 10,
        trialEnd: 15,
        latestInvoiceId: 'in_1',
        stripePriceId: 'price_1',
      },
    });
  });
});

describe('Stripe event processing', () => {
  it('deduplicates retries and stores only an allowlisted event summary', async () => {
    const { t, event } = await setup();
    expect(
      await event(
        'unhandled.event',
        {
          customerId: 'cus_1',
          subscriptionId: 'sub_1',
          plan: { lookupKey: 'lookup' },
          private: 'secret',
        },
        'evt_retry',
      ),
    ).toMatchObject({ received: true, duplicate: false });
    expect(await event('unhandled.event', {}, 'evt_retry')).toMatchObject({ duplicate: true });
    const events = await t.run((ctx) => ctx.db.query('billingEvents').collect());
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].payloadSummary)).toEqual({
      id: 'evt_retry',
      type: 'unhandled.event',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      lookupKey: 'lookup',
    });
    await event('unhandled.event', null);
    await event('unhandled.event', { customer_id: 'cus_2', subscription_id: 'sub_2', price: [] });
    await expect(
      t.mutation(internal.billing.handleStripeEvent, { eventJson: '{' }),
    ).rejects.toThrow();
  });

  it.each(['customer', 'customer_id', 'customerId'])(
    'maps completed checkout using %s and does not mark payment active prematurely',
    async (customerKey) => {
      const { account, owner, event, state } = await setup();
      await event('checkout.session.completed', {
        id: 'cs_paid',
        [customerKey]: 'cus_paid',
        metadata: {
          billingAccountId: account._id,
          userId: owner.user._id,
          organizationId: account.organizationId,
        },
        customer_details: { email: 'payer@example.test' },
      });
      expect(await state()).toMatchObject({
        billingStatus: 'pending',
        stripeCustomerId: 'cus_paid',
        billingEmail: 'payer@example.test',
        isActive: false,
      });
      await event('checkout.session.completed', {
        customer: 'cus_paid',
        customer_email: 'fallback@example.test',
      });
      expect(await state()).toMatchObject({ billingEmail: 'fallback@example.test' });
    },
  );

  it('rejects unmappable checkouts and subscriptions without IDs without recording a processed event', async () => {
    const { t, account, event } = await setup();
    await expect(event('checkout.session.completed', {})).rejects.toThrow('without an owner');
    await expect(
      event('customer.subscription.created', { metadata: { billingAccountId: account._id } }),
    ).rejects.toThrow('missing id');
    expect(await t.run((ctx) => ctx.db.query('billingEvents').collect())).toEqual([]);
    for (const type of [
      'customer.subscription.created',
      'invoice.paid',
      'entitlements.active_entitlement_summary.updated',
    ]) {
      await event(type, {});
      await event(type, { customer: 'cus_unknown' });
    }
    expect(await t.run((ctx) => ctx.db.query('billingSubscriptions').collect())).toEqual([]);
  });

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
  ])(
    'processes %s with verified account metadata and replaces subscription snapshots',
    async (type) => {
      const { account, event, state } = await setup();
      const object = {
        id: 'sub_1',
        customer: 'cus_1',
        metadata: {
          billingAccountId: account._id,
          organizationId: account.organizationId,
          entitlementSummary: JSON.stringify({ extra: true, denied: false, string: 'true' }),
        },
        status: 'active',
        items: {
          data: [
            {
              price: {
                id: 'price_1',
                lookup_key: getPriceLookupKey('town_essential', 'year'),
                product: 'prod_1',
              },
            },
          ],
        },
        current_period_start: 10,
        current_period_end: 20,
        trial_end: 15,
        cancel_at_period_end: true,
        latest_invoice: 'in_1',
      };
      await event(type, object);
      expect(await state()).toMatchObject({
        planKey: 'town_essential',
        currentPeriodEnd: 20,
        cancelAtPeriodEnd: true,
        entitlementSummary: { extra: true },
        subscription: {
          stripeSubscriptionId: 'sub_1',
          stripeProductId: 'prod_1',
          currentPeriodStart: 10,
        },
      });
      expect((await state())!.entitlementSummary).not.toHaveProperty('denied');
      await event(type, {
        ...object,
        metadata: {
          billingAccountId: account._id,
          planKey: 'city_standard',
          entitlementSummary: '{',
        },
        status: 'canceled',
        items: { data: [{ price: { product: { id: 'prod_2' }, lookupKey: 'unknown' } }] },
        current_period_end: 'bad',
        cancel_at_period_end: 'bad',
      });
      expect(await state()).toMatchObject({
        billingStatus: 'canceled',
        isActive: false,
        subscription: { stripeProductId: 'prod_2' },
      });
      expect((await state())!.entitlementSummary).not.toHaveProperty('private_workspaces');
    },
  );

  it('resolves subscriptions by owner/customer and safely handles missing optional price and metadata shapes', async () => {
    const { t, owner, account, event, state } = await setup();
    await event('customer.subscription.created', {
      id: 'sub_1',
      metadata: { userId: owner.user._id, entitlementSummary: 'null' },
      status: 'unknown',
      items: { data: [] },
    });
    expect(await state()).toMatchObject({ billingStatus: 'inactive', planKey: 'civic_free' });
    await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
      billingAccountId: account._id,
      stripeCustomerId: 'cus_1',
    });
    await event('customer.subscription.updated', {
      id: 'sub_1',
      customer_id: 'cus_1',
      items: { data: [{ price: { product: 7 } }] },
    });
    await event('customer.subscription.updated', { id: 'sub_1', customerId: 'cus_1', items: {} });
    expect((await state())!.subscription).toMatchObject({
      stripeProductId: null,
      stripePriceLookupKey: null,
    });
  });

  it.each([
    'invoice.paid',
    'invoice.payment_failed',
    'invoice.created',
    'invoice.finalized',
    'invoice.updated',
  ])(
    'applies %s to an account and its subscription without losing saved identifiers',
    async (type) => {
      const { t, account, event, state } = await setup();
      await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
        billingAccountId: account._id,
        stripeCustomerId: 'cus_1',
        billingStatus: 'active',
        planKey: 'town_essential',
      });
      await event(type, { id: 'in_first', customer_id: 'cus_1' });
      expect(await state()).toMatchObject({
        billingStatus: type === 'invoice.payment_failed' ? 'past_due' : 'active',
      });
      await t.mutation(internal.billing.upsertBillingSubscriptionSnapshot, {
        billingAccountId: account._id,
        stripeSubscriptionId: 'sub_1',
        planKey: 'town_essential',
        billingStatus: 'active',
        entitlementSummary: { custom: true },
        cancelAtPeriodEnd: false,
      });
      await event(type, { id: 'in_second', customerId: 'cus_1', period_end: 200 });
      expect(await state()).toMatchObject({
        currentPeriodEnd: 200,
        subscription: { latestInvoiceId: 'in_second', currentPeriodEnd: 200 },
      });
      await event(type, { id: 'in_third', customer: 'cus_1' });
      expect((await state())!.subscription).toMatchObject({
        currentPeriodEnd: 200,
        latestInvoiceId: 'in_third',
      });
    },
  );

  it('normalizes provider entitlement variants and updates the linked subscription', async () => {
    const { t, account, event, state } = await setup();
    await t.mutation(internal.billing.upsertBillingAccountSnapshot, {
      billingAccountId: account._id,
      stripeCustomerId: 'cus_1',
      billingStatus: 'active',
    });
    await event('entitlements.active_entitlement_summary.updated', {
      customer: 'cus_1',
      active_entitlements: 'invalid',
    });
    await event('entitlements.active_entitlement_summary.updated', {
      customer_id: 'cus_1',
      activeEntitlementSummary: [
        null,
        [],
        { feature: { lookup_key: 'a' } },
        { entitlement_feature: { lookupKey: 'b' } },
        { entitlementFeature: { lookup_key: 'c' } },
        { lookup_key: 'd' },
        { lookupKey: 'e' },
        { feature_key: 'f' },
        { featureKey: 'g' },
        {},
      ],
    });
    expect((await state())!.entitlementSummary).toMatchObject({
      a: true,
      b: true,
      c: true,
      d: true,
      e: true,
      f: true,
      g: true,
    });
    await t.mutation(internal.billing.upsertBillingSubscriptionSnapshot, {
      billingAccountId: account._id,
      stripeSubscriptionId: 'sub_1',
      planKey: 'civic_free',
      billingStatus: 'active',
      entitlementSummary: {},
      cancelAtPeriodEnd: false,
    });
    await event('entitlements.active_entitlement_summary.updated', {
      customerId: 'cus_1',
      entitlements: [{ lookup_key: 'sub_feature' }],
    });
    expect((await state())!.subscription?.entitlementSummary).toMatchObject({ sub_feature: true });
    expect((await state())!.entitlementSummary).not.toHaveProperty('a');
    await event('entitlements.active_entitlement_summary.updated', {
      customer: 'cus_1',
      active_entitlements: [],
    });
    expect((await state())!.entitlementSummary).not.toHaveProperty('sub_feature');
    expect((await state())!.subscription?.entitlementSummary).not.toHaveProperty('sub_feature');
  });
});
