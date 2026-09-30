# Personal Google Drive backup

This backup covers the repository source and Git history, current uncommitted work, ignored game assets, and generated content. It excludes reinstallable `node_modules/`, download caches, build output, temporary agent data, and `.env` files. The archive is a personal recovery copy; it is not a game download endpoint or an asset source for the installed app.

## One-time connection

Install `rclone` if needed, then run `rclone config`. Create a Google Drive remote named `gdrive` and complete Google's account sign-in in your browser. The OAuth credentials stay in your local rclone configuration, outside the repository. The backup script also accepts another configured remote name as its first argument.

The current `gdrive` remote uses rclone's shared Google OAuth client. Rclone warns that this shared client will stop working during 2026. Before relying on recurring backups, [configure a personal Google OAuth client ID](https://rclone.org/drive/#making-your-own-client-id) and reconnect the remote. The existing Drive backup remains accessible through Google's website while that client configuration is updated.

Check free space in the Google account before uploading. The current repository contains about 4.4 GB of assets; the archive also includes source, Git history, and generated content. Google's free 15 GB is shared with Gmail and Photos. Dated backups each consume space until you remove old ones yourself.

## Create and verify a backup

From the repository root:

```sh
./scripts/backup-google-drive.sh
```

The script creates an archive, splits it into 512 MiB parts under `ascencio-backups/snapshots/<UTC timestamp>/`, and uploads a SHA-256 list for the parts and whole archive. Smaller parts can be retried independently. It verifies the uploaded files with `rclone check` and writes a `VERIFIED` marker to Drive only after that check passes. It never synchronizes deletions or removes an older snapshot. Run it after important asset or source changes; there is no automatic schedule. Each dated snapshot consumes another archive's worth of Drive space.

## Restore

After cloning the repository, choose a snapshot folder shown by `rclone lsf gdrive:ascencio-backups/snapshots/` and confirm that it contains `VERIFIED`. From the fresh clone, one command downloads, verifies, and restores only the ignored `assets/` and `generated/` directories:

```sh
./scripts/restore-google-drive-assets.sh <UTC timestamp>
```

The script does not replace the clone's source files or Git history. It needs enough temporary disk space for the downloaded parts and their reconstructed archive, in addition to the restored assets. Use an empty fresh clone: the extraction can replace files already present under `assets/` or `generated/`.

If the fresh clone predates this restore script, download `restore-google-drive-assets.sh` from the same snapshot folder into `scripts/`, make it executable, then run the command above.

To recover the entire repository instead, download the snapshot to a temporary folder:

```sh
mkdir -p /tmp/ascencio-restore
rclone copy gdrive:ascencio-backups/snapshots/<UTC timestamp> /tmp/ascencio-restore
cd /tmp/ascencio-restore
sha256sum -c ascencio.parts.sha256
cat ascencio.tar.*.part > ascencio.tar
sha256sum -c ascencio.tar.sha256
tar -tf ascencio.tar | head
```

Once the checksum passes, extract the archive in the parent directory where you want the `ascencio/` folder:

```sh
tar -C /path/to/parent -xf /tmp/ascencio-restore/ascencio.tar
cd /path/to/parent/ascencio
npm ci
```

Choose an empty parent location or move an existing `ascencio/` directory aside before extraction. Source files and local assets are restored from the archive; `npm ci` reinstalls dependencies.
