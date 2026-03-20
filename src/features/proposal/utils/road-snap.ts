// OSRM Match API: snaps user-drawn polyline to actual road geometry

type LatLng = { lat: number; lng: number };

/**
 * Snap a user-drawn polyline to the nearest road using OSRM Match API.
 * Falls back to the raw input if OSRM fails.
 */
export async function snapToRoad(
  points: LatLng[],
): Promise<LatLng[]> {
  if (points.length < 2) return points;

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const radiuses = points.map(() => '25').join(';');
  const url = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radiuses}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM Match ${res.status}`);

    const data = await res.json();

    if (data.matchings?.length > 0) {
      const geojsonCoords = data.matchings[0].geometry.coordinates as [number, number][];
      const path = geojsonCoords.map(([lng, lat]) => ({ lat, lng }));
      if (path.length >= 2) return path;
    }
  } catch {
    // Fall back to raw input
  }

  return points;
}
