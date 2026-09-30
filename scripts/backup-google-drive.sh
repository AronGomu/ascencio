#!/usr/bin/env bash
set -euo pipefail

# Back up the restorable project, including .git and ignored game assets.
# Usage: ./scripts/backup-google-drive.sh [rclone-remote-name]

remote_name="${1:-gdrive}"
if [[ ! "$remote_name" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Remote name must contain only letters, digits, underscores, or hyphens." >&2
  exit 2
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "rclone is required. Install it, then configure a Google Drive remote." >&2
  exit 1
fi
if ! rclone listremotes | rg -Fxq "${remote_name}:"; then
  echo "Google Drive remote '${remote_name}' is not configured. Run: rclone config" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
repo_name="$(basename "$repo_root")"
repo_parent="$(dirname "$repo_root")"
snapshot_time="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "$repo_root/.cache"
backup_dir="$(mktemp -d "$repo_root/.cache/google-drive-backup.XXXXXX")"
backup_complete=false
cleanup() {
  if [[ "$backup_complete" == true ]]; then
    rm -rf -- "$backup_dir"
  else
    echo "Backup staging retained for inspection: $backup_dir" >&2
  fi
}
trap cleanup EXIT

archive_name="${repo_name}.tar"
parts_checksum_name="${repo_name}.parts.sha256"
remote_path="${remote_name}:ascencio-backups/snapshots/${snapshot_time}"
upload_dir="$backup_dir/upload"
mkdir -p "$upload_dir"

echo "Creating ${snapshot_time} snapshot from ${repo_root}..."
tar -C "$repo_parent" \
  --exclude="${repo_name}/node_modules" \
  --exclude="${repo_name}/.cache" \
  --exclude="${repo_name}/.tmp" \
  --exclude="${repo_name}/.pi-subagents" \
  --exclude="${repo_name}/dist" \
  --exclude="${repo_name}/dist-*" \
  --exclude="${repo_name}/coverage" \
  --exclude="${repo_name}/playwright-report" \
  --exclude="${repo_name}/test-results" \
  --exclude="${repo_name}/.env" \
  --exclude="${repo_name}/.env.*" \
  -cf "$backup_dir/$archive_name" "$repo_name"

(
  cd "$backup_dir"
  sha256sum "$archive_name" > "$archive_name.sha256"
)
split -b 512M -d -a 3 --additional-suffix=.part \
  "$backup_dir/$archive_name" "$upload_dir/$archive_name."
cp "$backup_dir/$archive_name.sha256" "$upload_dir/"
(
  cd "$upload_dir"
  sha256sum "$archive_name".*.part > "$parts_checksum_name"
)

echo "Uploading to ${remote_path}..."
rclone copy "$upload_dir" "$remote_path" --transfers 4 --stats 30s
rclone check "$upload_dir" "$remote_path" --one-way
date -u +%FT%TZ > "$backup_dir/VERIFIED"
rclone copyto "$backup_dir/VERIFIED" "$remote_path/VERIFIED"
backup_complete=true
echo "Verified backup: ${remote_path}/"
