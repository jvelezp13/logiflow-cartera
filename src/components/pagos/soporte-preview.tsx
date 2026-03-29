"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Loader2, ImageOff } from "lucide-react";
import { obtenerUrlVisualizacion } from "@/lib/pagos-action";

interface SoportePreviewProps {
  soporteKey: string;
  trigger?: React.ReactNode;
}

export function SoportePreview({ soporteKey, trigger }: SoportePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen(open: boolean) {
    if (open && !url) {
      setError(false);
      startTransition(async () => {
        const result = await obtenerUrlVisualizacion(soporteKey);
        if (result.url) {
          setUrl(result.url);
        } else {
          setError(true);
        }
      });
    }
  }

  return (
    <Dialog onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-2">
        <DialogTitle className="sr-only">Soporte de pago</DialogTitle>
        {isPending && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <ImageOff className="h-8 w-8" />
            <p className="text-sm">No se pudo cargar el soporte</p>
          </div>
        )}
        {url && !isPending && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Soporte de pago"
            className="w-full rounded-md"
            onError={() => {
              setUrl(null);
              setError(true);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
