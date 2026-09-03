export type LocationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export type FalconLocationCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  matchRadiusMeters: number;
};

export type FalconLocationMatch = {
  id: string;
  name: string;
  distanceMeters: number;
  source: "falcon_location";
};

const earthRadiusMeters = 6371000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(
  from: Pick<LocationInput, "latitude" | "longitude">,
  to: Pick<LocationInput, "latitude" | "longitude">,
) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function matchNearestFalconLocation(
  location: LocationInput,
  candidates: FalconLocationCandidate[],
): FalconLocationMatch | null {
  let nearestMatch: FalconLocationMatch | null = null;

  for (const candidate of candidates) {
    const distanceMeters = calculateDistanceMeters(location, candidate);

    if (distanceMeters > candidate.matchRadiusMeters) continue;

    if (!nearestMatch || distanceMeters < nearestMatch.distanceMeters) {
      nearestMatch = {
        id: candidate.id,
        name: candidate.name,
        distanceMeters: Math.round(distanceMeters),
        source: "falcon_location",
      };
    }
  }

  return nearestMatch;
}

export function validateLocationInput(payload: unknown): LocationInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("Location is required");
  }

  const record = payload as Record<string, unknown>;
  const { latitude, longitude, accuracyMeters } = record;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error("Latitude must be between -90 and 90");
  }

  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Longitude must be between -180 and 180");
  }

  if (
    typeof accuracyMeters !== "number" ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0
  ) {
    throw new Error("Accuracy must be zero or greater");
  }

  return {
    latitude,
    longitude,
    accuracyMeters,
  };
}
