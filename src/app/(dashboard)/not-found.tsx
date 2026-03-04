import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <FileQuestion className="h-12 w-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">
            Pagina no encontrada
          </h2>
          <p className="text-sm text-slate-500">
            La pagina que buscas no existe o fue movida.
          </p>
          <Link
            href="/"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            Volver al dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
