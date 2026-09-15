// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import schema from './schema';
const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const secret = 'whsec_local_fixture';
const payload = JSON.stringify({
  id: 'evt_signed',
  type: 'unhandled.test',
  data: { object: { customer: 'cus_1', private: 'do not persist' } },
});
const header = () => Stripe.webhooks.generateTestHeaderString({ payload, secret });
beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Stripe webhook HTTP boundary', () => {
  it('verifies a real signed payload, dispatches once and acknowledges retries', async () => {
    const t = convexTest(schema, modules);
    const request = { method: 'POST', body: payload, headers: { 'stripe-signature': header() } };
    const response = await t.fetch('/stripe/webhook', request);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toMatchObject({
      received: true,
      duplicate: false,
      eventId: 'evt_signed',
    });
    expect(await (await t.fetch('/stripe/webhook', request)).json()).toMatchObject({
      duplicate: true,
    });
    expect(await t.run((ctx) => ctx.db.query('billingEvents').collect())).toHaveLength(1);
  });

  it('rejects absent/bad signatures and tampered bodies without processing events', async () => {
    const t = convexTest(schema, modules);
    for (const args of [
      { body: payload },
      { body: payload, headers: { 'stripe-signature': 'bad' } },
      { body: payload + ' ', headers: { 'stripe-signature': header() } },
    ]) {
      expect((await t.fetch('/stripe/webhook', { method: 'POST', ...args })).status).toBe(400);
    }
    expect(await t.run((ctx) => ctx.db.query('billingEvents').collect())).toEqual([]);
  });

  it.each(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])(
    'fails closed when %s is absent',
    async (key) => {
      const t = convexTest(schema, modules);
      vi.stubEnv(key, undefined);
      const response = await t.fetch('/stripe/webhook', {
        method: 'POST',
        body: payload,
        headers: { 'stripe-signature': header() },
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toContain(`${key} is not configured`);
      expect(await t.run((ctx) => ctx.db.query('billingEvents').collect())).toEqual([]);
    },
  );

  it('returns a client error for an unreadable request body', async () => {
    const t = convexTest(schema, modules);
    vi.spyOn(Request.prototype, 'text').mockRejectedValueOnce(new Error('Body stream interrupted'));
    const response = await t.fetch('/stripe/webhook', { method: 'POST', body: payload });
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Unable to read request body');
  });
});
