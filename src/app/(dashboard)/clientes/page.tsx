import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyFull } from "@/lib/format";
import { getClientesConSaldo, getCiudades } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { ClientesFiltros } from "@/components/clientes/clientes-filtros";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import Link from "next/link";

const ITEMS_PER_PAGE = 50;

// Clasificacion por maxima_mora (mismos rangos que dashboard)
function getSeveridad(maxMora: number): { label: string; color: string } {
  if (maxMora <= 5) return { label: "Tolerable", color: "text-green-600" };
  if (maxMora <= 20) return { label: "Atencion", color: "text-yellow-600" };
  return { label: "Critico", color: "text-red-600" };
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const busqueda = params.q || "";
  const ciudad = params.ciudad || undefined;
  const severidad = (params.severidad as "tolerable" | "atencion" | "critico") || undefined;
  const rango = params.rango || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  // Todo en paralelo, server-side
  const [profile, incluirCastigada, ciudades, { clientes, total }] =
    await Promise.all([
      getUserProfile(),
      getIncluirCastigada(),
      getCiudades(),
      getClientesConSaldo({
        busqueda: busqueda || undefined,
        ciudad,
        severidad,
        rango,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      }),
    ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Construir query string para links de paginacion
  function buildPageUrl(targetPage: number): string {
    const p = new URLSearchParams();
    if (busqueda) p.set("q", busqueda);
    if (ciudad) p.set("ciudad", ciudad);
    if (severidad) p.set("severidad", severidad);
    if (rango) p.set("rango", rango);
    p.set("page", String(targetPage));
    return `/clientes?${p.toString()}`;
  }

  return (
    <>
      <Header
        titulo="Clientes"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        {/* Filtros inline */}
        <Suspense>
          <ClientesFiltros ciudades={ciudades} total={total} />
        </Suspense>

        {/* Tabla */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Negocio</TableHead>
                  <TableHead className="text-xs py-2">Ciudad</TableHead>
                  <TableHead className="text-xs py-2 text-right">Cupo</TableHead>
                  <TableHead className="text-xs py-2 text-right">Deuda</TableHead>
                  <TableHead className="text-xs py-2 text-right">Vencido</TableHead>
                  <TableHead className="text-xs py-2 text-right">Estado</TableHead>
                  <TableHead className="text-xs py-2 text-right">Facturas</TableHead>
                  <TableHead className="text-xs py-2 w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((cliente) => {
                    const sev = getSeveridad(cliente.maxima_mora);
                    return (
                      <TableRow key={cliente.codigo_cliente} className="hover:bg-slate-50">
                        <TableCell className="py-1.5">
                          <span className="text-sm font-medium">
                            {cliente.nombre_negocio || cliente.razon_social || cliente.codigo_cliente}
                          </span>
                          <div className="text-xs text-slate-400">{cliente.codigo_cliente}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 py-1.5">
                          {cliente.ciudad || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums py-1.5">
                          {cliente.cupo_asignado != null
                            ? formatCurrencyFull(Number(cliente.cupo_asignado))
                            : <span className="text-slate-400">-</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                          {formatCurrencyFull(Number(cliente.total_deuda))}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums py-1.5">
                          {Number(cliente.total_vencido) > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrencyFull(Number(cliente.total_vencido))}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-medium py-1.5 ${sev.color}`}>
                          {sev.label}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-500 py-1.5">
                          {cliente.num_facturas}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Link
                            href={`/clientes/${cliente.codigo_cliente}`}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            aria-label={`Ver detalle de ${cliente.nombre_negocio || cliente.razon_social || cliente.codigo_cliente}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Paginacion con Links */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} -{" "}
              {Math.min(page * ITEMS_PER_PAGE, total)} de {total}
            </div>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={buildPageUrl(page - 1)}
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
                  href={buildPageUrl(page + 1)}
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
        )}
      </div>
    </>
  );
}
