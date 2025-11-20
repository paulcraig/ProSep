#!/usr/bin/env bash

source "$(dirname "$0")/prosep-config.sh"
set -euo pipefail

RESTART=false
STOP=false

# ---> Parse Flags <--- #

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stop)
      STOP=true
      ;;
    --restart)
      RESTART=true
      ;;
    --help)
      cat <<EOF
Usage: $(basename "$0") [--stop] [--restart] [--help]

--stop
    Disable deploy service, stop backend, stop Apache -> Shutdown the webapp.

--restart
    If deploy service is inactive, activate it. Restart backend, reload Apache.

EOF
      exit 0
      ;;
    *)
      echo "Usage: $0 [--restart] [--stop] [--help]"
      exit 1
      ;;
  esac
  shift
done

# ---> Stop <--- #

if [[ "$STOP" == true ]]; then
  echo "Stopping webapp..."

  echo "Disabling deploy timer..."
  sudo systemctl disable --now "$DEPLOY_TIMER" || true

  echo "Disabling deploy service..."
  sudo systemctl disable --now "$DEPLOY_SERVICE" || true

  echo "Stopping backend..."
  sudo systemctl stop "$BACKEND_SERVICE" || true

  echo "Stopping Apache..."
  sudo systemctl stop "$APACHE_SERVICE" || true

  echo "Stopped."
  exit 0
fi

# ---> Restart <--- #

if [[ "$RESTART" == true ]]; then
  echo "Restarting backend and Apache..."

  TIMER_STATE="$(systemctl is-active "$DEPLOY_TIMER" || true)"

  if [[ "$TIMER_STATE" != "active" ]]; then
    echo "Deploy timer inactive; enabling..."
    sudo systemctl enable --now "$DEPLOY_TIMER"
  fi

  echo "Restarting backend..."
  sudo systemctl restart "$BACKEND_SERVICE"

  echo "Reloading Apache..."
  sudo systemctl reload "$APACHE_SERVICE"

  echo "Restart complete."
  exit 0
fi
