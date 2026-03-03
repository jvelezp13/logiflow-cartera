"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getClientesConSaldo,
  getCiudades,
  getSegmentos,
} from "@/lib/queries/cartera";
import type { ClienteConSaldo } from "@/types/cartera";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const ITEMS_PER_PAGE = 50;

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConSaldo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [ciudad, setCiudad] = useState<string>("all");
  const [segmento, setSegmento] = useState<string>("all");
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function loadFilters() {
      const [ciudadesData, segmentosData] = await Promise.all([
        getCiudades(),
        getSegmentos(),
      ]);
      setCiudades(ciudadesData);
      setSegmentos(segmentosData);
    }
    loadFilters();
  }, []);

  useEffect(() => {
    async function loadClientes() {
      setLoading(true);
      try {
        const { clientes: data, total: totalClientes } =
          await getClientesConSaldo(undefined, {
            busqueda: busqueda || undefined,
            ciudad: ciudad !== "all" ? ciudad : undefined,
            segmento: segmento !== "all" ? segmento : undefined,
            limit: ITEMS_PER_PAGE,
            offset: page * ITEMS_PER_PAGE,
          });
        setClientes(data);
        setTotal(totalClientes);
      } catch (error) {
        console.error("Error loading clientes:", error);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(loadClientes, 300);
    return () => clearTimeout(debounce);
  }, [busqueda, ciudad, segmento, page]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <>
      <Header titulo="Clientes" />

      <div className="p-6 space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por código..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>

              <Select
                value={ciudad}
                onValueChange={(v) => {
                  setCiudad(v);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ciudad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ciudades</SelectItem>
                  {ciudades.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={segmento}
                onValueChange={(v) => {
                  setSegmento(v);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segmentos.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="text-sm text-slate-500 flex items-center">
                Total: {total} clientes
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right">Facturas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Última Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </TableCell>
                  </TableRow>
                ) : clientes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-slate-500"
                    >
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((cliente) => (
                    <TableRow
                      key={cliente.codigo_cliente}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <TableCell>
                        <Link
                          href={`/clientes/${cliente.codigo_cliente}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {cliente.codigo_cliente}
                        </Link>
                      </TableCell>
                      <TableCell>{cliente.razon_social || "-"}</TableCell>
                      <TableCell>{cliente.ciudad || "-"}</TableCell>
                      <TableCell>{cliente.segmento || "-"}</TableCell>
                      <TableCell className="text-right">
                        {cliente.num_facturas}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(cliente.saldo)}
                      </TableCell>
                      <TableCell>
                        {cliente.ultima_fecha
                          ? format(
                              new Date(cliente.ultima_fecha),
                              "dd MMM yyyy",
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Mostrando {page * ITEMS_PER_PAGE + 1} -{" "}
              {Math.min((page + 1) * ITEMS_PER_PAGE, total)} de {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
