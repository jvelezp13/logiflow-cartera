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
import { getSeveridad, SEVERIDAD_CONFIG } from "@/lib/severity";
import { buildPageUrl } from "@/lib/url";
import { FiltrosCartera } from "@/components/filtros-cartera";
import { Paginacion } from "@/components/paginacion";
import { Eye } from "lucide-react";
import Link from "next/link";

const ITEMS_PER_PAGE = 50;

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

  return (
    <>
      <Header
        titulo="Clientes"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <Suspense>
          <FiltrosCartera
            rutaBase="/clientes"
            placeholder="Buscar cliente..."
            etiquetaConteo="clientes"
            ciudades={ciudades}
            total={total}
          />
        </Suspense>

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
                    const sevConfig = SEVERIDAD_CONFIG[getSeveridad(cliente.maxima_mora)];
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
                        <TableCell className={`text-right text-xs font-medium py-1.5 ${sevConfig.text}`}>
                          {sevConfig.label}
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

        <Paginacion
          page={page}
          totalPages={totalPages}
          total={total}
          itemsPorPagina={ITEMS_PER_PAGE}
          buildUrl={(p) => buildPageUrl("/clientes", p, { busqueda, ciudad, severidad, rango })}
        />
      </div>
    </>
  );
}
