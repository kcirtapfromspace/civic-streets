import { v } from 'convex/values';
export const city = v.union(v.literal('chi'), v.literal('nyc'), v.literal('denver'));
export const crash = v.object({
  id: v.string(), lat: v.number(), lng: v.number(), date: v.string(), source: city,
  modes: v.array(v.union(v.literal('pedestrian'), v.literal('cyclist'), v.literal('motorist'))),
  severity: v.union(v.literal('fatal'), v.literal('severe-injury'), v.literal('moderate-injury'), v.literal('minor'), v.literal('unknown')),
  fatalities: v.union(v.number(), v.null()), injuries: v.union(v.number(), v.null()),
  injuryCountScope: v.union(v.literal('all'), v.literal('serious-only')),
});
