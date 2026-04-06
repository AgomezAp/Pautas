#!/bin/bash
# Pautas Platform - Deployment Script
set -e

echo "=========================================="
echo "  Pautas Platform - Deploy"
echo "=========================================="

APP_DIR="/var/www/pautas"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Build frontend
echo "[1/5] Building frontend..."
cd "$REPO_DIR/pautas-frontend"
npm ci
npx ng build --configuration=production
echo "  Frontend build complete."

# 2. Build backend
echo "[2/5] Building backend..."
cd "$REPO_DIR/pautas-backend"
npm ci
npx tsc
echo "  Backend build complete."

# 3. Deploy files
echo "[3/5] Deploying files..."
sudo mkdir -p "$APP_DIR/frontend" "$APP_DIR/backend" "$APP_DIR/backend/uploads"

# Frontend
sudo rsync -av --delete "$REPO_DIR/pautas-frontend/dist/pautas-frontend/" "$APP_DIR/frontend/"

# Backend
sudo rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='uploads/*' \
  "$REPO_DIR/pautas-backend/" "$APP_DIR/backend/"

cd "$APP_DIR/backend"
sudo npm ci --production
echo "  Files deployed."

# 4. Run migrations
echo "[4/5] Running migrations..."
cd "$APP_DIR/backend"
sudo npx ts-node src/database/migrate.ts
echo "  Migrations complete."

# 5. Restart services
echo "[5/5] Restarting services..."
if command -v pm2 &> /dev/null; then
  pm2 restart pautas-api 2>/dev/null || pm2 start dist/app.js --name pautas-api
  echo "  PM2 process restarted."
else
  echo "  PM2 not found. Please start the backend manually:"
  echo "  cd $APP_DIR/backend && node dist/app.js"
fi

sudo nginx -t && sudo systemctl reload nginx
echo "  Nginx reloaded."

echo ""
echo "=========================================="
echo "  Deployment complete!"
echo "=========================================="
