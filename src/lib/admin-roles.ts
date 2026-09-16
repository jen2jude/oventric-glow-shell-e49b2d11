// Central admin role/section mapping. Client-safe (no server imports).
// `admin` = super admin; sees everything and manages roles.
export type ManagementRole = "admin" | "moderator" | "finance" | "content" | "support";

export const MANAGEMENT_ROLES: ManagementRole[] = [
  "admin",
  "moderator",
  "finance",
  "content",
  "support",
];

export const ROLE_LABELS: Record<ManagementRole, string> = {
  admin: "Super Admin",
  moderator: "Moderator",
  finance: "Finance",
  content: "Content",
  support: "Support",
};

export const ROLE_DESCRIPTIONS: Record<ManagementRole, string> = {
  admin: "Full access to every admin feature, including managing other admins.",
  moderator: "Reviews reports, moderates products & bounties.",
  finance: "Payouts, system wallets, affiliates.",
  content: "Blog, courses, campaigns, categories, communications.",
  support: "User management & audit log for handling tickets.",
};

/**
 * Map admin route path → roles that may view it. `admin` (super admin) always allowed.
 * Only MVP admin sections are listed. Non-MVP sections (bounties, academy/courses,
 * circles, blog, campaigns/ad inquiries, affiliates, creator tools, MiniPay/manual
 * payments) are intentionally absent: their code and data remain, but no management
 * role other than super admin can reach them, by navigation or by direct URL.
 */
export const SECTION_ACCESS: Record<string, ManagementRole[]> = {
  "/admin": ["admin", "moderator", "finance", "content", "support"],

  // Core
  "/admin/users": ["admin", "support"],
  "/admin/sellers": ["admin", "moderator", "support"],
  "/admin/products": ["admin", "moderator", "content"],
  "/admin/orders": ["admin", "finance", "support", "moderator"],
  "/admin/categories": ["admin", "content"],
  "/admin/marketplace-controls": ["admin", "moderator", "content"],

  // Money
  "/admin/system-wallets": ["admin", "finance"],
  "/admin/payouts": ["admin", "finance"],
  "/admin/disputes": ["admin", "moderator", "finance", "support"],
  "/admin/cashback-wallet": ["admin", "finance"],

  // Community & moderation
  "/admin/reports": ["admin", "moderator"],
  "/admin/communications": ["admin", "content"],
  "/admin/support": ["admin", "support"],

  // System
  "/admin/features": ["admin"],
  "/admin/audit": ["admin", "support"],
  "/admin/settings": ["admin"],
  "/admin/management-users": ["admin"],
};

export function canAccessSection(path: string, roles: ManagementRole[]): boolean {
  if (roles.includes("admin")) return true;
  const allowed = SECTION_ACCESS[path];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r));
}
