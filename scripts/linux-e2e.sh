#!/usr/bin/env bash
# Xvfb supplies pixels; Openbox supplies native pin and fullscreen behavior.
set -euo pipefail
if [[ "${1:-}" != --session ]]; then
  exec dbus-run-session -- xvfb-run -a -s "-screen 0 1920x1080x24" bash "$0" --session "$@"
fi
shift
openbox --sm-disable >/dev/null 2>&1 &
manager=$!
trap 'kill "$manager" 2>/dev/null || true; wait "$manager" 2>/dev/null || true' EXIT
ready=false
for attempt in {1..100}; do
  if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q 'window id'; then
    ready=true
    break
  fi
  sleep 0.05
done
if [[ "$ready" != true ]]; then
  echo 'The Linux E2E window manager did not become ready.' >&2
  exit 1
fi
"$@"
