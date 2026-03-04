"use client";

import { User, LogOut, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/login/actions";
import type { AppRole } from "@/lib/auth/types";

interface HeaderProps {
  titulo: string;
  userName?: string | null;
  userRole?: AppRole | null;
  onMenuToggle?: () => void;
}

export function Header({
  titulo,
  userName,
  userRole,
  onMenuToggle,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Abrir menu de navegacion"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
        )}
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 p-2 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Menu de usuario"
            >
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              {userName && (
                <span className="text-sm font-medium text-slate-700 hidden md:block">
                  {userName}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {userRole && (
              <DropdownMenuItem disabled className="text-xs text-slate-500">
                Rol: {userRole}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
