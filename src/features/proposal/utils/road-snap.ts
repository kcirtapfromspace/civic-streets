// OSRM Route API: snaps a user-drawn drag trail to actual road geometry.
// Uses Route (not Match) so the result follows the road network between
// waypoints instead of snapping each point to its nearest road segment.

type LatLng = { lat: number; lng: number };

/**
 * Pick routing waypoints from a drag trail: just start + end.
 * Intermediate trail points are mouse noise — OSRM finds the
 * road-following path between the endpoints.
 *
 * For very long trails (>100 points), include one midpoint to
 * preserve the user's intended shape on L-shaped / corner drags.
 */
function pickWaypoints(trail: LatLng[]): LatLng[] {
  const start = trail[0];
  const end = trail[trail.length - 1];
  if (trail.length > 100) {
    const mid = trail[Math.floor(trail.length / 2)];
    return [start, mid, end];
  }
  return [start, end];
}

/**
 * Snap a user-drawn drag trail to roads using OSRM Route API.
 * Routes between start and end of the trail so OSRM follows the
 * main road. Falls back to the raw input if OSRM fails.
 */
export async function snapToRoad(
  points: LatLng[],
): Promise<LatLng[]> {
  if (points.length < 2) return points;

  const waypoints = pickWaypoints(points);
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM Route ${res.status}`);

    const data = await res.json();

    if (data.routes?.length > 0) {
      const geojsonCoords = data.routes[0].geometry.coordinates as [number, number][];
      const path = geojsonCoords.map(([lng, lat]) => ({ lat, lng }));
      if (path.length >= 2) return path;
    }
  } catch {
    // Fall back to raw input
  }

  return points;
}
