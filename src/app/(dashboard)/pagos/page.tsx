import { Suspense } from "react";
import { redirect } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull, formatFechaCorta } from "@/lib/format";
import { getPagosPaginados, getPagosSinCRM } from "@/lib/queries/pagos-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { buildPageUrl } from "@/lib/url";
import { FiltrosPagos } from "@/components/pagos/filtros-pagos";
import { Paginacion } from "@/components/paginacion";
import { SoportePreview } from "@/components/pagos/soporte-preview";
import { CodigosCRMForm } from "@/components/pagos/codigos-crm-form";

import Link from "next/link";

const ITEMS_PER_PAGE = 20;

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.ENABLE_PAGOS === "false") redirect("/");

  const params = await searchParams;
  const busqueda = params.q || "";
  const estado = params.estado || undefined;
  const desde = params.desde || undefined;
  const hasta = params.hasta || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [profile, incluirCastigada, { pagos, total }, sinCRM] =
    await Promise.all([
      getUserProfile(),
      getIncluirCastigada(),
      getPagosPaginados(page, {
        busqueda: busqueda || undefined,
        estado,
        desde,
        hasta,
      }),
      getPagosSinCRM(),
    ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <>
      <Header
        titulo="Pagos"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <Suspense fallback={<div className="h-10 bg-slate-200 rounded animate-pulse" />}>
          <FiltrosPagos total={total} sinCRM={sinCRM} />
        </Suspense>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Fecha</TableHead>
                  <TableHead className="text-xs py-2">Cliente</TableHead>
                  <TableHead className="text-xs py-2 text-right">Monto</TableHead>
                  <TableHead className="text-xs py-2">Medio</TableHead>
                  <TableHead className="text-xs py-2 text-center">Facturas</TableHead>
                  <TableHead className="text-xs py-2 text-center">Estado CRM</TableHead>
                  <TableHead className="text-xs py-2 text-center">Soporte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No se encontraron pagos
                    </TableCell>
                  </TableRow>
                ) : (
                  pagos.map((pago) => (
                    <TableRow key={pago.id} className="hover:bg-slate-100/60">
                      <TableCell className="text-sm tabular-nums py-1.5">
                        {formatFechaCorta(pago.fecha_consignacion)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Link
                          href={`/clientes/${pago.codigo_cliente}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {pago.codigo_cliente}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                        {formatCurrencyFull(pago.monto_total)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 py-1.5">
                        {pago.medio_pago || "-"}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {pago.facturas.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        {pago.estado === "verificado" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs hover:bg-emerald-100">
                            Verificado
                          </Badge>
                        ) : profile.role !== "viewer" ? (
                          <CodigosCRMForm
                            pagoId={pago.id}
                            currentRecaudo={pago.numero_recaudo}
                            currentRecibo={pago.numero_recibo}
                          />
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 text-xs hover:bg-amber-100">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        {pago.soporte_key ? (
                          <SoportePreview soporteKey={pago.soporte_key} />
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
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
          buildUrl={(p) =>
            buildPageUrl("/pagos", p, { busqueda, estado, desde, hasta })
          }
        />
      </div>
    </>
  );
}
