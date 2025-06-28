#!/bin/bash

LOGFILE="/home/csc-lab/e1-player-deobf/logs/min.log"
LOCKFILE="/tmp/run-min.lock"
TIMEOUT=45 # Max execution time in seconds

{
    echo "-----"
    echo "[START] $(date) - run-min.sh"

    # Exit if already running
    if [ -f "$LOCKFILE" ]; then
        echo "[ABORTED] run-min.sh is already running (lockfile exists)."
        exit 1
    fi

    # Create lockfile
    touch "$LOCKFILE"

    # Ensure lockfile is removed on exit (success or failure)
    trap 'rm -f "$LOCKFILE"' EXIT

    MSG="Update (run-min): $(date '+%Y-%m-%d %H:%M:%S')"

    # Run the original script with timeout and git commit
    timeout --kill-after=5 "$TIMEOUT" bash -c '
        set -e
        cd "$(dirname "$0")"

        git pull
        npm install

        node core/build-key-min.js

        git add .
        git commit -m "$1" || echo "[INFO] No changes to commit."
        git push
    ' bash "$MSG"

    echo "[END] $(date) - run-min.sh"
    echo "-----"
} >> "$LOGFILE" 2>&1