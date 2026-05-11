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
  CONFIANZA_BAJA: "confianza_baja",
  VOUCHER_MODIFICADO: "voucher_modificado",
} as const;

export type AuditoriaTipo = (typeof AUDITORIA_TIPO)[keyof typeof AUDITORIA_TIPO];

export const AUDITORIA_MOTIVO_MAX_LENGTH = 200;

export const AUDITORIA_TIPO_BADGE: Record<AuditoriaTipo, { label: string; classes: string }> = {
  [AUDITORIA_TIPO.VOUCHER_COMPARTIDO]: { label: "Voucher", classes: "bg-red-100 text-red-700 border-red-200" },
  [AUDITORIA_TIPO.MONTO_DIFF_SYNC]: { label: "Monto Sync", classes: "bg-red-100 text-red-700 border-red-200" },
  [AUDITORIA_TIPO.MONTO_EDITADO]: { label: "Monto Edit", classes: "bg-red-100 text-red-700 border-red-200" },
  [AUDITORIA_TIPO.MONTO_DIFF_IA]: { label: "Monto IA", classes: "bg-amber-100 text-amber-700 border-amber-200" },
  [AUDITORIA_TIPO.PAGO_SIN_SOPORTE]: { label: "Sin soporte", classes: "bg-amber-100 text-amber-700 border-amber-200" },
  [AUDITORIA_TIPO.CONFIANZA_BAJA]: { label: "Confianza baja", classes: "bg-rose-100 text-rose-700 border-rose-200" },
  [AUDITORIA_TIPO.VOUCHER_MODIFICADO]: { label: "Voucher mod", classes: "bg-teal-100 text-teal-700 border-teal-200" },
};
