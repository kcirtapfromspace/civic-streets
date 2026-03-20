// Road geometry utilities: fetch road polyline via OSRM (free, no API key),
// decode polylines, and compute bearing.

type LatLng = { lat: number; lng: number };

/**
 * Fetch the road centerline through a point using OSRM's nearest + route API.
 * Generates a short route through the point to capture the road's actual path.
 * Falls back to a synthetic straight line if the API fails.
 */
export async function fetchRoadPath(
  location: LatLng,
): Promise<{ path: LatLng[]; bearing: number }> {
  // Create two waypoints offset ~150m in a north-south line through the point.
  // OSRM will snap to the nearest road and return detailed geometry.
  const offset = 0.0015; // ~150m in latitude
  const origin = { lat: location.lat - offset, lng: location.lng };
  const destination = { lat: location.lat + offset, lng: location.lng };

  try {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);

    const data = await res.json();

    if (data.routes?.length > 0) {
      const geojsonCoords = data.routes[0].geometry.coordinates as [number, number][];
      const path = geojsonCoords.map(([lng, lat]) => ({ lat, lng }));

      if (path.length >= 2) {
        const bearing = computeBearing(path[0], path[path.length - 1]);
        return { path, bearing };
      }
    }
  } catch {
    // Fall through to fallback
  }

  return createFallbackPath(location);
}

/**
 * Create a fallback straight-line path through a point.
 */
function createFallbackPath(location: LatLng): { path: LatLng[]; bearing: number } {
  const offset = 0.001;
  const path = [
    { lat: location.lat - offset, lng: location.lng },
    { lat: location.lat, lng: location.lng },
    { lat: location.lat + offset, lng: location.lng },
  ];
  return { path, bearing: 0 };
}

/**
 * Compute bearing (degrees, 0=N, 90=E) between two points.
 */
export function computeBearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}
