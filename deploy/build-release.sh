#!/usr/bin/env bash
#
# Produce a deployable release tarball from a clean build.
#
# Run this LOCALLY (or in CI), then ship the tarball to the server. Building
# locally is what lets a 1 GB Lightsail instance run this app at all — the
# Next.js build peaks well above what that instance has, but serving the
# finished output barely uses 200 MB.
#
#   ./deploy/build-release.sh
#   scp release.tar.gz ubuntu@YOUR_IP:/tmp/
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
npm ci

echo "==> Type checking"
npm run typecheck

echo "==> Testing"
npm test

echo "==> Building"
rm -rf .next release release.tar.gz
npm run build

# `output: 'standalone'` emits server.js plus only the packages it imports,
# but deliberately leaves out the static assets — they are meant to be served
# by a CDN or nginx. For a single-box deploy we copy them in ourselves.
echo "==> Assembling release"
mkdir -p release
cp -r .next/standalone/. release/
mkdir -p release/.next
cp -r .next/static release/.next/static
cp -r public release/public

echo "==> Packing"
tar -czf release.tar.gz -C release .

echo
echo "Release ready: release.tar.gz ($(du -h release.tar.gz | cut -f1))"
echo "Next: scp release.tar.gz ubuntu@YOUR_IP:/tmp/ && ssh in and run deploy/install-release.sh"
