#!/usr/bin/env bash
# Open a generated decision site in the operator's browser.
# Usage: open-site.sh [--no-open] <path-to-index.html>
# Env:   OPEN_SITE_DISABLE=1   never open, only print the URL
#        OPEN_SITE_OS=darwin|linux|wsl|msys|none   override OS detection
#        OPEN_SITE_DRY_RUN=1   print "would run: <opener> <path>" instead of running
# The last stdout line is always the absolute file:// URL. Exit 2 if the file is missing.

noopen=0
file=""
for arg in "$@"; do
  case "$arg" in
    --no-open) noopen=1 ;;
    -h|--help) echo "usage: open-site.sh [--no-open] <path-to-index.html>"; exit 0 ;;
    *) file="$arg" ;;
  esac
done

if [ -z "$file" ]; then
  echo "usage: open-site.sh [--no-open] <path-to-index.html>" >&2
  exit 2
fi
if [ ! -f "$file" ]; then
  echo "open-site: file not found: $file" >&2
  exit 2
fi

dir=$(cd "$(dirname "$file")" && pwd -P) || exit 2
abs="$dir/$(basename "$file")"
enc=$(printf '%s' "$abs" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' -e 's/?/%3F/g')
url="file://$enc"

detect_os() {
  if [ -n "${OPEN_SITE_OS:-}" ]; then echo "$OPEN_SITE_OS"; return; fi
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo darwin ;;
    MINGW*|MSYS*|CYGWIN*) echo msys ;;
    Linux)
      if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
        echo wsl
      else
        echo linux
      fi ;;
    *) echo none ;;
  esac
}
os=$(detect_os)

skip=""
if [ "$noopen" = 1 ]; then skip="--no-open given"
elif [ "${OPEN_SITE_DISABLE:-}" = 1 ]; then skip="OPEN_SITE_DISABLE=1"
elif [ "$os" = none ]; then skip="no opener available"
elif [ "$os" = linux ] && [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  skip="no GUI session (DISPLAY/WAYLAND_DISPLAY unset)"
elif [ "$os" != darwin ] && [ -n "${SSH_CONNECTION:-}${SSH_TTY:-}" ]; then
  skip="SSH session (no local GUI)"
fi

if [ -n "$skip" ]; then
  echo "Not opened ($skip). Open this URL in a browser:"
  echo "$url"
  exit 0
fi

# Pick the opener: prints "<cmd> <arg>..." with the target as the final word.
case "$os" in
  darwin) opener="open" ; target="$abs" ;;
  linux)  opener="xdg-open" ; target="$abs" ;;
  wsl)
    if command -v wslview >/dev/null 2>&1 || [ -n "${OPEN_SITE_DRY_RUN:-}" ]; then
      opener="wslview"; target="$abs"
    else
      opener="explorer.exe"; target="$url"
    fi ;;
  msys)   opener="cmd.exe /c start \"\"" ; target="$abs" ;;
  *)
    echo "Not opened (unknown OS '$os'). Open this URL in a browser:"
    echo "$url"; exit 0 ;;
esac

if [ -n "${OPEN_SITE_DRY_RUN:-}" ]; then
  echo "would run: $opener $target"
  echo "$url"
  exit 0
fi

bin=${opener%% *}
if ! command -v "$bin" >/dev/null 2>&1; then
  echo "Not opened ($bin not found). Open this URL in a browser:"
  echo "$url"
  exit 0
fi

case "$os" in
  msys) cmd.exe /c start "" "$target" >/dev/null 2>&1 ;;
  *)    "$bin" "$target" >/dev/null 2>&1 & ;;
esac
echo "Opened in your browser."
echo "$url"
exit 0
