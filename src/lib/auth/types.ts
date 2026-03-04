export type AppRole = "super_admin" | "admin" | "viewer";

// Identificador de esta app para app_permissions
export const APP_ID = "cartera" as const;

export interface AppPermission {
  id: string;
  profile_id: string;
  tenant_id: string;
  app_id: string;
  role: AppRole;
}
