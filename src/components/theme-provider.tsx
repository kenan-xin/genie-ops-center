"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes drives Ledger's [data-theme="dark"] selector via the data-theme
// attribute, so light/dark flips the whole token set.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
