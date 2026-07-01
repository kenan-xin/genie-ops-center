"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { FieldError } from "@/components/ui/form-feedback";

const schema = z.object({ email: z.email("Enter a valid email") });
type Values = z.infer<typeof schema>;

/**
 * Request a reset link. Always lands on the same "check your email" confirmation
 * regardless of whether the address exists (the server responds identically to
 * avoid account enumeration). `redirectTo` sends the link's landing page to
 * /reset-password, where better-auth appends the validated `?token=`.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
  });

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-body text-[var(--ink2)]">
          If an account exists for <span className="text-foreground">{getValues("email")}</span>,
          we&rsquo;ve sent a link to reset your password. Check your inbox and follow the link to
          continue.
        </p>
        <Link
          href="/login"
          className="text-small text-[var(--brandink)] underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <Link
        href="/login"
        className="text-small text-[var(--brandink)] underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
