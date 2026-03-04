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
import { getFacturasConFiltros, getCiudades } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { FacturasFiltros } from "@/components/facturas/facturas-filtros";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const ITEMS_PER_PAGE = 50;

// Badge de mora con colores semanticos
function getMoraBadge(mora: number): { label: string; classes: string } {
  if (mora <= 0) return { label: "Al dia", classes: "bg-slate-100 text-slate-600" };
  if (mora <= 5) return { label: `${mora}d`, classes: "bg-green-100 text-green-700" };
  if (mora <= 20) return { label: `${mora}d`, classes: "bg-yellow-100 text-yellow-700" };
  return { label: `${mora}d`, classes: "bg-red-100 text-red-700" };
}

// Formato fecha corta (dd/mm/aa)
function formatFecha(fecha: string | null): string {
  if (!fecha) return "-";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default async function FacturasPage({
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
  const [profile, incluirCastigada, ciudades, { facturas, total }] =
    await Promise.all([
      getUserProfile(),
      getIncluirCastigada(),
      getCiudades(),
      getFacturasConFiltros({
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
    return `/facturas?${p.toString()}`;
  }

  return (
    <>
      <Header
        titulo="Facturas"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        {/* Filtros inline */}
        <Suspense>
          <FacturasFiltros ciudades={ciudades} total={total} />
        </Suspense>

        {/* Tabla */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Factura</TableHead>
                  <TableHead className="text-xs py-2">Cliente</TableHead>
                  <TableHead className="text-xs py-2">Vendedor</TableHead>
                  <TableHead className="text-xs py-2">F. Vencimiento</TableHead>
                  <TableHead className="text-xs py-2 text-center">Mora</TableHead>
                  <TableHead className="text-xs py-2 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No se encontraron facturas
                    </TableCell>
                  </TableRow>
                ) : (
                  facturas.map((factura) => {
                    const badge = getMoraBadge(factura.mora);
                    return (
                      <TableRow key={factura.no_factura} className="hover:bg-slate-50">
                        <TableCell className="py-1.5 text-sm font-medium">
                          {factura.no_factura}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Link
                            href={`/clientes/${factura.codigo_cliente}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {factura.nombre_negocio || factura.razon_social || factura.codigo_cliente}
                          </Link>
                          <div className="text-xs text-slate-400">{factura.codigo_cliente}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 py-1.5">
                          {factura.vendedor || "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums py-1.5">
                          {formatFecha(factura.fecha_vencimiento)}
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                          {formatCurrencyFull(Number(factura.total))}
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
