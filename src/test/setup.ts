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

// jsdom implementiert `window.scrollTo` nicht und meldet das bei jedem Aufruf
// als „Not implemented" auf der Konsole. Die Scroll-Sperre der Overlays
// (AGE-529) ruft es bei jedem Schließen — ohne diesen Stub verrauscht jeder
// Lauf. Wo der AUFRUF selbst die Zusicherung ist, überschreibt der Test ihn
// mit einem eigenen Spion (siehe useOverlay.test.tsx).
if (!vi.isMockFunction(window.scrollTo)) {
  Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
}

// globals: false in vitest.config → testing-library registriert sein
// automatisches Cleanup nicht selbst. Ohne dies bleiben gerenderte DOMs über
// Testfälle hinweg bestehen (mehrfach gefundene Elemente).
afterEach(() => {
  cleanup();
});
