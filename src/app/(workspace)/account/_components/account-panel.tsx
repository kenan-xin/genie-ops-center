import { cn } from "@/lib/utils";

/**
 * Single bordered settings panel (prototype account section, lines 343/355/371
 * of the design package — `border:1px solid line;padding:20px 22px`). Replaces
 * the old stacked-`Card` look: only one panel renders at a time now (see
 * `page.tsx`'s sub-nav), so there's no header/content split to preserve.
 */
export function AccountPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border border-[var(--line)] bg-[var(--surface)] px-[22px] py-5", className)}
      {...props}
    />
  );
}

/**
 * Panel heading — title (`text-title`, not the card-scale `text-cardhead`),
 * optional description, optional trailing action (the sessions panel's
 * "Sign out others" button lives here, in the header, not a footer).
 */
export function AccountPanelHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-sans text-title font-extrabold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-[3px] text-small text-[var(--ink2)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
