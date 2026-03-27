# Logiflow Cartera

Sistema de gestion de cartera (cuentas por cobrar) multi-tenant. Visualiza mora, envejecimiento, alertas de cupo y clientes inactivos.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 (config en globals.css, NO tailwind.config.ts)
- Supabase SSR (@supabase/ssr) — auth + base de datos
- shadcn/ui (estilo new-york) — componentes UI en src/components/ui/
- Recharts — graficos dashboard
- Vitest + Testing Library — tests
- date-fns — manejo de fechas

## Ecosistema Logiflow

Este proyecto comparte el MISMO proyecto Supabase con logiflow-ventas. Ambos usan:
- Mismas tablas base: sync_tenants, profiles, app_permissions
- Mismas tablas de datos: cartera, maestra_total, pedidos, clientes_credito
- Mismo patron de auth (getUserProfile + app_permissions), diferente APP_ID
- Sync-Logiflow es el pipeline que pobla las tablas (jobs diarios ~3:45am COL)

Cartera es dueno de las migraciones SQL (supabase/migrations/). Ventas no tiene migraciones propias.

## Estructura

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── login/                  # Auth: page, login-form, actions
│   └── (dashboard)/            # Route group autenticado
│       ├── layout.tsx          # Auth check + DashboardShell
│       ├── page.tsx            # Dashboard KPIs
│       ├── clientes/           # Lista + detalle [codigo]
│       ├── facturas/           # Lista con filtros
│       ├── pre-facturacion/    # Modos: mora y cupo
│       ├── alertas/            # 4 modos: cupo excedido/ocioso/inactivos/novedades
│       ├── usuarios/           # Admin: gestion usuarios
│       ├── tenants/            # Super admin: gestion tenants
│       └── configuracion/      # Settings
├── components/
│   ├── layout/                 # Header, Sidebar, MobileSidebar, DashboardShell
│   ├── dashboard/              # KPI cards, charts, tablas top
│   ├── clientes/               # Filtros clientes
│   ├── facturas/               # Filtros facturas
│   ├── alertas/                # Filtros alertas
│   ├── pre-facturacion/        # Filtros pre-facturacion
│   ├── toggle-castigada.tsx    # Toggle cartera castigada (cookie)
│   └── ui/                     # shadcn/ui (NO editar manualmente)
└── lib/
    ├── auth/                   # types.ts (AppRole, APP_ID), get-tenant.ts (getUserProfile)
    ├── supabase/               # client.ts (browser), server.ts (SSR), middleware.ts
    ├── queries/
    │   ├── cartera-server.ts   # Tipos + queries server-side (usa auth + cookie castigada)
    │   └── alertas-server.ts   # Queries alertas (cupo excedido/ocioso, inactivos, novedades)
    ├── severity.ts             # getSeveridad, getMoraBadgeStyles, SEVERIDAD_CONFIG, SEVERIDADES, RANGOS
    ├── navigation.ts           # getNavItems, navigation arrays (sidebar + mobile)
    ├── format.ts               # formatCurrencyShort, formatCurrencyFull
    ├── constants.ts            # RANGE_COLORS, SEVERITY_GRUPOS, SEVERITY_COLORS
    ├── castigada.ts            # getIncluirCastigada (lee cookie)
    ├── castigada-action.ts     # toggleCastigadaCookie (server action, escribe cookie)
    └── logger.ts               # logError (solo en dev)
```

## Convenciones de codigo

### Patrones establecidos
- **Server Components por defecto** — las paginas son async server components
- **Client Components** solo para interactividad (filtros, toggles, charts)
- **Estado por URL** — filtros, paginacion y busqueda via searchParams (NO useState para estado compartido)
- **Queries server-side** — usar funciones de `cartera-server.ts` y `alertas-server.ts`, NUNCA `cartera.ts` directamente
- **React.cache()** — para deduplicar queries por request (getUserProfile, createClient)
- **Parallel queries** — usar Promise.all() para queries independientes en paginas

### Supabase
- Todas las queries filtran por `tenant_id` (multi-tenant con RLS)
- Preferir RPCs (`supabase.rpc()`) sobre queries directas para logica compleja
- Vistas disponibles: `vista_cartera_enriquecida`, `vista_cliente_resumen`, `vista_pedidos_enriquecida`
- RPCs: `get_dashboard_kpis`, `get_envejecimiento`, `get_ciudades`, `get_segmentos`, `get_alertas_completas`
- PostgREST NO soporta WHERE sobre columnas calculadas — filtrar en JS cuando sea necesario (ej: cupo)

### Naming
- Interfaces y tipos en espanol: ClienteEnriquecido, FacturaEnriquecida, PedidoPreFacturacion
- Funciones de query en espanol: getClientesConSaldo, getDetalleCliente
- Variables de negocio en espanol: mora, cupo, severidad, castigada, envejecimiento

### Auth y roles
- 3 roles: super_admin, admin, viewer
- APP_ID = "cartera" — filtra permisos para esta app
- getUserProfile() con INNER JOIN a app_permissions — falla si no tiene permiso
- Middleware solo verifica auth (no roles por ruta)

## Reglas de negocio

### Severidad por mora
- **Tolerable** (verde): mora <= 5 dias
- **Atencion** (amarillo): mora 6-20 dias
- **Critico** (rojo): mora > 20 dias
- Un cliente se clasifica por su PEOR mora (maxima_mora)

### Cartera castigada
- Facturas con mora > 90 dias
- Toggle global en header, OFF por defecto
- Se persiste en cookie (1 ano de expiracion)
- Afecta TODAS las queries y RPCs via parametro `p_incluir_castigada`

### Alertas
- **Cupo excedido**: uso > 80% del cupo asignado (3 niveles: >80% media, >90% alta, >95% critica)
- **Cupo ocioso**: uso < 50% del cupo asignado
- **Inactivos**: tiene deuda vencida + 30 dias sin pedidos
- **Novedades**: eventos recientes del sistema (tabla sync_alertas)

### Pre-facturacion
- **Modo mora**: pedidos de clientes con deuda vencida (severidad atencion/critico)
- **Modo cupo**: pedidos de clientes cerca o sobre el cupo

## Problemas conocidos

### Deuda tecnica resuelta
- Severidad centralizada en `lib/severity.ts` (antes duplicada en 5+ archivos)
- Navegacion centralizada en `lib/navigation.ts` (antes duplicada en sidebar y mobile-sidebar)
- Colores de charts centralizados en `lib/constants.ts` (RANGE_COLORS, SEVERITY_GRUPOS)
- Filtros usan SEVERIDADES y RANGOS de `lib/severity.ts` (antes duplicados)
- Eliminado `cartera.ts` legacy (tipos movidos a `cartera-server.ts`)

## Comandos

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Build produccion
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:ci      # Vitest (single run)
```
