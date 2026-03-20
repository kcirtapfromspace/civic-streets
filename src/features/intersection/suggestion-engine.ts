import type { IntersectionConditions, IntersectionImprovement, CrashSummary } from '@/lib/types/intersection';
import type { NormalizedCrash } from '@/lib/types/safety-data';
import { SEVERITY_WEIGHTS } from '@/lib/types/safety-data';

export interface ScoredImprovement {
  improvement: IntersectionImprovement;
  crashScore: number;
  isDataSuggested: boolean;
}

const NEARBY_RADIUS_METERS = 75;

/**
 * Haversine distance between two points in meters.
 */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter crashes within radius of a center point.
 */
export function filterNearbyCrashes(
  crashes: NormalizedCrash[],
  center: { lat: number; lng: number },
  radiusMeters = NEARBY_RADIUS_METERS,
): NormalizedCrash[] {
  return crashes.filter((c) =>
    haversineMeters(center.lat, center.lng, c.lat, c.lng) <= radiusMeters,
  );
}

/**
 * Summarize nearby crashes for display.
 */
export function summarizeCrashes(
  crashes: NormalizedCrash[],
  radiusMeters = NEARBY_RADIUS_METERS,
): CrashSummary {
  let fatalities = 0;
  let severeInjuries = 0;
  let pedestrianCrashes = 0;
  let cyclistCrashes = 0;
  let motoristCrashes = 0;

  for (const c of crashes) {
    fatalities += c.fatalities;
    if (c.severity === 'severe-injury') severeInjuries++;
    if (c.modes.includes('pedestrian')) pedestrianCrashes++;
    if (c.modes.includes('cyclist')) cyclistCrashes++;
    if (c.modes.includes('motorist')) motoristCrashes++;
  }

  return {
    totalCrashes: crashes.length,
    fatalities,
    severeInjuries,
    pedestrianCrashes,
    cyclistCrashes,
    motoristCrashes,
    radiusMeters,
  };
}

/**
 * Score and sort improvements based on intersection conditions and nearby crash data.
 *
 * Algorithm:
 * 1. Filter out inapplicable (already have signal → skip upgrade-to-signal; check excludes/requires)
 * 2. Score by crash relevance: count nearby crashes matching relevantCrashModes, weight by severity
 * 3. Sort: data-suggested first (by crash score desc), then remaining by complexity
 */
export function suggestImprovements(
  conditions: IntersectionConditions,
  nearbyCrashes: NormalizedCrash[],
  allImprovements: IntersectionImprovement[],
): ScoredImprovement[] {
  const isSignalized = conditions.trafficControl === 'signalized';
  const hasRoundabout = conditions.trafficControl === 'roundabout';

  const COMPLEXITY_ORDER: Record<string, number> = {
    'quick-win': 0,
    'moderate': 1,
    'major': 2,
  };

  return allImprovements
    .filter((imp) => {
      // Skip if already signalized and improvement adds signal
      if (isSignalized && imp.id === 'upgrade-to-signal') return false;
      // Skip signal-dependent improvements if not signalized
      if (imp.requires?.includes('signalized') && !isSignalized) return false;
      // Skip if already a roundabout
      if (hasRoundabout && imp.id === 'convert-to-roundabout') return false;
      // Already has curb ramps
      if (conditions.hasCurbRamps && imp.id === 'curb-ramps') return false;
      // Already has ped signal
      if (conditions.hasPedestrianSignal && imp.id === 'accessible-pedestrian-signal') return false;
      // Already has crosswalks (high-visibility includes standard)
      if (
        (conditions.crossingType === 'high-visibility-crosswalk' || conditions.crossingType === 'raised-crosswalk') &&
        imp.id === 'add-crosswalks'
      ) return false;
      if (conditions.crossingType === 'high-visibility-crosswalk' && imp.id === 'high-visibility-markings') return false;

      return true;
    })
    .map((imp) => {
      // Score by crash relevance
      let crashScore = 0;
      for (const crash of nearbyCrashes) {
        const modeMatch = imp.relevantCrashModes.some((m) => crash.modes.includes(m));
        if (modeMatch) {
          crashScore += SEVERITY_WEIGHTS[crash.severity] ?? 0.1;
        }
      }

      const isDataSuggested = crashScore >= imp.minimumCrashThreshold && crashScore > 0;

      return { improvement: imp, crashScore, isDataSuggested };
    })
    .sort((a, b) => {
      // Data-suggested first
      if (a.isDataSuggested && !b.isDataSuggested) return -1;
      if (!a.isDataSuggested && b.isDataSuggested) return 1;

      // Within same suggestion tier, sort by crash score desc
      if (a.isDataSuggested && b.isDataSuggested) {
        return b.crashScore - a.crashScore;
      }

      // Non-suggested: sort by complexity (quick-win first)
      return (COMPLEXITY_ORDER[a.improvement.complexity] ?? 1) - (COMPLEXITY_ORDER[b.improvement.complexity] ?? 1);
    });
}
