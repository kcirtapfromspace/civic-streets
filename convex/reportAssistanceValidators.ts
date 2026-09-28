import { v } from 'convex/values';

export const assistanceInput = {
  description: v.string(), lat: v.number(), lng: v.number(),
};
export const assistanceDecision = {
  classification: v.object({ choice: v.string(), confidence: v.number() }),
  checks: v.array(v.object({ id: v.string(), choice: v.string(), confidence: v.number() })),
  related: v.array(v.object({ hotspotId: v.id('hotspots'), probability: v.number() })),
};
