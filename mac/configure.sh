#!/bin/bash
set -euo pipefail
geo_root="$(cd "$(dirname "$0")/.." && pwd)"
node -e 'if (process.versions.node.split(".")[0] !== "24") { console.error("Node.js 24 is required."); process.exit(1); }'
if [ -e "$geo_root/repos/Elmo/.env" ] || [ -e "$geo_root/repos/Elmo/apps/web/.env" ]; then
  printf '%s\n' 'Configuration exists; nothing was changed.' >&2
  exit 1
fi
read -r -p 'Local PostgreSQL user [geo_local]: ' geo_user
geo_user="${geo_user:-geo_local}"
read -r -p 'Local PostgreSQL port [5432]: ' geo_port
geo_port="${geo_port:-5432}"
read -r -s -p 'Local PostgreSQL password: ' geo_password
printf '\n'
trap 'unset geo_password' EXIT
printf '%s\n' "$geo_user" "$geo_port" "$geo_password" | node "$geo_root/mac/write-config.mjs"
