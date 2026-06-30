"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Theme is unknown until mounted; render a neutral glyph to avoid a
  // hydration mismatch, then swap to the real sun/moon mark.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{ fontSize: "var(--m-lg)", fontFamily: "var(--font-mono)" }}
    >
      {mounted ? (isDark ? "☼" : "☾") : "·"}
    </Button>
  );
}
