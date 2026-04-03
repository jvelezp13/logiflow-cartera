export const PAGO_ESTADO = {
  REGISTRADO: "registrado",
  VERIFICADO: "verificado",
} as const;

export const PAGO_DATA_ORIGIN = {
  MANUAL: "manual",
  AI_ASSISTED: "ai_assisted",
} as const;

export const PAGO_TIPO = {
  PAGO: "pago",
  NOTA_CREDITO: "nota_credito",
} as const;

export const AUDITORIA_TIPO = {
  VOUCHER_COMPARTIDO: "voucher_compartido",
  MONTO_DIFF_SYNC: "monto_diff_sync",
  MONTO_EDITADO: "monto_editado",
  MONTO_DIFF_IA: "monto_diff_ia",
  PAGO_SIN_SOPORTE: "pago_sin_soporte",
} as const;

export type AuditoriaTipo = (typeof AUDITORIA_TIPO)[keyof typeof AUDITORIA_TIPO];
