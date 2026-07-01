"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { passwordSchema } from "@/lib/password-strength";

import { FieldError, FormError } from "./auth-feedback";
import { PasswordStrengthMeter } from "./password-strength-meter";

const schema = z
  .object({
    newPassword: passwordSchema,
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
type Values = z.infer<typeof schema>;

/**
 * Token-based new-password screen, shared by:
 *  - `reset`: forgot-password follow-through → success returns to sign-in.
 *  - `activate`: the invite-activation landing (/set-password). Setting the
 *    password flips pending→active server-side (onPasswordReset hook).
 *
 * Both call the same `resetPassword` endpoint; the server strength plugin is the
 * real gate, the live meter mirrors it. A missing/invalid token can't be
 * recovered here, so we point back to the request flow.
 */
export function SetNewPasswordForm({
  token,
  variant,
  linkError,
}: {
  token?: string;
  variant: "reset" | "activate";
  linkError?: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirm: "" },
  });

  if (!token || linkError) {
    return (
      <div className="flex flex-col gap-6">
        <FormError message="This link is invalid or has expired." />
        <Link
          href="/forgot-password"
          className="text-small text-[var(--brandink)] underline-offset-4 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await authClient.resetPassword({ newPassword: values.newPassword, token });
    if (error) {
      setFormError("This link is invalid or has expired. Request a new one.");
      return;
    }
    router.replace(`/login?notice=${variant === "activate" ? "activated" : "reset"}`);
  });

  const newPassword = watch("newPassword");

  return (
    <div className="flex flex-col gap-6">
      <FormError message={formError} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            {...register("confirm")}
          />
          <FieldError message={errors.confirm?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting
            ? "Saving…"
            : variant === "activate"
              ? "Activate account"
              : "Reset password"}
        </Button>
      </form>
    </div>
  );
}
