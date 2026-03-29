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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull, formatCurrencyShort, formatFechaCorta } from "@/lib/format";
import { getPagosPaginados, getPagosSinCRM } from "@/lib/queries/pagos-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { buildPageUrl } from "@/lib/url";
import { FiltrosPagos } from "@/components/pagos/filtros-pagos";
import { Paginacion } from "@/components/paginacion";
import { Banknote, Camera, AlertCircle } from "lucide-react";
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

  // KPIs
  const totalMonto = pagos.reduce((sum, p) => sum + p.monto_total, 0);

  return (
    <>
      <Header
        titulo="Pagos"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        {/* KPI Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500">
                Total pagado (pagina)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold tabular-nums">
                {formatCurrencyShort(totalMonto)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500">
                Pagos en esta pagina
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold tabular-nums flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-500" />
                {pagos.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500">
                Sin codigos CRM
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold tabular-nums flex items-center gap-2">
                <AlertCircle className={`h-5 w-5 ${sinCRM > 0 ? "text-amber-500" : "text-slate-300"}`} />
                {sinCRM}
              </div>
            </CardContent>
          </Card>
        </div>

        <Suspense>
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
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 text-xs hover:bg-amber-100">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        {pago.soporte_key ? (
                          <Camera className="h-4 w-4 text-blue-500 mx-auto" />
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
