// Tipos para las tablas de cartera

export interface Cartera {
  id: number;
  tenant_id: string;
  codigo_cliente: string;
  no_factura: string;
  fecha_factura: string | null;
  fecha_vencimiento: string | null;
  vendedor: string | null;
  plazo: number | null;
  cupo: number | null;
  mora: number | null;
  total: number;
  fecha_descarga: string;
  periodo: string;
  fuente: string;
}

export interface CarteraSnapshot {
  id: number;
  tenant_id: string;
  codigo_cliente: string;
  no_factura: string;
  fecha_factura: string | null;
  fecha_vencimiento: string | null;
  vendedor: string | null;
  plazo: number | null;
  cupo: number | null;
  mora: number | null;
  total: number;
  periodo: string;
  fuente: string;
  fecha_snapshot: string;
}

export interface Pedido {
  id: number;
  tenant_id: string;
  tipo: string;
  num_pedido: string;
  estado: string;
  fecha: string;
  hora: string;
  num_productos: number;
  codigo_cliente: string | null;
  razon_social: string | null;
  ciudad: string | null;
  total: number;
  cod_asesor: string | null;
  nombre_asesor: string | null;
  razon_no_compra: string | null;
  pedido_pideky: string | null;
  fecha_descarga: string;
}

export interface MaestraTotal {
  id: number;
  tenant_id: string;
  codigo_ecom: string;
  documento: string | null;
  tipo_documento: string | null;
  razon_social: string;
  nombre_negocio: string | null;
  nombre_completo: string | null;
  direccion: string | null;
  barrio: string | null;
  ciudad: string | null;
  departamento: string | null;
  cod_ciudad: string | null;
  latitud: number | null;
  longitud: number | null;
  telefono: string | null;
  telefono_2: string | null;
  correo: string | null;
  canal: string | null;
  subcanal: string | null;
  tipologia: string | null;
  segmento: string | null;
  estado: string | null;
  fecha_creacion: string | null;
  regimen: string | null;
  primera_descarga: string;
  ultima_descarga: string;
  reemplaza_a: string | null;
  fecha_descarga: string;
  periodo: string | null;
  fuente: string | null;
}

export interface ClienteConSaldo {
  codigo_cliente: string;
  razon_social: string | null;
  documento: string | null;
  ciudad: string | null;
  segmento: string | null;
  estado: string | null;
  saldo: number;
  num_facturas: number;
  ultima_fecha: string | null;
}

export interface ResumenCartera {
  total: number;
  por_vencer: number;
  vencido: number;
  clientes_activos: number;
}

export interface EnvejecimientoRango {
  label: string;
  min: number;
  max: number | null;
  total: number;
  porcentaje: number;
}

export interface AlertaCartera {
  codigo_cliente: string;
  razon_social: string | null;
  num_pedido: string;
  fecha_pedido: string;
  valor_pedido: number;
  no_factura: string;
  fecha_vencimiento: string | null;
  valor_factura: number;
  mora: number;
}
