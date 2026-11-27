import { describe, expect, it } from "vitest";
import {
  clampLauncherPosition,
  launcherAnchorToPosition,
  launcherPositionToAnchor,
} from "../src/lib/launcher-position";

describe("Ask PAYDAN launcher positioning", () => {
  const launcher = { width: 160, height: 48 };
  const viewport = { width: 1024, height: 768 };

  it("preserves a position that is already inside the viewport", () => {
    expect(
      clampLauncherPosition({ left: 300, top: 240 }, launcher, viewport),
    ).toEqual({ left: 300, top: 240 });
  });

  it("keeps dragged positions inside every viewport edge", () => {
    expect(
      clampLauncherPosition({ left: -100, top: -50 }, launcher, viewport),
    ).toEqual({ left: 8, top: 8 });
    expect(
      clampLauncherPosition({ left: 2000, top: 2000 }, launcher, viewport),
    ).toEqual({ left: 856, top: 712 });
  });

  it("keeps an oversized launcher anchored to the safe margin", () => {
    expect(
      clampLauncherPosition(
        { left: 100, top: 100 },
        { width: 500, height: 900 },
        { width: 390, height: 844 },
      ),
    ).toEqual({ left: 8, top: 8 });
  });

  it("restores the same relative position after shrinking and expanding", () => {
    const original = { width: 1440, height: 900 };
    const compact = { width: 920, height: 700 };
    const position = { left: 1272, top: 844 };
    const anchor = launcherPositionToAnchor(position, launcher, original);

    expect(launcherAnchorToPosition(anchor, launcher, compact)).toEqual({
      left: 752,
      top: 644,
    });
    expect(launcherAnchorToPosition(anchor, launcher, original)).toEqual(
      position,
    );
  });

  it("clamps corrupted stored anchors before positioning", () => {
    expect(
      launcherAnchorToPosition({ x: 4, y: -3 }, launcher, viewport),
    ).toEqual({ left: 856, top: 8 });
  });
});
