export type LauncherPosition = { left: number; top: number };

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
