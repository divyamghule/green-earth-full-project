const MAX_ALLOWED_ACCURACY = Math.max(10, Number(process.env.GPS_MAX_ACCURACY_METERS || 120));
const MAX_BEFORE_AFTER_DISTANCE_METERS = Math.max(
  20,
  Number(process.env.GPS_MAX_BEFORE_AFTER_DISTANCE_METERS || 300)
);

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function validateLocation(location = {}) {
  const lat = parseNumber(location.lat);
  const lng = parseNumber(location.lng);
  const accuracy = parseNumber(location.accuracy);
  const capturedAt = location.capturedAt ? new Date(location.capturedAt) : null;

  if (lat === null || lng === null || accuracy === null || !capturedAt || Number.isNaN(capturedAt.getTime())) {
    return {
      valid: false,
      reason: "Missing or invalid GPS data.",
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      valid: false,
      reason: "GPS coordinates are out of range.",
    };
  }

  if (accuracy > MAX_ALLOWED_ACCURACY) {
    return {
      valid: false,
      reason: `GPS accuracy too low (${accuracy}m). Required <= ${MAX_ALLOWED_ACCURACY}m. Please retry in open sky.`,
    };
  }

  return {
    valid: true,
    normalized: {
      lat,
      lng,
      accuracy,
      capturedAt: capturedAt.toISOString(),
    },
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(pointA, pointB) {
  const lat1 = parseNumber(pointA?.lat);
  const lng1 = parseNumber(pointA?.lng);
  const lat2 = parseNumber(pointB?.lat);
  const lng2 = parseNumber(pointB?.lng);

  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

module.exports = {
  validateLocation,
  MAX_ALLOWED_ACCURACY,
  MAX_BEFORE_AFTER_DISTANCE_METERS,
  calculateDistanceMeters,
};
