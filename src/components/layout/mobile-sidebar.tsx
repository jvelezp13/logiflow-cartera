"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  Bell,
  Settings,
  TrendingDown,
  UserCog,
  Building2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/types";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Envejecimiento", href: "/envejecimiento", icon: Clock },
  { name: "Alertas", href: "/alertas", icon: Bell },
];

const adminNavigation = [
  { name: "Usuarios", href: "/usuarios", icon: UserCog },
];

const superAdminNavigation = [
  { name: "Tenants", href: "/tenants", icon: Building2 },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: AppRole | null;
}

export function MobileSidebar({ open, onOpenChange, userRole }: MobileSidebarProps) {
  const pathname = usePathname();

  const allNavItems = [
    ...navigation,
    ...((userRole === "admin" || userRole === "super_admin") ? adminNavigation : []),
    ...(userRole === "super_admin" ? superAdminNavigation : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 bg-slate-900 text-white p-0 border-0">
        <SheetHeader className="px-6 py-5 border-b border-slate-800">
          <SheetTitle className="flex items-center gap-2 text-white">
            <TrendingDown className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-semibold">Logiflow</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navegacion principal">
          {allNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onOpenChange(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <Link
            href="/configuracion"
            onClick={() => onOpenChange(false)}
            aria-current={pathname === "/configuracion" ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === "/configuracion"
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
            )}
          >
            <Settings className="h-5 w-5" />
            Configuracion
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
