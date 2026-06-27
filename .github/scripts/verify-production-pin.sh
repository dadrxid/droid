#!/usr/bin/env bash
set -euo pipefail

image_line="$(grep '^[[:space:]]*image:' docker-compose.yml || true)"

if [ -z "$image_line" ]; then
  echo 'Missing image: line in docker-compose.yml'
  exit 1
fi

if ! echo "$image_line" | grep -q 'ghcr.io/dadrxid/droid:stable'; then
  echo "Production image must be ghcr.io/dadrxid/droid:stable, got: ${image_line}"
  exit 1
fi

if echo "$image_line" | grep -E 'ghcr.io/museofficial|:latest' >/dev/null; then
  echo 'Production image must not use upstream registry or :latest tag'
  exit 1
fi

echo "OK: ${image_line}"
