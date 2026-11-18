import type { GeoPoint, BoundingBox } from "@/types";

const EARTH_RADIUS_KM = 6371;

/** Haversine great-circle distance in kilometres */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bounding box for a circle (approximate, for pre-filtering) */
export function bboxFromCenter(
  lat: number,
  lng: number,
  radiusKm: number
): BoundingBox {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** Whether a point is within `radiusKm` of the center */
export function isWithinRadius(
  center: GeoPoint,
  point: GeoPoint,
  radiusKm: number
): boolean {
  return haversineKm(center.lat, center.lng, point.lat, point.lng) <= radiusKm;
}

/** Convert degrees to radians */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Parse lat/lng from query string with validation */
export function parseLatLng(lat: string | null, lng: string | null) {
  const parsedLat = lat ? parseFloat(lat) : null;
  const parsedLng = lng ? parseFloat(lng) : null;

  if (
    parsedLat === null ||
    parsedLng === null ||
    isNaN(parsedLat) ||
    isNaN(parsedLng) ||
    parsedLat < -90 ||
    parsedLat > 90 ||
    parsedLng < -180 ||
    parsedLng > 180
  ) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
}

/** Build a simple GeoJSON FeatureCollection from issue pins */
export function issuesToGeoJSON(
  issues: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    status: string;
    category: string;
  }>
) {
  return {
    type: "FeatureCollection" as const,
    features: issues.map((issue) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [issue.lng, issue.lat],
      },
      properties: {
        id: issue.id,
        title: issue.title,
        status: issue.status,
        category: issue.category,
      },
    })),
  };
}
