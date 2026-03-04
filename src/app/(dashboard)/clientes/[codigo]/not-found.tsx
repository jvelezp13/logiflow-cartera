import { Card, CardContent } from "@/components/ui/card";
import { UserX } from "lucide-react";
import Link from "next/link";

export default function ClienteNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <UserX className="h-12 w-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">
            Cliente no encontrado
          </h2>
          <p className="text-sm text-slate-500">
            El cliente que buscas no existe o no tienes acceso.
          </p>
          <Link
            href="/clientes"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            Volver a clientes
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
