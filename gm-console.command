#!/bin/bash
# gm-console.command
# Double-click from Finder (or alias on Desktop) to launch the GM Console.
# Creates an alias: right-click this file in Finder → Make Alias → drag to Desktop.

PORT=3001
cd "$(dirname "$0")"

echo "╔══════════════════════════════════════╗"
echo "║   Fate City 1999 — GM Console        ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Starting server on http://localhost:$PORT ..."
echo "Press Ctrl+C to stop."
echo ""

# Open the GM console after a short delay while the server warms up
(sleep 1.5 && open "http://localhost:$PORT/gm-console.html") &

# Run server in foreground so this window shows the log
npx serve -p $PORT
