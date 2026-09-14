// Single source of truth for form-control heights (32 / 40 / 44). Every control
// derives its height from this scale so toolbars align. Values are full Tailwind
// class literals so the JIT scanner picks them up here.
export const CONTROL_HEIGHTS = { sm: "h-8", md: "h-10", lg: "h-11" } as const;

// min-height variants for controls whose content may wrap (e.g. SegmentedControl
// with long labels) — grow instead of clipping.
export const CONTROL_MIN_HEIGHTS = { sm: "min-h-8", md: "min-h-10", lg: "min-h-11" } as const;

// Square icon tile: 30px, per the design package ("Mono-icon tiles are 30px
// squares with no radius"). Row action lanes and mono-icon tiles share it so a
// table row never mixes two tile sizes.
export const ICON_TILE = "size-[30px]";

export type ControlSize = keyof typeof CONTROL_HEIGHTS;
