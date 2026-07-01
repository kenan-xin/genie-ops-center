import { AuthHeader } from "../_components/auth-header";
import { ChangePasswordForm } from "../_components/change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Security"
        title="Change password"
        description="Enter your current password and choose a new one."
      />
      <ChangePasswordForm />
    </div>
  );
}
