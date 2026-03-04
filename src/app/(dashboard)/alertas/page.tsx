import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAlertasCompletas } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { formatCurrencyShort } from "@/lib/format";
import Link from "next/link";
import { AlertTriangle, AlertCircle, AlertOctagon, Info } from "lucide-react";

function getSeverityIcon(severidad: string) {
  switch (severidad) {
    case "critica":
      return <AlertOctagon className="h-5 w-5 text-red-500" />;
    case "alta":
      return <AlertCircle className="h-5 w-5 text-orange-500" />;
    case "media":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    default:
      return <Info className="h-5 w-5 text-green-500" />;
  }
}

function getSeverityBadgeClass(severidad: string) {
  switch (severidad) {
    case "critica":
      return "bg-red-500 text-white";
    case "alta":
      return "bg-orange-500 text-white";
    case "media":
      return "bg-amber-500 text-white";
    default:
      return "bg-green-500 text-white";
  }
}

export default async function AlertasPage() {
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();
  const alertas = await getAlertasCompletas();

  // Agrupar alertas por tipo
  const alertasPorTipo = alertas.reduce(
    (acc, alerta) => {
      if (!acc[alerta.tipo]) acc[alerta.tipo] = [];
      acc[alerta.tipo].push(alerta);
      return acc;
    },
    {} as Record<string, typeof alertas>
  );

  return (
    <>
      <Header
        titulo="Alertas"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(alertasPorTipo).map(([tipo, lista]) => (
            <Card
              key={tipo}
              className={`
                ${tipo === "DEUDA_VENCIDA" ? "border-red-200 bg-red-50" : ""}
                ${tipo === "PEDIDOS_PENDIENTES" ? "border-orange-200 bg-orange-50" : ""}
                ${tipo === "CUPO_EXCEDIDO" ? "border-amber-200 bg-amber-50" : ""}
                ${tipo === "CLIENTE_INACTIVO" ? "border-blue-200 bg-blue-50" : ""}
              `}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {tipo.replace(/_/g, " ")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lista.length}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lista de alertas */}
        <Card>
          <CardHeader>
            <CardTitle>Todas las Alertas ({alertas.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {alertas.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No hay alertas en este momento</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Descripcion</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertas.map((alerta, index) => (
                    <TableRow key={`${alerta.codigo_cliente}-${alerta.tipo}-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(alerta.severidad)}
                          <Badge className={getSeverityBadgeClass(alerta.severidad)}>
                            {alerta.severidad.toUpperCase()}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {alerta.tipo.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clientes/${alerta.codigo_cliente}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {alerta.razon_social || alerta.codigo_cliente}
                        </Link>
                      </TableCell>
                      <TableCell>{alerta.ciudad || "-"}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {alerta.descripcion}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyShort(alerta.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
