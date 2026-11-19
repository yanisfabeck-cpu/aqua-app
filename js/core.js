"use strict";
/* ============================================================
   Aqua Map – alle kostenlosen Wasserstellen in Luxemburg
   Datenquelle: OpenStreetMap (Overpass API), live beim Laden
   ============================================================ */

const LU_BOUNDS = L.latLngBounds([49.445, 5.73], [50.185, 6.535]);
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
const QUERY = `[out:json][timeout:90];
area["ISO3166-1"="LU"][admin_level=2]->.lu;
(
  nwr["amenity"="drinking_water"](area.lu);
  nwr["man_made"="drinking_fountain"](area.lu);
  nwr["amenity"="water_point"](area.lu);
  nwr["drinking_water"~"^(yes|treated)$"](area.lu);
  nwr["drinking_water:refill"="yes"](area.lu);
  nwr["fountain"~"^(drinking|bubbler|bottle_refill)$"](area.lu);
  node["place"~"^(city|town|village|suburb|quarter)$"](area.lu);
);
out center;`;
const PHOTON = "https://photon.komoot.io";
const CACHE_KEY = "aqua-data-v2", FAV_KEY = "aqua-favs-v1", WINTER_KEY = "aqua-winter-dismissed", INSTALL_KEY = "aqua-install-dismissed";
const CACHE_FRESH_MS = 12 * 3600 * 1000;

const CATS = {
  brunnen: { label: "Trinkbrunnen", one: "Trinkbrunnen", color: "#00A3E0" },
  refill:  { label: "Refill-Stationen", one: "Refill-Station", color: "#0F9D8A" },
  hahn:    { label: "Wasserhähne", one: "Wasserhahn", color: "#5560C8" },
  quelle:  { label: "Quellen & Brunnen", one: "Quelle oder Brunnen", color: "#4F8A3C" }
};
const GLYPH = {
  brunnen: '<path d="M8 23.6h8M10.3 23.6v-3.4c0-1.7 1-2.7 2.4-2.7 1.2 0 2 .7 2.3 1.8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  refill:  '<path d="M10.7 14.4h2.6v1.7l1.5 1.7v6.3a.8.8 0 0 1-.8.8h-4a.8.8 0 0 1-.8-.8v-6.3l1.5-1.7z" fill="#fff"/>',
  hahn:    '<path d="M7.6 17.8h6.2a2.6 2.6 0 0 1 2.6 2.6v.8M10.6 15.4v2.4M8.6 15.4h4" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="16.4" cy="24.2" r="1.15" fill="#fff"/>',
  quelle:  '<path d="M7.6 22.2c1.5-1.4 3-1.4 4.4 0s2.9 1.4 4.4 0M7.6 18.6c1.5-1.4 3-1.4 4.4 0s2.9 1.4 4.4 0" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>'
};
const DROP = "M12 1.6C9.2 5.6 3 12.6 3 19.6a9 9 0 0 0 18 0c0-7-6.2-14-9-18z";

function dropSVG(cat, w, opts = {}) {
  const h = Math.round(w * 32 / 24);
  const stroke = opts.sel ? "#13304D" : "#fff";
  return `<svg viewBox="0 0 24 32" width="${w}" height="${h}" aria-hidden="true"><path d="${DROP}" fill="${CATS[cat].color}" stroke="${stroke}" stroke-width="${opts.sel ? 2 : 1.5}"/>${GLYPH[cat]}</svg>`;
}

/* ---------------- Hilfsfunktionen ---------------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } }
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.matchMedia("(max-width:760px)").matches;

function haversine(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function fmtDist(m) {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toLocaleString("de-DE", { maximumFractionDigits: m < 9500 ? 1 : 0 })} km`;
}
function fmtWalk(m) {
  const min = Math.max(1, Math.round(m / 80));
  if (min > 90) return "";
  return `${min} Min. zu Fuß`;
}
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s || "");
  if (!m) return s;
  return m[3] ? `${m[3]}.${m[2]}.${m[1]}` : `${m[2]}/${m[1]}`;
}
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ---------------- OSM-Daten interpretieren ---------------- */
const SUBTYPE = (t) => {
  if (t.fountain === "bubbler") return "Sprudelbrunnen";
  if (t.fountain === "bottle_refill") return "Flaschen-Nachfüllstation";
  if (t.natural === "spring") return "Quelle";
  if (t.man_made === "water_well") return "Wasserbrunnen";
  if (t.amenity === "fountain") return "Zierbrunnen mit Trinkwasser";
  if (t.amenity === "water_point") return "Wasserzapfstelle";
  if (t.amenity === "toilets") return "Wasserhahn an öffentlicher Toilette";
  if (t.amenity === "grave_yard" || t.landuse === "cemetery") return "Wasserhahn am Friedhof";
  if (t.amenity === "shelter") return "Schutzhütte mit Trinkwasser";
  if (t.leisure === "playground") return "Wasserhahn am Spielplatz";
  if (t.tourism === "picnic_site" || t.leisure === "picnic_table" || t.amenity === "bbq") return "Wasser am Picknickplatz";
  if (t.highway === "rest_area") return "Rastplatz mit Trinkwasser";
  if (t.leisure === "park") return "Wasser im Park";
  if (t["drinking_water:refill"] === "yes" && t.amenity !== "drinking_water") {
    const place = { cafe: "im Café", restaurant: "im Restaurant", bar: "in der Bar", pub: "im Pub", fast_food: "im Imbiss", library: "in der Bibliothek", townhall: "im Rathaus", ice_cream: "in der Eisdiele", community_centre: "im Gemeinschaftszentrum", hotel: "im Hotel" }[t.amenity] || (t.tourism === "hotel" ? "im Hotel" : t.shop ? "im Geschäft" : t.tourism === "information" ? "in der Touristeninfo" : "");
    return place ? `Refill-Station ${place}` : "Refill-Station";
  }
  if (t.man_made === "water_tap") return "Wasserhahn";
  if (t.amenity === "drinking_water") return "Trinkbrunnen";
  return "Wasserstelle mit Trinkwasser";
};

function classify(t) {
  const isDW = t.amenity === "drinking_water" || t.man_made === "drinking_fountain" || /^(drinking|bubbler|bottle_refill)$/.test(t.fountain || "");
  if (t.natural === "spring" || t.man_made === "water_well" || (t.amenity === "fountain" && !isDW)) return "quelle";
  if (isDW && t.man_made !== "water_tap") return "brunnen";
  if (t["drinking_water:refill"] === "yes" && !isDW) return "refill";
  return "hahn";
}

