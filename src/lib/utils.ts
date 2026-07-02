import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The app defines nine custom font-size utilities in globals.css
// (`text-display`, `text-cardhead`, `text-title`, `text-body`, `text-small`,
// `text-mono-xs/sm/md/lg`) via `@theme inline`. Vanilla tailwind-merge has no
// knowledge of these and classifies them as `text-color` utilities (same
// conflict group as `text-foreground`, `text-primary-foreground`, etc.),
// which silently drops one of the two whenever both appear in the same
// `cn()` call. Registering them under `font-size` keeps them in their own
// conflict group so they no longer collide with text-color utilities.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "cardhead",
            "title",
            "body",
            "small",
            "mono-xs",
            "mono-sm",
            "mono-md",
            "mono-lg",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
