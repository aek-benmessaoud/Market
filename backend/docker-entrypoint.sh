#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push 2>&1

echo "Starting server..."
exec node dist/index.js