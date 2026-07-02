import { z } from "zod";

/**
 * Chat-only theme config (tech-plan → data-model `theme.config`): header
 * colour, user-bubble colour, corner radius, font, input placeholder, a
 * free-form Custom-CSS override, and the id of the last preset applied
 * (informational only — picking a preset just seeds the fields below, editing
 * a field afterwards doesn't clear it). Validated here so the tRPC boundary
 * enforces the shape, not just the editor form.
 */

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Enter a hex colour, e.g. #2360c4");

export const FONT_OPTIONS = [
  {
    value: "system",
    label: "System sans",
    stack: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  { value: "serif", label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  { value: "mono", label: "Monospace", stack: "ui-monospace, 'SFMono-Regular', Menlo, monospace" },
  { value: "rounded", label: "Rounded", stack: "ui-rounded, 'Segoe UI', system-ui, sans-serif" },
] as const;

const FONT_VALUES = FONT_OPTIONS.map((f) => f.value) as [string, ...string[]];

export function fontStack(font: string): string {
  return FONT_OPTIONS.find((f) => f.value === font)?.stack ?? FONT_OPTIONS[0].stack;
}

export const themeConfigSchema = z.object({
  preset: z.string().max(40),
  headerColor: hexColor,
  bubbleColor: hexColor,
  radius: z.number().int().min(0).max(28),
  font: z.enum(FONT_VALUES),
  placeholder: z.string().trim().min(1, "Enter placeholder text").max(140),
  customCss: z.string().max(20_000),
});
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/** Curated header/accent swatches for the Elements tab (replaces a raw colour input). */
export const HEADER_SWATCHES = [
  "#14161b",
  "#2360c4",
  "#0f1319",
  "#1f9a5c",
  "#b07d10",
  "#8b3fd9",
] as const;

/** Curated user-bubble swatches for the Elements tab. */
export const BUBBLE_SWATCHES = [
  "#2360c4",
  "#14161b",
  "#7fb2f0",
  "#1f9a5c",
  "#d94032",
  "#8b3fd9",
] as const;

/** Curated corner-radius presets (segmented control, replaces the raw range input). */
export const RADIUS_PRESETS = [
  { value: 0, label: "Sharp" },
  { value: 10, label: "Soft" },
  { value: 20, label: "Round" },
] as const;

/** Curated presets — Elements fields to seed when a preset is picked. */
export const THEME_PRESETS: {
  id: string;
  label: string;
  description: string;
  config: Omit<ThemeConfig, "preset" | "customCss">;
}[] = [
  {
    id: "default",
    label: "Default",
    description: "Ink header, brand-blue bubbles, balanced corners.",
    config: {
      headerColor: "#14161b",
      bubbleColor: "#2360c4",
      radius: 12,
      font: "system",
      placeholder: "Type a message…",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Dark header, soft sky-blue accents, sharper corners.",
    config: {
      headerColor: "#0f1319",
      bubbleColor: "#7fb2f0",
      radius: 8,
      font: "system",
      placeholder: "Ask anything…",
    },
  },
  {
    id: "meadow",
    label: "Meadow",
    description: "Fresh green, fully rounded and friendly.",
    config: {
      headerColor: "#1f9a5c",
      bubbleColor: "#1f9a5c",
      radius: 20,
      font: "rounded",
      placeholder: "How can we help?",
    },
  },
  {
    id: "classic",
    label: "Classic",
    description: "Muted grey, sharp corners, serif type.",
    config: {
      headerColor: "#4a515c",
      bubbleColor: "#4a515c",
      radius: 2,
      font: "serif",
      placeholder: "Type your message",
    },
  },
];

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: "default",
  ...THEME_PRESETS[0]!.config,
  customCss: "",
};

export const createThemeInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a theme name").max(80, "Keep it under 80 characters"),
});

export const updateThemeInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Enter a theme name").max(80).optional(),
  config: themeConfigSchema.optional(),
});

export const themeIdInputSchema = z.object({ id: z.uuid() });
