import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

export function getNavItems(): NavItem[] {
  return navigation;
}
