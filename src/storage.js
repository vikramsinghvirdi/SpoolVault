import {
  DEFAULT_INVENTORY,
  JULY_12_PURCHASE_MIGRATION_ID,
  JULY_13_PURCHASE_MIGRATION_ID,
  STARTER_DATA_VERSION,
  STARTER_V2_SPOOLS,
  STARTER_V4_SPOOLS,
} from "./catalog.js";

const STORAGE_KEY = "spoolvault.local.v1";
const LEGACY_STORAGE_KEYS = ["spool-inventory.local.v1"];
const PACKAGED_INVENTORY_URL = "./data/inventory.json?v=0.3.2";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#7C8591";
}

function detectStarterDataVersion(raw = {}) {
  const explicitVersion = Math.max(
    0,
    Math.trunc(asFiniteNumber(raw.starterDataVersion, 0)),
  );
  if (explicitVersion > 0) return explicitVersion;

  const hasOriginalSeedSpool = Array.isArray(raw.spools)
    && raw.spools.some((spool) => /^seed-(?!v\d+-)/.test(cleanText(spool?.id)));
  const hasOriginalSeedEvent = Array.isArray(raw.events)
    && raw.events.some((event) => cleanText(event?.id) === "seed-event-1");

  return hasOriginalSeedSpool || hasOriginalSeedEvent ? 1 : 0;
}

function normalizeMigrationIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item)).filter(Boolean))];
}

function normalizeStatus(value) {
  const allowed = new Set([
    "Needs audit",
    "Sealed",
    "Open",
    "Loaded",
    "Reserved",
    "Empty",
  ]);
  return allowed.has(value) ? value : "Needs audit";
}

function normalizePackaging(value) {
  const allowed = new Set(["Refill", "With spool", "Sample", "Unknown"]);
  return allowed.has(value) ? value : "Unknown";
}

export function normalizeSpool(raw = {}) {
  const now = new Date().toISOString();
  const initialWeightG = Math.max(1, asFiniteNumber(raw.initialWeightG, 1000));
  const remainingWeightG = Math.min(
    initialWeightG,
    Math.max(0, asFiniteNumber(raw.remainingWeightG, initialWeightG)),
  );

  return {
    id: cleanText(raw.id) || crypto.randomUUID(),
    brand: cleanText(raw.brand, "Unknown brand") || "Unknown brand",
    productLine: cleanText(raw.productLine, "Filament") || "Filament",
    materialFamily: cleanText(raw.materialFamily, "Other") || "Other",
    colorName: cleanText(raw.colorName, "Unknown color") || "Unknown color",
    colorFamily: cleanText(raw.colorFamily, "Other") || "Other",
    colorHex: validHex(raw.colorHex),
    sku: cleanText(raw.sku),
    productUrl: cleanText(raw.productUrl),
    packaging: normalizePackaging(raw.packaging),
    initialWeightG,
    remainingWeightG,
    reorderAtG: Math.max(0, asFiniteNumber(raw.reorderAtG, 250)),
    status: normalizeStatus(raw.status),
    location: cleanText(raw.location, "Unassigned") || "Unassigned",
    notes: cleanText(raw.notes),
    verified: Boolean(raw.verified),
    addedAt: cleanText(raw.addedAt, now) || now,
    updatedAt: cleanText(raw.updatedAt, now) || now,
  };
}

function normalizeEvent(raw = {}) {
  const now = new Date().toISOString();
  return {
    id: cleanText(raw.id) || crypto.randomUUID(),
    type: cleanText(raw.type, "update") || "update",
    message: cleanText(raw.message, "Inventory updated") || "Inventory updated",
    createdAt: cleanText(raw.createdAt, now) || now,
  };
}

export function normalizeInventory(raw = {}) {
  const spools = Array.isArray(raw.spools)
    ? raw.spools.map(normalizeSpool)
    : deepClone(DEFAULT_INVENTORY.spools);
  const events = Array.isArray(raw.events)
    ? raw.events.map(normalizeEvent)
    : [];

  return {
    schemaVersion: 1,
    starterDataVersion: detectStarterDataVersion(raw),
    appliedMigrations: normalizeMigrationIds(raw.appliedMigrations),
    spools,
    events,
    settings: {
      viewMode:
        raw.settings?.viewMode === "spools" ? "spools" : "products",
      displayMode:
        raw.settings?.displayMode === "table" ? "table" : "cards",
      theme: ["system", "light", "dark"].includes(raw.settings?.theme)
        ? raw.settings.theme
        : "system",
    },
  };
}

