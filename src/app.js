import {
  applyJulyPurchaseUpdate,
  applyLatestPurchaseUpdate,
  createEvent,
  loadInventory,
  normalizeSpool,
  parseInventoryFile,
  resetInventory,
  resetToPackagedInventory,
  saveInventory,
} from "./storage.js";

const STATUS_ORDER = [
  "Needs audit",
  "Loaded",
  "Open",
  "Reserved",
  "Sealed",
  "Empty",
];

const STATUS_ICONS = {
  "Needs audit": "!",
  Loaded: "▶",
  Open: "◒",
  Reserved: "◆",
  Sealed: "✓",
  Empty: "○",
  Mixed: "≋",
};

const EVENT_ICONS = {
  add: "+",
  update: "↻",
  usage: "−",
  delete: "×",
  import: "⇩",
  reset: "↺",
};

const filters = {
  query: "",
  brand: "",
  material: "",
  type: "",
  color: "",
  status: "",
  packaging: "",
  location: "",
  stock: "",
  link: "",
  quick: "all",
  sort: "updated-desc",
};

let inventory = await loadInventory();
let dialogMode = "add";
let editingId = "";
let remainingTouched = false;

const dom = {
  summaryGrid: document.querySelector("#summaryGrid"),
  inventoryContent: document.querySelector("#inventoryContent"),
  activityList: document.querySelector("#activityList"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  filterToggle: document.querySelector("#filterToggle"),
  filtersPanel: document.querySelector("#filtersPanel"),
  filterCountBadge: document.querySelector("#filterCountBadge"),
  quickFilters: document.querySelector("#quickFilters"),
  activeFilters: document.querySelector("#activeFilters"),
  resetFiltersButton: document.querySelector("#resetFiltersButton"),
  brandFilter: document.querySelector("#brandFilter"),
  materialFilter: document.querySelector("#materialFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  colorFilter: document.querySelector("#colorFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  packagingFilter: document.querySelector("#packagingFilter"),
  locationFilter: document.querySelector("#locationFilter"),
  stockFilter: document.querySelector("#stockFilter"),
  linkFilter: document.querySelector("#linkFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  addSpoolButton: document.querySelector("#addSpoolButton"),
  themeButton: document.querySelector("#themeButton"),
  spoolDialog: document.querySelector("#spoolDialog"),
  spoolForm: document.querySelector("#spoolForm"),
  spoolDialogEyebrow: document.querySelector("#spoolDialogEyebrow"),
  spoolDialogTitle: document.querySelector("#spoolDialogTitle"),
  saveSpoolButton: document.querySelector("#saveSpoolButton"),
  spoolId: document.querySelector("#spoolId"),
  brandInput: document.querySelector("#brandInput"),
  productLineInput: document.querySelector("#productLineInput"),
  materialInput: document.querySelector("#materialInput"),
  skuInput: document.querySelector("#skuInput"),
  productUrlInput: document.querySelector("#productUrlInput"),
  colorNameInput: document.querySelector("#colorNameInput"),
  colorFamilyInput: document.querySelector("#colorFamilyInput"),
  colorHexInput: document.querySelector("#colorHexInput"),
  colorPreview: document.querySelector("#colorPreview"),
  quantityField: document.querySelector("#quantityField"),
  quantityInput: document.querySelector("#quantityInput"),
  initialWeightInput: document.querySelector("#initialWeightInput"),
  remainingWeightInput: document.querySelector("#remainingWeightInput"),
  statusInput: document.querySelector("#statusInput"),
  packagingInput: document.querySelector("#packagingInput"),
  reorderInput: document.querySelector("#reorderInput"),
  locationInput: document.querySelector("#locationInput"),
  verifiedInput: document.querySelector("#verifiedInput"),
  notesInput: document.querySelector("#notesInput"),
  lookupButton: document.querySelector("#lookupButton"),
  brandSuggestions: document.querySelector("#brandSuggestions"),
  typeSuggestions: document.querySelector("#typeSuggestions"),
  materialSuggestions: document.querySelector("#materialSuggestions"),
  locationSuggestions: document.querySelector("#locationSuggestions"),
  usageDialog: document.querySelector("#usageDialog"),
  usageForm: document.querySelector("#usageForm"),
  usageSpoolId: document.querySelector("#usageSpoolId"),
  usageSpoolSummary: document.querySelector("#usageSpoolSummary"),
  usageAmountInput: document.querySelector("#usageAmountInput"),
  markOpenInput: document.querySelector("#markOpenInput"),
  usageHint: document.querySelector("#usageHint"),
  importFileInput: document.querySelector("#importFileInput"),
  toastRegion: document.querySelector("#toastRegion"),
};

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function safeHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#7C8591";
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function formatWeight(grams, compact = false) {
  const value = Number(grams || 0);
  if (value >= 1000) {
    const kilograms = value / 1000;
    const decimals = Number.isInteger(kilograms) ? 0 : 1;
    return `${kilograms.toFixed(decimals)}${compact ? "kg" : " kg"}`;
  }
  return `${Math.round(value)}${compact ? "g" : " g"}`;
}

function formatPercent(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (abs < 60) return formatter.format(seconds, "second");
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return formatter.format(Math.round(seconds / 86400), "day");
  return formatDate(value);
}

function percentRemaining(item) {
  const initial = getInitialWeight(item);
  return initial > 0 ? (getRemainingWeight(item) / initial) * 100 : 0;
}

function getRemainingWeight(item) {
  return "totalRemainingG" in item
    ? item.totalRemainingG
    : Number(item.remainingWeightG || 0);
}

function getInitialWeight(item) {
  return "totalInitialG" in item
    ? item.totalInitialG
    : Number(item.initialWeightG || 0);
}

function isLowSpool(spool) {
  const remaining = Number(spool.remainingWeightG || 0);
  return remaining > 0 && remaining <= Number(spool.reorderAtG || 0);
}

function isLowItem(item) {
  if ("spools" in item) {
    if (item.totalRemainingG <= 0) return false;
    return item.totalRemainingG <= item.reorderAtG;
  }
  return isLowSpool(item);
}

function stockBucket(item) {
  const remaining = getRemainingWeight(item);
  const pct = percentRemaining(item);
  const needsAudit = "spools" in item
    ? item.spools.some((spool) => !spool.verified || spool.status === "Needs audit")
    : !item.verified || item.status === "Needs audit";

  if (remaining <= 0) return "empty";
  if (isLowItem(item)) return "low";
  if (needsAudit) return "needs-audit";
  if (pct >= 90) return "full";
  return "in-use";
}

function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-");
}

function groupKeyFor(spool) {
  const identity = spool.sku
    ? `sku:${spool.sku}`
    : `${spool.productLine}|${spool.colorName}|${spool.initialWeightG}`;
  return `${spool.brand}|${identity}`.toLowerCase();
}

function groupSpools(spools) {
  const grouped = new Map();

  for (const spool of spools) {
    const key = groupKeyFor(spool);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(spool);
  }

  return Array.from(grouped.entries()).map(([key, members]) => {
    const first = members[0];
    const statusCounts = Object.fromEntries(
      STATUS_ORDER.map((status) => [
        status,
        members.filter((spool) => spool.status === status).length,
      ]),
    );
    const packagingCounts = members.reduce((counts, spool) => {
      counts[spool.packaging] = (counts[spool.packaging] || 0) + 1;
      return counts;
    }, {});
    const locations = [...new Set(members.map((spool) => spool.location).filter(Boolean))];
    const totalRemainingG = sum(members.map((spool) => spool.remainingWeightG));
    const totalInitialG = sum(members.map((spool) => spool.initialWeightG));
    const reorderAtG = Math.max(...members.map((spool) => Number(spool.reorderAtG || 0)));
    const productUrl = members.map((spool) => safeUrl(spool.productUrl)).find(Boolean) || "";
    const updatedAt = members
      .map((spool) => spool.updatedAt)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    const addedAt = members
      .map((spool) => spool.addedAt)
      .sort((a, b) => new Date(a) - new Date(b))[0];

    let status = "Mixed";
    if (members.every((spool) => spool.status === "Empty")) status = "Empty";
    else if (members.every((spool) => spool.status === "Needs audit")) status = "Needs audit";
    else if (members.some((spool) => spool.status === "Loaded")) status = "Loaded";
    else if (members.some((spool) => spool.status === "Open")) status = "Open";
    else if (members.every((spool) => spool.status === "Sealed")) status = "Sealed";
    else if (members.some((spool) => spool.status === "Reserved")) status = "Reserved";

    return {
      key,
      brand: first.brand,
      productLine: first.productLine,
      materialFamily: first.materialFamily,
      colorName: first.colorName,
      colorFamily: first.colorFamily,
      colorHex: first.colorHex,
      sku: first.sku,
      productUrl,
      spools: members,
      quantity: members.length,
      totalRemainingG,
      totalInitialG,
      reorderAtG,
      status,
      statusCounts,
      packagingCounts,
      locations,
      notes: members.map((spool) => spool.notes).filter(Boolean).join(" "),
      updatedAt,
      addedAt,
      verified: members.every((spool) => spool.verified),
    };
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(collator.compare);
}

function setSelectOptions(select, options, allLabel, currentValue) {
  const html = [
    `<option value="">${escapeHtml(allLabel)}</option>`,
    ...options.map(
      (value) =>
        `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`,
    ),
  ].join("");
  select.innerHTML = html;
  select.value = options.includes(currentValue) ? currentValue : "";
}

function setDatalist(datalist, options) {
  datalist.innerHTML = options
    .map((value) => `<option value="${escapeAttr(value)}"></option>`)
    .join("");
}

function populateOptions() {
  const spools = inventory.spools;
  setSelectOptions(
    dom.brandFilter,
    uniqueSorted(spools.map((spool) => spool.brand)),
    "All brands",
    filters.brand,
  );
  setSelectOptions(
    dom.materialFilter,
    uniqueSorted(spools.map((spool) => spool.materialFamily)),
    "All material families",
    filters.material,
  );
  setSelectOptions(
    dom.typeFilter,
    uniqueSorted(spools.map((spool) => spool.productLine)),
    "All types",
    filters.type,
  );
  setSelectOptions(
    dom.colorFilter,
    uniqueSorted(spools.map((spool) => spool.colorFamily)),
    "All color families",
    filters.color,
  );
  setSelectOptions(
    dom.statusFilter,
    STATUS_ORDER,
    "All statuses",
    filters.status,
  );
  setSelectOptions(
    dom.packagingFilter,
    uniqueSorted(spools.map((spool) => spool.packaging)),
    "All packaging",
    filters.packaging,
  );
  setSelectOptions(
    dom.locationFilter,
    uniqueSorted(spools.map((spool) => spool.location)),
    "All locations",
    filters.location,
  );

  setDatalist(dom.brandSuggestions, uniqueSorted(spools.map((spool) => spool.brand)));
  setDatalist(dom.typeSuggestions, uniqueSorted(spools.map((spool) => spool.productLine)));
  setDatalist(
    dom.materialSuggestions,
    uniqueSorted([
      "PLA",
      "PETG",
      "ABS",
      "ASA",
      "TPU",
      "TPE",
      "PET",
      "Nylon",
      "PC",
      "PVA",
      "HIPS",
      "Support",
      "Other",
      ...spools.map((spool) => spool.materialFamily),
    ]),
  );
  setDatalist(
    dom.locationSuggestions,
    uniqueSorted([
      "Unassigned",
      "Shelf A",
      "Shelf B",
      "Dry box",
      "AMS 1 Slot 1",
      "AMS 1 Slot 2",
      "AMS 1 Slot 3",
      "AMS 1 Slot 4",
      ...spools.map((spool) => spool.location),
    ]),
  );
}

function parseSearchQuery(query) {
  const terms = [];
  const expression = /(\w+):(?:"([^"]+)"|(\S+))|"([^"]+)"|(\S+)/g;
  let match;

  while ((match = expression.exec(query.trim())) !== null) {
    if (match[1]) {
      terms.push({ field: match[1].toLowerCase(), value: (match[2] || match[3] || "").toLowerCase() });
    } else {
      terms.push({ field: "", value: (match[4] || match[5] || "").toLowerCase() });
    }
  }

  return terms;
}

function searchFields(item) {
  const statuses = "spools" in item
    ? item.spools.map((spool) => spool.status).join(" ")
    : item.status;
  const packaging = "spools" in item
    ? Object.keys(item.packagingCounts).join(" ")
    : item.packaging;
  const locations = "spools" in item ? item.locations.join(" ") : item.location;

  return {
    brand: item.brand,
    type: item.productLine,
    product: item.productLine,
    material: item.materialFamily,
    color: `${item.colorName} ${item.colorFamily} ${item.colorHex}`,
    sku: item.sku,
    status: statuses,
    location: locations,
    packaging,
    package: packaging,
    note: item.notes,
    link: item.productUrl,
    all: [
      item.brand,
      item.productLine,
      item.materialFamily,
      item.colorName,
      item.colorFamily,
      item.sku,
      statuses,
      packaging,
      locations,
      item.notes,
      item.productUrl,
    ].join(" "),
  };
}

function matchesSearch(item, query) {
  const terms = parseSearchQuery(query);
  if (!terms.length) return true;
  const fields = searchFields(item);

  return terms.every(({ field, value }) => {
    if (!value) return true;
    const target = fields[field] ?? fields.all;
    return String(target || "").toLowerCase().includes(value);
  });
}

function itemStatuses(item) {
  return "spools" in item
    ? item.spools.map((spool) => spool.status)
    : [item.status];
}

function itemPackaging(item) {
  return "spools" in item ? Object.keys(item.packagingCounts) : [item.packaging];
}

function itemLocations(item) {
  return "spools" in item ? item.locations : [item.location];
}

function passesFilters(item) {
  if (filters.query && !matchesSearch(item, filters.query)) return false;
  if (filters.brand && item.brand !== filters.brand) return false;
  if (filters.material && item.materialFamily !== filters.material) return false;
  if (filters.type && item.productLine !== filters.type) return false;
  if (filters.color && item.colorFamily !== filters.color) return false;
  if (filters.status && !itemStatuses(item).includes(filters.status)) return false;
  if (filters.packaging && !itemPackaging(item).includes(filters.packaging)) return false;
  if (filters.location && !itemLocations(item).includes(filters.location)) return false;
  if (filters.stock && stockBucket(item) !== filters.stock) return false;

  if (filters.link === "has-link" && !safeUrl(item.productUrl)) return false;
  if (filters.link === "no-link" && safeUrl(item.productUrl)) return false;
  if (filters.link === "has-sku" && !item.sku) return false;
  if (filters.link === "no-sku" && item.sku) return false;

  if (filters.quick === "audit") {
    const needsAudit = "spools" in item
      ? item.spools.some((spool) => !spool.verified || spool.status === "Needs audit")
      : !item.verified || item.status === "Needs audit";
    if (!needsAudit) return false;
  }
  if (filters.quick === "low" && !isLowItem(item)) return false;
  if (filters.quick === "active") {
    if (!itemStatuses(item).some((status) => ["Open", "Loaded"].includes(status))) return false;
  }
  if (filters.quick === "sealed" && !itemStatuses(item).includes("Sealed")) return false;

  return true;
}

function hexToColorSort(hex) {
  const normalized = safeHex(hex).slice(1);
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return saturation < 0.12 ? 1000 + lightness * 100 : hue;
}

function sortItems(items) {
  const statusRank = (status) => {
    const index = STATUS_ORDER.indexOf(status);
    return index === -1 ? STATUS_ORDER.length : index;
  };

  return [...items].sort((a, b) => {
    let result = 0;
    switch (filters.sort) {
      case "added-desc":
        result = new Date(b.addedAt) - new Date(a.addedAt);
        break;
      case "color-spectrum":
        result = hexToColorSort(a.colorHex) - hexToColorSort(b.colorHex);
        break;
      case "color-asc":
        result = collator.compare(a.colorName, b.colorName);
        break;
      case "type-asc":
        result = collator.compare(a.productLine, b.productLine);
        break;
      case "brand-asc":
        result = collator.compare(a.brand, b.brand);
        break;
      case "remaining-asc":
        result = getRemainingWeight(a) - getRemainingWeight(b);
        break;
      case "remaining-desc":
        result = getRemainingWeight(b) - getRemainingWeight(a);
        break;
      case "percent-asc":
        result = percentRemaining(a) - percentRemaining(b);
        break;
      case "quantity-desc":
        result = (b.quantity || 1) - (a.quantity || 1);
        break;
      case "status-asc":
        result = statusRank(a.status) - statusRank(b.status);
        break;
      case "sku-asc":
        result = collator.compare(a.sku || "zzzz", b.sku || "zzzz");
        break;
      case "updated-desc":
      default:
        result = new Date(b.updatedAt) - new Date(a.updatedAt);
        break;
    }

    return result || collator.compare(a.productLine, b.productLine) || collator.compare(a.colorName, b.colorName);
  });
}

function swatchMarkup(item, extraClass = "") {
  const clearClass = item.colorFamily === "Clear" ? " clear" : "";
  return `<span class="color-swatch${clearClass} ${extraClass}" style="--swatch:${safeHex(item.colorHex)}" role="img" aria-label="${escapeAttr(item.colorName)} color swatch"></span>`;
}

function productReferenceMarkup(item) {
  const url = safeUrl(item.productUrl);
  if (url) {
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(item.sku || "Product link")} ↗</a>`;
  }
  return `<strong>${escapeHtml(item.sku || "Not set")}</strong>`;
}

function productBadges(group) {
  const badges = [];
  const auditCount = group.spools.filter(
    (spool) => !spool.verified || spool.status === "Needs audit",
  ).length;

  if (auditCount) badges.push(`<span class="badge audit">Needs audit ×${auditCount}</span>`);
  if (isLowItem(group)) badges.push(`<span class="badge low">Low stock</span>`);

  for (const status of ["Loaded", "Open", "Reserved", "Sealed", "Empty"]) {
    const count = group.statusCounts[status] || 0;
    if (count) {
      badges.push(`<span class="badge ${statusClass(status)}">${escapeHtml(status)} ×${count}</span>`);
    }
    if (badges.length >= 3) break;
  }

  return badges.join("");
}

function spoolBadges(spool) {
  const badges = [
    `<span class="badge ${statusClass(spool.status)}">${escapeHtml(spool.status)}</span>`,
  ];
  if (!spool.verified) badges.push(`<span class="badge warning">Estimated</span>`);
  if (isLowSpool(spool)) badges.push(`<span class="badge low">Low stock</span>`);
  return badges.join("");
}

function packagingSummary(group) {
  return Object.entries(group.packagingCounts)
    .map(([name, count]) => `${count} ${name.toLowerCase()}`)
    .join(", ");
}

function statusSummary(group) {
  return Object.entries(group.statusCounts)
    .filter(([, count]) => count)
    .map(([status, count]) => `${count} ${status.toLowerCase()}`)
    .join(", ");
}

function spoolSequence(spool) {
  const peers = inventory.spools
    .filter((candidate) => groupKeyFor(candidate) === groupKeyFor(spool))
    .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
  const index = peers.findIndex((candidate) => candidate.id === spool.id);
  return peers.length > 1 ? `Spool ${index + 1} of ${peers.length}` : "Individual spool";
}

function productCard(group) {
  const percent = percentRemaining(group);
  const low = isLowItem(group);
  const firstId = group.spools[0]?.id || "";
  const locations = group.locations.join(", ") || "Unassigned";

  return `
    <article class="inventory-card product-card">
      <div class="card-top">
        ${swatchMarkup(group)}
        <div class="card-title-wrap">
          <p class="card-kicker">${escapeHtml(group.brand)} · ${escapeHtml(group.materialFamily)}</p>
          <h3 class="card-title" title="${escapeAttr(group.productLine)}">${escapeHtml(group.productLine)}</h3>
          <p class="card-color-name" title="${escapeAttr(group.colorName)}">${escapeHtml(group.colorName)}</p>
        </div>
        <span class="quantity-badge" title="Physical quantity">×${group.quantity}</span>
      </div>
      <div class="badge-row">${productBadges(group)}</div>
      <div class="card-metrics">
        <div>
          <div class="metric-label">Total remaining</div>
          <div class="metric-value">${formatWeight(group.totalRemainingG)}</div>
        </div>
        <div class="metric-side">${formatPercent(percent)}</div>
      </div>
      <div class="progress-track" aria-label="${formatPercent(percent)} remaining">
        <div class="progress-bar${low ? " low" : ""}" style="width:${clamp(percent, 0, 100)}%"></div>
      </div>
      <div class="card-meta">
        <div class="meta-item">
          <span>SKU / link</span>
          ${productReferenceMarkup(group)}
        </div>
        <div class="meta-item">
          <span>Packaging</span>
          <strong title="${escapeAttr(packagingSummary(group))}">${escapeHtml(packagingSummary(group))}</strong>
        </div>
        <div class="meta-item">
          <span>Location</span>
          <strong title="${escapeAttr(locations)}">${escapeHtml(locations)}</strong>
        </div>
        <div class="meta-item">
          <span>Status mix</span>
          <strong title="${escapeAttr(statusSummary(group))}">${escapeHtml(statusSummary(group) || "None")}</strong>
        </div>
      </div>
      <div class="card-actions">
        <button class="primary-action" type="button" data-action="show-product" data-group-key="${escapeAttr(group.key)}">View spools</button>
        <button type="button" data-action="add-copy" data-id="${escapeAttr(firstId)}">Add another</button>
        <button type="button" data-action="lookup" data-id="${escapeAttr(firstId)}">Find online</button>
      </div>
    </article>`;
}

function spoolCard(spool) {
  const percent = percentRemaining(spool);
  const low = isLowSpool(spool);
  return `
    <article class="inventory-card spool-card">
      <div class="card-top">
        ${swatchMarkup(spool)}
        <div class="card-title-wrap">
          <p class="card-kicker">${escapeHtml(spool.brand)} · ${escapeHtml(spoolSequence(spool))}</p>
          <h3 class="card-title" title="${escapeAttr(spool.productLine)}">${escapeHtml(spool.productLine)}</h3>
          <p class="card-color-name" title="${escapeAttr(spool.colorName)}">${escapeHtml(spool.colorName)}</p>
        </div>
        <span class="quantity-badge" title="Material family">${escapeHtml(spool.materialFamily)}</span>
      </div>
      <div class="badge-row">${spoolBadges(spool)}</div>
      <div class="card-metrics">
        <div>
          <div class="metric-label">Remaining</div>
          <div class="metric-value">${formatWeight(spool.remainingWeightG)}</div>
        </div>
        <div class="metric-side">of ${formatWeight(spool.initialWeightG, true)} · ${formatPercent(percent)}</div>
      </div>
      <div class="progress-track" aria-label="${formatPercent(percent)} remaining">
        <div class="progress-bar${low ? " low" : ""}" style="width:${clamp(percent, 0, 100)}%"></div>
      </div>
      <div class="card-meta">
        <div class="meta-item">
          <span>SKU / link</span>
          ${productReferenceMarkup(spool)}
        </div>
        <div class="meta-item">
          <span>Packaging</span>
          <strong>${escapeHtml(spool.packaging)}</strong>
        </div>
        <div class="meta-item">
          <span>Location</span>
          <strong title="${escapeAttr(spool.location)}">${escapeHtml(spool.location)}</strong>
        </div>
        <div class="meta-item">
          <span>Updated</span>
          <strong title="${escapeAttr(formatDate(spool.updatedAt))}">${escapeHtml(relativeTime(spool.updatedAt))}</strong>
        </div>
      </div>
      <div class="card-actions">
        <button class="primary-action" type="button" data-action="use" data-id="${escapeAttr(spool.id)}">Log use</button>
        <button type="button" data-action="edit" data-id="${escapeAttr(spool.id)}">${spool.status === "Needs audit" ? "Audit" : "Edit"}</button>
        <button type="button" data-action="duplicate" data-id="${escapeAttr(spool.id)}">Copy</button>
        <button class="danger-action" type="button" data-action="delete" data-id="${escapeAttr(spool.id)}">Delete</button>
      </div>
    </article>`;
}

function productTable(groups) {
  const rows = groups
    .map((group) => {
      const percent = percentRemaining(group);
      const firstId = group.spools[0]?.id || "";
      return `
        <tr>
          <td>
            <div class="table-product">
              ${swatchMarkup(group)}
              <div>
                <strong>${escapeHtml(group.colorName)}</strong>
                <span>${escapeHtml(group.colorFamily)}</span>
              </div>
            </div>
          </td>
          <td><strong>${escapeHtml(group.productLine)}</strong><br><span class="muted-note">${escapeHtml(group.materialFamily)}</span></td>
          <td>${escapeHtml(group.brand)}</td>
          <td>${productReferenceMarkup(group)}</td>
          <td class="table-number"><strong>${group.quantity}</strong></td>
          <td class="table-progress table-number">
            <strong>${formatWeight(group.totalRemainingG)}</strong> · ${formatPercent(percent)}
            <div class="progress-track"><div class="progress-bar${isLowItem(group) ? " low" : ""}" style="width:${clamp(percent, 0, 100)}%"></div></div>
          </td>
          <td><div class="badge-row">${productBadges(group)}</div></td>
          <td>${escapeHtml(packagingSummary(group))}</td>
          <td title="${escapeAttr(group.locations.join(", "))}">${escapeHtml(group.locations.join(", ") || "Unassigned")}</td>
          <td>
            <div class="table-actions">
              <button type="button" data-action="show-product" data-group-key="${escapeAttr(group.key)}">View</button>
              <button type="button" data-action="add-copy" data-id="${escapeAttr(firstId)}">Add</button>
              <button type="button" data-action="lookup" data-id="${escapeAttr(firstId)}">Find</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div class="table-wrap">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Color</th>
            <th>Type</th>
            <th>Brand</th>
            <th>SKU / link</th>
            <th>Qty</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Packaging</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function spoolTable(spools) {
  const rows = spools
    .map((spool) => {
      const percent = percentRemaining(spool);
      return `
        <tr>
          <td>
            <div class="table-product">
              ${swatchMarkup(spool)}
              <div>
                <strong>${escapeHtml(spool.colorName)}</strong>
                <span>${escapeHtml(spoolSequence(spool))}</span>
              </div>
            </div>
          </td>
          <td><strong>${escapeHtml(spool.productLine)}</strong><br><span class="muted-note">${escapeHtml(spool.materialFamily)}</span></td>
          <td>${escapeHtml(spool.brand)}</td>
          <td>${productReferenceMarkup(spool)}</td>
          <td class="table-progress table-number">
            <strong>${formatWeight(spool.remainingWeightG)}</strong> of ${formatWeight(spool.initialWeightG)} · ${formatPercent(percent)}
            <div class="progress-track"><div class="progress-bar${isLowSpool(spool) ? " low" : ""}" style="width:${clamp(percent, 0, 100)}%"></div></div>
          </td>
          <td><div class="badge-row">${spoolBadges(spool)}</div></td>
          <td>${escapeHtml(spool.packaging)}</td>
          <td title="${escapeAttr(spool.location)}">${escapeHtml(spool.location)}</td>
          <td title="${escapeAttr(formatDate(spool.updatedAt))}">${escapeHtml(relativeTime(spool.updatedAt))}</td>
          <td>
            <div class="table-actions">
              <button type="button" data-action="use" data-id="${escapeAttr(spool.id)}">Use</button>
              <button type="button" data-action="edit" data-id="${escapeAttr(spool.id)}">Edit</button>
              <button type="button" data-action="duplicate" data-id="${escapeAttr(spool.id)}">Copy</button>
              <button class="danger-action" type="button" data-action="delete" data-id="${escapeAttr(spool.id)}">Delete</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div class="table-wrap">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Color</th>
            <th>Type</th>
            <th>Brand</th>
            <th>SKU / link</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Packaging</th>
            <th>Location</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function emptyStateMarkup() {
  const hasInventory = inventory.spools.length > 0;
  return `
    <div class="empty-state">
      <div>
        <div class="empty-state-icon" aria-hidden="true">◎</div>
        <h3>${hasInventory ? "No spools match these filters" : "Your inventory is empty"}</h3>
        <p>${
          hasInventory
            ? "Try clearing a filter or searching for a broader term."
            : "Add your first spool with its brand, material, color, weight, and location."
        }</p>
        <button class="button primary" type="button" data-empty-action="${hasInventory ? "clear" : "add"}">
          ${hasInventory ? "Clear filters" : "Add first spool"}
        </button>
      </div>
    </div>`;
}

function renderSummary(groups) {
  const totalRemaining = sum(inventory.spools.map((spool) => spool.remainingWeightG));
  const totalInitial = sum(inventory.spools.map((spool) => spool.initialWeightG));
  const auditCount = inventory.spools.filter(
    (spool) => !spool.verified || spool.status === "Needs audit",
  ).length;
  const lowCount = groups.filter(isLowItem).length;
  const estimatedLabel = auditCount ? "Includes estimated amounts" : "All amounts audited";

  const cards = [
    {
      label: "Physical spools",
      value: inventory.spools.length,
      detail: `${inventory.spools.filter((spool) => spool.status !== "Empty").length} not marked empty`,
      icon: "◎",
      action: "spools",
    },
    {
      label: "Unique products",
      value: groups.length,
      detail: "Grouped by brand and SKU",
      icon: "▦",
      action: "products",
    },
    {
      label: "Material remaining",
      value: formatWeight(totalRemaining, true),
      detail: `${formatWeight(totalInitial)} nominal · ${estimatedLabel}`,
      icon: "kg",
      action: "all",
    },
    {
      label: "Needs audit",
      value: auditCount,
      detail: "Confirm physical stock and weight",
      icon: "!",
      action: "audit",
    },
    {
      label: "At reorder level",
      value: lowCount,
      detail: "Product groups at their threshold",
      icon: "↓",
      action: "low",
    },
  ];

  dom.summaryGrid.innerHTML = cards
    .map(
      (card) => `
      <button class="summary-card" type="button" data-summary-action="${card.action}">
        <span class="summary-icon" aria-hidden="true">${card.icon}</span>
        <span class="summary-label">${escapeHtml(card.label)}</span>
        <span class="summary-value">${escapeHtml(card.value)}</span>
        <span class="summary-detail">${escapeHtml(card.detail)}</span>
      </button>`,
    )
    .join("");
}

function renderActivity() {
  const events = [...inventory.events]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  if (!events.length) {
    dom.activityList.innerHTML = `<p class="muted-note">No activity yet.</p>`;
    return;
  }

  dom.activityList.innerHTML = events
    .map(
      (event) => `
      <div class="activity-item">
        <span class="activity-icon" aria-hidden="true">${EVENT_ICONS[event.type] || "·"}</span>
        <p class="activity-message">${escapeHtml(event.message)}</p>
        <time class="activity-time" datetime="${escapeAttr(event.createdAt)}">${escapeHtml(relativeTime(event.createdAt))}</time>
      </div>`,
    )
    .join("");
}

function filterLabels() {
  return [
    ["query", filters.query ? `Search: ${filters.query}` : ""],
    ["quick", filters.quick !== "all" ? `Quick: ${filters.quick}` : ""],
    ["brand", filters.brand ? `Brand: ${filters.brand}` : ""],
    ["material", filters.material ? `Material: ${filters.material}` : ""],
    ["type", filters.type ? `Type: ${filters.type}` : ""],
    ["color", filters.color ? `Color: ${filters.color}` : ""],
    ["status", filters.status ? `Status: ${filters.status}` : ""],
    ["packaging", filters.packaging ? `Packaging: ${filters.packaging}` : ""],
    ["location", filters.location ? `Location: ${filters.location}` : ""],
    ["stock", filters.stock ? `Stock: ${filters.stock.replaceAll("-", " ")}` : ""],
    ["link", filters.link ? `Reference: ${filters.link.replaceAll("-", " ")}` : ""],
  ].filter(([, label]) => label);
}

function renderFilterState() {
  const active = filterLabels();
  dom.activeFilters.innerHTML = active
    .map(
      ([key, label]) => `
      <span class="filter-chip">
        ${escapeHtml(label)}
        <button type="button" data-clear-filter="${escapeAttr(key)}" aria-label="Remove ${escapeAttr(label)}">×</button>
      </span>`,
    )
    .join("");

  dom.filterCountBadge.hidden = active.length === 0;
  dom.filterCountBadge.textContent = String(active.length);
  dom.clearSearchButton.hidden = !filters.query;

  dom.quickFilters.querySelectorAll("[data-quick-filter]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.quickFilter === filters.quick),
    );
  });

  document.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.viewMode === inventory.settings.viewMode),
    );
  });
  document.querySelectorAll("[data-display-mode]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.displayMode === inventory.settings.displayMode),
    );
  });
}

function renderInventory() {
  const groups = groupSpools(inventory.spools);
  const source = inventory.settings.viewMode === "products" ? groups : inventory.spools;
  const results = sortItems(source.filter(passesFilters));
  const noun = inventory.settings.viewMode === "products" ? "product" : "spool";

  dom.resultCount.textContent = `${results.length} ${noun}${results.length === 1 ? "" : "s"} shown`;

  if (!results.length) {
    dom.inventoryContent.innerHTML = emptyStateMarkup();
    return;
  }

  if (inventory.settings.displayMode === "table") {
    dom.inventoryContent.innerHTML =
      inventory.settings.viewMode === "products"
        ? productTable(results)
        : spoolTable(results);
  } else {
    dom.inventoryContent.innerHTML = `<div class="card-grid">${results
      .map((item) =>
        inventory.settings.viewMode === "products"
          ? productCard(item)
          : spoolCard(item),
      )
      .join("")}</div>`;
  }
}

function renderAll({ optionsChanged = false } = {}) {
  const groups = groupSpools(inventory.spools);
  if (optionsChanged) populateOptions();
  renderSummary(groups);
  renderFilterState();
  renderInventory();
  renderActivity();
  dom.sortSelect.value = filters.sort;
  dom.searchInput.value = filters.query;
  dom.stockFilter.value = filters.stock;
  dom.linkFilter.value = filters.link;
  updateThemeButton();
}

function addEvent(type, message) {
  inventory.events.push(createEvent(type, message));
  if (inventory.events.length > 250) {
    inventory.events = inventory.events
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 250);
  }
}

function persist({ optionsChanged = false } = {}) {
  inventory = saveInventory(inventory);
  renderAll({ optionsChanged });
}

function resetFilterValues() {
  filters.query = "";
  filters.brand = "";
  filters.material = "";
  filters.type = "";
  filters.color = "";
  filters.status = "";
  filters.packaging = "";
  filters.location = "";
  filters.stock = "";
  filters.link = "";
  filters.quick = "all";

  dom.brandFilter.value = "";
  dom.materialFilter.value = "";
  dom.typeFilter.value = "";
  dom.colorFilter.value = "";
  dom.statusFilter.value = "";
  dom.packagingFilter.value = "";
  dom.locationFilter.value = "";
  dom.stockFilter.value = "";
  dom.linkFilter.value = "";
  renderAll();
}

function showToast(message, icon = "✓") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${escapeHtml(icon)}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" type="button" aria-label="Dismiss">×</button>`;
  dom.toastRegion.append(toast);
  const timeout = setTimeout(() => toast.remove(), 4200);
  toast.querySelector("button").addEventListener("click", () => {
    clearTimeout(timeout);
    toast.remove();
  });
}

function applyTheme() {
  const theme = inventory.settings.theme;
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}

function updateThemeButton() {
  const theme = inventory.settings.theme;
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  dom.themeButton.title = `Theme: ${theme}. Click for ${next}.`;
  dom.themeButton.setAttribute("aria-label", dom.themeButton.title);
  dom.themeButton.firstElementChild.textContent =
    theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐";
}

function cycleTheme() {
  const current = inventory.settings.theme;
  inventory.settings.theme =
    current === "system" ? "light" : current === "light" ? "dark" : "system";
  applyTheme();
  persist();
}

function findSpool(id) {
  return inventory.spools.find((spool) => spool.id === id);
}

function setFormValue(element, value) {
  element.value = value ?? "";
}

function updateColorPreview() {
  dom.colorPreview.style.background = safeHex(dom.colorHexInput.value);
}

function openAddDialog(template = null) {
  dialogMode = "add";
  editingId = "";
  remainingTouched = false;
  dom.spoolForm.reset();
  dom.spoolId.value = "";
  dom.spoolDialogEyebrow.textContent = template ? "Duplicate product" : "New inventory item";
  dom.spoolDialogTitle.textContent = template ? "Add another spool" : "Add spool";
  dom.saveSpoolButton.textContent = template ? "Add spool" : "Save spool";
  dom.quantityField.hidden = false;
  dom.quantityInput.value = "1";

  setFormValue(dom.brandInput, template?.brand || "");
  setFormValue(dom.productLineInput, template?.productLine || "");
  setFormValue(dom.materialInput, template?.materialFamily || "PLA");
  setFormValue(dom.skuInput, template?.sku || "");
  setFormValue(dom.productUrlInput, template?.productUrl || "");
  setFormValue(dom.colorNameInput, template?.colorName || "");
  setFormValue(dom.colorFamilyInput, template?.colorFamily || "Other");
  setFormValue(dom.colorHexInput, template?.colorHex || "#777777");
  setFormValue(dom.initialWeightInput, template?.initialWeightG || 1000);
  setFormValue(dom.remainingWeightInput, template?.initialWeightG || 1000);
  setFormValue(dom.statusInput, template ? "Sealed" : "Needs audit");
  setFormValue(dom.packagingInput, template?.packaging || "With spool");
  setFormValue(dom.reorderInput, template?.reorderAtG ?? 250);
  setFormValue(dom.locationInput, template?.location || "Unassigned");
  dom.verifiedInput.checked = Boolean(template);
  setFormValue(dom.notesInput, "");
  updateColorPreview();
  dom.spoolDialog.showModal();
  setTimeout(() => dom.brandInput.focus(), 0);
}

function openEditDialog(id) {
  const spool = findSpool(id);
  if (!spool) return;
  dialogMode = "edit";
  editingId = id;
  remainingTouched = true;
  dom.spoolForm.reset();
  dom.spoolDialogEyebrow.textContent = spool.status === "Needs audit" ? "Physical audit" : "Inventory item";
  dom.spoolDialogTitle.textContent = `${spool.productLine} · ${spool.colorName}`;
  dom.saveSpoolButton.textContent = "Save changes";
  dom.quantityField.hidden = true;
  setFormValue(dom.spoolId, spool.id);
  setFormValue(dom.brandInput, spool.brand);
  setFormValue(dom.productLineInput, spool.productLine);
  setFormValue(dom.materialInput, spool.materialFamily);
  setFormValue(dom.skuInput, spool.sku);
  setFormValue(dom.productUrlInput, spool.productUrl);
  setFormValue(dom.colorNameInput, spool.colorName);
  setFormValue(dom.colorFamilyInput, spool.colorFamily);
  setFormValue(dom.colorHexInput, spool.colorHex);
  setFormValue(dom.initialWeightInput, spool.initialWeightG);
  setFormValue(dom.remainingWeightInput, spool.remainingWeightG);
  setFormValue(dom.statusInput, spool.status);
  setFormValue(dom.packagingInput, spool.packaging);
  setFormValue(dom.reorderInput, spool.reorderAtG);
  setFormValue(dom.locationInput, spool.location);
  dom.verifiedInput.checked = spool.verified;
  setFormValue(dom.notesInput, spool.notes);
  updateColorPreview();
  dom.spoolDialog.showModal();
  setTimeout(() => dom.brandInput.focus(), 0);
}

function collectSpoolForm() {
  const initialWeightG = Number(dom.initialWeightInput.value);
  const remainingWeightG = Number(dom.remainingWeightInput.value);
  if (remainingWeightG > initialWeightG) {
    throw new Error("Remaining weight cannot be greater than nominal weight.");
  }

  const status = remainingWeightG <= 0 ? "Empty" : dom.statusInput.value;
  return normalizeSpool({
    id: editingId || crypto.randomUUID(),
    brand: dom.brandInput.value,
    productLine: dom.productLineInput.value,
    materialFamily: dom.materialInput.value,
    colorName: dom.colorNameInput.value,
    colorFamily: dom.colorFamilyInput.value,
    colorHex: dom.colorHexInput.value,
    sku: dom.skuInput.value,
    productUrl: dom.productUrlInput.value,
    packaging: dom.packagingInput.value,
    initialWeightG,
    remainingWeightG,
    reorderAtG: Number(dom.reorderInput.value),
    status,
    location: dom.locationInput.value,
    notes: dom.notesInput.value,
    verified: dom.verifiedInput.checked,
    addedAt: dialogMode === "edit" ? findSpool(editingId)?.addedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function handleSpoolSubmit(event) {
  event.preventDefault();
  if (!dom.spoolForm.reportValidity()) return;

  try {
    const spool = collectSpoolForm();
    if (dialogMode === "edit") {
      const index = inventory.spools.findIndex((item) => item.id === editingId);
      if (index === -1) throw new Error("This spool could not be found.");
      inventory.spools[index] = spool;
      addEvent("update", `Updated ${spool.brand} ${spool.productLine} · ${spool.colorName}.`);
      showToast("Spool updated.");
    } else {
      const quantity = clamp(Number(dom.quantityInput.value || 1), 1, 100);
      const baseTime = Date.now();
      const additions = Array.from({ length: quantity }, (_, index) => ({
        ...spool,
        id: crypto.randomUUID(),
        addedAt: new Date(baseTime + index).toISOString(),
        updatedAt: new Date(baseTime + index).toISOString(),
      }));
      inventory.spools.push(...additions);
      addEvent(
        "add",
        `Added ${quantity} × ${spool.brand} ${spool.productLine} · ${spool.colorName}.`,
      );
      showToast(`${quantity} spool${quantity === 1 ? "" : "s"} added.`);
    }

    dom.spoolDialog.close();
    persist({ optionsChanged: true });
  } catch (error) {
    showToast(error.message || "Could not save this spool.", "!");
  }
}

function openUsageDialog(id) {
  const spool = findSpool(id);
  if (!spool) return;
  dom.usageForm.reset();
  dom.usageSpoolId.value = spool.id;
  dom.usageAmountInput.max = String(Math.max(1, spool.remainingWeightG));
  dom.usageAmountInput.value = "";
  dom.markOpenInput.checked = !["Loaded", "Reserved"].includes(spool.status);
  dom.usageSpoolSummary.innerHTML = `
    <div class="usage-product">
      ${swatchMarkup(spool)}
      <div>
        <strong>${escapeHtml(spool.productLine)} · ${escapeHtml(spool.colorName)}</strong>
        <span>${escapeHtml(spool.brand)} · ${formatWeight(spool.remainingWeightG)} currently remaining</span>
      </div>
    </div>`;
  dom.usageHint.textContent = spool.verified
    ? "This subtracts from the current remaining amount."
    : "This amount is currently estimated. Use Edit/Audit to enter an exact measured amount.";
  dom.usageDialog.showModal();
  setTimeout(() => dom.usageAmountInput.focus(), 0);
}

function handleUsageSubmit(event) {
  event.preventDefault();
  if (!dom.usageForm.reportValidity()) return;
  const spool = findSpool(dom.usageSpoolId.value);
  if (!spool) return;
  const amount = Number(dom.usageAmountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a positive usage amount.", "!");
    return;
  }
  if (amount > spool.remainingWeightG) {
    showToast(`Only ${formatWeight(spool.remainingWeightG)} is recorded as remaining.`, "!");
    return;
  }

  spool.remainingWeightG = Math.max(0, spool.remainingWeightG - amount);
  if (spool.remainingWeightG === 0) spool.status = "Empty";
  else if (dom.markOpenInput.checked && !["Loaded", "Reserved"].includes(spool.status)) spool.status = "Open";
  spool.updatedAt = new Date().toISOString();
  addEvent("usage", `Recorded ${formatWeight(amount)} used from ${spool.productLine} · ${spool.colorName}.`);
  dom.usageDialog.close();
  persist();
  showToast(`${formatWeight(amount)} subtracted.`);
}

function deleteSpool(id) {
  const spool = findSpool(id);
  if (!spool) return;
  const confirmed = window.confirm(
    `Delete ${spool.brand} ${spool.productLine} · ${spool.colorName}? This cannot be undone unless you restore a backup.`,
  );
  if (!confirmed) return;
  inventory.spools = inventory.spools.filter((item) => item.id !== id);
  addEvent("delete", `Deleted ${spool.brand} ${spool.productLine} · ${spool.colorName}.`);
  persist({ optionsChanged: true });
  showToast("Spool deleted.", "×");
}

function searchOnline(spoolLike) {
  if (!spoolLike) return;
  const query = [
    spoolLike.brand,
    spoolLike.productLine,
    spoolLike.colorName,
    spoolLike.sku,
    "filament",
  ]
    .filter(Boolean)
    .join(" ");
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

function showProductSpools(groupKey) {
  const group = groupSpools(inventory.spools).find((item) => item.key === groupKey);
  if (!group) return;
  inventory.settings.viewMode = "spools";
  filters.query = group.sku
    ? `sku:${group.sku}`
    : `type:"${group.productLine}" color:"${group.colorName}"`;
  filters.quick = "all";
  persist();
  document.querySelector(".inventory-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleInventoryAction(event) {
  const emptyButton = event.target.closest("[data-empty-action]");
  if (emptyButton) {
    if (emptyButton.dataset.emptyAction === "add") openAddDialog();
    else resetFilterValues();
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  switch (button.dataset.action) {
    case "edit":
      openEditDialog(id);
      break;
    case "use":
      openUsageDialog(id);
      break;
    case "duplicate":
    case "add-copy":
      openAddDialog(findSpool(id));
      break;
    case "delete":
      deleteSpool(id);
      break;
    case "lookup":
      searchOnline(findSpool(id));
      break;
    case "show-product":
      showProductSpools(button.dataset.groupKey);
      break;
    default:
      break;
  }
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    `spoolvault-backup-${date}.json`,
    JSON.stringify(inventory, null, 2),
    "application/json",
  );
  showToast("JSON backup exported.");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = [
    "id",
    "brand",
    "productLine",
    "materialFamily",
    "colorName",
    "colorFamily",
    "colorHex",
    "sku",
    "productUrl",
    "packaging",
    "initialWeightG",
    "remainingWeightG",
    "reorderAtG",
    "status",
    "location",
    "verified",
    "notes",
    "addedAt",
    "updatedAt",
  ];
  const lines = [
    headers.map(csvCell).join(","),
    ...inventory.spools.map((spool) => headers.map((key) => csvCell(spool[key])).join(",")),
  ];
  const date = new Date().toISOString().slice(0, 10);
  downloadText(`spoolvault-${date}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  showToast("CSV spool list exported.");
}

async function handleImportFile(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const imported = parseInventoryFile(text);
    const confirmed = window.confirm(
      `Replace the current inventory with ${imported.spools.length} imported spool records? Export a backup first if needed.`,
    );
    if (!confirmed) return;
    inventory = imported;
    inventory.events.push(
      createEvent("import", `Imported ${imported.spools.length} spool records from ${file.name}.`),
    );
    resetFilterValues();
    applyTheme();
    persist({ optionsChanged: true });
    showToast("Inventory imported.");
  } catch (error) {
    showToast(error.message || "Could not import this JSON file.", "!");
  }
}

async function handleGlobalAction(action) {
  switch (action) {
    case "export-json":
      exportJson();
      break;
    case "export-csv":
      exportCsv();
      break;
    case "import-json":
      dom.importFileInput.click();
      break;
    case "reload-packaged-inventory": {
      const confirmed = window.confirm(
        "Replace the current browser inventory with data/inventory.json? Export a backup first if needed.",
      );
      if (!confirmed) return;
      inventory = await resetToPackagedInventory();
      resetFilterValues();
      populateOptions();
      applyTheme();
      renderAll({ optionsChanged: true });
      showToast(`Loaded ${inventory.spools.length} spools from inventory.json.`, "⇩");
      break;
    }
    case "sync-july-purchase": {
      const result = applyJulyPurchaseUpdate(inventory);
      inventory = result.inventory;
      if (result.addedCount > 0) {
        persist({ optionsChanged: true });
        showToast(
          `Added ${result.addedCount} missing spool${result.addedCount === 1 ? "" : "s"} from the July 12 purchase.`,
          "+",
        );
      } else {
        inventory = saveInventory(inventory);
        renderAll({ optionsChanged: true });
        showToast(`All ${result.expectedCount} July 12 purchase spools are already present.`, "✓");
      }
      break;
    }
    case "sync-latest-purchase": {
      const result = applyLatestPurchaseUpdate(inventory);
      inventory = result.inventory;
      if (result.addedCount > 0) {
        persist({ optionsChanged: true });
        showToast(
          `Added ${result.addedCount} missing spool${result.addedCount === 1 ? "" : "s"} from the July 13 purchase.`,
          "+",
        );
      } else {
        inventory = saveInventory(inventory);
        renderAll({ optionsChanged: true });
        showToast(`All ${result.expectedCount} July 13 purchase spools are already present.`, "✓");
      }
      break;
    }
    case "reset-demo": {
      const confirmed = window.confirm(
        "Reset to the current 56-spool starter inventory? This replaces your current local data.",
      );
      if (!confirmed) return;
      inventory = resetInventory();
      addEvent("reset", "Reset the app to the original starter inventory.");
      inventory = saveInventory(inventory);
      resetFilterValues();
      populateOptions();
      applyTheme();
      renderAll({ optionsChanged: true });
      showToast("Starter inventory restored.", "↺");
      break;
    }
    default:
      break;
  }
}

function clearSingleFilter(key) {
  if (key === "query") filters.query = "";
  else if (key === "quick") filters.quick = "all";
  else if (key in filters) filters[key] = "";

  const map = {
    brand: dom.brandFilter,
    material: dom.materialFilter,
    type: dom.typeFilter,
    color: dom.colorFilter,
    status: dom.statusFilter,
    packaging: dom.packagingFilter,
    location: dom.locationFilter,
    stock: dom.stockFilter,
    link: dom.linkFilter,
  };
  if (map[key]) map[key].value = "";
  renderAll();
}

function bindEvents() {
  dom.addSpoolButton.addEventListener("click", () => openAddDialog());
  dom.themeButton.addEventListener("click", cycleTheme);
  dom.inventoryContent.addEventListener("click", handleInventoryAction);
  dom.spoolForm.addEventListener("submit", handleSpoolSubmit);
  dom.usageForm.addEventListener("submit", handleUsageSubmit);
  dom.importFileInput.addEventListener("change", handleImportFile);

  dom.searchInput.addEventListener("input", (event) => {
    filters.query = event.target.value;
    renderAll();
  });
  dom.clearSearchButton.addEventListener("click", () => {
    filters.query = "";
    dom.searchInput.value = "";
    dom.searchInput.focus();
    renderAll();
  });
  dom.filterToggle.addEventListener("click", () => {
    dom.filtersPanel.hidden = !dom.filtersPanel.hidden;
    dom.filterToggle.setAttribute("aria-expanded", String(!dom.filtersPanel.hidden));
  });
  dom.resetFiltersButton.addEventListener("click", resetFilterValues);
  dom.quickFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quick-filter]");
    if (!button) return;
    filters.quick = button.dataset.quickFilter;
    renderAll();
  });
  dom.activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-filter]");
    if (button) clearSingleFilter(button.dataset.clearFilter);
  });

  const filterBindings = [
    [dom.brandFilter, "brand"],
    [dom.materialFilter, "material"],
    [dom.typeFilter, "type"],
    [dom.colorFilter, "color"],
    [dom.statusFilter, "status"],
    [dom.packagingFilter, "packaging"],
    [dom.locationFilter, "location"],
    [dom.stockFilter, "stock"],
    [dom.linkFilter, "link"],
  ];
  for (const [element, key] of filterBindings) {
    element.addEventListener("change", (event) => {
      filters[key] = event.target.value;
      renderAll();
    });
  }

  dom.sortSelect.addEventListener("change", (event) => {
    filters.sort = event.target.value;
    renderAll();
  });

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-mode]");
    if (viewButton) {
      inventory.settings.viewMode = viewButton.dataset.viewMode;
      persist();
      return;
    }

    const displayButton = event.target.closest("[data-display-mode]");
    if (displayButton) {
      inventory.settings.displayMode = displayButton.dataset.displayMode;
      persist();
      return;
    }

    const summaryButton = event.target.closest("[data-summary-action]");
    if (summaryButton) {
      const action = summaryButton.dataset.summaryAction;
      if (action === "spools") inventory.settings.viewMode = "spools";
      if (action === "products") inventory.settings.viewMode = "products";
      filters.quick = action === "audit" || action === "low" ? action : "all";
      if (["all", "spools", "products"].includes(action)) {
        resetFilterValues();
        inventory = saveInventory(inventory);
      } else {
        persist();
      }
      return;
    }

    const globalButton = event.target.closest("[data-global-action]");
    if (globalButton) {
      handleGlobalAction(globalButton.dataset.globalAction);
      globalButton.closest("details")?.removeAttribute("open");
      return;
    }

    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      document.getElementById(closeButton.dataset.closeDialog)?.close();
      return;
    }

    if (!event.target.closest(".data-menu")) {
      document.querySelector(".data-menu")?.removeAttribute("open");
    }
  });

  dom.summaryGrid.addEventListener("click", () => {});

  dom.colorHexInput.addEventListener("input", updateColorPreview);
  dom.remainingWeightInput.addEventListener("input", () => {
    remainingTouched = true;
  });
  dom.initialWeightInput.addEventListener("input", () => {
    if (!remainingTouched && dialogMode === "add") {
      dom.remainingWeightInput.value = dom.initialWeightInput.value;
    }
  });
  dom.statusInput.addEventListener("change", () => {
    if (dom.statusInput.value === "Empty") dom.remainingWeightInput.value = "0";
  });
  dom.lookupButton.addEventListener("click", () => {
    searchOnline({
      brand: dom.brandInput.value,
      productLine: dom.productLineInput.value,
      colorName: dom.colorNameInput.value,
      sku: dom.skuInput.value,
    });
  });

  window.addEventListener("storage", async (event) => {
    if (!event.key?.startsWith("spoolvault") && !event.key?.startsWith("spool-inventory")) return;
    inventory = await loadInventory();
    populateOptions();
    applyTheme();
    renderAll();
    showToast("Inventory refreshed from another tab.", "↻");
  });
}

applyTheme();
populateOptions();
bindEvents();
renderAll();
