#!/usr/bin/env bash
set -e

# scripts/dev-all.sh - Run server, web viewer, and desktop app concurrently

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting Brachio Tracker development environment..."
echo "  - Relay Server:  http://localhost:8080 (ws://localhost:8080)"
echo "  - Web Viewer:    http://localhost:5173"
echo "  - Desktop App:   http://localhost:1420"
echo ""

# Track child PIDs for clean exit
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down dev processes..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "All processes stopped."
}

trap cleanup EXIT INT TERM

# Start Relay Server
pnpm dev:server &
PIDS+=($!)

# Start Web Viewer
pnpm dev:web &
PIDS+=($!)

# Start Desktop App
pnpm dev:desktop &
PIDS+=($!)

echo "All services launched. Press Ctrl+C to stop all."
wait
