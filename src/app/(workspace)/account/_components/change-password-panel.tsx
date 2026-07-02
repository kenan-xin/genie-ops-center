"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { passwordSchema } from "@/lib/password-strength";

import { AccountPanel, AccountPanelHeading } from "./account-panel";

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
 * In-session password change (FR-ACCT-02, prototype lines 354-368 — no
 * description under the heading there, so this panel doesn't add one). Same
 * mechanism as the auth change-password screen (authClient.changePassword +
 * the shared strength schema/meter), but this is account settings: on success
 * it toasts and stays put — no redirect — and the current-password re-entry
 * is the re-auth here.
 */
export function ChangePasswordPanel() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    reset,
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
    reset();
  });

  const newPassword = watch("newPassword");

  return (
    <AccountPanel>
      <AccountPanelHeading title="Change password" />

      <FormError message={errors.root?.message} />
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
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
        <div className="flex">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </AccountPanel>
  );
}
