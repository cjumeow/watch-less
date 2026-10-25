#!/bin/sh
# Installs the worker's launchd agent for the current user, from this checkout. The developer runs it, since it
# changes what runs at login; an agent never does. The agent runs the node binary this script finds, at its full
# path, so run it again after moving the checkout, changing PATH, or removing that version of Node (with nvm, say).
#
#   sh worker/scripts/install-launchd-agent.sh
#
# It builds the worker, writes ~/Library/LaunchAgents/local.yt-digest.worker.plist and loads it. To uninstall:
#
#   launchctl bootout "gui/$(id -u)/local.yt-digest.worker"
#   rm ~/Library/LaunchAgents/local.yt-digest.worker.plist
set -eu

label=local.yt-digest.worker
checkout=$(cd "$(dirname "$0")/../.." && pwd)
data=${YT_DIGEST_DATA_DIR:-"$HOME/Library/Application Support/yt-digest"}
node=$(command -v node)
plist="$HOME/Library/LaunchAgents/$label.plist"

# Escapes a value for XML text, then for the replacement side of sed.
escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/[\\|&]/\\&/g'
}

npm --prefix "$checkout" run build --workspace worker
mkdir -p "$data/queue" "$data/logs" "$HOME/Library/LaunchAgents"

sed -e "s|@NODE@|$(escape "$node")|g" \
  -e "s|@WORKER@|$(escape "$checkout/worker/dist/worker.js")|g" \
  -e "s|@PATH@|$(escape "$PATH")|g" \
  -e "s|@DATA@|$(escape "$data")|g" \
  "$checkout/worker/launchd/$label.plist" >"$plist"
plutil -lint "$plist"

# Unload an earlier copy first, so launchd reads the new one.
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Installed $label; the worker's log is $data/logs/worker.log"
