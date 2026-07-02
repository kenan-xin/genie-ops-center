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

import { AuthHeader } from "./auth-header";
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
        <div className="flex flex-col items-start gap-3">
          <span
            aria-hidden
            className="flex h-[38px] w-[38px] items-center justify-center border-[1.5px] border-[var(--brand)] bg-[var(--brandtint)] font-sans font-extrabold text-[var(--brandink)]"
            style={{ fontSize: "var(--t-h3)" }}
          >
            ✓
          </span>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.12em] text-[var(--brandink)]">
              Reset link sent
            </span>
            <h1 className="m-0 font-sans text-cardhead font-extrabold tracking-[-0.02em] text-foreground">
              Check your email
            </h1>
          </div>
        </div>
        <p className="text-body leading-[1.55] text-[var(--ink2)]">
          If an account exists for <span className="text-foreground">{getValues("email")}</span>, a
          reset link is on its way. The link expires in 60 minutes.
        </p>
        <Link
          href="/login"
          className="block text-center text-small text-[var(--ink3)] underline-offset-4 hover:underline"
        >
          Back to sign-in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Reset your password"
        description="Enter your account email and we'll send a reset link."
      />
      <div className="flex flex-col gap-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <Link
          href="/login"
          className="block text-center text-small text-[var(--ink3)] underline-offset-4 hover:underline"
        >
          ← Back to sign-in
        </Link>
      </div>
    </div>
  );
}
