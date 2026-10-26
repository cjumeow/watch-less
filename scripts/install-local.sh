#!/bin/sh
# Installs yt-digest for this macOS account from the checkout's last commit, and updates it when run again:
#
#   npm run install-local              # check the tools, install, register the native host and (re)load the worker's
#                                      # launchd agent
#   npm run install-local -- --dry-run # install into a new temporary home instead, and run no launchctl
#
# It builds the commit in a temporary folder, so uncommitted edits are not installed, and copies what runs into
# ~/Library/Application Support/yt-digest/app/. Nothing it installs points into the checkout.
set -eu

dry_run=false
case "${1-}" in
  "") ;;
  --dry-run) dry_run=true ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 64 ;;
esac

checkout=$(cd "$(dirname "$0")/.." && pwd -P)

# Stop before building when a tool yt-digest needs is missing, rather than at the first digest. A dry run installs
# into a temporary home that never runs, so it needs none of them.
if [ "$dry_run" = false ]; then
  sh "$checkout/scripts/setup.sh" --check >&2 || exit 1
fi
build=$(mktemp -d "${TMPDIR:-/tmp}/yt-digest-build.XXXXXX")
trap 'rm -rf "$build"' EXIT

commit=$(git -C "$checkout" rev-parse --short HEAD)
if [ -n "$(git -C "$checkout" status --porcelain)" ]; then
  echo "warning: the checkout has uncommitted changes; they are not installed, only $commit is" >&2
fi
git -C "$checkout" archive --format=tar HEAD | tar -x -C "$build"
(cd "$build" && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent) >&2

if [ "$dry_run" = true ]; then
  HOME=$(mktemp -d "${TMPDIR:-/tmp}/yt-digest-dry-run.XXXXXX")
fi
home=$(cd "${HOME:?}" && pwd -P)
data="$home/Library/Application Support/yt-digest"
app="$data/app"

# Copy into a new folder next to the app, swapped in once everything is ready.
rm -rf "$app.new"
for program in native-host worker extension; do
  mkdir -p "$app.new/$program"
  cp -R "$build/$program/dist" "$app.new/$program/dist"
done
mkdir -p "$app.new/prompt"
cp "$build/prompt/digest.md" "$app.new/prompt/digest.md"

# Chrome and launchd start the programs with a minimal PATH, so the launcher and the agent name Node by its full path.
# Run this again after changing the Node version.
node=$(command -v node) || { echo "error: node is not on PATH" >&2; exit 1; }
node=$(cd "$(dirname "$node")" && pwd -P)/$(basename "$node")

# Each path in single quotes, with any single quote in it closed, escaped and reopened.
quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}
printf '#!/bin/sh\nexec %s %s "$@"\n' "$(quote "$node")" "$(quote "$app/native-host/dist/host.js")" \
  >"$app.new/native-host/yt-digest-host"
chmod 755 "$app.new/native-host/yt-digest-host"

# Chrome's manifest and the agent are written in the build folder first, so a failure before the swap below leaves the
# installed yt-digest as it was. The manifest, made from the template, allows only the extension whose ID its key
# gives. Node writes the JSON, so a path with a quote or a backslash in it is escaped correctly.
registration="$build/registration"
mkdir -p "$registration"
"$node" -e '
  const [template, extensionManifest, destination, launcher] = process.argv.slice(1);
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  // Chrome derives an extension ID from its key: the first 32 hex digits of its SHA-256, with 0-f written as a-p.
  const key = Buffer.from(JSON.parse(fs.readFileSync(extensionManifest, "utf8")).key, "base64");
  const hex = crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
  const extensionId = [...hex].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join("");
  const manifest = JSON.parse(fs.readFileSync(template, "utf8"));
  manifest.path = launcher;
  manifest.allowed_origins = [`chrome-extension://${extensionId}/`];
  fs.writeFileSync(`${destination}/${manifest.name}.json`, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`The native host ${manifest.name} allows chrome-extension://${extensionId}/`);
' "$build/native-host/manifest.template.json" "$build/extension/manifest.json" "$registration" \
  "$app/native-host/yt-digest-host"

# launchd's own PATH has none of yt-dlp, claude or heptabase, so the agent gets the developer's, without the folders
# npm adds for this run: the checkout's node_modules/.bin and npm's own helpers.
worker_path=
old_ifs=$IFS
IFS=:
for folder in $PATH; do
  case "$folder" in
    "" | "$checkout" | "$checkout"/* | */node_modules/* | */node_modules) continue ;;
  esac
  worker_path=${worker_path:+$worker_path:}$folder
done
IFS=$old_ifs

# Escapes a value for XML text, then for the replacement side of sed.
escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/[\\|&]/\\&/g'
}
label=local.yt-digest.worker
sed -e "s|@NODE@|$(escape "$node")|g" \
  -e "s|@WORKER@|$(escape "$app/worker/dist/worker.js")|g" \
  -e "s|@PATH@|$(escape "$worker_path")|g" \
  -e "s|@DATA@|$(escape "$data")|g" \
  "$build/worker/launchd/$label.plist" >"$registration/$label.plist"
# plutil is macOS's; CI's Linux runner has none.
if command -v plutil >/dev/null; then plutil -lint "$registration/$label.plist" >/dev/null; fi

rm -rf "$app"
mv "$app.new" "$app"
echo "Installed $commit into $app"
manifest_dir="$home/Library/Application Support/Google/Chrome/NativeMessagingHosts"
plist="$home/Library/LaunchAgents/$label.plist"
mkdir -p "$manifest_dir" "$data/queue" "$data/logs" "$home/Library/LaunchAgents"
cp "$registration/com.yt_digest.host.json" "$manifest_dir/"
cp "$registration/$label.plist" "$plist"
echo "Registered the native host in $manifest_dir"

if [ "$dry_run" = true ]; then
  echo "Dry run: installed into $home, which is kept for you to inspect; launchctl was not run."
  echo "Files:"
  (cd "$home" && find . -type f | sort)
  exit 0
fi
# Unload an earlier copy first, so launchd reads the new one.
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
# launchd can take a moment to finish unloading, and refuses the new copy until it has.
tries=0
until launchctl bootstrap "gui/$(id -u)" "$plist"; do
  tries=$((tries + 1))
  if [ "$tries" -ge 5 ]; then echo "error: launchctl could not load $plist" >&2; exit 1; fi
  sleep 1
done
echo "Loaded $label; the worker's log is $data/logs/worker.log"
echo
echo "Chrome loads the extension from $app/extension/dist."
echo "After an update, press Reload on yt-digest in chrome://extensions."
