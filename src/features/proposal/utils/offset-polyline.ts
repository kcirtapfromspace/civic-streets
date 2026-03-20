// Perpendicular offset math for rendering lane-width polylines on the map.

type LatLng = { lat: number; lng: number };

/**
 * Offset a polyline perpendicular to its bearing by a given distance in feet.
 * Positive offset = right side (when facing bearing direction).
 * Negative offset = left side.
 */
export function offsetPolyline(
  path: LatLng[],
  offsetFeet: number,
): LatLng[] {
  if (path.length < 2) return path;

  const offsetMeters = offsetFeet * 0.3048;

  return path.map((point, i) => {
    // Compute bearing at this point
    let bearing: number;
    if (i === 0) {
      bearing = bearingRad(path[0], path[1]);
    } else if (i === path.length - 1) {
      bearing = bearingRad(path[i - 1], path[i]);
    } else {
      // Average of incoming and outgoing bearings for smooth corners
      const b1 = bearingRad(path[i - 1], path[i]);
      const b2 = bearingRad(path[i], path[i + 1]);
      bearing = averageBearing(b1, b2);
    }

    // Perpendicular angle (90 degrees clockwise = right side)
    const perpAngle = bearing + Math.PI / 2;

    // Earth radius in meters
    const R = 6371000;
    const dLat = (offsetMeters * Math.cos(perpAngle)) / R;
    const dLng =
      (offsetMeters * Math.sin(perpAngle)) /
      (R * Math.cos((point.lat * Math.PI) / 180));

    return {
      lat: point.lat + (dLat * 180) / Math.PI,
      lng: point.lng + (dLng * 180) / Math.PI,
    };
  });
}

function bearingRad(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return Math.atan2(y, x);
}

function averageBearing(b1: number, b2: number): number {
  const x = Math.cos(b1) + Math.cos(b2);
  const y = Math.sin(b1) + Math.sin(b2);
  return Math.atan2(y, x);
}

/**
 * Compute the offsets for each element in a cross-section,
 * measured from the road centerline (feet, positive = right).
 */
export function computeElementOffsets(
  elements: Array<{ width: number }>,
  totalROWWidth: number,
): Array<{ centerOffset: number; width: number }> {
  // Start from leftmost edge
  let cursor = -totalROWWidth / 2;
  return elements.map((el) => {
    const centerOffset = cursor + el.width / 2;
    cursor += el.width;
    return { centerOffset, width: el.width };
  });
}