function addMissingSpools(inventory, purchaseSpools) {
  const existingIds = new Set(inventory.spools.map((spool) => spool.id));
  const additions = purchaseSpools
    .filter((spool) => !existingIds.has(spool.id))
    .map((spool) => normalizeSpool(deepClone(spool)));

  inventory.spools.push(...additions);
  return additions.length;
}

function addMissingPackagedSpools(inventory, packagedInventory) {
  const existingIds = new Set(inventory.spools.map((spool) => spool.id));
  const additions = packagedInventory.spools
    .filter((spool) => !existingIds.has(spool.id))
    .map((spool) => normalizeSpool(deepClone(spool)));

  inventory.spools.push(...additions);
  return additions.length;
}

function addMissingJulyPurchaseSpools(inventory) {
  return addMissingSpools(inventory, STARTER_V2_SPOOLS);
}

function addMissingLatestPurchaseSpools(inventory) {
  return addMissingSpools(inventory, STARTER_V4_SPOOLS);
}

function markMigrationApplied(inventory, migrationId) {
  if (!inventory.appliedMigrations.includes(migrationId)) {
    inventory.appliedMigrations.push(migrationId);
  }
}

function markJulyPurchaseApplied(inventory) {
  markMigrationApplied(inventory, JULY_12_PURCHASE_MIGRATION_ID);
}

function markLatestPurchaseApplied(inventory) {
  markMigrationApplied(inventory, JULY_13_PURCHASE_MIGRATION_ID);
}

function addPurchaseEvent(
  inventory,
  {
    addedCount,
    source = "automatic migration",
    automaticEventId,
    repairEventPrefix,
    dateLabel,
  },
) {
  if (addedCount <= 0) return;

  const eventId = source === "manual repair"
    ? `${repairEventPrefix}-${Date.now()}`
    : automaticEventId;

  if (inventory.events.some((event) => event.id === eventId)) return;

  inventory.events.unshift({
    id: eventId,
    type: "import",
    message: `Added ${addedCount} missing spool${addedCount === 1 ? "" : "s"} from the Bambu Lab ${dateLabel} purchase (${source}).`,
    createdAt: new Date().toISOString(),
  });
}

function addJulyPurchaseEvent(inventory, addedCount, source = "automatic migration") {
  addPurchaseEvent(inventory, {
    addedCount,
    source,
    automaticEventId: "seed-event-2",
    repairEventPrefix: "repair-event",
    dateLabel: "July 12",
  });
}

function addLatestPurchaseEvent(inventory, addedCount, source = "automatic migration") {
  addPurchaseEvent(inventory, {
    addedCount,
    source,
    automaticEventId: "seed-event-3",
    repairEventPrefix: "repair-event-july-13",
    dateLabel: "July 13",
  });
}

function migrateStarterInventory(inventory) {
  // Do not inject the user's personal starter purchases into an unrelated custom
  // inventory. Version 0 identifies data that did not originate from this starter.
  if (inventory.starterDataVersion <= 0) return inventory;

  const migrated = deepClone(inventory);

  // v0.2 could be served from the browser's five-minute module cache. In that
  // situation, a version marker could exist while the ten July 12 spools were
  // still missing. Version 3 intentionally performs one repair pass for all
  // legacy v1/v2 inventories and checks the stable spool IDs, not only the marker.
  if (migrated.starterDataVersion < 3) {
    const addedCount = addMissingJulyPurchaseSpools(migrated);
    addJulyPurchaseEvent(migrated, addedCount);
    markJulyPurchaseApplied(migrated);
  }

  // v0.3.0 could mark a browser inventory as current even if an already-open
  // tab had not received the final July 13 purchase records. Version 5 repairs
  // by stable spool IDs, so an incomplete v4 localStorage snapshot reaches 56.
  if (migrated.starterDataVersion < 5) {
    const addedCount = addMissingLatestPurchaseSpools(migrated);
    addLatestPurchaseEvent(migrated, addedCount);
    markLatestPurchaseApplied(migrated);
  }

  migrated.starterDataVersion = STARTER_DATA_VERSION;
  return migrated;
}

