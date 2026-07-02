import { ForgotPasswordForm } from "../_components/forgot-password-form";

// The header lives inside the client form, not here — the confirmation state
// swaps the whole card head ("Reset your password" → "Check your email"), which
// a server component can't react to.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
