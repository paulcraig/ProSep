#!/usr/bin/env bash

source "$(dirname "$0")/prosep-config.sh"
set -euo pipefail

# ---> Usage:

usage() {
  cat <<EOF
Usage: $(basename "$0") [COMMAND] [OPTIONS]

Commands:
  --deploy | (none)       Check for a newer tag and deploy if one is available.
  --deploy -f [TAG]       Force deploy TAG (or latest). Locks the deployed version.
  --deploy -b <BRANCH>    Deploy a branch at the latest commit. Locks as "b-<commit>-locked".
  --unlock                Unlock the local deployed version.
  --lock                  Lock the local deployed version.
  --help                  Show this message.

Examples:
  $(basename "$0")
  $(basename "$0") --deploy
  $(basename "$0") --deploy -f
  $(basename "$0") --deploy -f v1.8.0
  $(basename "$0") --deploy -b spike/hidden-dev-page
  $(basename "$0") --lock
  $(basename "$0") --unlock

EOF
}

# ---> State Management:

parse_state() { # Sets CURRENT_TAG and IS_LOCKED
  local raw

  raw="$(cat "$STATE_FILE" 2>/dev/null || echo "")"
  IS_LOCKED=false
  CURRENT_TAG=""

  if [[ "$raw" =~ ^(.+)-locked$ ]]; then
    CURRENT_TAG="${BASH_REMATCH[1]}"
    IS_LOCKED=true

  else
    CURRENT_TAG="$raw"
  fi
}

write_state() { echo "$1" | sudo tee "$STATE_FILE" >/dev/null; }

lock_state() { write_state "${1}-locked"; }

unlock_state() { write_state "$1"; }


revert() {
  local prev_ref="$1"
  local prev_state="$2"

  echo "[REVERT] Deploy failed: Attempting to restore previous state..." >&2

  if [[ -n "$prev_ref" ]]; then
    git -C "$REPO_DIR" -c advice.detachedHead=false checkout -f "$prev_ref" 2>/dev/null \
      || echo "[REVERT] Warning: Failed to checkout '$prev_ref'." >&2
  fi

  (
    set -euo pipefail
    cd "$REPO_DIR"

    pushd frontend/jbio-app >/dev/null
    rm -rf node_modules build
    npm ci --force
    npm run build
    popd >/dev/null

    TMP_DIR="$(mktemp -d)"
    rsync -a --delete frontend/jbio-app/build/ "$TMP_DIR/"
    sudo rsync -a --delete "$TMP_DIR/" "$WWW_DIR/"
    rm -rf "$TMP_DIR"

    python3 -m pip install -r requirements.txt
  ) || echo "[REVERT] Restore failed: Manual intervention required." >&2

  [[ -n "$prev_state" ]] && write_state "$prev_state" 2>/dev/null || true
  sudo systemctl start   "$DEPLOY_TIMER"    2>/dev/null || true
  echo "[REVERT] Done." >&2

  sudo systemctl reload  "$APACHE_SERVICE"  2>/dev/null || true
  sudo systemctl restart "$BACKEND_SERVICE" 2>/dev/null || true
}


check_version_base() { # Refuses deployment if <tag> sorts older than BASE_VERSION.
  local candidate="$1"
  local floor_check

  floor_check="$(printf '%s\n%s\n' "$BASE_VERSION" "$candidate" | sort -V | head -n1)"

  if [[ "$floor_check" != "$BASE_VERSION" ]]; then
    echo "[BUILD] Error: '$candidate' is older than the minimum allowed version '$BASE_VERSION'."
    exit 1
  fi
}


do_deploy() { # Requires <git_ref> <new_state_string>
  local ref="$1"
  local new_state="$2"
  local prev_state prev_ref deploy_ok=true

  prev_state="$(cat "$STATE_FILE" 2>/dev/null || echo "")"
  prev_ref="$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "")"

  if [[ ! "$new_state" =~ ^b- ]]; then
    check_version_base "$ref"
  else
    echo "[BUILD] Warning: Branch deploy may overwrite maintenance script functionality." >&2
  fi

  echo "[BUILD] Deploying: $ref"
  sudo systemctl stop "$DEPLOY_TIMER"

  (
    set -euo pipefail
    cd "$REPO_DIR"
    git -c advice.detachedHead=false checkout -f "$ref"

    pushd frontend/jbio-app >/dev/null
    rm -rf node_modules build
    npm ci --force
    npm run build
    popd >/dev/null

    TMP_DIR="$(mktemp -d)"
    rsync -a --delete frontend/jbio-app/build/ "$TMP_DIR/"
    sudo rsync -a --delete "$TMP_DIR/" "$WWW_DIR/"
    rm -rf "$TMP_DIR"

    python3 -m pip install -r requirements.txt
  ) || deploy_ok=false

  if [[ "$deploy_ok" == false ]]; then
    revert "$prev_ref" "$prev_state"
    return 1
  fi

  write_state "$new_state"
  sudo systemctl start "$DEPLOY_TIMER"
  echo "[BUILD] Done."

  sudo systemctl reload  "$APACHE_SERVICE"
  sudo systemctl restart "$BACKEND_SERVICE"
}

