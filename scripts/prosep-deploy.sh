#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/shared/ProSep"
WWW_DIR="/var/www/html"
STATE_FILE="/var/www/.deployed_tag"

FORCE_REBUILD=false
RESTART=false
FORCE_TAG=""


# ---> Parse Flags <--- #
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-rebuild)
      FORCE_REBUILD=true
      if [[ -n "${2:-}" && ! "${2:-}" =~ ^-- ]]; then
        FORCE_TAG="$2"
        shift
      fi
      ;;
    --restart)
      RESTART=true
      ;;
    --help)
      cat <<EOF
Usage: $(basename "$0") [--force-rebuild [TAG]] [--restart] [--help]

Default (no flags):
  Checks for new tags. If a newer version is found, redeploys automatically.
  If already at the latest tag, exits without changes.
  If no tags on remote, use the latest commit.

Options:
  --force-rebuild [TAG]  Force a rebuild and deploy. If TAG is provided, deploy it.
                         If TAG does not exist, exit without changes.
                         If TAG isn't provided, use the latest tag on remote.
  --restart              Restart backend (uvicorn) and Apache without rebuilding the frontend.
  --help                 Show this help message.

Examples:
  $(basename "$0")                          # Check for updates and redeploy if needed
  $(basename "$0") --force-rebuild          # Force rebuild with latest tag
  $(basename "$0") --force-rebuild v1.2.0   # Force rebuild specific tag
  $(basename "$0") --restart                # Restart backend and Apache
EOF
      exit 0
      ;;
    *)
      echo "Usage: $0 [--force-rebuild [TAG]] [--restart] [--help]"
      exit 1
      ;;
  esac
  shift
done

# ---> Restart Only Mode <--- #
if [[ "$RESTART" == true ]]; then
  echo "Restarting frontend/backend..."
  pkill -f "uvicorn" || true
  echo "Starting FastAPI backend..."
  nohup python3 -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 > uvicorn.log 2>&1 & # TODO: Switch to service.
  sudo systemctl reload apache2
  echo "Restart complete"
  exit 0
fi

# ---> Update Repo/Pull Latest <--- #
cd "$REPO_DIR"
git fetch origin --tags
git checkout main
git pull origin main

# ---> Determine Target Tag <--- #
if [[ -n "$FORCE_TAG" ]]; then
  if git rev-parse "$FORCE_TAG" >/dev/null 2>&1; then
    TARGET_TAG="$FORCE_TAG"
    echo "Using specified tag: $TARGET_TAG"
  else
    echo "Tag '$FORCE_TAG' not found. Aborting."
    exit 0
  fi
else
  TARGET_TAG="$(git tag --merged origin/main --sort=version:refname | tail -n1 || true)"
  if [[ -z "$TARGET_TAG" ]]; then
    TARGET_TAG="$(git rev-parse origin/main)"
  fi
fi

CURRENT_TAG="$(cat "$STATE_FILE" 2>/dev/null || echo "")"

# Skip if latest unless force rebuild:
if [[ "$FORCE_REBUILD" == false && "$TARGET_TAG" == "$CURRENT_TAG" ]]; then
  echo "Already latest: ($TARGET_TAG). Nothing to do."
  exit 0
fi

# ---> Deploy (default/forced) <--- #
echo "Deploying $TARGET_TAG"
git -c advice.detachedHead=false checkout -f "$TARGET_TAG"

# ---> Build Frontend <--- #
pushd frontend/jbio-app >/dev/null
rm -rf node_modules build || true
npm ci --force
npm run build
popd >/dev/null

TMP_DIR="$(mktemp -d)"
rsync -a --delete frontend/jbio-app/build/ "$TMP_DIR/"
sudo rsync -a --delete "$TMP_DIR/" "$WWW_DIR/"
rm -rf "$TMP_DIR"

# ---> Start Backend <--- #
echo "Installing Python requirements..."
python3 -m pip install -r requirements.txt

echo "Stopping OLD backend (if any)..."
pkill -f "uvicorn" || true

echo "Starting backend..."
nohup python3 -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 > uvicorn.log 2>&1 & # TODO: Switch to service.

# ---> Finalize <--- #
echo "$TARGET_TAG" | sudo tee "$STATE_FILE" >/dev/null
sudo systemctl reload apache2

echo "Deployed: ($TARGET_TAG)."
