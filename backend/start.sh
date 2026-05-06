#!/bin/sh
# ============================================================
# Backend startup
# 1. Show what's actually in dist/ (helps debug build issues)
# 2. Run Prisma db push (schema → DB; idempotent)
# 3. Find main.js — be tolerant of dist/main.js OR dist/src/main.js
#    so a tsconfig include change doesn't break startup
# ============================================================
set -e

echo "=== dist contents ==="
ls -la dist/ || true
if [ -d dist/src ]; then
  echo "=== dist/src contents ==="
  ls -la dist/src/
fi
echo "===================="

echo "Running prisma db push..."
npx prisma db push --skip-generate --accept-data-loss

if [ -f dist/main.js ]; then
  echo "Starting: node dist/main.js"
  exec node dist/main.js
elif [ -f dist/src/main.js ]; then
  echo "Starting: node dist/src/main.js"
  exec node dist/src/main.js
else
  echo "ERROR: cannot find main.js in dist/ or dist/src/"
  echo "Did 'npm run build' succeed?"
  exit 1
fi
