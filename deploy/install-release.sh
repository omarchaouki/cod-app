#!/usr/bin/env bash
#
# Install a release tarball ON THE SERVER, with an atomic switch and rollback.
#
#   sudo ./install-release.sh /tmp/release.tar.gz
#
# Releases are unpacked into their own timestamped directory and `current` is
# flipped with a symlink swap, so a bad deploy is one command to undo and there
# is no window where the site is serving half-copied files.
#
set -euo pipefail

TARBALL="${1:-/tmp/release.tar.gz}"
APP_ROOT=/var/www/cahier-eps
KEEP=5

[[ -f "$TARBALL" ]] || { echo "No tarball at $TARBALL"; exit 1; }
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }

RELEASE="$APP_ROOT/releases/$(date +%Y%m%d%H%M%S)"

echo "==> Unpacking to $RELEASE"
mkdir -p "$RELEASE"
tar -xzf "$TARBALL" -C "$RELEASE"
chown -R www-data:www-data "$RELEASE"

echo "==> Switching current -> $RELEASE"
ln -sfn "$RELEASE" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"

echo "==> Restarting"
systemctl restart cahier-eps

echo "==> Waiting for health"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
  if [[ "$code" == "200" ]]; then
    echo "    healthy after ${i}s (HTTP $code)"

    echo "==> Pruning old releases (keeping $KEEP)"
    ls -1dt "$APP_ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

    echo
    echo "Deployed: $RELEASE"
    exit 0
  fi
  sleep 1
done

echo "!! App did not become healthy. Recent logs:"
journalctl -u cahier-eps -n 40 --no-pager
echo
echo "To roll back:"
echo "  ls -1dt $APP_ROOT/releases/*/ | sed -n 2p   # previous release"
echo "  sudo ln -sfn <that-path> $APP_ROOT/current && sudo systemctl restart cahier-eps"
exit 1
