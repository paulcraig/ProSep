#!/usr/bin/env bash

source "$(dirname "$0")/prosep-config.sh"
set -euo pipefail

FORCE_REBUILD=false
FORCE_TAG=""

LOCK_VERSION=false
UNLOCK=false
LOCK_TAG=""

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
    --lock-version)
      LOCK_VERSION=true
      if [[ -n "${2:-}" && ! "${2:-}" =~ ^-- ]]; then
        LOCK_TAG="$2"
        shift
      fi
      ;;
    --unlock-version)
      UNLOCK=true
      ;;
    --help)
      cat <<EOF
Usage: $(basename "$0") [--force-rebuild [TAG]] [--lock-version [TAG]] [--unlock-version] [--help]

Version locking:
  --lock-version [TAG]  Lock current deployment to TAG. If TAG provided and not pre-deployed, lock and deploy.
  --unlock-version      Remove lock. Future deployments follow the latest tag.

EOF
      exit 0
      ;;
    *)
      echo "Usage: $0 [--force-rebuild [TAG]] [--lock-version [TAG]] [--unlock-version] [--help]"
      exit 1
      ;;
  esac
  shift
done


# ---> Get current state <--- #

CURRENT_STATE="$(cat "$STATE_FILE" 2>/dev/null || echo "")"
CURRENT_TAG="$CURRENT_STATE"

is_locked=false

if [[ "$CURRENT_STATE" =~ ^(.+)-locked$ ]]; then
  CURRENT_TAG="${BASH_REMATCH[1]}"
  is_locked=true
fi


# ---> Handle unlock-version <--- #

if [[ "$UNLOCK" == true ]]; then
  if [[ "$is_locked" == false ]]; then
    echo "Nothing to unlock."
    exit 0
  fi

  echo "$CURRENT_TAG" | sudo tee "$STATE_FILE" >/dev/null
  exit 0
fi


# ---> Handle lock-version <--- #

if [[ "$LOCK_VERSION" == true ]]; then
  if [[ -z "$LOCK_TAG" ]]; then
    if [[ -z "$CURRENT_TAG" ]]; then
      echo "Cannot lock: Current tag does not exist."
      exit 1
    fi
    LOCK_TAG=$CURRENT_TAG
  else
    if ! git -C "$REPO_DIR" rev-parse "$LOCK_TAG" >/dev/null 2>&1; then
      echo "Cannot lock: Tag '$LOCK_TAG' does not exist."
      exit 1
    fi
  fi

  echo "${LOCK_TAG}-locked" | sudo tee "$STATE_FILE" >/dev/null
  echo "Locked version: Tag '$LOCK_TAG'"

  if [[ "$CURRENT_TAG" == "$LOCK_TAG" ]]; then
    exit 0
  fi

  FORCE_REBUILD=true
  FORCE_TAG=$LOCK_TAG
fi

# ---> Deployment path (normal or forced) <--- #

cd "$REPO_DIR"
git fetch origin --tags
git checkout main
git pull origin main


# ---> Determine target tag <--- #

if [[ "$is_locked" == true ]]; then
  TARGET_TAG="$CURRENT_TAG"
else
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
fi

# ---> Skip if up to date and not forced <--- #

if [[ "$FORCE_REBUILD" == false && "$TARGET_TAG" == "$CURRENT_TAG" ]]; then
  echo "Already latest: ($TARGET_TAG). Nothing to do."
  exit 0
fi

# ---> Deploy <--- #

echo "Deploying $TARGET_TAG"
git -c advice.detachedHead=false checkout -f "$TARGET_TAG"

pushd frontend/jbio-app >/dev/null
rm -rf node_modules build || true
npm ci --force
npm run build
popd >/dev/null

TMP_DIR="$(mktemp -d)"
rsync -a --delete frontend/jbio-app/build/ "$TMP_DIR/"
sudo rsync -a --delete "$TMP_DIR/" "$WWW_DIR/"
rm -rf "$TMP_DIR"

echo "Installing Python requirements..."
python3 -m pip install -r requirements.txt

echo "Starting backend..."
sudo systemctl restart "$BACKEND_SERVICE"

# ---> Finalize <--- #

if [[ "$is_locked" == false ]]; then
  echo "$TARGET_TAG" | sudo tee "$STATE_FILE" >/dev/null
fi
sudo systemctl reload "$APACHE_SERVICE"

echo "Deployed: ($TARGET_TAG)."
