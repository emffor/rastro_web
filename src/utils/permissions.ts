import type { User } from "../types";

export type AppPermission = string | null | undefined;

export function hasPermission(user: User | null | undefined, permission: AppPermission): boolean {
  if (!permission) return true;

  if (permission === "admin_master") {
    return Boolean(user?.is_master);
  }

  if (permission === "admin_only") {
    return Boolean(user?.is_master || user?.is_admin);
  }

  if (user?.is_master || user?.is_admin) {
    return true;
  }

  return Boolean(user?.permissoes?.includes(permission));
}

export function hasAnyPermission(
  user: User | null | undefined,
  permissions: AppPermission[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}
