"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FormularioPago } from "@/components/pagos/formulario-pago";
import type { FacturaAbierta } from "@/lib/queries/pagos-server";
import type { RetroactivoData } from "@/lib/pagos-action";

interface RegistrarPagoSheetProps {
  codigoCliente: string;
  facturas: FacturaAbierta[];
  defaultOpen?: boolean;
  retroactivo?: RetroactivoData;
}

export function RegistrarPagoSheet({
  codigoCliente,
  facturas,
  defaultOpen = false,
  retroactivo,
}: RegistrarPagoSheetProps) {
  const [open, setOpen] = useState(defaultOpen);

  const handleSuccess = useCallback(() => {
    setTimeout(() => setOpen(false), 1500);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Registrar pago
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {retroactivo ? "Registrar pago retroactivo" : "Registrar pago"} — {codigoCliente}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <FormularioPago
            codigoCliente={codigoCliente}
            facturas={facturas}
            onSuccess={handleSuccess}
            retroactivo={retroactivo}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
