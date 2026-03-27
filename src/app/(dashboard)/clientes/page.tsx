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
import {
  getClientesConSaldo,
  getConteoClientesConSaldo,
  getConteoCupoSinUso,
  getConteoCreditoAnulado,
  getCiudades,
  getClientesCupoSinUso,
  getClientesCreditoAnulado,
} from "@/lib/queries/cartera-server";
import type { ClienteEnriquecido, ClienteCredito } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { getSeveridad, SEVERIDAD_CONFIG } from "@/lib/severity";
import { buildPageUrl } from "@/lib/url";
import { FiltrosCartera } from "@/components/filtros-cartera";
import { Paginacion } from "@/components/paginacion";
import { ClientesModos } from "@/components/clientes-modos";
import { FiltrosCredito } from "@/components/filtros-credito";
import Link from "next/link";

const ITEMS_PER_PAGE = 50;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const modo = params.modo || "con_saldo";

  // Conteos ligeros siempre en paralelo (para badges de tabs)
  const [profile, incluirCastigada, conteoConSaldo, conteoCupoSinUso, conteoCreditoAnulado] = await Promise.all([
    getUserProfile(),
    getIncluirCastigada(),
    getConteoClientesConSaldo(),
    getConteoCupoSinUso(),
    getConteoCreditoAnulado(),
  ]);

  const conteos = {
    con_saldo: conteoConSaldo,
    cupo_sin_uso: conteoCupoSinUso,
    credito_anulado: conteoCreditoAnulado,
  };

  // Datos completos solo del modo activo
  const busqueda = params.q || "";
  const ciudad = params.ciudad || undefined;
  const severidad = (params.severidad as "tolerable" | "atencion" | "critico") || undefined;
  const rango = params.rango || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  let clientes: ClienteEnriquecido[] = [];
  let total = 0;
  let ciudades: string[] = [];
  let cupoSinUso: ClienteCredito[] = [];
  let creditoAnulado: ClienteCredito[] = [];

  if (modo === "con_saldo") {
    const [ciudadesData, saldoData] = await Promise.all([
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
    ciudades = ciudadesData;
    clientes = saldoData.clientes;
    total = saldoData.total;
  } else if (modo === "cupo_sin_uso") {
    cupoSinUso = await getClientesCupoSinUso();
  } else if (modo === "credito_anulado") {
    creditoAnulado = await getClientesCreditoAnulado();
  }

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
          <ClientesModos conteos={conteos} />
        </Suspense>

        {modo === "con_saldo" && (
          <>
            <Suspense>
              <FiltrosCartera
                rutaBase="/clientes"
                placeholder="Buscar cliente..."
                etiquetaConteo="clientes"
                ciudades={ciudades}
                total={total}
              />
            </Suspense>
            <TablaConSaldo clientes={clientes} />
            <Paginacion
              page={page}
              totalPages={totalPages}
              total={total}
              itemsPorPagina={ITEMS_PER_PAGE}
              buildUrl={(p) => buildPageUrl("/clientes", p, { busqueda, ciudad, severidad, rango })}
            />
          </>
        )}

        {modo === "cupo_sin_uso" && (
          <FiltrosCredito clientes={cupoSinUso} modo="cupo_sin_uso" />
        )}
        {modo === "credito_anulado" && (
          <FiltrosCredito clientes={creditoAnulado} modo="credito_anulado" />
        )}
      </div>
    </>
  );
}

function TablaConSaldo({ clientes }: { clientes: ClienteEnriquecido[] }) {
  return (
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente) => {
                const sevConfig = SEVERIDAD_CONFIG[getSeveridad(cliente.maxima_mora)];
                return (
                  <TableRow key={cliente.codigo_cliente} className="hover:bg-slate-50">
                    <TableCell className="py-1.5">
                      <Link
                        href={`/clientes/${cliente.codigo_cliente}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {cliente.nombre_negocio || cliente.razon_social || cliente.codigo_cliente}
                      </Link>
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
                        <div>
                          <span className="text-red-600 font-medium">
                            {formatCurrencyFull(Number(cliente.total_vencido))}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {Number(cliente.total_deuda) > 0
                              ? ((Number(cliente.total_vencido) / Number(cliente.total_deuda)) * 100).toFixed(0)
                              : 0}% de la deuda
                          </div>
                        </div>
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
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

