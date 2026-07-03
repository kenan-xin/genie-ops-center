import { AccountScreen } from "@/features/account/components/account-screen";

/**
 * Customer workspace account (FR-ACCT). The shared `AccountScreen` renders
 * wrapper-free, so this route owns the workspace padding ladder (`cs-hubpad`,
 * matching the hub/recent pages) and the content max-width — the workspace
 * `<main>` doesn't pad. The admin console reaches the same screen via
 * `(admin)/admin/account`.
 */
export default function AccountPage() {
  return (
    <div className="cs-hubpad" style={{ maxWidth: "var(--content-wide)" }}>
      <AccountScreen />
    </div>
  );
}