function normalize(el) {
  const t = el.tags || {};
  const lat = el.lat ?? (el.center && el.center.lat);
  const lon = el.lon ?? (el.center && el.center.lon);
  if (lat == null || lon == null) return null;
  // Nicht gratis, nicht trinkbar oder nicht zugänglich: weglassen
  if (t.drinking_water === "no" && t["drinking_water:refill"] !== "yes") return null;
  if (t.fee === "yes") return null;
  if (t.access === "private" || t.access === "no") return null;
  if (t.amenity === "vending_machine" || t.vending) return null;
  if (t.disused === "yes" || t.abandoned === "yes") return null;
  if (t.amenity === "drinking_water" && t.drinking_water === "no") return null;
  // drinking_water=yes an Restaurants, Hotels, Campingplätzen usw. ist nicht unbedingt gratis für alle
  const isWaterThing = t.amenity === "drinking_water" || t.man_made === "drinking_fountain" || !!t.fountain ||
    /^(water_tap|water_well)$/.test(t.man_made || "") || t.natural === "spring" ||
    /^(water_point|fountain|toilets|shelter|grave_yard|bbq)$/.test(t.amenity || "") || t.landuse === "cemetery" ||
    /^(playground|park|picnic_table|fitness_station)$/.test(t.leisure || "") || /^(picnic_site|viewpoint)$/.test(t.tourism || "") || t.highway === "rest_area";
  if (!isWaterThing && t["drinking_water:refill"] !== "yes") return null;
  const cat = classify(t);
  const name = t.name || t["name:de"] || t["name:lb"] || t["name:fr"] || t["name:en"] || "";
  const sub = SUBTYPE(t);
  const broken = /^(broken|out_of_order|closed|needs_maintenance)$/.test(t.operational_status || "") || t.out_of_order === "yes" || t["operational_status"] === "no";
  return {
    id: el.type[0] + el.id, osmType: el.type, osmId: el.id,
    lat, lon, t, cat, name, sub,
    title: name || sub,
    broken,
    winterOk: t.indoor === "yes" || cat === "refill" || t.seasonal === "no" || t.opening_hours === "24/7" && t.seasonal !== "yes",
    search: norm([name, sub, t.operator, t["addr:street"], t["addr:city"], t.description].join(" "))
  };
}

/* ---------------- Zustand ---------------- */
const state = {
  items: [], byId: new Map(), visible: [],
  on: { brunnen: true, refill: true, hahn: true, quelle: true },
  favs: new Set(store.get(FAV_KEY, [])),
  ref: null, refMode: "center", user: null, place: null,
  sel: null, tab: "list", listLimit: 30, osmStamp: null
};

/* ---------------- Karte ---------------- */
const map = L.map("map", {
  zoomControl: false, minZoom: 9, maxZoom: 19,
  maxBounds: LU_BOUNDS.pad(1.2), maxBoundsViscosity: 0.9,
  zoomSnap: 0.5, attributionControl: true
});
map.attributionControl.setPrefix(false);

// Ebenen: Kacheln (200) < Maske (350) < Straßennamen ab Zoom 15 (360) < Marker (600) < Ortsnamen (640)
map.createPane("mask"); map.getPane("mask").style.zIndex = 350; map.getPane("mask").style.pointerEvents = "none";
map.createPane("tilelabels"); map.getPane("tilelabels").style.zIndex = 360; map.getPane("tilelabels").style.pointerEvents = "none";
map.createPane("placelabels"); map.getPane("placelabels").style.zIndex = 640; map.getPane("placelabels").style.pointerEvents = "none";
const CARTO_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
const LABEL_MIN_Z = 15;
const BASES = {
  hell: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20, crossOrigin: "anonymous", attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' }),
  detail: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20, crossOrigin: "anonymous", attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' }),
  satellit: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, crossOrigin: "anonymous", attribution: 'Bilder © Esri, Maxar, Earthstar Geographics' })
};
const LABEL_TILES = {
  hell: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", minZoom: LABEL_MIN_Z, maxZoom: 20, pane: "tilelabels", crossOrigin: "anonymous" }),
  detail: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", minZoom: LABEL_MIN_Z, maxZoom: 20, pane: "tilelabels", crossOrigin: "anonymous" }),
  satellit: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { minZoom: LABEL_MIN_Z, maxZoom: 19, pane: "tilelabels", crossOrigin: "anonymous" })
};
const BASE_NAMES = { hell: "Hell", detail: "Detailliert", satellit: "Satellit" };
let base = store.get("aqua-base-v2", "detail");
if (!BASES[base]) base = "detail";
function useBase(k) {
  if (BASES[base] && map.hasLayer(BASES[base])) { map.removeLayer(BASES[base]); map.removeLayer(LABEL_TILES[base]); }
  base = k; BASES[base].addTo(map); LABEL_TILES[base].addTo(map);
  const el = map.getContainer(); el.classList.remove("base-hell", "base-detail", "base-satellit"); el.classList.add("base-" + base);
}
useBase(base);

// Luxemburg hervorheben, Nachbarländer leicht abdunkeln
const luLatLngs = LU_RING.map(([x, y]) => [y, x]);
L.polygon([[[-89, -179], [-89, 179], [89, 179], [89, -179]], luLatLngs], { pane: "mask", stroke: false, fillColor: "#13304D", fillOpacity: 0.16, interactive: false }).addTo(map);
L.polygon(luLatLngs, { pane: "mask", fill: false, color: "#00A3E0", weight: 2.5, opacity: 0.9, interactive: false }).addTo(map);

function sidePad() {
  if (isMobile()) {
    const top = $("#topbar").getBoundingClientRect().bottom + 8;
    return { paddingTopLeft: [12, top], paddingBottomRight: [12, sheetHeight() + navHeight() + 12] };
  }
  return { paddingTopLeft: [parseInt(getComputedStyle(document.documentElement).getPropertyValue("--side-w")) + 32, 20], paddingBottomRight: [20, 20] };
}

L.control.zoom({ position: "bottomright", zoomInTitle: "Hineinzoomen", zoomOutTitle: "Herauszoomen" }).addTo(map);

const MapCtl = L.Control.extend({
  options: { position: "bottomright" },
  onAdd() {
    const box = L.DomUtil.create("div", "mapctl");
    box.innerHTML = `
      <div class="layer-menu" id="layermenu" role="radiogroup" aria-label="Kartenstil" hidden>
        ${Object.keys(BASES).map((k) => `<button type="button" role="radio" data-base="${k}" aria-checked="${k === base}">${BASE_NAMES[k]}</button>`).join("")}
      </div>
      <button class="mapbtn" type="button" id="layerbtn" aria-label="Kartenstil wählen" aria-expanded="false" title="Kartenstil">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 8 12 13l9.5-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m2.5 12.5 9.5 5 9.5-5M2.5 16.5l9.5 5 9.5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </button>`;
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.disableScrollPropagation(box);
    return box;
  }
});
new MapCtl().addTo(map);
$("#layerbtn").addEventListener("click", () => {
  const m = $("#layermenu"); m.hidden = !m.hidden;
  $("#layerbtn").setAttribute("aria-expanded", String(!m.hidden));
});
$("#layermenu").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-base]"); if (!b) return;
  const k = b.dataset.base; if (k === base) return;
  useBase(k); store.set("aqua-base-v2", base); drawLabels();
  document.querySelectorAll("#layermenu button").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.base === base)));
  $("#layermenu").hidden = true; $("#layerbtn").setAttribute("aria-expanded", "false");
});

