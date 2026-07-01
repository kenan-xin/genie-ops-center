import { AuthHeader } from "../_components/auth-header";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Reset"
        title="Forgot password"
        description="Enter your email and we'll send a link to reset your password."
      />
      <ForgotPasswordForm />
    </div>
  );
}
