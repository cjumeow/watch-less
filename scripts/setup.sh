#!/bin/sh
# Sets yt-digest up on this Mac in one command, from a clone of the repository:
#
#   sh scripts/setup.sh            # install the missing tools, sign in, then install yt-digest itself
#   sh scripts/setup.sh --check    # check only, installing nothing; exits 1 when yt-digest cannot run
#
# It runs before Node.js may be there, so it is plain sh and `npm run setup` only calls it. It lists everything it
# would install and asks once; Homebrew installs Node.js 24, yt-dlp, ffmpeg, uv and terminal-notifier, uv installs mlx_whisper, and npm
# installs Claude Code or Codex CLI. Notion's CLI, ntn, is optional (Heptabase is the default destination): it is
# never installed for you, since its installer is a script piped from the web, but its sign-in is offered. Two steps stay with the developer, and it says how: turning on Heptabase's CLI,
# which has no command, and loading the extension in Chrome, which Chrome allows no program to do.
set -u

check_only=false
case "${1-}" in
  "") ;;
  --check) check_only=true ;;
  *) echo "usage: $0 [--check]" >&2; exit 64 ;;
esac

checkout=$(cd "$(dirname "$0")/.." && pwd -P)
has() { command -v "$1" >/dev/null 2>&1; }
ask() {
  # $1 the question, $2 the default answer; reads the developer's answer from stdin.
  printf '%s ' "$1"
  read -r answer || answer=""
  [ -n "$answer" ] || answer=$2
}
node_ok() { has node && node --version | grep -q '^v24\.'; }
# A digest is written with the developer's own plan, never an API key, so only a subscription sign-in counts.
claude_signed_in() {
  status=$(claude auth status 2>/dev/null || true)
  printf '%s' "$status" | grep -q '"loggedIn": *true' && ! printf '%s' "$status" | grep -qi '"authMethod": *"[^"]*api'
}
codex_signed_in() { codex login status 2>&1 | grep -q 'ChatGPT'; }
# ntn doctor reports in words that may change in a beta CLI, so ask Notion who the login is: it fails when signed out.
# stdin is closed because ntn waits forever on one that stays open.
ntn_signed_in() { ntn api v1/users/me </dev/null >/dev/null 2>&1; }
signed_in() { { has claude && claude_signed_in; } || { has codex && codex_signed_in; }; }

# Prints each tool as ok or missing, and sets `ready` to false when yt-digest cannot run.
report() {
  ready=true
  ok() { printf '  ok       %s\n' "$1"; }
  missing() { printf '  missing  %s\n           %s\n' "$1" "$2"; ready=false; }
  optional() { printf '  missing  %s (optional)\n           %s\n' "$1" "$2"; }

  echo "yt-digest's tools:"
  if node_ok; then ok "Node.js $(node --version)"; else missing "Node.js 24" "brew install node@24"; fi
  if has yt-dlp; then ok "yt-dlp"; else missing "yt-dlp, which reads a video's details and subtitles" "brew install yt-dlp"; fi
  if has heptabase; then
    ok "Heptabase CLI"
  else
    missing "Heptabase CLI, which files the digest" \
      "In the Heptabase app's settings, install the CLI and turn on the Local CLI Server."
  fi
  if has claude; then
    if claude_signed_in; then
      ok "Claude Code, signed in"
    elif printf '%s' "$(claude auth status 2>/dev/null || true)" | grep -q '"loggedIn": *true'; then
      optional "Claude Code signed in with a Claude plan" \
        "It is signed in with an API key, which yt-digest never uses: claude auth login with your Claude account."
    else
      optional "Claude Code signed in" "claude auth login"
    fi
  fi
  if has codex; then
    if codex_signed_in; then ok "Codex CLI, signed in with ChatGPT"; else optional "Codex CLI signed in with ChatGPT" "codex login"; fi
  fi
  if ! signed_in; then
    missing "Claude Code or Codex CLI, signed in with your plan, which writes the digest" \
      "npm install -g @anthropic-ai/claude-code, then claude auth login; or npm install -g @openai/codex, then codex login."
  fi
  if has ntn; then
    if ntn_signed_in; then ok "Notion CLI, signed in"; else optional "Notion CLI signed in, to save digests to Notion" "ntn login"; fi
  else
    optional "Notion CLI (ntn), to save digests to Notion instead of Heptabase" \
      "curl -fsSL https://ntn.dev | bash, then ntn login"
  fi
  if has terminal-notifier; then
    ok "terminal-notifier"
  else
    optional "terminal-notifier, so clicking a notification opens the digest" "brew install terminal-notifier"
  fi
  if has ffmpeg; then ok "ffmpeg"; else optional "ffmpeg, for videos without subtitles" "brew install ffmpeg"; fi
  if has mlx_whisper; then
    ok "mlx_whisper"
  else
    optional "mlx_whisper, which transcribes videos without subtitles on Apple Silicon" "uv tool install mlx-whisper"
  fi
  if ! has ffmpeg || ! has mlx_whisper; then
    echo "           Without them, a video without subtitles fails; every other video works."
  fi
}