const cluster = L.markerClusterGroup({
  showCoverageOnHover: false, spiderfyOnMaxZoom: true, chunkedLoading: true,
  disableClusteringAtZoom: 17,
  maxClusterRadius: (z) => (z < 11 ? 64 : z < 14 ? 48 : 36),
  iconCreateFunction(c) {
    const n = c.getChildCount();
    const s = n < 10 ? 34 : n < 50 ? 40 : n < 200 ? 48 : 56;
    return L.divIcon({ html: `<div>${n}</div>`, className: "wk-cluster", iconSize: [s, s] });
  }
});
map.addLayer(cluster);

function pinIcon(it, sel) {
  const w = 26;
  return L.divIcon({
    html: dropSVG(it.cat, w, { sel }),
    className: "wk-pin" + (sel ? " sel" : "") + (it.broken ? " off" : ""),
    iconSize: [w, Math.round(w * 32 / 24)],
    iconAnchor: [w / 2, Math.round(w * 32 / 24) - 1]
  });
}

/* ---------------- Daten laden ---------------- */
async function fetchOverpass() {
  let lastErr;
  for (const url of OVERPASS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch(url, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: "data=" + encodeURIComponent(QUERY)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.elements)) throw new Error("Unerwartete Antwort");
      if (json.remark && /runtime error|timed out/i.test(json.remark) && !json.elements.length) throw new Error(json.remark);
      return json;
    } catch (e) {
      lastErr = e;
    } finally { clearTimeout(timer); }
  }
  throw lastErr || new Error("Keine Verbindung");
}

function ingest(json) {
  const seen = new Set();
  const items = [];
  const places = [];
  for (const el of json.elements) {
    if (el.tags && el.tags.place) { const pl = toPlace(el); if (pl) places.push(pl); continue; }
    const it = normalize(el);
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id); items.push(it);
  }
  state.items = items;
  state.places = places;
  assignLocality(items, places);
  state.byId = new Map(items.map((i) => [i.id, i]));
  state.osmStamp = json.osm3s && json.osm3s.timestamp_osm_base || null;
  for (const it of items) {
    it.marker = L.marker([it.lat, it.lon], { icon: pinIcon(it, false), title: it.title, alt: it.title, keyboard: true, riseOnHover: true });
    it.marker.on("click", () => select(it.id, { from: "map" }));
  }
}

/* ---------------- Ortsnamen ---------------- */
const PLACE_RANK = { city: 0, town: 1, village: 2, suburb: 3, quarter: 4 };
function toPlace(el) {
  const t = el.tags;
  const name = t.name || t["name:fr"] || t["name:lb"] || t["name:de"];
  if (!name || el.lat == null) return null;
  return { name, lat: el.lat, lon: el.lon, kind: t.place, rank: PLACE_RANK[t.place], pop: parseInt(String(t.population || "0").replace(/\D/g, ""), 10) || 0, n: norm(name) };
}
function assignLocality(items, places) {
  const cosL = Math.cos(49.7 * Math.PI / 180);
  const km = (a, b) => Math.hypot((a.lon - b.lon) * cosL, a.lat - b.lat) * 111.2;
  const settle = places.filter((p) => p.rank <= 2), towns = places.filter((p) => p.rank <= 1), subs = places.filter((p) => p.rank >= 3);
  const nearest = (pt, list, max) => { let best = null, bd = max; for (const p of list) { const d = km(pt, p); if (d < bd) { bd = d; best = p; } } return best ? { p: best, d: bd } : null; };
  for (const s of subs) { const par = nearest(s, towns, 8); s.parent = par && par.p.name !== s.name ? par.p.name : ""; }
  for (const it of items) {
    const st = nearest(it, settle, 8), sb = nearest(it, subs, 1.2);
    let loc = st ? st.p.name : "";
    if (sb && (!st || sb.d < st.d)) loc = sb.p.parent ? `${sb.p.name}, ${sb.p.parent}` : sb.p.name;
    it.locality = loc;
    if (loc) it.search += " " + norm(loc);
  }
}
const labelLayer = L.layerGroup().addTo(map);
function drawLabels() {
  labelLayer.clearLayers();
  const z = map.getZoom();
  if (z >= LABEL_MIN_Z || !state.places || !state.places.length) return;
  const maxRank = z < 10 ? 1 : z < 11.5 ? 2 : 4;
  const b = map.getBounds().pad(0.15);
  const cand = state.places.filter((p) => p.rank <= maxRank && b.contains([p.lat, p.lon]))
    .sort((a, c) => a.rank - c.rank || c.pop - a.pop);
  const placed = [];
  for (const p of cand) {
    const fs = p.rank === 0 ? 15 : p.rank === 1 ? 13.5 : p.rank === 2 ? 12.5 : 12;
    const w = p.name.length * fs * 0.58 + 10, h = fs * 1.4;
    const pt = map.latLngToContainerPoint([p.lat, p.lon]);
    const box = { x1: pt.x - w / 2, y1: pt.y + 19, x2: pt.x + w / 2, y2: pt.y + 19 + h };
    if (placed.some((q) => !(box.x2 < q.x1 || box.x1 > q.x2 || box.y2 < q.y1 || box.y1 > q.y2))) continue;
    placed.push({ x1: box.x1 - 6, y1: box.y1 - 3, x2: box.x2 + 6, y2: box.y2 + 3 });
    L.marker([p.lat, p.lon], { pane: "placelabels", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "pl pl-" + p.kind, html: `<span>${esc(p.name)}</span>`, iconSize: [0, 0] }) }).addTo(labelLayer);
    if (placed.length >= 140) break;
  }
}
let labelTimer;
map.on("zoomend moveend", () => { clearTimeout(labelTimer); labelTimer = setTimeout(drawLabels, 60); });

function setBusy(b) {
  $("#reload").setAttribute("aria-busy", String(b));
  $("#veil").hidden = !b || state.items.length > 0;
}

async function load(force) {
  const cached = store.get(CACHE_KEY, null);
  const haveCache = cached && cached.json && Array.isArray(cached.json.elements);
  if (haveCache && !state.items.length) {
    ingest(cached.json); afterData();
  }
  if (!navigator.onLine) { showOffline(haveCache ? cached.t : null); return; }
  if (!force && haveCache && Date.now() - cached.t < CACHE_FRESH_MS) return;
  setBusy(true); $("#err").hidden = true; $("#err").classList.add("error");
  if (!state.items.length) { $("#count").textContent = "Wasserstellen werden geladen …"; $("#stamp").textContent = "Daten kommen live aus OpenStreetMap. Das dauert ein paar Sekunden."; }
  try {
    const json = await fetchOverpass();
    // Nur die nötigen Felder zwischenspeichern
    const slim = { osm3s: json.osm3s, elements: json.elements.map((e) => ({ type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags: e.tags })) };
    store.set(CACHE_KEY, { t: Date.now(), json: slim });
    const selId = state.sel;
    cluster.clearLayers();
    ingest(slim); afterData();
    if (selId && state.byId.has(selId)) select(selId, { quiet: true });
    if (force) toast("Daten aktualisiert");
  } catch (e) {
    const err = $("#err");
    err.innerHTML = haveCache
      ? `<p>Neue Daten konnten nicht geladen werden. Du siehst den gespeicherten Stand. <button class="retry" type="button">Erneut versuchen</button></p>`
      : `<p>Die Wasserstellen konnten nicht geladen werden. Die OpenStreetMap-Server sind gerade nicht erreichbar oder es besteht keine Internetverbindung. <button class="retry" type="button">Erneut versuchen</button></p>`;
    err.hidden = false;
    err.querySelector(".retry").onclick = () => load(true);
    if (!haveCache) { $("#count").textContent = "Keine Daten geladen"; $("#stamp").textContent = ""; }
  } finally { setBusy(false); }
}

