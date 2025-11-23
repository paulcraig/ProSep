#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(dirname "$0")"
source "$BASE_DIR/prosep-config.sh"

# ---> Sub-commands <--- #

stop_app() {
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
}

restart_app() {
  echo "Restarting backend and Apache..."

  TIMER_STATE="$(systemctl is-active "$DEPLOY_TIMER" || true)"
  if [[ "$TIMER_STATE" != "active" ]]; then
    echo "Deploy timer inactive; enabling..."
    sudo systemctl enable --now "$DEPLOY_TIMER"
  fi

  echo "Restarting backend..."
  sudo systemctl restart "$BACKEND_SERVICE"

  echo "Reloading Apache..."
  if systemctl is-active --quiet "$APACHE_SERVICE"; then
    sudo systemctl reload "$APACHE_SERVICE"
  else
    sudo systemctl start "$APACHE_SERVICE"
  fi

  echo "Restart complete."
}

show_help() {
  cat <<EOF
Usage: $(basename "$0") <command> [options]

Commands:
  stop                 Shutdown backend, Apache, and disable deploy timer.
  restart              Restart backend + reload Apache and ensure deploy timer enabled.
  deploy [options]     Forwarded to prosep-deploy.sh.
  status [options]     Forwarded to prosep-status.sh.
  help                 Show this help message.

Use '$(basename "$0") deploy --help' or '$(basename "$0") status --help'
to see subcommand-specific options.
EOF
}

# ---> Dispatcher <--- #

CMD="${1:-}"

case "$CMD" in
  stop)
    stop_app
    ;;

  restart)
    restart_app
    ;;

  deploy)
    shift
    exec "$BASE_DIR/prosep-deploy.sh" "$@"
    ;;

  status)
    shift
    exec "$BASE_DIR/prosep-status.sh" "$@"
    ;;

  help|--help|-h|"")
    show_help
    ;;

  *)
    echo "Unknown command: $CMD"
    echo "Try: $(basename "$0") help"
    exit 1
    ;;
esac
