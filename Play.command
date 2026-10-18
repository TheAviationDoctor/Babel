#!/bin/bash
# Double-click this file to open the Library of Babel in your browser.
#
# Browsers do not let a page opened straight from the disk read config.yaml,
# so this starts a small web server on your own computer (nothing is shared
# with the network) and opens the page through it. Close this window, or press
# Control-C in it, to stop the server.

cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed to run the local server, and it was not found."
  echo "On a Mac, install it by running:  xcode-select --install"
  read -r -p "Press Return to close."
  exit 1
fi

PORT=8642
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done

URL="http://localhost:$PORT/"
echo "The Library of Babel is open at $URL"
echo "Close this window to stop it."
(sleep 1; open "$URL") &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
