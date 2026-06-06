import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postalToLatLng } from "./search";

describe("postalToLatLng", () => {
  it("returns the centroid for a known Singapore postal district", () => {
    assert.deepEqual(postalToLatLng("160001"), { lat: 1.3236, lng: 103.943 });
  });

  it("ignores non-digit formatting in postal codes", () => {
    assert.deepEqual(postalToLatLng("SG 238-859"), {
      lat: 1.3636,
      lng: 103.764,
    });
  });

  it("returns null for short or unknown postal districts", () => {
    assert.equal(postalToLatLng("7"), null);
    assert.equal(postalToLatLng("990000"), null);
  });
});
