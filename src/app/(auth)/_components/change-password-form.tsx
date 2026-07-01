"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { authClient, isAdminRole } from "@/lib/auth-client";
import { passwordSchema } from "@/lib/password-strength";

import { FieldError, FormError } from "@/components/ui/form-feedback";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
type Values = z.infer<typeof schema>;

/**
 * In-session password change (FR-ACCT-02 portion) — also the forced-change
 * destination for `mustChangePassword` accounts (e.g. the bootstrap admin).
 * The server clears the force-change flag on the actual password write
 * (account.update hook), so on success we re-read the session and move the user
 * on to their destination.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { refetch } = authClient.useSession();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (error) {
      setError("currentPassword", { message: "Current password is incorrect." });
      return;
    }
    toast({ tone: "success", description: "Password updated." });
    // Read a FRESH session for the redirect decision — the pre-refetch `session`
    // closure is stale (and may not have loaded), which could send a forced-change
    // admin to "/" instead of "/admin". getSession also reflects the now-cleared
    // mustChangePassword flag.
    const { data: fresh } = await authClient.getSession();
    await refetch();
    router.replace(isAdminRole(fresh?.user?.role) ? "/admin" : "/");
  });

  const newPassword = watch("newPassword");

  return (
    <div className="flex flex-col gap-6">
      <FormError message={errors.root?.message} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...register("currentPassword")}
          />
          <FieldError message={errors.currentPassword?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword")}
          />
          <PasswordStrengthMeter value={newPassword} />
          <FieldError message={errors.newPassword?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            {...register("confirm")}
          />
          <FieldError message={errors.confirm?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
