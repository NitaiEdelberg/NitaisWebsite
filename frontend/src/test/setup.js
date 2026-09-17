import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom doesn't implement matchMedia, which Chakra's color-mode uses.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom lacks scrollTo; some Chakra components call it.
window.scrollTo = window.scrollTo || (() => {});

// jsdom implements no layout, so scrollIntoView does not exist on elements.
// Stubbed here rather than guarded in the components: the guard would be dead
// code in every real browser, written to satisfy a test environment.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
