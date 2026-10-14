#!/bin/bash
set -euo pipefail
geo_root="$(cd "$(dirname "$0")/.." && pwd)"
node -e 'if (process.versions.node.split(".")[0] !== "24") { console.error("Node.js 24 is required."); process.exit(1); }'
cd "$geo_root/repos/Elmo"
if [ ! -f .env ]; then
  printf '%s\n' 'Run bash mac/configure.sh from the extracted root first.' >&2
  exit 1
fi
node --env-file=.env "$geo_root/mac/check-db.mjs"
cd apps/web
printf '%s\n' 'Open http://localhost:3010/app/org/default/restaurants after Vite is ready.'
printf '%s\n' 'Only the local web app starts. Ctrl+C stops it.'
exec node --env-file=../../.env node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 3010 --strictPort
