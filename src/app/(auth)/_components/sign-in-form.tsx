"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, isAdminRole } from "@/lib/auth-client";

import { FieldError, FormError, NoticeBanner } from "@/components/ui/form-feedback";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

/**
 * Credentials sign-in for both entry screens.
 *
 * - `workspace` (/login): success → `/`, or `/change-password` if the account
 *   is forced to change first. Neutral, customer-safe copy — no admin framing.
 * - `admin` (/admin/login): UX routing only. Admins → `/admin`; a non-admin who
 *   authenticates is signed straight back out (the admin door grants no session)
 *   and shown an inline rejection. The server guard is the real boundary.
 */
export function SignInForm({ mode, notice }: { mode: "workspace" | "admin"; notice?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error || !data) {
      setFormError("Incorrect email or password.");
      return;
    }

    const user = data.user;
    // Admin door rejects non-admins FIRST (FR-AUTH-02) — before any
    // mustChangePassword handling — so a non-admin forced-change account can't
    // slip into the limited-session change-password flow via /admin/login.
    if (mode === "admin" && !isAdminRole(user.role)) {
      await authClient.signOut();
      setFormError("This account doesn't have administrator access.");
      return;
    }
    if (user.mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    router.replace(mode === "admin" ? "/admin" : "/");
  });

  const isAdmin = mode === "admin";

  return (
    <div className="flex flex-col gap-6">
      {notice ? <NoticeBanner message={notice} /> : null}
      <FormError message={formError} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{isAdmin ? "Admin email" : "Email"}</Label>
          <Input
            id="email"
            type="email"
            inputSize="auth"
            autoComplete="email"
            placeholder={isAdmin ? "admin@genie.ai" : "you@company.com"}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {isAdmin ? null : (
              <Link
                href="/forgot-password"
                className="text-small text-[var(--brandink)] underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              inputSize="auth"
              autoComplete="current-password"
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--ink3)] hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>
        <Button type="submit" size="auth" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Signing in…" : isAdmin ? "Sign in" : "Continue"}
        </Button>
      </form>
      {isAdmin ? (
        <Link
          href="/login"
          className="block text-center text-small text-[var(--ink3)] underline-offset-4 hover:underline"
        >
          ← Back to sign-in
        </Link>
      ) : (
        <Link
          href="/admin/login"
          className="block text-center text-small text-[var(--ink3)] underline-offset-4 hover:underline"
        >
          Administrator sign-in →
        </Link>
      )}
    </div>
  );
}
