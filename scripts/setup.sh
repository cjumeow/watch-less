#!/bin/sh
# Checks the tools yt-digest runs on this Mac, and offers to install the ones Homebrew or uv can:
#
#   npm run setup              # check, offer to install what is missing, and say what to do by hand
#   npm run setup -- --check   # check only, installing nothing; exits 1 when yt-digest cannot run (install-local runs it)
#
# yt-digest needs Node.js 24, yt-dlp, the Heptabase CLI, and Claude Code or Codex CLI signed in with a subscription.
# ffmpeg and mlx_whisper are needed only for a video without subtitles, which is transcribed on this Mac.
set -u

check_only=false
case "${1-}" in
  "") ;;
  --check) check_only=true ;;
  *) echo "usage: $0 [--check]" >&2; exit 64 ;;
esac

ready=true
brew_missing=""
whisper_missing=false

ok() { printf '  ok       %s\n' "$1"; }
missing() { printf '  missing  %s\n           %s\n' "$1" "$2"; ready=false; }
optional() { printf '  missing  %s (optional)\n           %s\n' "$1" "$2"; }
has() { command -v "$1" >/dev/null 2>&1; }

echo "yt-digest's tools:"

if has node && node --version | grep -q '^v24\.'; then
  ok "Node.js $(node --version)"
else
  missing "Node.js 24" "Install it with nvm (nvm install 24) or Homebrew (brew install node@24)."
fi

if has yt-dlp; then
  ok "yt-dlp"
else
  missing "yt-dlp, which reads a video's details and subtitles" "brew install yt-dlp"
  brew_missing="$brew_missing yt-dlp"
fi

if has heptabase; then
  ok "Heptabase CLI"
else
  missing "Heptabase CLI, which files the digest" \
    "In the Heptabase app's settings, install the CLI and turn on the Local CLI Server."
fi

# A digest is written with the developer's own plan, never an API key, so only a subscription sign-in counts.
plans=0
if has claude; then
  status=$(claude auth status 2>/dev/null || true)
  if printf '%s' "$status" | grep -q '"loggedIn": *true'; then
    if printf '%s' "$status" | grep -qi '"authMethod": *"[^"]*api'; then
      optional "Claude Code signed in with a Claude plan" \
        "It is signed in with an API key, which yt-digest never uses: claude auth login with your Claude account."
    else
      ok "Claude Code, signed in"
      plans=$((plans + 1))
    fi
  else
    optional "Claude Code signed in" "claude auth login"
  fi
fi
if has codex; then
  if codex login status 2>&1 | grep -q 'ChatGPT'; then
    ok "Codex CLI, signed in with ChatGPT"
    plans=$((plans + 1))
  else
    optional "Codex CLI signed in with ChatGPT" "codex login"
  fi
fi
if [ "$plans" -eq 0 ]; then
  missing "Claude Code or Codex CLI, signed in with your plan, which writes the digest" \
    "Install Claude Code and run claude auth login, or install Codex CLI and run codex login."
fi

if has ffmpeg; then
  ok "ffmpeg"
else
  optional "ffmpeg, for videos without subtitles" "brew install ffmpeg"
  brew_missing="$brew_missing ffmpeg"
fi
if has mlx_whisper; then
  ok "mlx_whisper"
else
  optional "mlx_whisper, which transcribes videos without subtitles on Apple Silicon" "uv tool install mlx-whisper"
  whisper_missing=true
fi
if ! has ffmpeg || ! has mlx_whisper; then
  echo "           Without them, a video without subtitles fails; every other video works."
fi

if [ "$check_only" = false ] && { [ -n "$brew_missing" ] || [ "$whisper_missing" = true ]; }; then
  install=""
  [ -n "$brew_missing" ] && has brew && install="brew install${brew_missing}"
  if [ "$whisper_missing" = true ] && has uv; then
    install="${install:+$install && }uv tool install mlx-whisper"
  fi
  if [ -n "$install" ]; then
    printf '\nInstall the missing tools now with: %s ? [y/N] ' "$install"
    read -r answer || answer=""
    case "$answer" in
      y | Y | yes)
        [ -n "$brew_missing" ] && has brew && brew install $brew_missing
        [ "$whisper_missing" = true ] && has uv && uv tool install mlx-whisper
        echo
        exec /bin/sh "$0" --check
        ;;
    esac
  else
    echo
    echo "Homebrew (https://brew.sh) or uv installs these; neither is on PATH."
  fi
fi

echo
if [ "$ready" = true ]; then
  echo "Ready: run npm run install-local."
else
  echo "Not ready: install what is missing above, then run npm run setup again."
  exit 1
fi
