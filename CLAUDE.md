# Logiflow Cartera

Sistema de gestion de cartera (cuentas por cobrar) multi-tenant. Visualiza mora, envejecimiento, alertas de cupo y clientes inactivos.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 (config en globals.css, NO tailwind.config.ts)
- Supabase SSR (@supabase/ssr) — auth + base de datos
- shadcn/ui (estilo new-york) — componentes UI en src/components/ui/
- Recharts — graficos dashboard
- Vitest + Testing Library — tests
- Fechas con Intl.toLocaleDateString nativo (date-fns eliminado)

## Supabase — Conexion y Keys

- Proyecto: `reaahmkrqxpbvnmrwhrt` (linked en supabase/.temp/project-ref)
- `.env.local` tiene: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `.env.local` NO tiene `SUPABASE_SERVICE_ROLE_KEY` — obtenerla con: `supabase projects api-keys --project-ref reaahmkrqxpbvnmrwhrt`
- **IMPORTANTE**: La anon key sin sesion autenticada NO puede leer `sync_tenants`, `profiles`, `maestra_total` (RLS las bloquea). Para queries de diagnostico/admin usar SIEMPRE service_role key.
- Tablas `cartera`, `clientes_credito`, `pedidos` SI devuelven datos con anon key (RLS diferente).

## Ecosistema Logiflow

Este proyecto comparte el MISMO proyecto Supabase con logiflow-ventas. Ambos usan:
- Mismas tablas base: sync_tenants, profiles, app_permissions
- Mismas tablas de datos: cartera, maestra_total, pedidos, clientes_credito
- Mismo patron de auth (getUserProfile + app_permissions), diferente APP_ID
- Sync-Logiflow es el pipeline que pobla las tablas (jobs diarios ~3:45am COL)

Cartera es dueno de las migraciones SQL (supabase/migrations/). Ventas no tiene migraciones propias.

### Ownership de objetos en Supabase

| Objeto | Dueño | Nota |
|--------|-------|------|
| Tablas base (cartera, pedidos, maestra_total, clientes_credito) | Sync-Logiflow | Pobladas por jobs diarios |
| sync_tenants, sync_alertas, sync_credentials, sync_runs | Sync-Logiflow | Infraestructura de sync |
| vista_pedidos_enriquecida | Sync-Logiflow | **No esta en migraciones locales** — si cambia alla, puede romper aca |
| vista_cartera_enriquecida | logiflow-cartera | migrations/007 |
| vista_cliente_resumen | logiflow-cartera | migrations/008, 010 |
| notas_cliente | logiflow-cartera | migrations/009 |
| profiles, app_permissions | logiflow-cartera | migrations/002, 005 |
| RPCs (get_dashboard_kpis, get_envejecimiento, get_ciudades, get_segmentos, get_alertas_completas) | logiflow-cartera | migrations/004, 007, 011 |

**Riesgo**: los tipos TypeScript de `vista_pedidos_enriquecida` estan escritos a mano en `cartera-server.ts`. Si Sync-Logiflow cambia columnas, cartera rompe en runtime sin error de compilacion.

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
│       └── alertas/            # 4 modos: cupo excedido/ocioso/inactivos/novedades
├── components/
│   ├── layout/                 # Header, Sidebar, MobileSidebar, DashboardShell
│   ├── dashboard/              # KPI cards, charts, tablas top
│   ├── alertas/                # Filtros alertas (mode-switching)
│   ├── pre-facturacion/        # Filtros pre-facturacion (mode-switching)
│   ├── filtros-cartera.tsx     # Filtros compartidos clientes/facturas (busqueda+ciudad+rango+severidad)
│   ├── paginacion.tsx          # Paginacion reutilizable con Links
│   ├── toggle-castigada.tsx    # Toggle cartera castigada (cookie)
│   └── ui/                     # shadcn/ui (NO editar manualmente)
└── lib/
    ├── auth/                   # types.ts (AppRole, APP_ID), get-tenant.ts (getUserProfile)
    ├── supabase/               # client.ts (browser), server.ts (SSR), middleware.ts
    ├── queries/
    │   ├── cartera-server.ts   # Tipos + queries server-side (usa auth + cookie castigada)
    │   └── alertas-server.ts   # Queries alertas (cupo excedido/ocioso, inactivos, novedades)
    ├── severity.ts             # getSeveridad, getMoraBadgeStyles, isValidSeveridad, SEVERIDAD_CONFIG, SEVERIDADES, RANGOS, RANGOS_MORA
    ├── navigation.ts           # getNavItems, navigation arrays (sidebar + mobile)
    ├── format.ts               # formatCurrencyShort, formatCurrencyFull
    ├── url.ts                  # buildPageUrl (paginacion con filtros)
    ├── constants.ts            # RANGE_COLORS, SEVERITY_GRUPOS
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
- Gestion de usuarios y tenants es centralizada en Sync-Logiflow/logiflow-hub (NO en esta app)

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
- Filtros consolidados en `components/filtros-cartera.tsx` (antes duplicados en clientes/ y facturas/)
- Paginacion extraida a `components/paginacion.tsx` (antes duplicada en ambas paginas)
- buildPageUrl centralizado en `lib/url.ts`
- Eliminado `cartera.ts` legacy (tipos movidos a `cartera-server.ts`)
- Eliminado `SEVERITY_COLORS` (codigo muerto sin consumidores)

## Comandos

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Build produccion
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:ci      # Vitest (single run)
```
