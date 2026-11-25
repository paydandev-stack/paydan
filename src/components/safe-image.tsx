"use client";
import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

function isUploadedMedia(src: ImageProps["src"]) {
  if (typeof src !== "string") return false;
  if (src.startsWith("/api/media/")) return true;
  // Uploaded catalogue images are resized and converted to WebP before they
  // reach the CDN. Loading them directly avoids a second optimizer hop and
  // keeps delivery working with customer-owned CloudFront hostnames.
  return (
    src.startsWith("https://") &&
    !src.startsWith("https://images.unsplash.com/")
  );
}

export default function SafeImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [props.src]);
  return (
    <Image
      {...props}
      unoptimized={isUploadedMedia(props.src) || props.unoptimized}
      src={failed ? "/image-placeholder.svg" : props.src}
      onError={() => setFailed(true)}
    />
  );
}
