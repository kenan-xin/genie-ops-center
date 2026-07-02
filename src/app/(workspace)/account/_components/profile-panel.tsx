"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";

import { AccountPanel, AccountPanelHeading } from "./account-panel";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a display name").max(80, "Keep it under 80 characters"),
});
type Values = z.infer<typeof schema>;

/**
 * Profile (FR-ACCT-01, prototype lines 342-352). Editable full name (better-auth
 * `user.name`) via authClient.updateUser, plus a read-only email row — email
 * isn't self-editable here, it's admin-managed. The identity avatar/name/role
 * banner lives one level up in `page.tsx`, not in this panel.
 *
 * The prototype's `onInput` wiring implies live-binding with no explicit save
 * step; production keeps an explicit "Save changes" submit so the mutation has
 * a clear pending/error state (RHF + authClient.updateUser), per this app's
 * form conventions.
 */
export function ProfilePanel() {
  const { toast } = useToast();
  const { data: session, isPending, refetch } = authClient.useSession();
  const user = session?.user;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // `values` keeps the field in sync with the loaded/updated session name
    // without clobbering an in-progress edit (RHF only resets when it changes).
    values: { name: user?.name ?? "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    const { error } = await authClient.updateUser({ name: data.name });
    if (error) {
      setError("name", { message: error.message ?? "Couldn't update your name." });
      return;
    }
    await refetch();
    toast({ tone: "success", description: "Profile updated." });
  });

  return (
    <AccountPanel>
      <AccountPanelHeading title="Profile" description="How you appear across the workspace." />

      <form onSubmit={onSubmit} className="mt-[18px] flex flex-col gap-3.5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" disabled={isPending} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <div
            id="email"
            className="flex h-10 items-center justify-between gap-2.5 border border-[var(--line2)] bg-[var(--panel)] px-3"
          >
            <span className="truncate text-body text-[var(--ink2)]">
              {isPending ? "" : user?.email}
            </span>
            <span className="shrink-0 font-mono text-mono-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">
              Managed by admin
            </span>
          </div>
          <p className="text-small text-[var(--ink3)]">
            Your sign-in email is set by your workspace administrator.
          </p>
        </div>

        <div className="flex">
          <Button type="submit" disabled={isPending || isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </AccountPanel>
  );
}
