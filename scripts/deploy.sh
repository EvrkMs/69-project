#!/usr/bin/env bash
# Deploys to the host behind a Docker context (docker context create ... --docker "host=ssh://user@server").
#   scripts/deploy.sh <context>        build on that host and (re)start
#   scripts/deploy.sh <context> down   stop and remove the container
# The image is built by the remote engine, so nothing but the source is sent; .env is read locally and passed as env.
set -euo pipefail
cd "$(dirname "$0")/.."

ctx="${1:?usage: scripts/deploy.sh <docker-context> [down]}"
docker context inspect "$ctx" >/dev/null

if [ "${2:-up}" = "down" ]; then
  docker --context "$ctx" compose down
  exit 0
fi

[ -f .env ] || { echo "no .env: copy .env.example and set ARCH69_SECRET" >&2; exit 1; }

npm run validate
npm test --silent
docker --context "$ctx" compose up -d --build --remove-orphans
docker --context "$ctx" compose ps
