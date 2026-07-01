import { AuthHeader } from "../_components/auth-header";
import { SetNewPasswordForm } from "../_components/set-new-password-form";

// better-auth validates the reset link then redirects here with ?token=… (or
// ?error=INVALID_TOKEN when the link is bad/expired).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Reset"
        title="Set a new password"
        description="Choose a strong password to finish resetting your account."
      />
      <SetNewPasswordForm token={token} variant="reset" linkError={Boolean(error)} />
    </div>
  );
}
