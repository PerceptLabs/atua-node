#!/bin/bash
# Run a package test in WSL with nvm-provided Node.js
# Usage: wsl-run.sh <action> <package-dir> [args...]
#   action: clone|install|test
#   package-dir: WSL path to package directory

source /home/shoshi/.nvm/nvm.sh

ACTION="$1"
PKG_DIR="$2"
shift 2

case "$ACTION" in
  clone)
    REPO="$1"
    TAG="$2"
    DEST="$3"
    git clone --depth 1 --branch "$TAG" "https://github.com/$REPO.git" "$DEST" 2>&1 || \
    git clone --depth 1 "https://github.com/$REPO.git" "$DEST" 2>&1
    ;;
  install)
    cd "$PKG_DIR" || exit 1
    # Remove Windows node_modules if present (platform mismatch with WSL)
    if [ -d node_modules ] && [ -f node_modules/.package-lock.json ]; then
      rm -rf node_modules 2>/dev/null || true
    fi
    npm install 2>&1 || true
    ;;
  build)
    cd "$PKG_DIR" && npm run build 2>&1 || npm run prepare 2>&1 || true
    ;;
  test)
    TEST_CMD="$*"
    cd "$PKG_DIR" && PATH="./node_modules/.bin:$PATH" eval "$TEST_CMD" 2>&1
    ;;
  *)
    echo "Unknown action: $ACTION"
    exit 1
    ;;
esac
