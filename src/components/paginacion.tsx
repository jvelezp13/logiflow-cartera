import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginacionProps {
  page: number;
  totalPages: number;
  total: number;
  itemsPorPagina: number;
  buildUrl: (page: number) => string;
}

export function Paginacion({ page, totalPages, total, itemsPorPagina, buildUrl }: PaginacionProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-slate-500">
        Mostrando {(page - 1) * itemsPorPagina + 1} -{" "}
        {Math.min(page * itemsPorPagina, total)} de {total}
      </div>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildUrl(page - 1)}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            aria-label="Pagina anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm opacity-50 cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <span className="text-sm">
          Pagina {page} de {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={buildUrl(page + 1)}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            aria-label="Pagina siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm opacity-50 cursor-not-allowed">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
