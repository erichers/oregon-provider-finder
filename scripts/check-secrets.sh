#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail=0
report() {
  echo "check-secrets: $1" >&2
  fail=1
}

# Fragments are split so this file does not contain a key prefix.
# Shapes require a tail so lockfile hashes do not trip the check.
shapes=(
  "gsk""_"'[A-Za-z0-9]{8,}'
  "nvapi""-"'[A-Za-z0-9_-]{8,}'
  "csk""-"'[A-Za-z0-9]{8,}'
  "AI""za"'[A-Za-z0-9_-]{8,}'
  "sk""-"'[A-Za-z0-9]{16,}'
  "Pass""word=""[^[:space:]]+"
  "Pw""d=""[^[:space:]]+"
)
frida_home="${HOME}/Sites/""frida"
frida_abs="/Users/""eric/Sites/""frida"

scan_text() {
  local label="$1"
  local text="$2"
  local n
  for n in "${shapes[@]}"; do
    if printf '%s' "$text" | grep -I -E -q -- "$n"; then
      report "forbidden pattern in $label"
    fi
  done
  if printf '%s' "$text" | grep -I -F -q -- "$frida_home"; then
    report "local frida path in $label"
  fi
  if printf '%s' "$text" | grep -I -F -q -- "$frida_abs"; then
    report "local frida path in $label"
  fi
}

scan_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  case "$f" in
    */package-lock.json|package-lock.json|*/pnpm-lock.yaml|*/yarn.lock) return 0 ;;
  esac
  scan_text "$f" "$(cat "$f")"
}

if [ ! -t 0 ]; then
  scan_text "stdin" "$(cat)"
else
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    report "not a git repository"
  elif [ "${1:-}" = "--history" ]; then
    scan_text "git history" "$(git log -p -- . ':(exclude)package-lock.json' ':(exclude)web/package-lock.json')"
  else
    staged="$(git diff --cached --name-only --diff-filter=ACMR || true)"
    if [ -n "$staged" ]; then
      while IFS= read -r f; do
        scan_file "$f"
      done <<< "$staged"
    else
      while IFS= read -r f; do
        scan_file "$f"
      done < <(git ls-files)
    fi
  fi
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "check-secrets: ok"
