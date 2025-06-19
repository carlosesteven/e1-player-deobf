#!/bin/bash

LOGFILE="/home/csc-lab/e1-player-deobf/full.log"
LOCKFILE="/tmp/run-full.lock"
TIMEOUT=45 # Max execution time in seconds

{
    echo "-----"
    echo "[START] $(date) - run-full.sh"

    # Exit if already running
    if [ -f "$LOCKFILE" ]; then
        echo "[ABORTED] run-full.sh is already running (lockfile exists)."
        exit 1
    fi

    # Create lockfile
    touch "$LOCKFILE"

    # Ensure lockfile is removed on exit (success or failure)
    trap 'rm -f "$LOCKFILE"' EXIT

    # Run the original sequence with a timeout
    timeout --kill-after=5 "$TIMEOUT" bash -c '
        set -e
        cd "$(dirname "$0")"

        git pull
        npm install

        node core/download-input.js
        node core/deobfuscate.js
        node core/build-key.js

        git add .
        git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')" || echo "[INFO] No changes to commit."
        git push
    '

    echo "[END] $(date) - run-full.sh"
    echo "-----"
} >> "$LOGFILE" 2>&1
