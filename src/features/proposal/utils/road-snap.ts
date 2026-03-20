// OSRM Route API: snaps a user-drawn drag trail to actual road geometry.
// Uses Route (not Match) so the result follows the road network between
// waypoints instead of snapping each point to its nearest road segment.

type LatLng = { lat: number; lng: number };

/**
 * Sample key waypoints from a drag trail.
 * Extracts start, end, and evenly-spaced midpoints to capture
 * the user's intended path while keeping the waypoint count low.
 */
function sampleWaypoints(trail: LatLng[], count: number): LatLng[] {
  if (trail.length <= count) return trail;
  const step = (trail.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => trail[Math.round(i * step)]);
}

/**
 * Snap a user-drawn drag trail to roads using OSRM Route API.
 * Samples ~5 waypoints from the trail and routes between them,
 * producing a path that follows the road network.
 * Falls back to the raw input if OSRM fails.
 */
export async function snapToRoad(
  points: LatLng[],
): Promise<LatLng[]> {
  if (points.length < 2) return points;

  // Sample 5 waypoints: start, 3 midpoints, end.
  // This captures the general shape of the drag while letting
  // OSRM fill in the actual road geometry between them.
  const waypoints = sampleWaypoints(points, 5);
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
