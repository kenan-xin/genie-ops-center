"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { authClient, isAdminRole } from "@/lib/auth-client";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a display name").max(80, "Keep it under 80 characters"),
});
type Values = z.infer<typeof schema>;

/**
 * Profile (FR-ACCT-01). Initials avatar, read-only email + role, and an editable
 * display name (better-auth `user.name`) via authClient.updateUser. Email and
 * role aren't self-editable here — role is admin-managed, email is out of scope.
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
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your display name and account details.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-0">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center bg-[var(--brandtint)] font-sans text-cardhead font-extrabold text-[var(--brand)]"
          >
            {isPending ? "" : initials(user?.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            {isPending ? (
              <>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <span className="truncate text-body text-foreground">{user?.email}</span>
                <span className="text-mono-sm uppercase tracking-[0.06em] text-[var(--ink3)]">
                  {isAdminRole(user?.role) ? "Admin" : "Member"}
                </span>
              </>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" autoComplete="name" disabled={isPending} {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="flex">
            <Button type="submit" disabled={isPending || isSubmitting || !isDirty}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** First letters of up to two name parts, e.g. "Ada Lovelace" → "AL". */
function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}
