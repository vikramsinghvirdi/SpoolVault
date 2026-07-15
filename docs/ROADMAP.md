# Product roadmap

## Phase 1 — Local starter, included now

- Physical-spool inventory
- Grouped product catalog
- Search, filters, sorting, and responsive views
- Add/edit/delete/duplicate
- Basic usage subtraction
- Reorder threshold per spool
- Product URL and SKU reference
- JSON backup/import and CSV export

## Phase 2 — Make daily tracking faster

- Exact “set remaining weight” shortcut
- Optional spool-carrier tare weights
- Batch audit mode for checking many spools quickly
- Storage locations and AMS slots as managed entities
- Project reservations in grams
- Reorder list with desired stock targets
- Usage history per spool and printer job
- QR-code labels that open a spool detail page

## Phase 3 — Shared online product catalog

Keep user inventory separate from reusable product metadata:

- `brands`
- `filament_products`
- `product_variants`
- `spools`
- `usage_events`
- `locations`

A catalog record could contain brand, product line, material, diameter, color, SKU, nominal weight, recommended temperatures, abrasion information, and source URL. A user’s spool record would reference the catalog item while retaining its own weight, status, location, and notes.

The first online-reference feature should be assisted rather than automatic: accept a product URL or SKU, search for likely matches, show extracted values, and require confirmation before saving. Product-page layouts vary widely, so silent scraping would create incorrect inventory records.

## Phase 4 — Vercel + Supabase

Suggested responsibilities:

- Vercel: static frontend and small server functions for product metadata lookup
- Supabase Auth: optional user accounts
- Supabase Postgres: inventory, catalog references, locations, and usage events
- Row Level Security: each user can access only their own inventory
- Supabase Storage: optional spool photos and receipts

A migration can preserve the current UI by replacing the functions in `src/storage.js` with an asynchronous repository that reads and writes Supabase. Keep local storage as an offline cache and import path.

## Phase 5 — Broader 3D-printing workflow

- Import estimated filament usage from slicer exports
- Track filament by printer, AMS, project, and print job
- Drying history and moisture reminders
- Cost per gram and project cost
- Open-spool age and shelf-life reminders
- Multi-user workshop inventory
- Low-stock notifications
- Barcode and NFC support
- Community-maintained cross-brand filament catalog