function showOffline(t) {
  const err = $("#err");
  err.classList.toggle("error", !t);
  err.innerHTML = t
    ? `<p>Du bist offline. Aqua Map zeigt die gespeicherten Wasserstellen vom ${new Date(t).toLocaleDateString("de-DE")}. Kartenbereiche, die du schon angesehen hast, funktionieren auch ohne Internet.</p>`
    : `<p>Du bist offline und es sind noch keine Wasserstellen gespeichert. Öffne Aqua Map einmal mit Internetverbindung, danach klappt es auch offline.</p>`;
  err.hidden = false;
  if (!t) { $("#count").textContent = "Keine Daten gespeichert"; $("#stamp").textContent = ""; }
  setBusy(false);
}
window.addEventListener("offline", () => { const c = store.get(CACHE_KEY, null); showOffline(c ? c.t : null); });
window.addEventListener("online", () => { $("#err").hidden = true; load(false); });

/* ---------------- Filtern & Liste ---------------- */
const F = { bottle: $("#f-bottle"), wheel: $("#f-wheel"), winter: $("#f-winter"), broken: $("#f-broken") };
function passes(it) {
  if (!state.on[it.cat]) return false;
  if (F.bottle.checked && !(it.t.bottle === "yes" || it.t.fountain === "bottle_refill" || it.cat === "refill" || it.cat === "hahn")) return false;
  if (F.wheel.checked && it.t.wheelchair !== "yes") return false;
  if (F.winter.checked && !it.winterOk) return false;
  if (F.broken.checked && it.broken) return false;
  return true;
}

function applyFilters() {
  state.visible = state.items.filter(passes);
  cluster.clearLayers();
  cluster.addLayers(state.visible.map((i) => i.marker));
  renderChips(); renderCount(); renderList();
}

function renderChips() {
  const counts = { brunnen: 0, refill: 0, hahn: 0, quelle: 0 };
  for (const it of state.items) if (!(F.broken.checked && it.broken)) counts[it.cat]++;
  $("#chips").innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<button type="button" class="chip" data-cat="${k}" aria-pressed="${state.on[k]}" style="--c:${c.color}"><span class="dot"></span>${c.label} <span class="n">${counts[k]}</span></button>`
  ).join("");
}
$("#chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  const k = b.dataset.cat; state.on[k] = !state.on[k];
  if (!Object.values(state.on).some(Boolean)) { Object.keys(state.on).forEach((x) => (state.on[x] = x === k)); }
  state.listLimit = 30; applyFilters();
});
Object.values(F).forEach((el) => el.addEventListener("change", () => { state.listLimit = 30; applyFilters(); }));

function renderCount() {
  const base = F.broken.checked ? state.items.filter((i) => !i.broken) : state.items;
  const hiddenBroken = state.items.length - base.length;
  const total = base.length, vis = state.visible.length;
  $("#count").textContent = total === vis
    ? `${total.toLocaleString("de-DE")} Wasserstellen in Luxemburg`
    : `${vis.toLocaleString("de-DE")} von ${total.toLocaleString("de-DE")} Wasserstellen angezeigt`;
  if (state.osmStamp) {
    const d = new Date(state.osmStamp);
    $("#stamp").textContent = `OpenStreetMap-Daten vom ${d.toLocaleDateString("de-DE")}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` + (hiddenBroken ? `. ${hiddenBroken} als defekt gemeldete ausgeblendet.` : "");
  }
}

function currentRef() {
  if (state.refMode === "user" && state.user) return state.user;
  if (state.refMode === "place" && state.place) return state.place;
  return map.getCenter();
}

function rowHTML(it, d) {
  const extras = [];
  if (it.locality) extras.push(it.locality);
  if (it.name && it.sub) extras.push(it.sub);
  if (it.t.bottle === "yes" || it.t.fountain === "bottle_refill") extras.push("Flasche befüllbar");
  if (it.t.wheelchair === "yes") extras.push("rollstuhlgerecht");
  if (it.broken) extras.push("als defekt gemeldet");
  const street = [it.t["addr:street"], it.t["addr:housenumber"]].filter(Boolean).join(" ");
  const sub = extras.join(", ") || street || (it.t.operator ? "Betreiber: " + it.t.operator : "Öffentlich und kostenlos");
  const walk = d != null ? fmtWalk(d) : "";
  return `<li><button type="button" class="row${state.sel === it.id ? " sel" : ""}" data-id="${it.id}">
    ${dropSVG(it.cat, 22)}
    <span class="row-main"><span class="row-title">${esc(it.title)}${it.broken ? '<span class="warn-dot" aria-hidden="true"></span>' : ""}</span><span class="row-sub">${esc(sub)}</span></span>
    ${d != null ? `<span class="row-dist">${fmtDist(d)}${walk && d < 5000 ? `<small>${walk.replace(" zu Fuß", "")}</small>` : ""}</span>` : ""}
  </button></li>`;
}

function renderList() {
  const list = $("#list"), head = $("#listhead");
  $("#tab-fav").textContent = state.favs.size ? `Gemerkt (${state.favs.size})` : "Gemerkt";
  if (!state.items.length) { list.innerHTML = ""; head.textContent = ""; return; }
  const ref = currentRef();
  if (state.tab === "fav") {
    const favs = [...state.favs].map((id) => state.byId.get(id)).filter(Boolean)
      .map((it) => ({ it, d: haversine(ref, L.latLng(it.lat, it.lon)) })).sort((a, b) => a.d - b.d);
    head.textContent = favs.length ? "Deine gemerkten Wasserstellen, nach Entfernung sortiert" : "";
    list.innerHTML = favs.length ? favs.map(({ it, d }) => rowHTML(it, d)).join("")
      : `<li class="empty">Noch nichts gemerkt. Öffne eine Wasserstelle und tippe auf „Merken“. Die Liste bleibt in diesem Browser gespeichert.</li>`;
    return;
  }
  if (!state.visible.length) {
    head.textContent = "";
    list.innerHTML = `<li class="empty">Keine Wasserstelle passt zu diesen Filtern.<br><button type="button" class="act" id="resetf" style="padding:0 14px;display:inline-flex">Filter zurücksetzen</button></li>`;
    $("#resetf").onclick = resetFilters; return;
  }
  const ranked = state.visible.map((it) => ({ it, d: haversine(ref, L.latLng(it.lat, it.lon)) })).sort((a, b) => a.d - b.d);
  head.textContent = state.refMode === "user" && state.user ? "Am nächsten zu deinem Standort"
    : state.refMode === "place" && state.place ? `Am nächsten zu ${state.place.label}`
    : "Am nächsten zur Kartenmitte. Verschiebe die Karte oder suche einen Ort.";
  const shown = ranked.slice(0, state.listLimit);
  list.innerHTML = shown.map(({ it, d }) => rowHTML(it, d)).join("") +
    (ranked.length > shown.length ? `<li><button type="button" class="more-rows" id="morerows">Weitere ${Math.min(30, ranked.length - shown.length)} anzeigen</button></li>` : "");
  const mr = $("#morerows"); if (mr) mr.onclick = () => { state.listLimit += 30; renderList(); };
}
function scrollToList() {
  const sc = $("#scroll"), tabs = document.querySelector(".tabs");
  setTimeout(() => { sc.scrollTo({ top: tabs.offsetTop - 8, behavior: reduceMotion ? "auto" : "smooth" }); }, 240);
}
function resetFilters() {
  Object.keys(state.on).forEach((k) => (state.on[k] = true));
  F.bottle.checked = F.wheel.checked = F.winter.checked = false; F.broken.checked = true;
  applyFilters();
}
$("#list").addEventListener("click", (e) => {
  const b = e.target.closest(".row"); if (b) select(b.dataset.id, { from: "list" });
});
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  state.tab = t.id === "tab-fav" ? "fav" : "list";
  document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
  closeDetail(); renderList();
}));

let moveTimer;
map.on("moveend", () => {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => { if (state.refMode === "center" && $("#view-detail").hidden) renderList(); updateAddLink(); }, 180);
});
map.on("click", () => { $("#layermenu").hidden = true; hideResults(); });

function updateAddLink() {
  const c = map.getCenter(), z = Math.round(Math.max(map.getZoom(), 15));
  const a = $("#addlink"); if (!a) return;
  a.href = `https://mapcomplete.org/drinking_water.html?z=${z}&lat=${c.lat.toFixed(5)}&lon=${c.lng.toFixed(5)}`;
}

