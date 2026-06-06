import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPetProfilePrompt,
  formatPriceCents,
  formatPriceRange,
  petTypeLabel,
  speciesToPetType,
} from "./format";

describe("formatPriceCents", () => {
  it("formats Singapore dollar prices from cents", () => {
    assert.equal(formatPriceCents(1290), "S$12.90");
    assert.equal(formatPriceCents(0), "S$0.00");
  });

  it("returns null for absent or invalid prices", () => {
    assert.equal(formatPriceCents(null), null);
    assert.equal(formatPriceCents(undefined), null);
    assert.equal(formatPriceCents(Number.NaN), null);
  });
});

describe("formatPriceRange", () => {
  it("collapses identical minimum and maximum prices", () => {
    assert.equal(formatPriceRange(1290, 1290), "S$12.90");
  });

  it("formats a price range when both endpoints differ", () => {
    assert.equal(formatPriceRange(1290, 2590), "S$12.90 – S$25.90");
  });

  it("uses the available endpoint when one side is missing", () => {
    assert.equal(formatPriceRange(null, 2590), "S$25.90");
    assert.equal(formatPriceRange(1290, undefined), "S$12.90");
  });
});

describe("petTypeLabel", () => {
  it("maps known pet data values to display labels", () => {
    assert.equal(petTypeLabel("dog"), "Dog");
    assert.equal(petTypeLabel("SMALL_PET"), "Small pet");
    assert.equal(petTypeLabel("rabbit"), "Small pet");
  });

  it("preserves unknown values and ignores empty values", () => {
    assert.equal(petTypeLabel("ferret"), "ferret");
    assert.equal(petTypeLabel(null), null);
    assert.equal(petTypeLabel(undefined), null);
  });
});

describe("speciesToPetType", () => {
  it("maps supported app species to pet data filters", () => {
    assert.equal(speciesToPetType("dog"), "dog");
    assert.equal(speciesToPetType("Cat"), "cat");
    assert.equal(speciesToPetType("small_pet"), "rabbit");
  });

  it("returns undefined for unsupported or missing species", () => {
    assert.equal(speciesToPetType("hamster"), undefined);
    assert.equal(speciesToPetType(null), undefined);
  });
});

describe("buildPetProfilePrompt", () => {
  it("asks for profile details when no pet is selected", () => {
    assert.match(buildPetProfilePrompt(null), /No pet profile is on file yet/);
  });

  it("builds a compact prompt with known pet details", () => {
    const prompt = buildPetProfilePrompt({
      id: "pet-1",
      userId: "user-1",
      name: "Mochi",
      species: "Cat",
      breed: " Ragdoll ",
      ageYears: 4,
      weightKg: 5.2,
      medicalConditions: ["sensitive stomach"],
      dietaryRestrictions: ["grain-free"],
      locationLabel: "Tiong Bahru",
      locationPostalCode: "160001",
      photoPath: null,
      photoUrl: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    assert.equal(
      prompt,
      [
        "Name: Mochi",
        "Species: Cat",
        "Breed: Ragdoll",
        "Age: 4 years",
        "Weight: 5.2 kg",
        "Medical conditions: sensitive stomach",
        "Dietary restrictions: grain-free",
        "Location: Tiong Bahru",
      ].join("\n"),
    );
  });
});
