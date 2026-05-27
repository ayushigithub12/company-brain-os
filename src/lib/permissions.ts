// src/lib/permissions.ts
// Central permission system for Company Brain OS

export type Role = "ADMIN" | "OWNER" | "MEMBER" | "VIEWER";

/**
 * Check if an email is the Admin (set via ADMIN_EMAIL env var)
 */
export function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  return !!adminEmail && email.toLowerCase().trim() === adminEmail;
}

/**
 * What roles can a given role invite
 */
export function getInvitableRoles(role: Role): Role[] {
  switch (role) {
    case "ADMIN":  return ["OWNER", "MEMBER", "VIEWER"];
    case "OWNER":  return ["MEMBER", "VIEWER"];
    case "MEMBER": return ["VIEWER"];
    case "VIEWER": return [];
  }
}

/**
 * Can this role perform an action
 */
export const can = {
  sync:             (role: Role) => ["ADMIN", "OWNER"].includes(role),
  connectConnector: (role: Role) => ["ADMIN", "OWNER"].includes(role),
  extractCards:     (role: Role) => ["ADMIN", "OWNER"].includes(role),
  editCards:        (role: Role) => ["ADMIN", "OWNER"].includes(role),
  deleteCards:      (role: Role) => ["ADMIN", "OWNER"].includes(role),
  verifyCards:      (role: Role) => ["ADMIN", "OWNER"].includes(role),
  viewGaps:         (role: Role) => ["ADMIN", "OWNER", "MEMBER"].includes(role),
  manageMembers:    (role: Role) => ["ADMIN", "OWNER"].includes(role),
  inviteUsers:      (role: Role) => ["ADMIN", "OWNER", "MEMBER"].includes(role),
  createAdmin:      (_role: Role) => false, // nobody can create Admin
};

/**
 * Role display info
 */
export const roleInfo: Record<Role, { label: string; description: string; color: string; bg: string }> = {
  ADMIN:  { label: "Admin",  description: "Full access — manages everything", color: "#5b21b6", bg: "#ede9fe" },
  OWNER:  { label: "Owner",  description: "Can sync, manage cards, invite members & viewers", color: "#1e40af", bg: "#dbeafe" },
  MEMBER: { label: "Member", description: "Can ask questions, view cards, invite viewers", color: "#065f46", bg: "#d1fae5" },
  VIEWER: { label: "Viewer", description: "Read only — view cards and ask questions", color: "#6b7280", bg: "#f3f4f6" },
};
