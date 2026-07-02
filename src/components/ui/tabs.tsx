"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

// Ledger tabs: filled segmented strip attached to the panel below it (bordered
// row, active segment = --ink fill / white — same recipe as SegmentedControl).
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex divide-x divide-[var(--line)] border border-[var(--line)] font-sans text-small font-semibold",
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "cursor-pointer px-4 py-2 text-[var(--ink2)] outline-none transition-colors duration-150 hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[selected]:bg-[var(--ink)] data-[selected]:text-[var(--on-ink)]",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTab, TabsPanel };
