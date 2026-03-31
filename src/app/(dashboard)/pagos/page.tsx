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
import { getPagosPaginados, getPagosAuditCounts, type FiltroAuditoria } from "@/lib/queries/pagos-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { buildPageUrl } from "@/lib/url";
import { FiltrosPagos } from "@/components/pagos/filtros-pagos";
import { Paginacion } from "@/components/paginacion";
import { SoportePreview } from "@/components/pagos/soporte-preview";
import { CodigosCRMForm } from "@/components/pagos/codigos-crm-form";
import { EditarPagoDialog } from "@/components/pagos/editar-pago-dialog";
import { MessageSquare, History } from "lucide-react";
import { AiMetadataPopover } from "@/components/pagos/ai-metadata-popover";

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
  const filtro = (params.filtro as FiltroAuditoria) || undefined;
  const desde = params.desde || undefined;
  const hasta = params.hasta || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [profile, incluirCastigada, { pagos, total }, auditCounts] =
    await Promise.all([
      getUserProfile(),
      getIncluirCastigada(),
      getPagosPaginados(page, {
        busqueda: busqueda || undefined,
        filtro,
        desde,
        hasta,
      }),
      getPagosAuditCounts(),
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
          <FiltrosPagos total={total} auditCounts={auditCounts} />
        </Suspense>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Voucher</TableHead>
                  <TableHead className="text-xs py-2">Registrado</TableHead>
                  <TableHead className="text-xs py-2">Cliente</TableHead>
                  <TableHead className="text-xs py-2 text-right">Monto</TableHead>
                  <TableHead className="text-xs py-2">Medio / Fecha pago</TableHead>
                  <TableHead className="text-xs py-2">Facturas</TableHead>
                  <TableHead className="text-xs py-2 text-center">Estado CRM</TableHead>
                  <TableHead className="text-xs py-2 text-center">Soporte</TableHead>
                  {profile.role !== "viewer" && (
                    <TableHead className="text-xs py-2 w-10" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={profile.role !== "viewer" ? 9 : 8} className="text-center py-8 text-slate-500">
                      No se encontraron pagos
                    </TableCell>
                  </TableRow>
                ) : (
                  pagos.map((pago) => {
                    const facturasMostradas = pago.facturas.slice(0, 2);
                    const facturasExtra = pago.facturas.length - 2;

                    return (
                      <TableRow key={pago.id} className="hover:bg-slate-100/60">
                        <TableCell className="py-1.5">
                          {pago.vouchers.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {pago.vouchers.map((v, i) => (
                                <span key={i} className="font-mono text-xs text-slate-700 tabular-nums">
                                  {v}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="text-sm tabular-nums flex items-center gap-1">
                            {pago.created_at ? formatFechaCorta(pago.created_at.slice(0, 10)) : "—"}
                            {pago.editado && (
                              <span title="Editado" className="text-blue-500">
                                <History className="h-3 w-3" />
                              </span>
                            )}
                            {pago.ai_metadata && (
                              <AiMetadataPopover data={pago.ai_metadata} />
                            )}
                          </div>
                          {pago.created_by_name && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {pago.created_by_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Link
                            href={`/clientes/${pago.codigo_cliente}`}
                            className="text-sm text-blue-600 hover:underline leading-tight"
                          >
                            {pago.nombre_cliente || pago.codigo_cliente}
                          </Link>
                          {pago.nombre_cliente && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {pago.codigo_cliente}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                          {formatCurrencyFull(pago.monto_total)}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="text-xs text-slate-500">
                            {pago.medio_pago || "-"}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums mt-0.5">
                            {formatFechaCorta(pago.fecha_consignacion)}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          {pago.facturas.length === 0 ? (
                            <span className="text-xs text-slate-300">-</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              {facturasMostradas.map((f) => (
                                <span
                                  key={f.id}
                                  className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                                >
                                  {f.no_factura}
                                </span>
                              ))}
                              {facturasExtra > 0 && (
                                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                  +{facturasExtra}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          {pago.estado === "verificado" ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Badge className="bg-emerald-100 text-emerald-800 text-xs hover:bg-emerald-100">
                                Verificado
                              </Badge>
                              {(pago.numero_recaudo || pago.numero_recibo) && (
                                <span className="text-xs text-slate-500">
                                  {pago.numero_recaudo ? `R: ${pago.numero_recaudo}` : ""}
                                  {pago.numero_recaudo && pago.numero_recibo ? " / " : ""}
                                  {pago.numero_recibo ? `C: ${pago.numero_recibo}` : ""}
                                </span>
                              )}
                            </div>
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
                          <div className="flex items-center justify-center gap-1.5">
                            {pago.soporte_key ? (
                              <SoportePreview soporteKey={pago.soporte_key} />
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                            {pago.observaciones && (
                              <span
                                title={pago.observaciones}
                                className="inline-flex text-slate-400 hover:text-slate-600 cursor-default"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {profile.role !== "viewer" && (
                          <TableCell className="py-1.5">
                            <EditarPagoDialog pago={pago} />
                          </TableCell>
                        )}
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
          buildUrl={(p) =>
            buildPageUrl("/pagos", p, { busqueda, filtro, desde, hasta })
          }
        />
      </div>
    </>
  );
}
