"use server";

import {
  getClientesConSaldo,
  getCiudades,
  getSegmentos,
} from "@/lib/queries/cartera-server";

export async function searchClientes(options?: {
  busqueda?: string;
  ciudad?: string;
  segmento?: string;
  limit?: number;
  offset?: number;
}) {
  return getClientesConSaldo(options);
}

export async function loadFilterOptions() {
  const [ciudades, segmentos] = await Promise.all([
    getCiudades(),
    getSegmentos(),
  ]);
  return { ciudades, segmentos };
}
