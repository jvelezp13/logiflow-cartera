-- Evitar duplicar la misma factura en un mismo pago
ALTER TABLE pago_facturas
  ADD CONSTRAINT uq_pago_factura UNIQUE (pago_id, no_factura);

-- Evitar sobre-aplicación: valor_aplicado no puede superar valor_factura
ALTER TABLE pago_facturas
  ADD CONSTRAINT chk_valor_aplicado_max
  CHECK (valor_aplicado <= valor_factura);

-- Cambiar created_by a RESTRICT para evitar perder referencia del creador
ALTER TABLE pagos
  DROP CONSTRAINT IF EXISTS pagos_created_by_fkey,
  ADD CONSTRAINT pagos_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
