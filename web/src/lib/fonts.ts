import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";

import { cn } from "@/lib/utils";

// Geist Sans / Mono / Pixel Square for the UI; JetBrains Mono (heavy) is the
// display face for the commits.sh wordmark — reads like a shell command.
const display = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-display",
  display: "swap",
});

export const fontVariables = cn(
  GeistSans.variable,
  GeistMono.variable,
  GeistPixelSquare.variable,
  display.variable,
  "[--font-sans:var(--font-geist-sans)]",
  "[--font-mono:var(--font-geist-mono)]",
);
