#!/bin/bash
# Run package sync/install/test in WSL with Node.js resolved from NVM when available.
# Usage: wsl-run.sh <action> <package-dir> [args...]
#   action: sync|install|test
#   package-dir: WSL path to package directory

set -u
set -o pipefail

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi

# Keep package commands inside WSL/Linux toolchains. If a binary is missing
# locally, we want a hard failure instead of Windows interop launching shims.
PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '^/mnt/[a-z]/' | paste -sd ':' -)"
export PATH
corepack enable >/dev/null 2>&1 || true

ACTION="$1"
PKG_DIR="$2"
shift 2

case "$ACTION" in
  sync)
    REPO_URL="$1"
    REF="$2"
    if [ ! -d "$PKG_DIR/.git" ]; then
      rm -rf "$PKG_DIR" 2>/dev/null || true
      mkdir -p "$(dirname "$PKG_DIR")"
      git clone "$REPO_URL" "$PKG_DIR" 2>&1 || exit 1
    fi
    cd "$PKG_DIR" || exit 1
    git remote set-url origin "$REPO_URL" 2>/dev/null || true
    git fetch --tags origin 2>&1 || exit 1
    if [ "$REF" = "HEAD" ]; then
      DEFAULT_BRANCH="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
      if [ -z "$DEFAULT_BRANCH" ]; then
        DEFAULT_BRANCH="main"
      fi
      git checkout "$DEFAULT_BRANCH" 2>&1 || git checkout master 2>&1 || exit 1
      git reset --hard "origin/$DEFAULT_BRANCH" 2>&1 || git reset --hard origin/master 2>&1 || exit 1
    else
      git checkout "$REF" 2>&1 || exit 1
      git reset --hard "$REF" 2>&1 || exit 1
    fi
    git clean -fdx -e .atua-source.json -e .atua-install.json 2>&1 || exit 1
    ;;
  install)
    cd "$PKG_DIR" || exit 1
    MODE="$1"
    case "$MODE" in
      npm-ci)
        npm ci 2>&1
        ;;
      npm-install)
        npm install 2>&1
        ;;
      npm-ci-legacy)
        npm ci --legacy-peer-deps 2>&1
        ;;
      npm-install-legacy)
        npm install --legacy-peer-deps 2>&1
        ;;
      yarn-install)
        yarn install 2>&1
        ;;
      pnpm-install)
        pnpm install 2>&1
        ;;
      *)
        echo "Unknown install mode: $MODE"
        exit 1
        ;;
    esac
    ;;
  test)
    TEST_CMD="$*"
    cd "$PKG_DIR" && CI=1 AVA_FORCE_CI=1 PATH="./node_modules/.bin:$PATH" eval "$TEST_CMD" 2>&1
    ;;
  *)
    echo "Unknown action: $ACTION"
    exit 1
    ;;
esac
