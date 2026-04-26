import { useCallback } from "react";
import { hasAnyPermission, hasPermission, type AppPermission } from "../utils/permissions";
import { useAuth } from "./useAuth";

export function usePermissions() {
  const { user } = useAuth();

  const can = useCallback(
    (permission: AppPermission) => hasPermission(user, permission),
    [user],
  );

  const canAny = useCallback(
    (permissions: AppPermission[]) => hasAnyPermission(user, permissions),
    [user],
  );

  return { can, canAny };
}
