import { AuthHeader } from "../_components/auth-header";
import { SignInForm } from "../_components/sign-in-form";

const NOTICES: Record<string, string> = {
  reset: "Your password has been reset. Sign in with your new password.",
  activated: "Your account is active. Sign in with your new password.",
  "signed-out": "You've been signed out. Sign in to continue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader eyebrow="Sign in" title="Welcome back" />
      <SignInForm mode="workspace" notice={notice ? NOTICES[notice] : undefined} />
    </div>
  );
}
