import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";

import { cn } from "@/lib/utils";

// Mirrors chanhdai.com's font setup (Geist Sans / Mono / Pixel Square).
export const fontVariables = cn(
  GeistSans.variable,
  GeistMono.variable,
  GeistPixelSquare.variable,
  "[--font-sans:var(--font-geist-sans)]",
  "[--font-mono:var(--font-geist-mono)]",
);
