# Spool Inventory Starter 0.3.2

A dependency-free, local-first web app for tracking 3D-printer filament spools across any brand. It runs locally with Node.js and keeps a clean path toward a hosted Vercel + Supabase version later.

## What 0.3.2 adds

Version 0.3.2 stores the audited inventory in `data/inventory.json` so the same 56-spool catalog can ship with the static site on Vercel. On startup, the UI reads that packaged JSON and merges any missing packaged spool IDs into browser storage. The Data menu also includes **Reload packaged inventory.json** for replacing the current browser copy with the deployed JSON file.

## What 0.3.1 fixed

Version 0.3.1 repairs a browser-local state where the app shell showed v0.3.0 but localStorage still contained only the 46-spool July 12 inventory. It checks the stable July 13 spool IDs and fills in any missing records on reload.

## What 0.3.0 added

Version 0.3.0 adds the ten filament units from the Bambu Lab purchase screenshot supplied on 2026-07-13. The migration updates existing starter inventories from 46 to 56 physical spools/refills and keeps the previous cache-busting safeguards from 0.2.1.

A manual **Data -> Add/repair July 13 purchase (10 spools)** command is also included. It inserts only missing stable spool IDs, so running it repeatedly does not create duplicates.

## What 0.2.1 fixed

Version 0.2 used the same JavaScript file URLs as version 0.1 while the local server allowed those files to remain cached for five minutes. A browser could therefore keep running the old inventory code after the folder was replaced. Version 0.2.1 fixes this in three ways:

1. The local server sends `no-store` for every file.
2. The CSS and JavaScript URLs include a version query string.
3. The inventory migration performs a one-time repair pass even when a version-2 marker exists but the ten July 12 records are missing.

A manual **Data -> Add/repair July 12 purchase (10 spools)** command is also included. It inserts only missing stable spool IDs, so running it repeatedly does not create duplicates.

## Included starter inventory

The starter data contains all 56 filament units visible across the supplied Bambu Lab order screenshots:

- 36 original physical spools/refills
- 10 additional one-kilogram refills from the July 12 screenshot
- 10 additional one-kilogram spools/refills from the July 13 screenshot
- 51 unique product/package combinations
- 54.5 kg nominal filament

The added July 12 refills are:

- PLA Basic: Black 10101, Silver 10102, Blue Grey 10602, Dark Gray 10105
- PLA Matte: Matte Ash Gray 11102, Matte Dark Green 11501
- ABS: Black 40101
- PETG Translucent: Brown 32800, Orange 32300, Light Blue 32600

The added July 13 spools/refills are:

- ABS: White 40100
- PLA Basic: Beige 10201, Jade White 10100 (x2), Gold 10401, Blue 10601, Brown 10800
- PLA Matte: Matte Caramel 11803
- PETG Basic: Pine Green 30503 with spool
- PLA Pure: Milky Pink 17200

The partially visible N20 reduction gear motor is excluded because it is not filament.

All imported items start as **Needs audit** because an order history cannot prove that an item is still on hand or full.

## Update from the earlier folder without losing edits

1. In the current app, choose **Data → Export backup (.json)**.
2. Stop the running server with `Ctrl+C`.
3. Extract this folder and run:

```bash
cd filament-inventory-starter-v2.1
npm run dev
```

4. Open the exact same origin you used previously, preferably:

```text
http://127.0.0.1:4173
```

5. Confirm the header displays **v0.3.2**.
6. The summary should report **56 physical spools/refills**. If it does not, choose **Data -> Add/repair July 13 purchase (10 spools)**.

`127.0.0.1:4173` and `localhost:4173` have separate browser storage. Continue using the one that contains your existing inventory. Version 0.3.2 disables source-file caching, but a single hard reload is still harmless if an older tab was already open.

## Run locally

Only a recent Node.js installation is required. There are no third-party packages to install.

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

Run the included migration tests with:

```bash
npm test
```

## Main features

- Product view that groups duplicate physical spools by brand and SKU
- Individual-spool view for tracking each physical roll or refill
- Color swatches, exact color names, color families, material family, product line/type, brand, and SKU
- Quantity and combined remaining weight in product view
- Nominal weight, remaining weight, packaging, status, location, and reorder threshold per spool
- Search across color, type, brand, material, SKU, status, location, packaging, notes, and product URL
- Field search such as `type:PETG`, `color:black`, `status:open`, `sku:30105`, and `location:AMS`
- Filters for brand, material, type, color, status, packaging, location, stock state, SKU availability, and product-link availability
- Sort by update date, added date, color spectrum, color name, type, brand, remaining grams, remaining percentage, quantity, status, or SKU
- Add, edit, duplicate, delete, and log-usage actions
- Product URL and SKU fields plus a web-search shortcut
- JSON backup/import and CSV export
- Responsive card/table layouts and light/dark themes

## Recommended first inventory audit

1. Open **Individual spools**.
2. Select the **Needs audit** quick filter.
3. Locate each physical spool or refill.
4. Edit its status, storage location, and current remaining weight.
5. Check the physical-audit box.
6. Delete records for items already consumed, returned, or never received.
7. Export a JSON backup after the audit.

## Local data

Inventory is stored under this browser key:

```text
spool-inventory.local.v1
```

Clearing site data removes the local inventory. Use **Data → Export backup (.json)** regularly. JSON import replaces the current inventory only after confirmation.

The deployable baseline lives in:

```text
data/inventory.json
```

Update that file before deploying when you want Vercel visitors to receive a new packaged inventory.

## Future deployment

The app is static and can be deployed without a build step. A minimal `vercel.json` is included. Before public deployment, the local storage adapter in `src/storage.js` can be replaced with authenticated Supabase tables and row-level security.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the broader product roadmap.
