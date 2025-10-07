#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/shared/ProSep"
STATE_FILE="/var/www/.deployed_tag"
FRONTEND_URL="http://protein-separation-sim.se.rit.edu/"
BACKEND_PROCESS="uvicorn server:app"
WWW_DIR="/var/www/html"

REPAIR=false


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
  
  if systemctl is-active --quiet apache2; then
    echo "Apache: RUNNING"
  else
    echo "Apache: NOT RUNNING"
  fi

  # ---> Backend <--- #
  
  if pgrep -f "$BACKEND_PROCESS" >/dev/null; then
    PID=$(pgrep -f "$BACKEND_PROCESS" | head -n1)
    echo "Backend: RUNNING @PID $PID"
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
  
  if systemctl is-active --quiet prosep-deploy.timer; then
    echo "prosep-deploy.timer: ACTIVE"
  else
    echo "prosep-deploy.timer: INACTIVE"
  fi
  
  if systemctl is-enabled --quiet prosep-deploy.timer; then
    echo "prosep-deploy.timer: ENABLED"
  else
    echo "prosep-deploy.timer: DISABLED"
  fi

  # ---> Deploy Service <--- #
  
  if systemctl is-active --quiet prosep-deploy.service; then
    echo "prosep-deploy.service: ACTIVE"
  else
    echo "prosep-deploy.service: INACTIVE"
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
if ! systemctl is-active --quiet apache2; then
  show_repair_header
  echo "Attempting Apache restart..."
  
  if sudo systemctl restart apache2 && systemctl is-active --quiet apache2; then
    echo "Apache restart: SUCCESS"
  else
    echo "Apache restart: FAILED"
    FAILED=true
  fi
fi

# Backend:
if ! pgrep -f "$BACKEND_PROCESS" >/dev/null; then
  show_repair_header
  echo "Attempting Backend restart..."
  
  pkill -f "uvicorn" || true
  nohup python3 -m uvicorn server:app --host 127.0.0.1 --port 8000 > uvicorn.log 2>&1 &
  sleep 2
  
  if pgrep -f "$BACKEND_PROCESS" >/dev/null; then
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
if ! systemctl is-enabled --quiet prosep-deploy.timer; then
  show_repair_header
  echo "Enabling timer..."
  
  if sudo systemctl enable prosep-deploy.timer; then
    echo "Timer enable: SUCCESS"
  else
    echo "Timer enable: FAILED"
    FAILED=true
  fi
fi

if ! systemctl is-active --quiet prosep-deploy.timer; then
  show_repair_header
  echo "Starting inactive timer..."
  
  if sudo systemctl start prosep-deploy.timer && systemctl is-active --quiet prosep-deploy.timer; then
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
