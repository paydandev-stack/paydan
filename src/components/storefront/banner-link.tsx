"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export function BannerLink({
  bannerId,
  ...props
}: ComponentProps<typeof Link> & { bannerId: string }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented)
          void fetch("/api/banners/click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bannerId }),
            keepalive: true,
          });
      }}
    />
  );
}
