#!/bin/bash
# Pautas Platform - Local Development Setup
set -e

echo "=========================================="
echo "  Pautas - Setup Desarrollo Local"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 1. Check prerequisites
echo "[1/5] Verificando requisitos..."
command -v node >/dev/null 2>&1 || { echo "Node.js no encontrado. Instale Node.js 18+."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker no encontrado. Instale Docker."; exit 1; }
echo "  Node.js: $(node -v)"
echo "  Docker: $(docker -v | cut -d' ' -f3)"

# 2. Start PostgreSQL
echo "[2/5] Levantando PostgreSQL..."
cd "$ROOT_DIR"
docker-compose up -d postgres
echo "  Esperando que PostgreSQL esté listo..."
sleep 5
echo "  PostgreSQL listo en puerto 5432."

# 3. Install backend dependencies
echo "[3/5] Instalando dependencias del backend..."
cd "$ROOT_DIR/pautas-backend"
npm install
echo "  Backend dependencies installed."

# 4. Run migrations
echo "[4/5] Ejecutando migraciones y seeds..."
cd "$ROOT_DIR/pautas-backend"
npx ts-node src/database/migrate.ts
echo "  Base de datos configurada."

# 5. Install frontend dependencies
echo "[5/5] Instalando dependencias del frontend..."
cd "$ROOT_DIR/pautas-frontend"
npm install
echo "  Frontend dependencies installed."

echo ""
echo "=========================================="
echo "  Setup completado!"
echo ""
echo "  Para iniciar el backend:"
echo "    cd pautas-backend && npm run dev"
echo ""
echo "  Para iniciar el frontend:"
echo "    cd pautas-frontend && npm start"
echo ""
echo "  Acceso inicial:"
echo "    Usuario: admin"
echo "    Contraseña: admin123"
echo "=========================================="
