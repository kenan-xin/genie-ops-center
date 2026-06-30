"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

// Ledger tabs: text labels, active gets a 2px brand underline.
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex gap-4 border-b border-[var(--line2)] font-sans text-small font-semibold",
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
        "-mb-px cursor-pointer border-b-2 border-transparent px-1 py-2 text-[var(--ink2)] outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[selected]:border-[var(--brand)] data-[selected]:text-foreground",
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
