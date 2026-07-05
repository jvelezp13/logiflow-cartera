import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAuditoriasHistorico,
  HISTORICO_PAGE_SIZE,
  type AuditoriaEstadoCierre,
  type HistoricoFilters,
} from "@/lib/queries/auditoria-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { buildPageUrl } from "@/lib/url";
import { FiltrosHistorico } from "@/components/alertas/filtros-historico";
import { TablaHistorico } from "@/components/alertas/tabla-historico";
import { Paginacion } from "@/components/paginacion";
import { AUDITORIA_TIPO, type AuditoriaTipo } from "@/lib/pagos-constants";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

function parseTipo(value: string | undefined): AuditoriaTipo | undefined {
  if (!value) return undefined;
  const valid = Object.values(AUDITORIA_TIPO) as string[];
  return valid.includes(value) ? (value as AuditoriaTipo) : undefined;
}

function parseEstado(value: string | undefined): AuditoriaEstadoCierre | undefined {
  return value === "aprobada" || value === "rechazada" ? value : undefined;
}

export default async function HistoricoAlertasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const filters: HistoricoFilters = {
    desde: params.desde || undefined,
    hasta: params.hasta || undefined,
    tipo: parseTipo(params.tipo),
    estado: parseEstado(params.estado),
  };

  const [profile, incluirCastigada, { auditorias, total }] = await Promise.all([
    getUserProfile(),
    getIncluirCastigada(),
    getAuditoriasHistorico(page, filters),
  ]);

  const totalPages = Math.ceil(total / HISTORICO_PAGE_SIZE);

  return (
    <>
      <Header
        titulo="Histórico de alertas"
        userName={profile.full_name}
        userRole={profile.role}
        availableTenants={profile.available_tenants}
        activeTenant={profile.active_tenant}
        isSupportMode={profile.is_support_mode}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <div>
          <Link
            href="/alertas"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver a alertas pendientes
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <FiltrosHistorico total={total} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <TablaHistorico auditorias={auditorias} />
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <Paginacion
            page={page}
            totalPages={totalPages}
            total={total}
            itemsPorPagina={HISTORICO_PAGE_SIZE}
            buildUrl={(p) =>
              buildPageUrl("/alertas/historico", p, {
                desde: filters.desde,
                hasta: filters.hasta,
                tipo: filters.tipo,
                estado: filters.estado,
              })
            }
          />
        )}
      </div>
    </>
  );
}
