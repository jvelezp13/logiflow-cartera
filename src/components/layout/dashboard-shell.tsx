"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <MobileSidebar
        open={mobileOpen}
        onOpenChange={setMobileOpen}
      />
      <main className="flex-1 overflow-auto overscroll-none bg-slate-50">{children}</main>
    </div>
  );
}