/* ---------------- Auswahl & Details ---------------- */
let selMarker = null;
function select(id, opts = {}) {
  const it = state.byId.get(id); if (!it) return;
  if (selMarker && selMarker !== it.marker) {
    const prev = state.byId.get(state.sel); if (prev) prev.marker.setIcon(pinIcon(prev, false));
  }
  state.sel = id; selMarker = it.marker;
  it.marker.setIcon(pinIcon(it, true));
  it.marker.setZIndexOffset(1000);
  try { history.replaceState(null, "", "#" + id); } catch (e) {}
  renderDetail(it);
  if (opts.from !== "map" || map.getZoom() < 15) {
    const z = Math.max(map.getZoom(), 16);
    const show = () => {
      const pad = sidePad();
      // Punkt so platzieren, dass er nicht unter Leiste oder Sheet liegt
      const size = map.getSize();
      const cx = (pad.paddingTopLeft[0] + size.x - pad.paddingBottomRight[0]) / 2;
      const cy = (pad.paddingTopLeft[1] + size.y - pad.paddingBottomRight[1]) / 2;
      const target = map.project([it.lat, it.lon], z).subtract([cx - size.x / 2, cy - size.y / 2]);
      const ll = map.unproject(target, z);
      if (reduceMotion) map.setView(ll, z); else map.flyTo(ll, z, { duration: 0.6 });
    };
    if (!state.visible.includes(it)) { cluster.addLayer(it.marker); }
    show();
  }
  if (isMobile() && sheetState === "peek") setSheet("half");
}

function closeDetail() {
  $("#view-detail").hidden = true; $("#view-list").hidden = false;
  $("#sheet").classList.remove("in-detail");
  if (state.sel) { const prev = state.byId.get(state.sel); if (prev) { prev.marker.setIcon(pinIcon(prev, false)); prev.marker.setZIndexOffset(0); } }
  state.sel = null; selMarker = null;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  renderList();
}

const LBL = {
  wheelchair: { yes: "Rollstuhlgerecht", limited: "Eingeschränkt rollstuhlgerecht", no: "Nicht rollstuhlgerecht" },
  bottle: { yes: "Ja", no: "Nein, eher zum Trinken" },
  seasonal: { yes: "Saisonal, nicht ganzjährig", no: "Ganzjährig", summer: "Nur im Sommer", spring: "Nur im Frühling", autumn: "Nur im Herbst", winter: "Nur im Winter", dry_season: "Nur in der Trockenzeit" },
  access: { yes: "Öffentlich", permissive: "Öffentlich zugänglich", customers: "Nur für Kundschaft", designated: "Öffentlich" }
};
function seasonText(t) {
  if (t.seasonal) return LBL.seasonal[t.seasonal] || t.seasonal;
  return null;
}
function hoursText(h) {
  if (!h) return null;
  if (h === "24/7") return "Rund um die Uhr";
  return h.replace(/\bTu\b/g, "Di").replace(/\bWe\b/g, "Mi").replace(/\bTh\b/g, "Do").replace(/\bSu\b/g, "So").replace(/PH/g, "Feiertage").replace(/\boff\b/g, "geschlossen");
}
function photoURL(t) {
  const wc = t.wikimedia_commons;
  if (wc && /^File:/i.test(wc)) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(wc.replace(/^File:/i, ""))}?width=640`;
  const img = t.image || "";
  if (/^https?:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(img)) return img;
  const m = /commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/i.exec(img);
  if (m) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(m[1]).replace(/^File:/i, ""))}?width=640`;
  return null;
}

