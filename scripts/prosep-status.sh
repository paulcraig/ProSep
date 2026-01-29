#!/usr/bin/env bash

source "$(dirname "$0")/prosep-config.sh"
set -euo pipefail

REPAIR=false

# ---> Parse Flags <--- #

if [[ "${1:-}" == "--repair" ]]; then
  REPAIR=true
elif [[ "${1:-}" == "--help" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--repair | --help]

Without arguments:
  Shows current ProSep deployment status including:
    - Git tags
    - Apache, backend, and frontend service health
    - Systemd timer/service states

Options:
  --repair    Attempt to fix any detected service or deployment issues.
  --help      Show this help message.

Examples:
  $(basename "$0")          # Show deployment status
  $(basename "$0") --repair # Attempt automatic repair
EOF
  exit 0
fi

# ---> Status Mode <--- #

if ! $REPAIR; then
  echo
  echo "=== ProSep Deployment Status ==="
  echo

  # ---> Git Tags <--- #
  
  cd "$REPO_DIR"
  git fetch --tags >/dev/null 2>&1
  LATEST_TAG="$(git tag --sort=version:refname | tail -n1 || true)"
  
  if [[ -z "$LATEST_TAG" ]]; then
    LATEST_TAG="(no tags, using HEAD)"
  fi
  
  echo "Remote tag: $LATEST_TAG"

  if [[ -f "$STATE_FILE" ]]; then
    echo "Deployed tag: $(cat "$STATE_FILE")"
  else
    echo "Deployed tag: (none found)"
  fi

  echo
  
  # ---> Apache <--- #
  
  if systemctl is-active --quiet "$APACHE_SERVICE"; then
    echo "Apache: RUNNING"
  else
    echo "Apache: NOT RUNNING"
  fi

  # ---> Backend <--- #
  
  if systemctl is-active --quiet "$BACKEND_SERVICE"; then
    echo "Backend: RUNNING (systemd)"
  else
    echo "Backend: NOT RUNNING"
  fi

  # ---> Frontend <--- #
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
  
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "Frontend: RUNNING @$FRONTEND_URL"
  else
    echo "Frontend: NOT RUNNING @$FRONTEND_URL [HTTP $HTTP_CODE]"
  fi

  echo
  
  # ---> Deploy Timer <--- #
  
  if systemctl is-active --quiet "$DEPLOY_TIMER"; then
    echo "$DEPLOY_TIMER: ACTIVE"
  else
    echo "$DEPLOY_TIMER: INACTIVE"
  fi
  
  if systemctl is-enabled --quiet "$DEPLOY_TIMER"; then
    echo "$DEPLOY_TIMER: ENABLED"
  else
    echo "$DEPLOY_TIMER: DISABLED"
  fi

  # ---> Deploy Service <--- #
  
  if systemctl is-active --quiet "$DEPLOY_SERVICE"; then
    echo "$DEPLOY_SERVICE: ACTIVE"
  else
    echo "$DEPLOY_SERVICE: INACTIVE"
  fi

  echo
  echo "=== End of Status ==="
  echo
  exit 0
fi

# ---> Repair Mode <--- #

FAILED=false
REPAIR_HEADER_SHOWN=false

show_repair_header() {
  if ! $REPAIR_HEADER_SHOWN; then
    echo
    echo "=== ProSep Deployment Repair ==="
    REPAIR_HEADER_SHOWN=true
  fi
}

# Apache:
if ! systemctl is-active --quiet "$APACHE_SERVICE"; then
  show_repair_header
  echo "Attempting Apache restart..."
  
  if sudo systemctl restart "$APACHE_SERVICE" && systemctl is-active --quiet "$APACHE_SERVICE"; then
    echo "Apache restart: SUCCESS"
  else
    echo "Apache restart: FAILED"
    FAILED=true
  fi
fi

# Backend:
if ! systemctl is-active --quiet "$BACKEND_SERVICE"; then
  show_repair_header
  echo "Attempting Backend restart..."
  
  sudo systemctl restart "$BACKEND_SERVICE"
  sleep 2
  
  if systemctl is-active --quiet "$BACKEND_SERVICE"; then
    echo "Backend restart: SUCCESS"
  else
    echo "Backend restart: FAILED"
    FAILED=true
  fi
fi

# Frontend:
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")

if [[ "$HTTP_CODE" != "200" ]]; then
  show_repair_header
  echo "Rebuilding unresponsive frontend (HTTP $HTTP_CODE)..."
  
  pushd frontend/jbio-app >/dev/null
  rm -rf node_modules build || true
  
  if npm ci --force && npm run build; then
    popd >/dev/null
    TMP_DIR="$(mktemp -d)"
    rsync -a --delete frontend/jbio-app/build/ "$TMP_DIR/"
    
    if sudo rsync -a --delete "$TMP_DIR/" "$WWW_DIR/"; then
      rm -rf "$TMP_DIR"
      echo "Frontend rebuild: SUCCESS"
    else
      echo "Frontend rsync: FAILED"
      FAILED=true
    fi
  else
    popd >/dev/null
    echo "Frontend rebuild: FAILED"
    FAILED=true
  fi
fi

# Timer:
if ! systemctl is-enabled --quiet "$DEPLOY_TIMER"; then
  show_repair_header
  echo "Enabling timer..."
  
  if sudo systemctl enable "$DEPLOY_TIMER"; then
    echo "Timer enable: SUCCESS"
  else
    echo "Timer enable: FAILED"
    FAILED=true
  fi
fi

if ! systemctl is-active --quiet "$DEPLOY_TIMER"; then
  show_repair_header
  echo "Starting inactive timer..."
  
  if sudo systemctl start "$DEPLOY_TIMER" && systemctl is-active --quiet "$DEPLOY_TIMER"; then
    echo "Timer start: SUCCESS"
  else
    echo "Timer start: FAILED"
    FAILED=true
  fi
fi

if $FAILED; then
  echo
  echo "=== FAILED to repair ALL issues ==="
  echo
  exit 1
else
  if $REPAIR_HEADER_SHOWN; then
    echo "=== SUCCESSFULLY repaired ALL issues ==="
    echo
  else
    echo "Nothing to repair :)"
  fi
  exit 0
fi
