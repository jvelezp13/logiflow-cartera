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
import { formatCurrencyFull, formatFechaCorta } from "@/lib/format";
import { getFacturasConFiltros, getCiudades } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { getMoraBadgeStyles, isValidSeveridad } from "@/lib/severity";
import { buildPageUrl } from "@/lib/url";
import { FiltrosCartera } from "@/components/filtros-cartera";
import { Paginacion } from "@/components/paginacion";
import { ArrowDownWideNarrow } from "lucide-react";
import Link from "next/link";

const ITEMS_PER_PAGE = 50;

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const busqueda = params.q || "";
  const ciudad = params.ciudad || undefined;
  const severidad = isValidSeveridad(params.severidad) ? params.severidad : undefined;
  const rango = params.rango || undefined;
  const page = Math.max(1, Number(params.page) || 1);

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

  return (
    <>
      <Header
        titulo="Facturas"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <Suspense>
          <FiltrosCartera
            rutaBase="/facturas"
            placeholder="Buscar factura o cliente..."
            etiquetaConteo="facturas"
            ciudades={ciudades}
            total={total}
          />
        </Suspense>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Factura</TableHead>
                  <TableHead className="text-xs py-2">Cliente</TableHead>
                  <TableHead className="text-xs py-2">Vendedor</TableHead>
                  <TableHead className="text-xs py-2">F. Vencimiento</TableHead>
                  <TableHead className="text-xs py-2 text-center">
                    <span className="inline-flex items-center gap-1">
                      Mora <ArrowDownWideNarrow className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
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
                    const badge = getMoraBadgeStyles(factura.mora);
                    return (
                      <TableRow key={factura.no_factura} className="hover:bg-slate-100/60">
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
                          {formatFechaCorta(factura.fecha_vencimiento)}
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

        <Paginacion
          page={page}
          totalPages={totalPages}
          total={total}
          itemsPorPagina={ITEMS_PER_PAGE}
          buildUrl={(p) => buildPageUrl("/facturas", p, { busqueda, ciudad, severidad, rango })}
        />
      </div>
    </>
  );
}
