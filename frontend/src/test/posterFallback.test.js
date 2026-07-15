import { describe, it, expect } from "vitest";
import { generatePoster, isBlank } from "../utils/posterFallback";

describe("posterFallback", () => {
  it("isBlank detects empty-ish values", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank("Inception")).toBe(false);
    expect(isBlank(0)).toBe(true); // 0 is not a usable image url
  });

  it("generatePoster returns an SVG data URI containing the title", () => {
    const uri = generatePoster("Inception", 2010);
    expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("Inception");
    expect(decoded).toContain("2010");
  });

  it("generatePoster escapes XML-unsafe characters", () => {
    const uri = generatePoster("Tom & Jerry <2>", 1994);
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("Tom &amp; Jerry");
    expect(decoded).not.toContain("<2>");
  });

  it("generatePoster is deterministic for the same title", () => {
    expect(generatePoster("Heat", 1995)).toBe(generatePoster("Heat", 1995));
  });
});
