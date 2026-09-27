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
  "Pass""word=""[A-Za-z0-9+/_-]{12,}"
  "Pw""d=""[A-Za-z0-9+/_-]{12,}"
)
frida_home="${HOME}/Sites/""frida"
frida_abs="/Users/""eric/Sites/""frida"

scan_text() {
  local label="$1"
  local text="$2"
  local n
  for n in "${shapes[@]}"; do
    # A here-string, not a pipe. grep -q closes stdin at the first hit, and
    # pipefail would turn that SIGPIPE into a false "no match" on a large file.
    if grep -I -E -q -- "$n" <<<"$text"; then
      report "forbidden pattern in $label"
    fi
  done
  if grep -I -F -q -- "$frida_home" <<<"$text"; then
    report "local frida path in $label"
  fi
  if grep -I -F -q -- "$frida_abs" <<<"$text"; then
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

scan_tracked() {
  while IFS= read -r f; do
    scan_file "$f"
  done < <(git ls-files)
}

mode="${1:-}"
case "$mode" in
  --stdin)
    scan_text "stdin" "$(cat)"
    ;;
  --history)
    scan_text "git history" "$(git log -p -- . ':(exclude)package-lock.json' ':(exclude)web/package-lock.json')"
    ;;
  --tracked)
    scan_tracked
    ;;
  "")
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      report "not a git repository"
    else
      staged="$(git diff --cached --name-only --diff-filter=ACMR || true)"
      if [ -n "$staged" ]; then
        while IFS= read -r f; do
          scan_file "$f"
        done <<< "$staged"
      else
        scan_tracked
      fi
    fi
    ;;
  *)
    report "unknown mode $mode"
    ;;
esac

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "check-secrets: ok"
