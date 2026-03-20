// Road geometry utilities: fetch road polyline via Directions API,
// decode encoded polylines, and compute bearing.

type LatLng = { lat: number; lng: number };

/**
 * Fetch the road centerline through a point using the Directions API.
 * Generates a short route through the point to capture the road's actual path.
 * Falls back to a synthetic straight line if the API fails.
 */
export async function fetchRoadPath(
  location: LatLng,
  apiKey: string,
): Promise<{ path: LatLng[]; bearing: number }> {
  // Create two waypoints offset ~200m in a north-south line through the point.
  // The Directions API will snap to the nearest road.
  const offset = 0.002; // ~200m in latitude
  const origin = { lat: location.lat - offset, lng: location.lng };
  const destination = { lat: location.lat + offset, lng: location.lng };

  try {
    const directionsService = new google.maps.DirectionsService();
    const result = await directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
    });

    if (result.routes.length > 0 && result.routes[0].overview_path) {
      const path = result.routes[0].overview_path.map((p) => ({
        lat: p.lat(),
        lng: p.lng(),
      }));

      if (path.length >= 2) {
        const bearing = computeBearing(path[0], path[path.length - 1]);
        return { path, bearing };
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: straight line through the point
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
