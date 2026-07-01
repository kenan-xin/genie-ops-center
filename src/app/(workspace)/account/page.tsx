import { ChangePasswordPanel } from "./_components/change-password-panel";
import { ProfilePanel } from "./_components/profile-panel";
import { SessionsPanel } from "./_components/sessions-panel";

// Account settings (FR-ACCT): profile (01), change password (02), and devices
// & sessions (03). All self-service via better-auth's client SDK — see
// docs/tech-plan/account-sessions.
export default function AccountPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">Account</h1>
        <p className="text-small text-[var(--ink2)]">
          Manage your profile, password, and the devices you&rsquo;re signed in on.
        </p>
      </header>

      <ProfilePanel />
      <ChangePasswordPanel />
      <SessionsPanel />
    </div>
  );
}
