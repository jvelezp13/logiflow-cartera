"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumenCardProps {
  titulo: string;
  valor: string | number;
  icono: "dollar" | "trending" | "users" | "clock";
  tendencia?: {
    valor: number;
    tipo: "up" | "down";
  };
  className?: string;
}

const iconos = {
  dollar: DollarSign,
  trending: TrendingDown,
  users: Users,
  clock: TrendingUp,
};

export function ResumenCard({
  titulo,
  valor,
  icono,
  tendencia,
  className,
}: ResumenCardProps) {
  const Icono = iconos[icono];

  const formatoMoneda = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(0)}K`;
    }
    return `$${val.toFixed(0)}`;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {titulo}
        </CardTitle>
        <Icono className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof valor === "number" ? formatoMoneda(valor) : valor}
        </div>
        {tendencia && (
          <p
            className={cn(
              "text-xs mt-1",
              tendencia.tipo === "up" ? "text-green-600" : "text-red-600",
            )}
          >
            {tendencia.tipo === "up" ? "+" : "-"}
            {tendencia.valor}% vs mes anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