function renderDetail(it) {
  const t = it.t, ref = currentRef(), d = haversine(ref, L.latLng(it.lat, it.lon));
  const fav = state.favs.has(it.id);
  const addrParts = [ [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "), [t["addr:postcode"] && "L-" + String(t["addr:postcode"]).replace(/^L-?/i, ""), t["addr:city"]].filter(Boolean).join(" ") ].filter(Boolean);
  const facts = [];
  const add = (k, v) => { if (v) facts.push(`<dt>${k}</dt><dd>${esc(v)}</dd>`); };
  add("Art", it.sub);
  add("Flasche befüllen", LBL.bottle[t.bottle] || (t.fountain === "bottle_refill" ? "Ja" : null));
  add("Barrierefreiheit", LBL.wheelchair[t.wheelchair]);
  add("Saison", seasonText(t));
  add("Öffnungszeiten", hoursText(t.opening_hours));
  add("Lage", t.indoor === "yes" ? ("Im Gebäude" + (t.level ? `, Etage ${t.level}` : "")) : (t.covered === "yes" ? "Überdacht" : null));
  add("Zugang", LBL.access[t.access]);
  add("Wasser", t.drinking_water === "treated" ? "Aufbereitetes Trinkwasser" : (t["drinking_water:legal"] === "yes" ? "Amtlich geprüftes Trinkwasser" : null));
  add("Temperatur", t.warm_water === "yes" || t.hot_water === "yes" ? "Kalt und warm" : (t.cold_water === "yes" ? "Kalt" : null));
  add("Für Hunde", t.dog === "yes" ? "Mit Hundenapf" : null);
  add("Betreiber", t.operator);
  add("Beschreibung", t["description:de"] || t.description || t["description:fr"] || t["description:lb"]);
  add("Zuletzt geprüft", fmtDate(t.check_date || t["survey:date"] || t["check_date:drinking_water"]));
  const photo = photoURL(t);

  let hint = "";
  if (it.cat === "refill") hint = `<p class="hint">Teilnehmender Betrieb: Frag einfach nach, hier wird deine Flasche gratis mit Leitungswasser gefüllt.</p>`;
  if (it.cat === "quelle" && t["drinking_water:legal"] !== "yes") hint = `<p class="hint warn">Natürliche Quelle oder Brunnen. Die Wasserqualität wird hier nicht unbedingt amtlich überwacht. Im Zweifel lieber nicht trinken.</p>`;
  if (t["drinking_water:legal"] === "no") hint = `<p class="hint warn">Das Wasser ist hier nicht amtlich als Trinkwasser geprüft.</p>`;
  if (it.broken) hint += `<p class="hint warn">Diese Wasserstelle wurde als außer Betrieb gemeldet${t.check_date ? ` (Stand ${esc(fmtDate(t.check_date))})` : ""}.</p>`;

  const badges = [`<span class="badge free">Kostenlos</span>`];
  if (t.bottle === "yes" || t.fountain === "bottle_refill") badges.push(`<span class="badge">Flasche befüllbar</span>`);
  if (t.wheelchair === "yes") badges.push(`<span class="badge">Rollstuhlgerecht</span>`);
  if (t.indoor === "yes") badges.push(`<span class="badge">Drinnen</span>`);
  if (typeof profile !== "undefined" && profile.visits[it.id]) badges.push(`<span class="badge visited">Von dir besucht</span>`);
  if (t.seasonal && t.seasonal !== "no") badges.push(`<span class="badge warn">${esc(seasonText(t))}</span>`);

  const g = `https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lon}&travelmode=walking`;
  const a = `https://maps.apple.com/?daddr=${it.lat},${it.lon}&dirflg=w`;
  const osm = `https://www.openstreetmap.org/${it.osmType}/${it.osmId}`;
  const note = `https://www.openstreetmap.org/note/new?lat=${it.lat}&lon=${it.lon}#map=19/${it.lat}/${it.lon}`;
  const showDist = state.refMode !== "center";

  const v = $("#view-detail");
  v.innerHTML = `<div class="detail">
    <button class="back" type="button" id="back"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Zurück zur Liste</button>
    <div class="d-head">${dropSVG(it.cat, 34)}<div><h2 class="d-title" id="dtitle" tabindex="-1">${esc(it.title)}</h2>${it.name && it.sub !== it.name ? `<p class="d-type">${esc(it.sub)}</p>` : `<p class="d-type">${esc(CATS[it.cat].one === it.title ? "Öffentlich und kostenlos" : CATS[it.cat].one)}</p>`}</div></div>
    <p class="d-addr${addrParts.length ? "" : " muted"}" id="daddr">${addrParts.length ? esc(addrParts.join(", ")) : it.locality ? "In " + esc(it.locality) : "Adresse wird gesucht …"}</p>
    ${showDist ? `<p class="d-dist">${fmtDist(d)} entfernt${state.refMode === "user" ? " von dir" : state.refMode === "place" ? ` von ${esc(state.place.label)}` : " von der Kartenmitte"}${fmtWalk(d) ? `, ca. ${fmtWalk(d)}` : ""}</p>` : ""}
    <div class="badges">${badges.join("")}</div>
    <div class="actions">
      <a class="act primary" href="${g}" target="_blank" rel="noopener"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z" fill="currentColor"/></svg>Route planen</a>
      <a class="act" href="${a}" target="_blank" rel="noopener">Apple Karten</a>
      <button class="act" type="button" id="favbtn" aria-pressed="${fav}">${fav ? "Gemerkt" : "Merken"}</button>
      <button class="act" type="button" id="sharebtn">Link kopieren</button>
      <button class="act" type="button" id="qrbtn">QR-Code</button>
    </div>
    ${hint}
    ${photo ? `<img class="photo" src="${esc(photo)}" alt="Foto der Wasserstelle" loading="lazy" onerror="this.remove()">` : ""}
    <dl class="facts">${facts.join("")}</dl>
    <div class="d-links">
      <a href="${osm}" target="_blank" rel="noopener">In OpenStreetMap ansehen</a>
      <a href="${note}" target="_blank" rel="noopener">Fehler melden</a>
    </div>
    <p class="coords">${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}</p>
  </div>`;
  $("#view-list").hidden = true; v.hidden = false;
  $("#sheet").classList.add("in-detail");
  $("#scroll").scrollTop = 0;
  $("#back").onclick = closeDetail;
  $("#favbtn").onclick = () => toggleFav(it);
  $("#sharebtn").onclick = () => share(it);
  $("#qrbtn").onclick = () => showFountainQR(it);
  if (!addrParts.length) reverse(it);
  if (!isMobile()) $("#dtitle").focus({ preventScroll: true });
}

function toggleFav(it) {
  if (state.favs.has(it.id)) state.favs.delete(it.id); else state.favs.add(it.id);
  store.set(FAV_KEY, [...state.favs]);
  const on = state.favs.has(it.id), b = $("#favbtn");
  b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "Gemerkt" : "Merken";
  toast(on ? "Gemerkt" : "Nicht mehr gemerkt");
  $("#tab-fav").textContent = state.favs.size ? `Gemerkt (${state.favs.size})` : "Gemerkt";
}
async function share(it) {
  const url = location.href.split("#")[0] + "#" + it.id;
  try { await navigator.clipboard.writeText(url); toast("Link kopiert"); }
  catch (e) { toast(url); }
}

const revCache = new Map();
async function reverse(it) {
  const el = () => (state.sel === it.id ? $("#daddr") : null);
  if (revCache.has(it.id)) { const e = el(); if (e) { e.textContent = revCache.get(it.id); e.classList.remove("muted"); } return; }
  try {
    const r = await fetch(`${PHOTON}/reverse?lat=${it.lat}&lon=${it.lon}&lang=de&limit=1`);
    const j = await r.json();
    const p = j.features && j.features[0] && j.features[0].properties;
    let txt = "Keine Adresse gefunden";
    if (p) {
      const street = [p.street || p.name, p.housenumber].filter(Boolean).join(" ");
      const town = [p.postcode && "L-" + String(p.postcode).replace(/^L-?/i, ""), p.city || p.locality || p.district].filter(Boolean).join(" ");
      txt = "Nahe " + [street, town].filter(Boolean).join(", ");
    }
    revCache.set(it.id, txt);
    const e = el(); if (e) { e.textContent = txt; e.classList.toggle("muted", !p); }
  } catch (e) {
    const x = el(); if (x) x.textContent = "Adresse nicht verfügbar";
  }
}

/* ---------------- Standort ---------------- */
let meMarker = null, meCircle = null;
$("#locate").addEventListener("click", locate);
function locate() {
  if (!("geolocation" in navigator)) { toast("Dein Browser kann den Standort nicht bestimmen. Suche stattdessen einen Ort."); return; }
  const btn = $("#locate"); btn.setAttribute("aria-busy", "true");
  navigator.geolocation.getCurrentPosition((pos) => {
    btn.setAttribute("aria-busy", "false");
    const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
    state.user = ll; state.refMode = "user";
    if (meMarker) { meMarker.setLatLng(ll); meCircle.setLatLng(ll).setRadius(pos.coords.accuracy); }
    else {
      meCircle = L.circle(ll, { radius: pos.coords.accuracy, color: "#E1251B", weight: 1, opacity: .4, fillColor: "#E1251B", fillOpacity: .08, interactive: false }).addTo(map);
      meMarker = L.marker(ll, { icon: L.divIcon({ className: "wk-me", html: "<span></span>", iconSize: [18, 18] }), keyboard: false, interactive: false, zIndexOffset: 2000 }).addTo(map);
    }
    if (!LU_BOUNDS.pad(0.15).contains(ll)) toast("Du bist außerhalb von Luxemburg. Die Liste zeigt trotzdem die nächsten Stellen.");
    // Auf die drei nächsten Stellen zoomen
    const near = state.visible.map((it) => ({ it, d: haversine(ll, L.latLng(it.lat, it.lon)) })).sort((a, b) => a.d - b.d).slice(0, 3);
    const b = L.latLngBounds([ll]); near.forEach(({ it }) => b.extend([it.lat, it.lon]));
    if (near.length && near[0].d < 40000) map.fitBounds(b, { ...sidePad(), maxZoom: 17, animate: !reduceMotion });
    else map.setView(ll, 14);
    closeDetail(); state.tab = "list";
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x.id === "tab-list")));
    renderList();
    if (isMobile()) { if (sheetState === "peek") setSheet("half"); scrollToList(); }
  }, (err) => {
    btn.setAttribute("aria-busy", "false");
    toast(err.code === 1 ? "Standortzugriff verweigert. Du kannst oben einen Ort suchen." : "Standort konnte nicht bestimmt werden. Suche stattdessen einen Ort.");
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

/* ---------------- Suche ---------------- */
const q = $("#q"), results = $("#results"), sbox = $("#searchbox");
let searchTimer, searchCtrl, resultItems = [], activeIdx = -1;
q.addEventListener("input", () => {
  $("#qclear").hidden = !q.value;
  clearTimeout(searchTimer);
  const v = q.value.trim();
  if (v.length < 2) { hideResults(); return; }
  searchTimer = setTimeout(() => runSearch(v), 280);
});
q.addEventListener("keydown", (e) => {
  if (results.hidden) { if (e.key === "Enter" && q.value.trim().length >= 2) runSearch(q.value.trim(), true); return; }
  const btns = [...results.querySelectorAll("button")];
  if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(btns.length - 1, activeIdx + 1); markActive(btns); }
  else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); markActive(btns); }
  else if (e.key === "Enter") { e.preventDefault(); (btns[activeIdx] || btns[0])?.click(); }
  else if (e.key === "Escape") hideResults();
});
$("#qclear").addEventListener("click", () => {
  q.value = ""; $("#qclear").hidden = true; hideResults();
  if (state.refMode === "place") { state.refMode = state.user ? "user" : "center"; state.place = null; if (placeMarker) { map.removeLayer(placeMarker); placeMarker = null; } renderList(); }
  q.focus();
});
function markActive(btns) { btns.forEach((b, i) => b.setAttribute("aria-selected", String(i === activeIdx))); }
function hideResults() { results.hidden = true; sbox.setAttribute("aria-expanded", "false"); activeIdx = -1; }
function showResults(html) { results.innerHTML = html; results.hidden = false; sbox.setAttribute("aria-expanded", "true"); activeIdx = -1; }

