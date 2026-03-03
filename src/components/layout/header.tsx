"use client";

import { Bell, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  titulo: string;
  alertasCount?: number;
}

export function Header({ titulo, alertasCount = 0 }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
      <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="h-5 w-5 text-slate-600" />
          {alertasCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {alertasCount > 99 ? "99+" : alertasCount}
            </Badge>
          )}
        </button>

        <button className="flex items-center gap-2 p-2 rounded-full hover:bg-slate-100 transition-colors">
          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
        </button>
      </div>
    </header>
  );
}
