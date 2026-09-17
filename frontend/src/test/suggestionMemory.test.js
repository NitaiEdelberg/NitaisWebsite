import { describe, it, expect, beforeEach } from "vitest";
import {
  avoidList, forgetEverything, rememberRejected, rememberShown, shownTitles,
} from "../utils/suggestionMemory";

describe("suggestion memory", () => {
  beforeEach(() => localStorage.clear());

  it("remembers what was shown across reloads", () => {
    rememberShown(["Heat", "Inside Man"]);
    expect(shownTitles()).toEqual(expect.arrayContaining(["Heat", "Inside Man"]));
  });

  it("never lists the same title twice", () => {
    rememberShown(["Heat"]);
    rememberShown(["Heat", "Ronin"]);
    expect(shownTitles().filter((t) => t === "Heat")).toHaveLength(1);
  });

  it("caps what it keeps, dropping the oldest first", () => {
    rememberShown(Array.from({ length: 80 }, (_, i) => `Film ${i}`));
    const kept = shownTitles();
    expect(kept.length).toBeLessThanOrEqual(60);
    expect(kept).toContain("Film 0");      // newest batch survives
    expect(kept).not.toContain("Film 79"); // the tail is dropped
  });

  it("puts rejected titles ahead of merely shown ones", () => {
    rememberShown(["Heat"]);
    rememberRejected("Ronin");
    expect(avoidList()[0]).toBe("Ronin");
  });

  it("survives storage being unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new Error("blocked"); },
    });
    expect(() => rememberShown(["Heat"])).not.toThrow();
    expect(shownTitles()).toEqual([]);
    Object.defineProperty(window, "localStorage", original);
  });

  it("can be cleared", () => {
    rememberShown(["Heat"]);
    rememberRejected("Ronin");
    forgetEverything();
    expect(avoidList()).toEqual([]);
  });
});