async function runSearch(v, pickFirst) {
  const nv = norm(v);
  const local = state.items.filter((it) => it.name && it.search.includes(nv)).slice(0, 3);
  const localPlaces = (state.places || []).filter((p) => p.n.startsWith(nv) || (nv.length >= 3 && p.n.includes(nv)))
    .sort((a, b) => a.rank - b.rank || b.pop - a.pop).slice(0, 4)
    .map((p) => ({ title: p.name, sub: ({ city: "Stadt", town: "Stadt", village: "Ortschaft", suburb: "Stadtteil", quarter: "Viertel" }[p.kind]) + (p.parent ? ` von ${p.parent}` : "") + `, ${countNear(p)} Wasserstellen in der Nähe`, lat: p.lat, lon: p.lon, label: p.name, local: true }));
  let places = [...localPlaces];
  if (searchCtrl) searchCtrl.abort();
  searchCtrl = new AbortController();
  const html = () => {
    resultItems = [...local.map((it) => ({ kind: "item", it })), ...places.map((p) => ({ kind: "place", p }))];
    let h = "";
    if (local.length) h += `<h3>Wasserstellen</h3>` + local.map((it, i) => `<button type="button" role="option" data-i="${i}">${dropSVG(it.cat, 18)}<span><span class="r-title">${esc(it.name)}</span><br><span class="r-sub">${esc(it.sub)}</span></span></button>`).join("");
    if (places.length) h += `<h3>Orte</h3>` + places.map((p, j) => `<button type="button" role="option" data-i="${local.length + j}"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 auto;margin-top:2px"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" fill="#13304D"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg><span><span class="r-title">${esc(p.title)}</span><br><span class="r-sub">${esc(p.sub)}</span></span></button>`).join("");
    if (!h) h = `<p class="r-empty">Nichts gefunden zu „${esc(v)}“. Versuche einen Ortsnamen wie „Esch“ oder „Clervaux“.</p>`;
    showResults(h);
  };
  if (local.length) html();
  try {
    const url = `${PHOTON}/api/?q=${encodeURIComponent(v)}&limit=6&lang=de&bbox=5.70,49.42,6.56,50.20`;
    const r = await fetch(url, { signal: searchCtrl.signal });
    const j = await r.json();
    const seenNames = new Set(localPlaces.map((p) => norm(p.title)));
    places = localPlaces.concat((j.features || []).filter((f) => !f.properties.countrycode || f.properties.countrycode === "LU").map((f) => {
      const p = f.properties;
      const title = p.name || [p.street, p.housenumber].filter(Boolean).join(" ");
      const sub = [p.name && p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : "", [p.postcode, p.city || (p.name !== p.locality ? p.locality : "") || p.county].filter(Boolean).join(" "), p.name === p.city ? "Ortschaft" : ""].filter(Boolean).join(", ") || "Luxemburg";
      return { title, sub, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], extent: p.extent, label: p.name || title };
    }).filter((p) => !seenNames.has(norm(p.title)))).slice(0, 7);
  } catch (e) { if (e.name === "AbortError") return; }
  html();
  if (pickFirst) results.querySelector("button")?.click();
}
results.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]"); if (!b) return;
  const r = resultItems[+b.dataset.i]; hideResults();
  if (r.kind === "item") { q.value = r.it.name; select(r.it.id, { from: "search" }); return; }
  q.value = r.p.title; goPlace(r.p);
});
function countNear(p) {
  const c = L.latLng(p.lat, p.lon); let n = 0;
  for (const it of state.items) if (haversine(c, L.latLng(it.lat, it.lon)) < 2000) n++;
  return n;
}
let placeMarker = null;
function goPlace(p) {
  const ll = L.latLng(p.lat, p.lon);
  state.place = { lat: ll.lat, lng: ll.lng, label: p.label };
  state.refMode = "place";
  if (placeMarker) placeMarker.setLatLng(ll);
  else placeMarker = L.marker(ll, { icon: L.divIcon({ className: "wk-place", html: '<svg width="26" height="34" viewBox="0 0 24 30"><path d="M12 1a8.5 8.5 0 0 0-8.5 8.5C3.5 15.8 12 28 12 28s8.5-12.2 8.5-18.5A8.5 8.5 0 0 0 12 1z" fill="#13304D" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9.5" r="3" fill="#fff"/></svg>', iconSize: [26, 34], iconAnchor: [13, 33] }), interactive: false, zIndexOffset: 1500 }).addTo(map);
  if (state.sel) closeDetail();
  if (p.extent) {
    const [w, n, e, s] = p.extent;
    map.fitBounds([[s, w], [n, e]], { ...sidePad(), maxZoom: 16, animate: !reduceMotion });
  } else map.setView(ll, p.local ? 14 : 16, { animate: !reduceMotion });
  state.tab = "list"; document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x.id === "tab-list")));
  renderList();
  if (isMobile()) { q.blur(); if (sheetState === "peek") setSheet("half"); scrollToList(); }
}
document.addEventListener("click", (e) => { if (!sbox.contains(e.target)) hideResults(); });

