-- ============================================
-- Reconcilia drift de notas_cliente aplicado por hotfixes directos
-- en la DB remota (Sync-LogiFlow) sin migration versionada.
--
-- Cambios que ya estan presentes en la DB y que esta migration formaliza:
--   1. Columna app_id (tabla compartida entre cartera/maestra/ventas)
--   2. CHECK de tipo ampliado con 'visita' y 'observacion' (uso de maestra-clientes)
--   3. Indice idx_notas_cliente_app (lookup por app)
--
-- NOTA sobre idempotencia: esta migration usa IF NOT EXISTS / DROP IF EXISTS
-- a proposito porque reconcilia estado YA presente en la DB remota (aplicado
-- via hotfix). No porque esperemos correrla varias veces. En entornos donde
-- el drift no exista (DB nueva, local fresh) los mismos statements crean los
-- objetos desde cero. Si lees esto en 6 meses: el patron idempotente es la
-- forma segura de hacer converger DB con drift y DB limpia en una sola pasada.
--
-- Fuera de scope (decision explicita):
--   - created_by ON DELETE SET NULL queda como esta. Si se quiere alinear con
--     la regla de trazabilidad de la migration 029, va como migration 031.
-- ============================================

-- ============================================
-- 1. Columna app_id
-- ============================================

ALTER TABLE public.notas_cliente
  ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'cartera';

-- Recreamos el constraint por idempotencia: si ya existe (drift) lo dropeamos
-- y volvemos a crear con la misma definicion. Si no existe, simplemente lo crea.
ALTER TABLE public.notas_cliente
  DROP CONSTRAINT IF EXISTS notas_cliente_app_id_check;

ALTER TABLE public.notas_cliente
  ADD CONSTRAINT notas_cliente_app_id_check
  CHECK (app_id IN ('cartera', 'maestra', 'ventas'));

COMMENT ON COLUMN public.notas_cliente.app_id IS
  'App de origen de la nota. Tabla compartida entre cartera, maestra y ventas. Default cartera por razones historicas — apps nuevas DEBEN setear app_id explicitamente al hacer INSERT.';

-- TODO (deuda tecnica): el DEFAULT 'cartera' es legacy y existe solo porque
-- la columna se agrego despues de que cartera ya tenia datos. Apps nuevas
-- (maestra, ventas, futuras) DEBEN pasar app_id explicitamente en cada INSERT
-- y NO confiar en el default. A futuro conviene evaluar:
--   1. Backfill explicito de cualquier fila que dependa del default
--   2. Quitar el DEFAULT
--   3. Mantener NOT NULL para forzar que todo INSERT lo declare
-- Esa limpieza NO es parte de esta migration — esta migration solo reconcilia
-- el estado actual de la DB con el repo de migrations.

-- ============================================
-- 2. CHECK de tipo ampliado
-- ============================================

ALTER TABLE public.notas_cliente
  DROP CONSTRAINT IF EXISTS notas_cliente_tipo_check;

ALTER TABLE public.notas_cliente
  ADD CONSTRAINT notas_cliente_tipo_check
  CHECK (tipo IN ('gestion', 'compromiso', 'novedad', 'visita', 'observacion'));

COMMENT ON COLUMN public.notas_cliente.tipo IS
  'gestion=contacto/seguimiento, compromiso=acuerdo/pago, novedad=evento/contexto (cartera); visita=visita en sitio, observacion=nota libre (maestra-clientes).';

-- ============================================
-- 3. Indice por app
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notas_cliente_app
  ON public.notas_cliente (tenant_id, codigo_cliente, app_id);
