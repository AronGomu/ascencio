#!/usr/bin/env bash
set -euo pipefail

# Restore ignored assets into this fresh clone from a verified Drive snapshot.
# Usage: ./scripts/restore-google-drive-assets.sh <UTC-snapshot-name> [rclone-remote-name]

snapshot_name="${1:-}"
remote_name="${2:-gdrive}"
if [[ ! "$snapshot_name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$ ]]; then
  echo "Usage: $0 <UTC-snapshot-name> [rclone-remote-name]" >&2
  exit 2
fi
if [[ ! "$remote_name" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Remote name must contain only letters, digits, underscores, or hyphens." >&2
  exit 2
fi
if ! command -v rclone >/dev/null 2>&1; then
  echo "rclone is required." >&2
  exit 1
fi
if ! rclone listremotes | rg -Fxq "${remote_name}:"; then
  echo "Google Drive remote '${remote_name}' is not configured. Run: rclone config" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
if [[ ! -d "$repo_root/.git" ]]; then
  echo "Run this script from a fresh Git clone of the repository." >&2
  exit 1
fi

mkdir -p "$repo_root/.cache"
restore_dir="$(mktemp -d "$repo_root/.cache/google-drive-restore.XXXXXX")"
restore_complete=false
cleanup() {
  if [[ "$restore_complete" == true ]]; then
    rm -rf -- "$restore_dir"
  else
    echo "Restore staging retained for inspection: $restore_dir" >&2
  fi
}
trap cleanup EXIT

remote_path="${remote_name}:ascencio-backups/snapshots/${snapshot_name}"
if ! rclone cat "$remote_path/VERIFIED" >/dev/null 2>&1; then
  echo "This Drive snapshot has no VERIFIED marker yet; wait for backup verification." >&2
  exit 1
fi
echo "Downloading ${remote_path}..."
rclone copy "$remote_path" "$restore_dir" --transfers 4 --stats 30s
(
  cd "$restore_dir"
  sha256sum -c ascencio.parts.sha256
  cat ascencio.tar.*.part > ascencio.tar
  sha256sum -c ascencio.tar.sha256
)

echo "Restoring assets/ and generated/ into ${repo_root}..."
tar -C "$repo_root" --strip-components=1 -xf "$restore_dir/ascencio.tar" \
  ascencio/assets ascencio/generated
restore_complete=true
echo "Verified assets restored into ${repo_root}"
