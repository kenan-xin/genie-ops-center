import { cn } from "@/lib/utils";

// Bordered horizontal-scroll container — wrap a Table and give the Table a
// min-width so columns never crush on narrow screens.
function TableScroll({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-scroll"
      className={cn("overflow-x-auto rounded-none border border-[var(--line)]", className)}
      {...props}
    />
  );
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full border-collapse text-left", className)}
      {...props}
    />
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={className} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-[var(--line2)] transition-colors last:border-0 hover:bg-[var(--panel)]",
        className,
      )}
      {...props}
    />
  );
}

// Mono uppercase header cell on the panel fill.
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 font-mono text-mono-sm font-semibold tracking-[0.07em] text-[var(--ink2)] uppercase",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-4 py-3 align-middle text-small", className)}
      {...props}
    />
  );
}

export { TableScroll, Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
