/**
 * Script one-time para importar 128 notas historicas desde el Excel.
 *
 * Uso:
 *   npx tsx scripts/import-notas-historicas.ts              # insertar
 *   npx tsx scripts/import-notas-historicas.ts --dry-run     # solo mostrar clasificacion
 *
 * Requiere:
 *   - npm install -D xlsx
 *   - SUPABASE_SERVICE_ROLE_KEY (se obtiene via: supabase projects api-keys --project-ref reaahmkrqxpbvnmrwhrt)
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as fs from "fs";

// --- Config ---

const XLSX_PATH = "/Users/julianvelez/Downloads/Base Cartera.xlsx";
const SHEET_NAME = "Base Historica Clientes";
const TENANT_ID = "0bd44961-e36a-4fc1-8fbd-6577b09e6139";

// Leer URL de .env.local
const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
);
const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;

// Obtener service_role key del CLI de Supabase
function getServiceRoleKey(): string {
  const output = execSync(
    "supabase projects api-keys --project-ref reaahmkrqxpbvnmrwhrt",
    { encoding: "utf8" },
  );
  const match = output.match(/service_role\s+\|\s+(\S+)/);
  if (!match) throw new Error("No se pudo obtener service_role key");
  return match[1];
}

// --- Clasificacion por regex ---

type TipoNota = "gestion" | "compromiso" | "novedad";

function clasificarNota(texto: string): TipoNota {
  const lower = texto.toLowerCase();

  // compromiso: acuerdos, pagos, montos, planes
  if (
    /acuerdo|abona|semanal|compromet|cuota|\$\s*\d|pagar[eé]|plan de pago/.test(
      lower,
    )
  ) {
    return "compromiso";
  }

  // gestion: contacto, mensaje, llamada
  if (
    /mensaje|no responde|llam[oóa]|contact|negociacion|solicita factura/.test(
      lower,
    )
  ) {
    return "gestion";
  }

  // novedad: todo lo demas (retiros, nuevo credito, cambios, etc.)
  return "novedad";
}

// --- Main ---

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(dryRun ? "=== DRY RUN ===" : "=== IMPORTACION ===");
  console.log();

  // 1. Leer xlsx
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Hoja "${SHEET_NAME}" no encontrada`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  // 2. Extraer notas
  const notas: { codigo_cliente: string; contenido: string; tipo: TipoNota }[] =
    [];

  for (const row of rows) {
    const clienteRaw = row["Cliente"];
    const obsRaw = row["Observacion"];

    if (clienteRaw == null || obsRaw == null) continue;

    const contenido = String(obsRaw).trim();
    if (!contenido) continue;

    const codigo_cliente = String(Math.floor(Number(clienteRaw)));
    const tipo = clasificarNota(contenido);
    notas.push({ codigo_cliente, contenido, tipo });
  }

  console.log(`Total notas con texto: ${notas.length}`);
  console.log();

  // 3. Clasificacion
  const conteo = { gestion: 0, compromiso: 0, novedad: 0 };
  for (const n of notas) {
    conteo[n.tipo]++;
  }
  console.log("Clasificacion:");
  console.log(`  gestion:    ${conteo.gestion}`);
  console.log(`  compromiso: ${conteo.compromiso}`);
  console.log(`  novedad:    ${conteo.novedad}`);
  console.log();

  // 4. Mostrar detalle
  for (const n of notas) {
    console.log(`  [${n.tipo.padEnd(11)}] ${n.codigo_cliente} | ${n.contenido.substring(0, 80)}`);
  }
  console.log();

  if (dryRun) {
    console.log("Dry run finalizado. No se insertaron datos.");
    return;
  }

  // 5. Conectar con service_role
  console.log("Obteniendo service_role key...");
  const serviceKey = getServiceRoleKey();
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 6. Obtener user ID para created_by (primer admin del tenant)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("tenant_id", TENANT_ID)
    .limit(1);

  const createdBy = profiles?.[0]?.id;
  if (!createdBy) throw new Error("No se encontro un usuario para el tenant");
  console.log(`Usuario para created_by: ${profiles[0].full_name} (${createdBy})`);

  // 7. Validar que todos los codigos existan en maestra_total
  const codigos = [...new Set(notas.map((n) => n.codigo_cliente))];
  const { data: maestraData } = await supabase
    .from("maestra_total")
    .select("codigo_ecom")
    .eq("tenant_id", TENANT_ID)
    .in("codigo_ecom", codigos);

  const maestraSet = new Set((maestraData || []).map((m) => m.codigo_ecom));
  const sinMatch = codigos.filter((c) => !maestraSet.has(c));

  if (sinMatch.length > 0) {
    console.error(`ERROR: ${sinMatch.length} codigos no existen en maestra_total:`);
    console.error(sinMatch);
    process.exit(1);
  }
  console.log(`Validacion: ${codigos.length} codigos verificados en maestra_total`);

  // 8. Insertar
  const rows_to_insert = notas.map((n) => ({
    tenant_id: TENANT_ID,
    codigo_cliente: n.codigo_cliente,
    tipo: n.tipo,
    contenido: n.contenido,
    created_by: createdBy,
    created_at: null, // marca como historica
  }));

  const { error } = await supabase.from("notas_cliente").insert(rows_to_insert);

  if (error) {
    console.error("Error al insertar:", error.message);
    process.exit(1);
  }

  // 9. Verificar
  const { count } = await supabase
    .from("notas_cliente")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .is("created_at", null);

  console.log();
  console.log(`Insertadas: ${notas.length} notas`);
  console.log(`Verificacion: ${count} notas historicas en la tabla`);
  console.log("Importacion completada.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