/* ---------------- Mobiles Bottom-Sheet ---------------- */
let sheetState = "peek";
function navHeight() {
  const n = document.getElementById("nav");
  return isMobile() && n ? n.getBoundingClientRect().height : 0;
}
function sheetHeight() {
  if (!isMobile()) return 0;
  const vh = window.innerHeight;
  const top = $("#topbar").getBoundingClientRect().bottom + 10;
  return sheetState === "full" ? vh - top - navHeight() : sheetState === "half" ? Math.round((vh - navHeight()) * 0.5) : 178;
}
function setSheet(s) {
  sheetState = s;
  document.documentElement.style.setProperty("--nav-h", navHeight() + "px");
  document.documentElement.style.setProperty("--sheet-h", sheetHeight() + "px");
  $("#handle").setAttribute("aria-expanded", String(s !== "peek"));
}
(function sheetDrag() {
  const h = $("#handle"), sheet = $("#sheet");
  let startY = 0, startH = 0, moved = false, dragging = false;
  h.addEventListener("pointerdown", (e) => { if (!isMobile()) return; dragging = true; moved = false; startY = e.clientY; startH = sheet.getBoundingClientRect().height; sheet.classList.add("dragging"); h.setPointerCapture(e.pointerId); });
  h.addEventListener("pointermove", (e) => {
    if (!dragging) return; const dy = startY - e.clientY; if (Math.abs(dy) > 4) moved = true;
    const hgt = Math.max(120, Math.min(window.innerHeight - 70, startH + dy));
    document.documentElement.style.setProperty("--sheet-h", hgt + "px");
  });
  const end = (e) => {
    if (!dragging) return; dragging = false; sheet.classList.remove("dragging");
    if (!moved) { setSheet(sheetState === "peek" ? "half" : sheetState === "half" ? "full" : "peek"); return; }
    const hgt = sheet.getBoundingClientRect().height, vh = window.innerHeight;
    const opts = [["peek", 178], ["half", (vh - navHeight()) * 0.5], ["full", vh - 80 - navHeight()]];
    opts.sort((a, b) => Math.abs(a[1] - hgt) - Math.abs(b[1] - hgt));
    setSheet(opts[0][0]);
  };
  h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
})();
window.addEventListener("resize", () => { setSheet(sheetState); map.invalidateSize(); });

/* ---------------- Start ---------------- */
let nearDone = false;
function afterData() {
  $("#veil").hidden = true;
  applyFilters();
  drawLabels();
  if (typeof onDataReady === "function") onDataReady();
  if (!nearDone && new URLSearchParams(location.search).get("near") === "1") { nearDone = true; locate(); }
  const m = /^#([nwr]\d+)$/.exec(location.hash);
  if (m && state.byId.has(m[1]) && !state.sel) select(m[1], { from: "hash" });
}
window.addEventListener("hashchange", () => {
  const m = /^#([nwr]\d+)$/.exec(location.hash);
  if (m && state.byId.has(m[1]) && state.sel !== m[1]) select(m[1], { from: "hash" });
});
/* ---------------- Als App installieren ---------------- */
const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installEvt = null;
function showInstall(on) { $("#install").hidden = !on || standalone || store.get(INSTALL_KEY, false); }
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; showInstall(true); });
window.addEventListener("appinstalled", () => { installEvt = null; showInstall(false); toast("Aqua Map ist installiert"); });
$("#installbtn").addEventListener("click", async () => {
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null; if (r && r.outcome === "accepted") showInstall(false);
  } else if (isIOS) {
    $("#iosdlg").hidden = false; $("#iosdlg-ok").focus();
  }
});
$("#installx").addEventListener("click", () => { store.set(INSTALL_KEY, true); showInstall(false); });
$("#iosdlg-ok").addEventListener("click", () => { $("#iosdlg").hidden = true; });
$("#iosdlg").addEventListener("click", (e) => { if (e.target.id === "iosdlg") $("#iosdlg").hidden = true; });
if (isIOS && !standalone) showInstall(true);
if (standalone) document.documentElement.classList.add("standalone");
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

function coreInit() {
  setSheet("peek");
  map.fitBounds(LU_BOUNDS, { ...sidePad(), animate: false });
  updateAddLink();
  const mth = new Date().getMonth() + 1;
  if ((mth >= 11 || mth <= 3) && !store.get(WINTER_KEY, false)) $("#winter").hidden = false;
  $("#winterx").onclick = () => { $("#winter").hidden = true; store.set(WINTER_KEY, true); };
  $("#reload").onclick = () => load(true);
  renderChips();
  load(false);
}
