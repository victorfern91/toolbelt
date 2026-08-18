#!/usr/bin/env bash
# curl -fsSL https://raw.githubusercontent.com/victorfern91/toolbelt/main/install.sh | bash
set -euo pipefail

REPO="victorfern91/toolbelt"
INSTALL_DIR="${TOOLBELT_INSTALL:-$HOME/.local/bin}"
VERSION="${TOOLBELT_VERSION:-latest}"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux)  os=linux ;;
  *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch=arm64 ;;
  x86_64|amd64)  arch=x64 ;;
  *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

asset="toolbelt-${os}-${arch}"
if [ "$VERSION" = latest ]; then
  url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"
fi

echo "installing $asset -> $INSTALL_DIR/toolbelt"
mkdir -p "$INSTALL_DIR"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
curl -fSL --progress-bar "$url" -o "$tmp" || {
  echo "no build at $url" >&2
  exit 1
}
chmod +x "$tmp"
mv "$tmp" "$INSTALL_DIR/toolbelt"
trap - EXIT

echo "✓ $("$INSTALL_DIR/toolbelt" --version 2>/dev/null || echo installed)"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) echo "run: toolbelt" ;;
  *) echo "add to PATH:  export PATH=\"$INSTALL_DIR:\$PATH\"" ;;
esac
