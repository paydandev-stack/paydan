"use client";
import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
export default function SafeImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [props.src]);
  return (
    <Image
      {...props}
      unoptimized={
        (typeof props.src === "string" &&
          props.src.startsWith("/api/media/")) ||
        props.unoptimized
      }
      src={failed ? "/image-placeholder.svg" : props.src}
      onError={() => setFailed(true)}
    />
  );
}
