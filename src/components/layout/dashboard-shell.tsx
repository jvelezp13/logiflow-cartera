"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import type { AppRole } from "@/lib/auth/types";

interface DashboardShellProps {
  children: React.ReactNode;
  userRole?: AppRole | null;
}

export function DashboardShell({ children, userRole }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar userRole={userRole} />
      <MobileSidebar
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        userRole={userRole}
      />
      <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
    </div>
  );
}
