"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">
            Algo salio mal
          </h2>
          <p className="text-sm text-slate-500">
            {error.message || "Ocurrio un error inesperado al cargar esta pagina."}
          </p>
          <Button onClick={reset} variant="outline">
            Intentar de nuevo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
