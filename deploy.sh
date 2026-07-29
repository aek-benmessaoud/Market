#!/bin/bash
set -e

echo "=== Mini-Market Price Checker Deployment ==="

# Load production env
if [ -f .env.production ]; then
  export $(grep -v '^\s*#' .env.production | xargs)
fi

echo "1. Pulling latest code..."
git pull origin main

echo "2. Building and starting services..."
docker compose down
docker compose up --build -d

echo "3. Waiting for backend health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "   Backend is healthy!"
    break
  fi
  echo "   Waiting... ($i/30)"
  sleep 2
done

echo "4. Checking database migration..."
docker compose exec -T backend npx drizzle-kit push

echo "=== Deployment complete ==="
echo "Backend: https://yourdomain.com/api/v1/"
echo "Frontend: https://yourdomain.com/"