export type LauncherPosition = { left: number; top: number };
export type LauncherAnchor = { x: number; y: number };

function movableSpace(
  launcher: { width: number; height: number },
  viewport: { width: number; height: number },
  margin: number,
) {
  return {
    width: Math.max(0, viewport.width - launcher.width - margin * 2),
    height: Math.max(0, viewport.height - launcher.height - margin * 2),
  };
}

export function clampLauncherPosition(
  position: LauncherPosition,
  launcher: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): LauncherPosition {
  const maximumLeft = Math.max(margin, viewport.width - launcher.width - margin);
  const maximumTop = Math.max(margin, viewport.height - launcher.height - margin);
  return {
    left: Math.min(Math.max(position.left, margin), maximumLeft),
    top: Math.min(Math.max(position.top, margin), maximumTop),
  };
}

/** Store a viewport-independent position so a shrink/expand cycle is reversible. */
export function launcherPositionToAnchor(
  position: LauncherPosition,
  launcher: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): LauncherAnchor {
  const bounded = clampLauncherPosition(position, launcher, viewport, margin);
  const space = movableSpace(launcher, viewport, margin);
  return {
    x: space.width ? (bounded.left - margin) / space.width : 0,
    y: space.height ? (bounded.top - margin) / space.height : 0,
  };
}

/** Rebuild pixel coordinates from the relative position for the current viewport. */
export function launcherAnchorToPosition(
  anchor: LauncherAnchor,
  launcher: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): LauncherPosition {
  const space = movableSpace(launcher, viewport, margin);
  const x = Math.min(Math.max(anchor.x, 0), 1);
  const y = Math.min(Math.max(anchor.y, 0), 1);
  return {
    left: margin + space.width * x,
    top: margin + space.height * y,
  };
}
