#!/usr/bin/with-contenv bashio
set -euo pipefail

LOG_LEVEL="$(bashio::config 'log_level')"
export HOMESTOCK_LOG_LEVEL="${LOG_LEVEL:-info}"

bashio::log.info "Starting HomeStock Engine 2.0.0-alpha.1"
exec python3 /app/app.py
