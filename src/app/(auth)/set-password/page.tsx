import { AuthHeader } from "../_components/auth-header";
import { SetNewPasswordForm } from "../_components/set-new-password-form";

// Invite-activation landing. Same reset-token mechanism as /reset-password;
// setting the password flips the account pending→active (onPasswordReset hook).
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Activate"
        title="Set your password"
        description="Choose a strong password to activate your account."
      />
      <SetNewPasswordForm token={token} variant="activate" linkError={Boolean(error)} />
    </div>
  );
}
