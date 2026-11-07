"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function SubtleMotion() {
  const pathname = usePathname();
  useEffect(() => {
    if (
      pathname !== "/" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(".section-heading,.category-card"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    for (const target of targets) {
      if (target.getBoundingClientRect().top > innerHeight) {
        target.classList.add("reveal-ready");
        observer.observe(target);
      }
    }
    return () => {
      observer.disconnect();
      targets.forEach((el) =>
        el.classList.remove("reveal-ready", "reveal-visible"),
      );
    };
  }, [pathname]);
  return null;
}
