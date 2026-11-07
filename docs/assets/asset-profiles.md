# Asset source layout

All authored configuration, application resources, and package source assets live under the root `assets/` directory.

The former `content/` and nested asset layers have been consolidated into this directory.

- `assets/app/` contains tracked application icons, fonts, and download-link configuration.
- `assets/card-library/` contains acquired card data, scripts, image metadata, and artwork.
- `assets/chapter-01/` contains acquired Chapter 1 package sources and media.
- `assets/freeplay/` and `assets/duel-core/` retain authored gameplay configuration and deck definitions.

Package declarations in `assets/packages.json` and `scripts/lib/asset-roots.ts:PACKAGE_ASSET_SOURCES` identify current package inputs. Acquired bytes remain ignored by Git; moving their directory does not reacquire or alter them. Browser development continues to deny direct access to package source roots. Native resources and startup snapshots remain governed by ADR-104/105.

The former root `asset-profiles/` declarations and their inventory and promotion commands have been removed. They no longer provide an asset-selection mechanism. Current package composition follows [content modules](content-modules.md).

Independent copy-migration commands remain available for older local source layouts:

```bash
npm run legacy:assets:copy-migrate -- --help
npm run legacy:assets:copy-to-package-roots -- --help
```

These commands preserve their copy-only and ownership checks and target the relocated source roots. Their shared file-safety, metadata, and locking helpers are retained for acquisition commands. Frozen engine files remain under `vendor/ocgcore-wasm/0.1.2/`.