# ---> Commands:

cmd_lock() { # --lock
  parse_state

  if [[ -z "$CURRENT_TAG" ]]; then
    echo "[LOCK] Error: No version deployed."
    exit 1
  fi

  if [[ "$IS_LOCKED" == true ]]; then
    echo "[LOCK] Already locked '${CURRENT_TAG}'. Nothing to do."
    exit 0
  fi

  lock_state "$CURRENT_TAG"
  echo "[LOCK] Locked: '${CURRENT_TAG}'."
}


cmd_unlock() { # --unlock
  parse_state

  if [[ "$IS_LOCKED" == false ]]; then
    echo "[LOCK] Already unlocked '${CURRENT_TAG}'. Nothing to do."
    exit 0
  fi

  unlock_state "$CURRENT_TAG"
  echo "[LOCK] Unlocked: '${CURRENT_TAG}'."
}


cmd_auto_deploy() { # Default latest pull: --deploy
  parse_state

  if [[ "$IS_LOCKED" == true ]]; then
    echo "[DEPLOY] Version locked at '${CURRENT_TAG}'. Use --unlock to re-enable auto-updates."
    exit 0
  fi

  cd "$REPO_DIR"
  git fetch origin --tags

  local latest_tag
  latest_tag="$(git tag --merged origin/main --sort=version:refname | tail -n1 || true)"
  [[ -z "$latest_tag" ]] && latest_tag="$(git rev-parse origin/main)"

  if [[ "$latest_tag" == "$CURRENT_TAG" ]]; then
    echo "[DEPLOY] Already latest '$CURRENT_TAG'. Nothing to do."
    exit 0
  fi

  # Verify new remote:
  if [[ -n "$CURRENT_TAG" ]]; then
    local newer
    newer="$(printf '%s\n%s\n' "$CURRENT_TAG" "$latest_tag" | sort -V | tail -n1)"

    if [[ "$newer" != "$latest_tag" ]]; then
      echo "[DEPLOY] Remote tag '$latest_tag' is older than the local '$CURRENT_TAG'. Skipping."
      exit 0
    fi
  fi

  do_deploy "$latest_tag" "$latest_tag"
  echo "[DEPLOY] Deploy complete: '$latest_tag'."
}


cmd_force_deploy() { # Force: --deploy -f [TAG]; deploys TAG (or latest if none) regardless of lock state.
  local tag="${1:-}"

  cd "$REPO_DIR"
  git fetch origin --tags

  if [[ -z "$tag" ]]; then
    tag="$(git tag --merged origin/main --sort=version:refname | tail -n1 || true)"
    [[ -z "$tag" ]] && tag="$(git rev-parse origin/main)"
    echo "[DEPLOY] No tag specified. Using latest: '$tag'."

  else
    if ! git rev-parse "$tag" >/dev/null 2>&1; then
      echo "[DEPLOY] Error: Tag '$tag' not found on remote."
      exit 1
    fi
  fi

  do_deploy "$tag" "${tag}-locked"
  echo "[DEPLOY] Force deploy complete: '$tag' (locked)."
}


cmd_branch_deploy() { # Branch: --deploy -b <BRANCH>; deploys its latest regardless of lock state.
  local branch="$1"

  cd "$REPO_DIR"
  git fetch origin --tags

  if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    echo "[DEPLOY] Error: Branch '$branch' not found on remote."
    exit 1
  fi

  local commit
  local base_commit

  commit="$(git rev-parse --short "origin/$branch")"

  if ! base_commit="$(git rev-parse "$BASE_VERSION" 2>/dev/null)"; then
    echo "[DEPLOY] Error: BASE_VERSION tag '$BASE_VERSION' not found in the repo."
    exit 1
  fi

  if ! git merge-base --is-ancestor "$base_commit" "origin/$branch" 2>/dev/null; then
    echo "[DEPLOY] Error: Branch '$branch' doesn't contain the base version in its history."
    echo "         Merge or rebase from main at >= '$BASE_VERSION' before deploying."
    exit 1
  fi

  do_deploy "origin/$branch" "b-${commit}-locked"
  echo "[DEPLOY] Branch deploy complete: $branch @ $commit (locked)."
}

# ---> Main:

CMD="${1:-}"
SUB="${2:-}"

case "$CMD" in
  ""|--deploy)
    case "$SUB" in
      "")
        cmd_auto_deploy
        ;;
      -f)
        cmd_force_deploy "${3:-}"
        ;;
      -b)
        if [[ -z "${3:-}" ]]; then
          echo "[DEPLOY] Error: Branch name required."
          echo "[DEPLOY] Usage: $(basename "$0") --deploy -b <BRANCH>"
          exit 1
        fi
        cmd_branch_deploy "$3"
        ;;
      *)
        echo "[DEPLOY] Error: Unknown option '$SUB'."
        usage
        exit 1
        ;;
    esac
    ;;
  --lock)
    cmd_lock
    ;;
  --unlock)
    cmd_unlock
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    echo "[MAIN] Error: Unknown command '$CMD'."
    usage
    exit 1
    ;;
esac
