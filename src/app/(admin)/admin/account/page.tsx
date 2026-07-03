import { AccountScreen } from "@/features/account/components/account-screen";

/**
 * Admin's own account (FR-ACCT). Same `AccountScreen` as the workspace route,
 * but reached from the admin console footer so an admin manages their profile,
 * password and sessions without leaving the admin chrome (the console's
 * `<main>` supplies the padding + max-width, so this renders wrapper-free).
 */
export default function AdminAccountPage() {
  return <AccountScreen />;
}
