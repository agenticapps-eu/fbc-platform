import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// globals: false in vitest.config → testing-library registriert sein
// automatisches Cleanup nicht selbst. Ohne dies bleiben gerenderte DOMs über
// Testfälle hinweg bestehen (mehrfach gefundene Elemente).
afterEach(() => {
  cleanup();
});
