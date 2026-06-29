"use client";

// Theme-aware badge preview: re-requests the SVG with ?theme=light|dark so the
// gallery shows the white badge when the site is in light mode (and dark in dark
// mode). Defaults to dark until mounted to avoid a hydration flash.
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function BadgePreview({ handle, style, name }: { handle: string; style: string; name: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const theme = mounted && resolvedTheme === "light" ? "light" : "dark";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/badge?handle=${encodeURIComponent(handle)}&style=${style}&theme=${theme}`}
      alt={`${name} badge for ${handle}`}
      className="max-w-full"
      loading="lazy"
    />
  );
}
