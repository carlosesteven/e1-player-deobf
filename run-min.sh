#!/bin/bash

LOCKFILE="/tmp/run-min.lock"
TIMEOUT=45 # Max execution time in seconds

# Exit if already running
if [ -f "$LOCKFILE" ]; then
    echo "[ABORTED] run-min.sh is already running (lockfile exists)."
    exit 1
fi

# Create lockfile
touch "$LOCKFILE"

# Ensure lockfile is removed on exit (success or failure)
trap 'rm -f "$LOCKFILE"' EXIT

# Run the original script with timeout
timeout --kill-after=5 "$TIMEOUT" bash -c '
    set -e
    cd "$(dirname "$0")"
    node core/build-key-min.js
'