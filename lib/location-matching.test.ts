import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDistanceMeters,
  matchNearestFalconLocation,
  type FalconLocationCandidate,
  type LocationInput,
} from "./location-matching";

const approvedLocations: FalconLocationCandidate[] = [
  { id: "arra-showroom", name: "Arra Showroom", latitude: 3.111434, longitude: 101.582701, matchRadiusMeters: 1000 },
  { id: "falcon-office", name: "Falcon Office", latitude: 3.0829794301704596, longitude: 101.7015696422315, matchRadiusMeters: 1000 },
  { id: "ren-showroom", name: "Ren Showroom", latitude: 3.0467428543348953, longitude: 101.66525514298799, matchRadiusMeters: 1000 },
  { id: "stellaris-showroom", name: "Stellaris Showroom", latitude: 3.1867843093780577, longitude: 101.66567538666598, matchRadiusMeters: 1000 },
];

function capturedAt(candidate: FalconLocationCandidate): LocationInput {
  return { latitude: candidate.latitude, longitude: candidate.longitude, accuracyMeters: 10 };
}

for (const approvedLocation of approvedLocations) {
  test(`matches a check-in inside ${approvedLocation.name}'s 1000 metre radius`, () => {
    const match = matchNearestFalconLocation(capturedAt(approvedLocation), approvedLocations);

    assert.equal(match?.id, approvedLocation.id);
    assert.equal(match?.name, approvedLocation.name);
    assert.equal(match?.source, "falcon_location");
  });
}

test("returns no approved-location match outside all radiuses without inventing a name", () => {
  const outsideLocation: LocationInput = { latitude: 3.25, longitude: 101.8, accuracyMeters: 10 };

  assert.equal(matchNearestFalconLocation(outsideLocation, approvedLocations), null);
});

test("selects the nearest approved location when radiuses overlap", () => {
  const firstLocation: FalconLocationCandidate = {
    id: "first-location", name: "First Location", latitude: 3.1, longitude: 101.6, matchRadiusMeters: 1000,
  };
  const nearerLocation: FalconLocationCandidate = {
    id: "nearer-location", name: "Nearer Location", latitude: 3.1005, longitude: 101.6, matchRadiusMeters: 1000,
  };
  const checkInLocation: LocationInput = { latitude: 3.10045, longitude: 101.6, accuracyMeters: 10 };

  assert.equal(
    matchNearestFalconLocation(checkInLocation, [firstLocation, nearerLocation])?.id,
    "nearer-location",
  );
});

test("includes a location exactly at its configured radius and excludes it beyond the boundary", () => {
  const checkInLocation: LocationInput = { latitude: 3.11, longitude: 101.58, accuracyMeters: 10 };
  const candidate: FalconLocationCandidate = {
    id: "boundary-location", name: "Boundary Location", latitude: 3.115, longitude: 101.58, matchRadiusMeters: 0,
  };
  const exactDistance = calculateDistanceMeters(checkInLocation, candidate);

  assert.equal(
    matchNearestFalconLocation(checkInLocation, [{ ...candidate, matchRadiusMeters: exactDistance }])?.id,
    candidate.id,
  );
  assert.equal(
    matchNearestFalconLocation(checkInLocation, [{ ...candidate, matchRadiusMeters: exactDistance - 0.001 }]),
    null,
  );
});
