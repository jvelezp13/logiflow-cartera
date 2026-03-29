"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { completarCodigosCRM } from "@/lib/pagos-action";

interface CodigosCRMFormProps {
  pagoId: string;
  currentRecaudo: number | null;
  currentRecibo: number | null;
}

export function CodigosCRMForm({
  pagoId,
  currentRecaudo,
  currentRecibo,
}: CodigosCRMFormProps) {
  const [recaudo, setRecaudo] = useState(currentRecaudo?.toString() || "");
  const [recibo, setRecibo] = useState(currentRecibo?.toString() || "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges =
    (recaudo && recaudo !== (currentRecaudo?.toString() || "")) ||
    (recibo && recibo !== (currentRecibo?.toString() || ""));

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await completarCodigosCRM(pagoId, {
        numero_recaudo: recaudo ? parseInt(recaudo, 10) : undefined,
        numero_recibo: recibo ? parseInt(recibo, 10) : undefined,
      });
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <Input
        type="number"
        placeholder="Recaudo"
        value={recaudo}
        onChange={(e) => setRecaudo(e.target.value)}
        className="w-24 h-7 text-xs"
        disabled={isPending}
      />
      <Input
        type="number"
        placeholder="Recibo"
        value={recibo}
        onChange={(e) => setRecibo(e.target.value)}
        className="w-24 h-7 text-xs"
        disabled={isPending}
      />
      {hasChanges && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          <Check className="h-3 w-3" />
        </Button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