function mergePackagedInventory(inventory, packagedInventory) {
  if (!packagedInventory || inventory.starterDataVersion <= 0) return inventory;

  const merged = deepClone(inventory);
  const addedCount = addMissingPackagedSpools(merged, packagedInventory);

  if (addedCount > 0 && !merged.events.some((event) => event.id === "packaged-inventory-repair")) {
    merged.events.unshift({
      id: "packaged-inventory-repair",
      type: "import",
      message: `Added ${addedCount} missing spool${addedCount === 1 ? "" : "s"} from packaged inventory.json.`,
      createdAt: new Date().toISOString(),
    });
  }

  merged.appliedMigrations = normalizeMigrationIds([
    ...merged.appliedMigrations,
    ...packagedInventory.appliedMigrations,
  ]);
  merged.starterDataVersion = Math.max(
    merged.starterDataVersion,
    packagedInventory.starterDataVersion,
  );

  return merged;
}

export async function loadPackagedInventory() {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return deepClone(DEFAULT_INVENTORY);
  }

  try {
    const response = await fetch(PACKAGED_INVENTORY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseInventoryFile(await response.text());
  } catch (error) {
    console.warn("Could not load packaged inventory.json; using built-in starter data.", error);
    return deepClone(DEFAULT_INVENTORY);
  }
}

/**
 * Manually adds only the missing July 12 purchase records. This is safe to run
 * more than once because every included physical spool has a stable unique ID.
 */
export function applyJulyPurchaseUpdate(inventory) {
  const updated = deepClone(normalizeInventory(inventory));
  const addedCount = addMissingJulyPurchaseSpools(updated);
  markJulyPurchaseApplied(updated);
  updated.starterDataVersion = STARTER_DATA_VERSION;
  addJulyPurchaseEvent(updated, addedCount, "manual repair");

  return {
    inventory: updated,
    addedCount,
    expectedCount: STARTER_V2_SPOOLS.length,
  };
}

/**
 * Manually adds only the missing July 13 purchase records from the latest
 * screenshot. Stable IDs keep this repair idempotent.
 */
export function applyLatestPurchaseUpdate(inventory) {
  const updated = deepClone(normalizeInventory(inventory));
  const addedCount = addMissingLatestPurchaseSpools(updated);
  markLatestPurchaseApplied(updated);
  updated.starterDataVersion = STARTER_DATA_VERSION;
  addLatestPurchaseEvent(updated, addedCount, "manual repair");

  return {
    inventory: updated,
    addedCount,
    expectedCount: STARTER_V4_SPOOLS.length,
  };
}

export async function loadInventory({
  packagedInventory = null,
  preferPackaged = false,
} = {}) {
  try {
    const packaged = packagedInventory || await loadPackagedInventory();

    if (preferPackaged) {
      return saveInventory(packaged);
    }

    const saved = localStorage.getItem(STORAGE_KEY)
      || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!saved) {
      const initial = deepClone(packaged);
      saveInventory(initial);
      return initial;
    }

    const normalized = normalizeInventory(JSON.parse(saved));
    const migrated = migrateStarterInventory(normalized);
    const withPackaged = mergePackagedInventory(migrated, packaged);
    return saveInventory(withPackaged);
  } catch (error) {
    console.warn("Could not load local inventory; using the starter data.", error);
    const initial = deepClone(DEFAULT_INVENTORY);
    saveInventory(initial);
    return initial;
  }
}

export function saveInventory(inventory) {
  const normalized = normalizeInventory(inventory);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetInventory() {
  const initial = deepClone(DEFAULT_INVENTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export async function resetToPackagedInventory() {
  const packaged = await loadPackagedInventory();
  return saveInventory(packaged);
}

export function parseInventoryFile(text) {
  const parsed = JSON.parse(text);

  if (Array.isArray(parsed)) {
    return normalizeInventory({
      spools: parsed,
      events: [
        {
          type: "import",
          message: `Imported ${parsed.length} spools from a JSON file.`,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  if (!parsed || !Array.isArray(parsed.spools)) {
    throw new Error(
      "The JSON file must contain a spools array, or be an array of spool records.",
    );
  }

  return migrateStarterInventory(normalizeInventory(parsed));
}

export function createEvent(type, message) {
  return {
    id: crypto.randomUUID(),
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}

export function storageKey() {
  return STORAGE_KEY;
}
