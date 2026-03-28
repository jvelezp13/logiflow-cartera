"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex flex-col h-full bg-slate-900 text-white w-64">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
        <TrendingDown className="h-6 w-6 text-emerald-400" />
        <span className="text-lg font-semibold">Logiflow Cartera</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navegacion principal">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
