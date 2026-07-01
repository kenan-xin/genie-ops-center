import { AuthHeader } from "../../_components/auth-header";
import { SignInForm } from "../../_components/sign-in-form";

// Lives in the (auth) group, so it gets the centered auth card — not the admin
// chrome. UX routing only: the real admin gate is server-enforced.
export default function AdminLoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Admin"
        title="Administrator sign in"
        description="Sign in with your administrator account."
      />
      <SignInForm mode="admin" />
    </div>
  );
}
