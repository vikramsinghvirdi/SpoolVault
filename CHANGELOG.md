# Changelog

## 0.3.2

- Added `data/inventory.json` as the deployable packaged inventory source.
- Loaded packaged JSON on startup and merged missing packaged spool IDs into browser storage.
- Added **Data -> Reload packaged inventory.json**.
- Added tests for packaged inventory merging.

## 0.3.1

- Added a defensive repair for v0.3.0 browser storage that had the current marker but was still missing the July 13 purchase records.
- Bumped versioned asset URLs so an open tab reloads the repaired migration code.
- Added a regression test for the 46-spool v0.3.0 localStorage state.

## 0.3.0

- Added ten Bambu Lab spool/refill records from the July 13 purchase screenshot.
- Added automatic starter-data migration from the 46-spool July 12 inventory.
- Added **Data -> Add/repair July 13 purchase (10 spools)**.
- Added a visible v0.3.0 build badge.
- Extended migration tests for the new 56-spool starter inventory.

## 0.2.1

- Disabled browser caching in the local development server.
- Added versioned CSS and JavaScript URLs.
- Added a repair migration for inventories marked as version 2 but missing the ten July 12 spool records.
- Added **Data → Add/repair July 12 purchase (10 spools)**.
- Added a visible v0.2.1 build badge.
- Added a clear error when an older server is still using port 4173.
- Added migration tests covering v1, broken v2, idempotency, and unrelated custom inventories.

## 0.2.0

- Added ten Bambu Lab refill records from the July 12 purchase screenshot.
- Added automatic starter-data migration from the original 36-spool inventory.
