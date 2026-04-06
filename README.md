# Pautas Platform

Sistema de gestión de campañas publicitarias con registro diario de datos, integración con Google Ads y Google Sheets, reportes y dashboards.

## Stack Tecnológico

- **Frontend**: Angular 17+ (standalone components, Angular Material, ng2-charts)
- **Backend**: Node.js + Express + TypeScript
- **Base de datos**: PostgreSQL 16
- **Integraciones**: Google Ads API, Google Sheets API

## Requisitos

- Node.js 18+
- Docker y Docker Compose (para PostgreSQL)
- npm o yarn

## Inicio Rápido

### 1. Levantar PostgreSQL con Docker

```bash
docker-compose up -d
```

Esto levantará:
- PostgreSQL en el puerto `5432` (user: `pautas_app`, pass: `pautas_dev_2024`, db: `pautas`)
- pgAdmin en `http://localhost:5050` (admin@pautas.local / admin123)

### 2. Backend

```bash
cd pautas-backend
npm install
cp .env.example .env   # Ya existe un .env preconfigurado para desarrollo
npm run migrate         # Ejecuta migraciones y seeds
npm run dev             # Inicia en http://localhost:3000
```

### 3. Frontend

```bash
cd pautas-frontend
npm install
npm start               # Inicia en http://localhost:4200
```

### 4. Acceso Inicial

- **Usuario admin**: `admin` / `admin123`
- Desde el panel de admin, crear usuarios con roles: conglomerado, pautador, gestion_administrativa

## Estructura del Proyecto

```
Pautas/
├── docker-compose.yml          # PostgreSQL + pgAdmin
├── pautas-backend/
│   ├── src/
│   │   ├── app.ts              # Entry point
│   │   ├── config/             # DB, env, CORS
│   │   ├── middleware/         # Auth, roles, validation, upload
│   │   ├── database/           # Migraciones y seeds SQL
│   │   ├── services/           # Google Sheets, Ads, exports, cron
│   │   ├── modules/
│   │   │   ├── auth/           # Login, refresh token, cambio contraseña
│   │   │   ├── admin/          # CRUD usuarios, campañas, países
│   │   │   ├── conglomerado/   # Entrada diaria, historial
│   │   │   ├── pautadores/     # Dashboard, consolidados, exports
│   │   │   └── gestion/        # Reportes, rotación de campañas
│   │   ├── jobs/               # Cron jobs
│   │   └── utils/              # Response, pagination, ISO week, logger
│   └── package.json
├── pautas-frontend/
│   └── src/app/
│       ├── core/               # Services, guards, interceptors, models
│       ├── features/           # Módulos por rol
│       │   ├── admin/
│       │   ├── conglomerado/
│       │   ├── pautadores/
│       │   └── gestion/
│       └── layouts/            # Auth layout, Main layout con sidenav
└── README.md
```

## Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| **Admin** | Crea usuarios, gestiona campañas y países |
| **Conglomerado** | Registro diario (clientes, efectivos, menores, soporte) |
| **Pautador** | Vista consolidada, Google Ads, dashboards, exportar PDF/Excel |
| **Gestión Administrativa** | Reportes de lectura, rotación de campañas |

## API Endpoints Principales

### Auth
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/refresh` - Renovar token
- `POST /api/v1/auth/logout` - Cerrar sesión

### Admin
- `GET/POST /api/v1/admin/users` - Gestión de usuarios
- `GET/POST /api/v1/admin/campaigns` - Gestión de campañas
- `GET /api/v1/admin/stats` - Estadísticas del panel

### Conglomerado
- `POST /api/v1/conglomerado/entry` - Crear entrada diaria
- `GET /api/v1/conglomerado/entry/today` - Verificar si ya registró hoy
- `GET /api/v1/conglomerado/entries` - Historial de entradas

### Pautadores
- `GET /api/v1/pautadores/consolidated` - Vista consolidada
- `GET /api/v1/pautadores/dashboard/kpis` - KPIs
- `GET /api/v1/pautadores/export/excel` - Exportar Excel
- `GET /api/v1/pautadores/export/pdf` - Exportar PDF

### Gestión Administrativa
- `GET /api/v1/gestion/dashboard/kpis` - KPIs generales
- `GET /api/v1/gestion/reports/*` - Reportes (efectividad, conversiones, por país, semanal)
- `POST /api/v1/gestion/rotations` - Registrar rotación de campaña
- `GET /api/v1/gestion/rotations` - Historial de rotaciones

## Integraciones

### Google Sheets
1. Crear un Service Account en Google Cloud Console
2. Habilitar la API de Google Sheets
3. Compartir la hoja de cálculo con el email del Service Account
4. Configurar en `.env`: `GOOGLE_SHEETS_KEY_FILE` y `GOOGLE_SHEETS_SPREADSHEET_ID`

### Google Ads
1. Obtener un Developer Token en el Google Ads API Center
2. Configurar OAuth2 (Client ID, Client Secret, Refresh Token)
3. Configurar en `.env` las variables `GOOGLE_ADS_*`

## Cron Jobs

| Job | Frecuencia | Descripción |
|-----|-----------|-------------|
| Sync Google Ads | Cada 4 horas | Descarga snapshots de campañas |
| Retry Sheets Sync | Cada 30 minutos | Reintenta syncs fallidos a Google Sheets |
| Weekly Summaries | Diario 1:00 AM | Recalcula resúmenes semanales |

## Despliegue en Producción

1. Configurar variables de entorno en `.env` (cambiar `JWT_SECRET`, credenciales DB, etc.)
2. Construir frontend: `cd pautas-frontend && ng build --configuration=production`
3. Compilar backend: `cd pautas-backend && npm run build`
4. Servir frontend con Nginx apuntando a `pautas-frontend/dist/`
5. Ejecutar backend con PM2: `pm2 start dist/app.js --name pautas-api`

## Países Configurados

Colombia (CO), México (MX), Perú (PE), Chile (CL), Ecuador (EC), Panamá (PA), Costa Rica (CR)
