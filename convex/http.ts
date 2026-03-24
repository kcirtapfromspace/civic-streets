import Stripe from 'stripe';
import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

function getStripeSecretKey(): string {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return secret;
}

function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

const http = httpRouter();

http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    let body: string;
    try {
      body = await req.text();
    } catch {
      return new Response('Unable to read request body', { status: 400 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing Stripe signature', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(getStripeSecretKey());
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        getStripeWebhookSecret(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Stripe webhook';
      return new Response(message, { status: 400 });
    }

    const result = await ctx.runMutation(internal.billing.handleStripeEvent, {
      eventJson: JSON.stringify(event),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  }),
});

export default http;
