import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom kennt weder IntersectionObserver (framer-motion useInView / CountUp) noch
// matchMedia (prefers-reduced-motion). Minimal-Stubs, damit Motion-Komponenten in
// Tests rendern, ohne dass Animationen geprüft werden.
if (!("IntersectionObserver" in globalThis)) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

if (!window.matchMedia) {
  // Tests laufen deterministisch mit reduced-motion → Animationen kollabieren,
  // CountUp etc. rendern sofort ihren Endwert (keine rAF-Flakiness).
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

// globals: false in vitest.config → testing-library registriert sein
// automatisches Cleanup nicht selbst. Ohne dies bleiben gerenderte DOMs über
// Testfälle hinweg bestehen (mehrfach gefundene Elemente).
afterEach(() => {
  cleanup();
});
