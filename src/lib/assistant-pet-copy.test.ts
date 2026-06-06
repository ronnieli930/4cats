import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAssistantWelcome,
  buildContextPetSubtitle,
} from "./assistant-pet-copy";

const basePet = {
  id: "pet-1",
  userId: "user-1",
  name: "Mochi",
  species: "Cat",
  breed: null,
  ageYears: null,
  weightKg: null,
  medicalConditions: [],
  dietaryRestrictions: [],
  locationLabel: null,
  locationPostalCode: null,
  photoPath: null,
  photoUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("buildAssistantWelcome", () => {
  it("uses a generic welcome when no pet exists", () => {
    assert.equal(
      buildAssistantWelcome(null),
      "Hi there! I'm ready to help with grooming, health, or lifestyle questions for your pet in Singapore.",
    );
  });

  it("uses the breed when one is available", () => {
    assert.equal(
      buildAssistantWelcome({ ...basePet, breed: " Ragdoll " }),
      "Hi there! How is Mochi doing today? I'm ready to help with any grooming, health, or lifestyle questions you have for your Ragdoll.",
    );
  });

  it("normalizes common species in the fallback copy", () => {
    assert.match(buildAssistantWelcome(basePet), /for your cat\.$/);
    assert.match(
      buildAssistantWelcome({ ...basePet, species: "Dog" }),
      /for your dog\.$/,
    );
  });
});

describe("buildContextPetSubtitle", () => {
  it("summarizes breed, age, and the first two medical conditions", () => {
    assert.equal(
      buildContextPetSubtitle({
        ...basePet,
        breed: "Ragdoll",
        ageYears: 4,
        medicalConditions: ["sensitive stomach", "allergies", "arthritis"],
      }),
      "Ragdoll • 4 yrs • sensitive stomach, allergies",
    );
  });

  it("falls back when optional profile details are missing", () => {
    assert.equal(
      buildContextPetSubtitle(basePet),
      "Cat • Age not set • No conditions on file",
    );
  });
});
