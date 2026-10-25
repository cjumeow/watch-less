#!/bin/sh
# Registers the built native host with Chrome for this macOS account, so the extension with the given ID can reach it.
# Run it from a checkout after `npm run build`, with the extension's fixed ID:
#
#   native-host/install.sh <extension-id>
#
# It writes a launcher next to the built host, then Chrome's manifest for the host, made from manifest.template.json.
# Run it again after changing the Node version or deleting dist/, since the launcher names both.
# Delete that manifest to unregister the host. Registering is the developer's step: no agent and no check runs this.
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <extension-id>" >&2
  exit 64
fi
extension_id=$1
# Chrome's extension IDs are 32 letters from a to p.
case "$extension_id" in
  *[!a-p]*) echo "error: '$extension_id' is not an extension ID (32 letters from a to p)" >&2; exit 64 ;;
esac
if [ "${#extension_id}" -ne 32 ]; then
  echo "error: '$extension_id' is not an extension ID (32 letters from a to p)" >&2
  exit 64
fi

host_dir=$(cd "$(dirname "$0")" && pwd -P)
host_js="$host_dir/dist/host.js"
if [ ! -f "$host_js" ]; then
  echo "error: $host_js does not exist; run 'npm run build' first" >&2
  exit 1
fi
# Chrome starts the host with a minimal PATH, so the launcher names Node by its full path.
node=$(command -v node) || { echo "error: node is not on PATH" >&2; exit 1; }
node=$(cd "$(dirname "$node")" && pwd -P)/$(basename "$node")

# Each path in single quotes, with any single quote in it closed, escaped and reopened.
quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}
launcher="$host_dir/dist/yt-digest-host"
printf '#!/bin/sh\nexec %s %s "$@"\n' "$(quote "$node")" "$(quote "$host_js")" > "$launcher"
chmod 755 "$launcher"

manifest_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$manifest_dir"
# Node writes the JSON, so a path with a quote or a backslash in it is escaped correctly.
"$node" -e '
  const [template, destination, launcher, extensionId] = process.argv.slice(1);
  const fs = require("node:fs");
  const manifest = JSON.parse(fs.readFileSync(template, "utf8"));
  manifest.path = launcher;
  manifest.allowed_origins = [`chrome-extension://${extensionId}/`];
  fs.writeFileSync(`${destination}/${manifest.name}.json`, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Registered ${manifest.name} for chrome-extension://${extensionId}/ in ${destination}`);
' "$host_dir/manifest.template.json" "$manifest_dir" "$launcher" "$extension_id"
