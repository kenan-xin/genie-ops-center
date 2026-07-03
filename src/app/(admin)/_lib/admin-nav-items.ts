/**
 * The admin console's primary nav, in display order (prototype `adminNav`,
 * proto 1667). One source shared by `AdminNav` (links) and `AdminHeader`
 * (route-aware title), so the two can't drift out of sync.
 *
 * `/admin/groups/access` sits under `/admin/groups`, so Groups' own match
 * must exclude it — otherwise both items would light up on the Access route.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/people", label: "People", isActive: (p) => p.startsWith("/admin/people") },
  {
    href: "/admin/groups",
    label: "Groups",
    isActive: (p) => p.startsWith("/admin/groups") && !p.startsWith("/admin/groups/access"),
  },
  {
    href: "/admin/groups/access",
    label: "Access",
    isActive: (p) => p.startsWith("/admin/groups/access"),
  },
  {
    href: "/admin/solutions",
    label: "Solutions",
    isActive: (p) => p.startsWith("/admin/solutions"),
  },
  {
    href: "/admin/themes",
    label: "Theme Builder",
    isActive: (p) => p.startsWith("/admin/themes"),
  },
];
