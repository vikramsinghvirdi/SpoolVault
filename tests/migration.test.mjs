import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

class LocalStorageMock {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

globalThis.localStorage = new LocalStorageMock();

const {
  INITIAL_SEED_SPOOLS,
  JULY_12_PURCHASE_MIGRATION_ID,
  JULY_13_PURCHASE_MIGRATION_ID,
  SEED_SPOOLS,
  STARTER_V2_SPOOLS,
} = await import("../src/catalog.js");
const {
  applyJulyPurchaseUpdate,
  applyLatestPurchaseUpdate,
  loadInventory,
} = await import("../src/storage.js");

const KEY = "spoolvault.local.v1";

function legacyInventory(starterDataVersion) {
  return {
    schemaVersion: 1,
    ...(starterDataVersion === undefined ? {} : { starterDataVersion }),
    spools: structuredClone(INITIAL_SEED_SPOOLS),
    events: [
      {
        id: "seed-event-1",
        type: "import",
        message: "Started with the original inventory.",
        createdAt: "2026-07-11T21:00:00.000Z",
      },
    ],
    settings: {
      viewMode: "products",
      displayMode: "cards",
      theme: "system",
    },
  };
}

function july12Inventory() {
  return {
    ...legacyInventory(3),
    appliedMigrations: [JULY_12_PURCHASE_MIGRATION_ID],
    spools: [
      ...structuredClone(INITIAL_SEED_SPOOLS),
      ...structuredClone(STARTER_V2_SPOOLS),
    ],
    events: [
      ...legacyInventory(3).events,
      {
        id: "seed-event-2",
        type: "import",
        message: "Added the July 12 purchase.",
        createdAt: "2026-07-12T19:40:00.000Z",
      },
    ],
  };
}

test("migrates the original 36-spool inventory to 56 spools", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify(legacyInventory(undefined)));

  const inventory = await loadInventory();
  assert.equal(inventory.spools.length, 56);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v2-")).length, 10);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v4-")).length, 10);
  assert.equal(inventory.starterDataVersion, 5);
  assert.ok(inventory.appliedMigrations.includes(JULY_12_PURCHASE_MIGRATION_ID));
  assert.ok(inventory.appliedMigrations.includes(JULY_13_PURCHASE_MIGRATION_ID));
});

test("repairs a v0.2 marker even when the ten records are missing", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify(legacyInventory(2)));

  const inventory = await loadInventory();
  assert.equal(inventory.spools.length, 56);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v2-")).length, 10);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v4-")).length, 10);
  assert.equal(inventory.starterDataVersion, 5);
});

test("migrates the 46-spool July 12 inventory to 56 spools", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify(july12Inventory()));

  const inventory = await loadInventory();
  assert.equal(inventory.spools.length, 56);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v2-")).length, 10);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v4-")).length, 10);
  assert.equal(inventory.starterDataVersion, 5);
  assert.ok(inventory.appliedMigrations.includes(JULY_12_PURCHASE_MIGRATION_ID));
  assert.ok(inventory.appliedMigrations.includes(JULY_13_PURCHASE_MIGRATION_ID));
});

test("repairs a v0.3 marker even when the July 13 records are missing", async () => {
  localStorage.clear();
  const incompleteV4 = {
    ...july12Inventory(),
    starterDataVersion: 4,
    appliedMigrations: [
      JULY_12_PURCHASE_MIGRATION_ID,
      JULY_13_PURCHASE_MIGRATION_ID,
    ],
  };
  localStorage.setItem(KEY, JSON.stringify(incompleteV4));

  const inventory = await loadInventory();
  assert.equal(inventory.spools.length, 56);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v4-")).length, 10);
  assert.equal(inventory.starterDataVersion, 5);
  assert.ok(inventory.appliedMigrations.includes(JULY_13_PURCHASE_MIGRATION_ID));
});

test("merges missing records from packaged inventory json", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify({
    ...july12Inventory(),
    starterDataVersion: 5,
    appliedMigrations: [
      JULY_12_PURCHASE_MIGRATION_ID,
      JULY_13_PURCHASE_MIGRATION_ID,
    ],
  }));

  const inventory = await loadInventory({
    packagedInventory: {
      ...july12Inventory(),
      starterDataVersion: 5,
      spools: structuredClone(SEED_SPOOLS),
      appliedMigrations: [
        JULY_12_PURCHASE_MIGRATION_ID,
        JULY_13_PURCHASE_MIGRATION_ID,
      ],
    },
  });

  assert.equal(inventory.spools.length, 56);
  assert.equal(inventory.spools.filter((spool) => spool.id.startsWith("seed-v4-")).length, 10);
  assert.equal(inventory.events[0].id, "packaged-inventory-repair");
});

test("manual July 12 repair is idempotent", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify(legacyInventory(1)));
  const inventory = await loadInventory();

  const first = applyJulyPurchaseUpdate(inventory);
  const second = applyJulyPurchaseUpdate(first.inventory);

  assert.equal(first.addedCount, 0);
  assert.equal(second.addedCount, 0);
  assert.equal(second.inventory.spools.length, 56);
});

test("manual July 13 repair is idempotent", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify(july12Inventory()));
  const inventory = await loadInventory();

  const first = applyLatestPurchaseUpdate(inventory);
  const second = applyLatestPurchaseUpdate(first.inventory);

  assert.equal(first.addedCount, 0);
  assert.equal(second.addedCount, 0);
  assert.equal(second.inventory.spools.length, 56);
});

test("does not inject personal starter purchases into unrelated custom data", async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify({
    schemaVersion: 1,
    spools: [
      {
        id: "custom-1",
        brand: "Other Brand",
        productLine: "PLA",
        materialFamily: "PLA",
        colorName: "Purple",
        colorFamily: "Purple",
        colorHex: "#663399",
        initialWeightG: 1000,
        remainingWeightG: 700,
      },
    ],
    events: [],
    settings: {},
  }));

  const inventory = await loadInventory();
  assert.equal(inventory.spools.length, 1);
  assert.equal(inventory.starterDataVersion, 0);
});