if [ "$check_only" = true ]; then
  report
  echo
  if [ "$ready" = true ]; then echo "Ready: run npm run install-local."; exit 0; fi
  echo "Not ready: run sh scripts/setup.sh to install what is missing."
  exit 1
fi

# 1. Work out what to install.
brew_formulas=""
node_ok || brew_formulas="$brew_formulas node@24"
has yt-dlp || brew_formulas="$brew_formulas yt-dlp"
has ffmpeg || brew_formulas="$brew_formulas ffmpeg"
notifier=false
if ! has terminal-notifier; then
  notifier=true
  brew_formulas="$brew_formulas terminal-notifier"
fi
whisper=false
if ! has mlx_whisper; then
  whisper=true
  has uv || brew_formulas="$brew_formulas uv"
fi
cli=""
if ! has claude && ! has codex; then
  ask "Which writes your summaries, claude or codex? [claude]" claude
  case "$answer" in
    codex) cli=@openai/codex ;;
    *) cli=@anthropic-ai/claude-code ;;
  esac
fi

# 2. Install it, after one yes.
if [ -n "$brew_formulas" ] || [ "$whisper" = true ] || [ -n "$cli" ]; then
  if [ -n "$brew_formulas" ] && ! has brew; then
    echo "Homebrew installs${brew_formulas}; install it first from https://brew.sh, then run this again."
    exit 1
  fi
  echo "yt-digest will install:"
  [ -n "$brew_formulas" ] && echo "  brew install${brew_formulas}"
  [ "$whisper" = true ] && echo "  uv tool install mlx-whisper"
  [ -n "$cli" ] && echo "  npm install -g $cli"
  ask "Install them now? [y/N]" n
  case "$answer" in
    y | Y | yes) ;;
    *) echo "Nothing installed."; exit 1 ;;
  esac
  if [ -n "$brew_formulas" ]; then
    # shellcheck disable=SC2086 -- one formula per word.
    brew install $brew_formulas || exit 1
  fi
  # Homebrew keeps node@24 off PATH, so the rest of this run, and the PATH install-local gives the worker, add it.
  if ! node_ok && has brew; then
    PATH="$(brew --prefix node@24)/bin:$PATH"
    export PATH
    node_added=true
  fi
  if [ "$whisper" = true ]; then uv tool install mlx-whisper || exit 1; fi
  # macOS asks whether terminal-notifier may show notifications only when it starts as an app, never when the worker
  # runs it in the background, so start it once here.
  if [ "$notifier" = true ] && has brew; then
    open -a "$(brew --prefix terminal-notifier)/terminal-notifier.app" --args -title yt-digest \
      -message "Allow notifications, so a finished digest can tell you." 2>/dev/null || true
    echo "When macOS asks, allow notifications from terminal-notifier."
  fi
  if [ -n "$cli" ]; then npm install -g "$cli" || exit 1; fi
fi

# 3. Sign in with a plan, which needs the developer in a browser.
if ! signed_in; then
  for tool in claude codex; do
    has "$tool" || continue
    ask "Sign in to $tool with your plan now? [Y/n]" y
    case "$answer" in
      n | N | no) continue ;;
    esac
    if [ "$tool" = claude ]; then claude auth login; else codex login; fi
    signed_in && break
  done
fi

if has ntn && ! ntn_signed_in; then
  ask "Sign in to Notion with ntn login now, to save digests there? [y/N]" n
  case "$answer" in
    y | Y | yes) ntn login ;;
  esac
fi

# 4. Install yt-digest itself, once every tool it needs is there.
echo
report
echo
if [ "$ready" = false ]; then
  echo "Not ready: finish what is missing above, then run sh scripts/setup.sh again."
  exit 1
fi
(cd "$checkout" && npm install --no-audit --no-fund && npm run install-local) || exit 1

echo
echo "Last step, once: in chrome://extensions, turn on Developer mode, press Load unpacked and pick"
echo "  $HOME/Library/Application Support/yt-digest/app/extension/dist"
if [ "${node_added-false}" = true ]; then
  echo "Homebrew's Node.js 24 is not on your PATH yet; add this line to ~/.zprofile:"
  echo "  export PATH=\"$(brew --prefix node@24)/bin:\$PATH\""
fi
