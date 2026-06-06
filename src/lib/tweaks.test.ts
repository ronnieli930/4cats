import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { applyTweaks, TWEAK_DEFAULTS, TWEAKS_BOOTSTRAP } from "./tweaks";

const originalDocument = globalThis.document;

function installTestDocument() {
  const properties = new Map<string, string>();
  const style = {
    getPropertyValue(name: string) {
      return properties.get(name) ?? "";
    },
    setProperty(name: string, value: string) {
      properties.set(name, value);
    },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        removeAttribute(name: string) {
          if (name === "style") properties.clear();
        },
        style,
      },
    },
  });
}

function readVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

describe("applyTweaks", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
      return;
    }
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });

  it("does nothing outside a browser document", () => {
    try {
      Reflect.deleteProperty(globalThis, "document");
      assert.doesNotThrow(() => applyTweaks(TWEAK_DEFAULTS));
    } finally {
      installTestDocument();
    }
  });

  it("applies accent, density, roundness, cuteness, and headline font variables", () => {
    applyTweaks({
      accent: "sage",
      roundness: 2,
      density: "compact",
      cuteness: 35,
      headlineFont: "Nunito",
    });

    assert.equal(readVar("--primary"), "#3f7a4f");
    assert.equal(readVar("--primary-container"), "#daeedb");
    assert.equal(readVar("--radius"), "1.5rem");
    assert.equal(readVar("--pad-card"), "16px");
    assert.equal(readVar("--gap"), "14px");
    assert.equal(readVar("--cute"), "0.35");
    assert.match(readVar("--font-brand"), /--font-nunito/);
  });

  it("falls back to defaults for unknown option ids", () => {
    applyTweaks({
      accent: "unknown",
      roundness: 1,
      density: "not-a-density" as typeof TWEAK_DEFAULTS.density,
      cuteness: 80,
      headlineFont: "Unknown" as typeof TWEAK_DEFAULTS.headlineFont,
    });

    assert.equal(readVar("--primary"), "#9c3f53");
    assert.equal(readVar("--pad-card"), "22px");
    assert.match(readVar("--font-brand"), /--font-quicksand/);
  });
});

describe("TWEAKS_BOOTSTRAP", () => {
  it("contains the storage key and CSS custom properties it applies", () => {
    assert.match(TWEAKS_BOOTSTRAP, /llp-tweaks/);
    assert.match(TWEAKS_BOOTSTRAP, /--primary/);
    assert.match(TWEAKS_BOOTSTRAP, /--font-brand/);
  });
});
