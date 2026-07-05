"use client";

import { startTransition, useDeferredValue, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { setActiveTenant } from "@/lib/auth/tenant-actions";
import { cn } from "@/lib/utils";
import type { AvailableTenant } from "@/lib/auth/get-tenant";

interface TenantSwitcherProps {
  activeTenant: AvailableTenant;
  availableTenants: AvailableTenant[];
  isSupportMode: boolean;
}

export function TenantSwitcher({
  activeTenant,
  availableTenants,
  isSupportMode,
}: TenantSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filteredTenants = availableTenants.filter((tenant) => {
    const searchable = `${tenant.nombre} ${tenant.slug ?? ""}`.toLowerCase();
    return searchable.includes(deferredQuery);
  });

  function handleSelect(tenantId: string) {
    if (tenantId === activeTenant.id) {
      setOpen(false);
      setQuery("");
      return;
    }

    setPendingTenantId(tenantId);
    startTransition(async () => {
      try {
        await setActiveTenant(tenantId);
        // Resetea los query params tenant-scoped navegando a la ruta sin querystring.
        router.replace(pathname);
        setOpen(false);
        setQuery("");
      } catch {
        toast.error("No se pudo cambiar de tenant. Intentá de nuevo.");
      } finally {
        setPendingTenantId(null);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex max-w-56 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            isSupportMode
              ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
          aria-label="Cambiar tenant activo"
        >
          {isSupportMode && (
            <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Soporte
            </span>
          )}
          <span className="truncate">{activeTenant.nombre}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 size-4 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar tenant..."
            className="pl-8"
          />
        </div>
        <div className="max-h-72 overflow-auto">
          {filteredTenants.length > 0 ? (
            filteredTenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => handleSelect(tenant.id)}
                disabled={pendingTenantId !== null}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">
                    {tenant.nombre}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {tenant.is_home ? "Tenant home" : tenant.role}
                  </span>
                </span>
                <Check
                  className={cn(
                    "size-4 text-blue-600",
                    tenant.id === activeTenant.id ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            ))
          ) : (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              No hay tenants que coincidan.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
