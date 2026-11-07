import type { ReactNode } from "react";
import type { Tone } from "@/lib/status";

/** Small status badge; tone colours live in admin.css alongside `.status`. */
export function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return <span className={`status ${tone}`}>{children}</span>;
}
