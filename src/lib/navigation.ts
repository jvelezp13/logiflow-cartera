import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  Bell,
  UserCog,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppRole } from "@/lib/auth/types";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Facturas", href: "/facturas", icon: FileText },
  { name: "Pre-facturacion", href: "/pre-facturacion", icon: AlertTriangle },
  { name: "Alertas", href: "/alertas", icon: Bell },
];

export const adminNavigation: NavItem[] = [
  { name: "Usuarios", href: "/usuarios", icon: UserCog },
];

export const superAdminNavigation: NavItem[] = [
  { name: "Tenants", href: "/tenants", icon: Building2 },
];

export function getNavItems(role?: AppRole | null): NavItem[] {
  return [
    ...navigation,
    ...((role === "admin" || role === "super_admin") ? adminNavigation : []),
    ...(role === "super_admin" ? superAdminNavigation : []),
  ];
}
