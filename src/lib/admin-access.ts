import { capabilityForAdminPath, hasCapability } from "./capabilities";
import type { AdminRole } from "./types";

export function canAccessAdmin(role: AdminRole, path: string) {
  if (role === "Vendor") return false;
  if (path === "/admin") return true;
  const capability = capabilityForAdminPath(path);
  return capability ? hasCapability(role, capability) : role === "Super Admin";
}
