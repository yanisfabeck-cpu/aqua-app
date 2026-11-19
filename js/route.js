"use strict";
/* Aqua Map – Fußweg-Routen zur Wasserstelle
   Routing: Valhalla auf den Servern des FOSSGIS e.V. (max. 1 Anfrage pro Sekunde) */

const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const VALHALLA_LANG = { de: "de-DE", fr: "fr-FR", en: "en-US", lb: "de-DE", pt: "pt-PT" };
const VALHALLA_ATTR = 'Route: <a href="https://valhalla.openstreetmap.de/" target="_blank" rel="noopener">Valhalla (FOSSGIS)</a>';
const route = { it: null, coords: null, cum: null, man: null, total: 0, time: 0, lines: null, watch: null, follow: false, arrived: false, busy: false, lastReq: 0 };

function decodePolyline6(str) {
  let index = 0, lat = 0, lng = 0; const out = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

async function routeTo(it) {
  if (route.busy) return;
  const btn = $("#routebtn");
  route.busy = true; if (btn) { btn.disabled = true; btn.lastChild.textContent = t("Route wird berechnet …"); }
  try {
    let start;
    try { start = await getPosition(); }
    catch (err) { toast(geoError(err)); return; }
    if (haversine(start, L.latLng(it.lat, it.lon)) > 60000) { toast(t("Die Wasserstelle ist zu weit weg für eine Fußroute.")); return; }
    // höchstens eine Anfrage pro Sekunde
    const wait = 1100 - (Date.now() - route.lastReq); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    route.lastReq = Date.now();
    const body = { locations: [{ lat: start.lat, lon: start.lng }, { lat: it.lat, lon: it.lon }], costing: "pedestrian", directions_options: { language: VALHALLA_LANG[LANG], units: "kilometers" } };
    const res = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`);
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || !j.trip) throw new Error((j && j.error) || "HTTP " + res.status);
    const leg = j.trip.legs[0];
    endRoute(true);
    route.it = it;
    route.coords = decodePolyline6(leg.shape);
    route.cum = [0];
    for (let i = 1; i < route.coords.length; i++) route.cum.push(route.cum[i - 1] + haversine(L.latLng(route.coords[i - 1]), L.latLng(route.coords[i])));
    route.man = leg.maneuvers || [];
    route.total = j.trip.summary.length * 1000;
    route.time = j.trip.summary.time;
    route.arrived = false;
    route.lines = L.layerGroup([
      L.polyline(route.coords, { color: "#fff", weight: 9, opacity: 0.95, interactive: false, lineCap: "round", lineJoin: "round" }),
      L.polyline(route.coords, { color: "#0079B8", weight: 5, opacity: 1, interactive: false, lineCap: "round", lineJoin: "round" })
    ]).addTo(map);
    map.attributionControl.addAttribution(VALHALLA_ATTR);
    map.fitBounds(L.latLngBounds(route.coords), { ...sidePad(), maxZoom: 17, animate: !reduceMotion });
    renderRouteBox();
  } catch (e) {
    toast(t("Die Route konnte nicht berechnet werden. Versuche es gleich noch einmal."));
  } finally {
    route.busy = false;
    const b2 = $("#routebtn"); if (b2) { b2.disabled = false; b2.lastChild.textContent = t("Route hierhin"); }
  }
}

function fmtDuration(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return t("{n} Min.", { n: m });
  return t("{h} Std. {m} Min.", { h: Math.floor(m / 60), m: m % 60 });
}

function renderRouteBox() {
  const box = $("#routebox"); if (!box || !route.it) return;
  const steps = route.man.map((m, i) => `<li data-m="${i}"><span>${esc(m.instruction)}</span>${m.length ? `<small>${fmtDist(m.length * 1000)}</small>` : ""}</li>`).join("");
  box.innerHTML = `<section class="routebox" aria-label="${esc(t("Route"))}">
    <p class="rt-sum"><strong>${fmtDist(route.total)}</strong> ${esc(t("zu Fuß, ca. {time}", { time: fmtDuration(route.time) }))}</p>
    <div class="row2">
      <button type="button" class="act primary" id="rtgo">${esc(route.follow ? t("Mitlaufen beenden") : t("Losgehen"))}</button>
      <button type="button" class="act" id="rtend">${esc(t("Route schließen"))}</button>
    </div>
    <details class="rt-steps"><summary>${esc(t("Wegbeschreibung ({n} Schritte)", { n: route.man.length }))}</summary><ol>${steps}</ol></details>
  </section>`;
  $("#rtgo").onclick = () => (route.follow ? stopFollow() : startFollow());
  $("#rtend").onclick = () => endRoute();
  const vd = $("#view-detail"); if (vd) vd.classList.add("has-route");
  requestAnimationFrame(() => box.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }));
}

function endRoute(silent) {
  stopFollow(true);
  if (route.lines) { map.removeLayer(route.lines); route.lines = null; map.attributionControl.removeAttribution(VALHALLA_ATTR); }
  route.it = null; route.coords = null;
  const box = $("#routebox"); if (box) box.innerHTML = "";
  const vd = $("#view-detail"); if (vd) vd.classList.remove("has-route");
  if (!silent) toast(t("Route geschlossen"));
}

/* Mitlaufen: Standort verfolgen, nächsten Schritt anzeigen, Ankunft erkennen */
let wakeLockRoute = null;
function startFollow() {
  if (!route.it) return;
  if (!("geolocation" in navigator)) { toast(geoError(null)); return; }
  route.follow = true; renderRouteBox();
  $("#navbanner").hidden = false;
  document.body.classList.add("navigating");
  if (navigator.wakeLock) navigator.wakeLock.request("screen").then((l) => (wakeLockRoute = l)).catch(() => {});
  route.watch = navigator.geolocation.watchPosition(onFollowPos, onFollowErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  if (isMobile() && typeof setSheet === "function") setSheet("peek");
}
function stopFollow(silent) {
  if (route.watch != null) navigator.geolocation.clearWatch(route.watch);
  route.watch = null; route.follow = false;
  if (wakeLockRoute) { wakeLockRoute.release().catch(() => {}); wakeLockRoute = null; }
  const nb = $("#navbanner"); if (nb) nb.hidden = true;
  document.body.classList.remove("navigating");
  if (!silent && route.it) renderRouteBox();
}
// Nur ein verweigerter Zugriff beendet das Mitlaufen. Kurze Aussetzer (Tunnel, schwaches Signal) überbrückt die App.
function onFollowErr(err) {
  if (err && err.code === 1) { toast(geoError(err)); stopFollow(); return; }
  const el = $("#nbleft"); if (el) el.textContent = t("GPS-Signal wird gesucht …");
}
function onFollowPos(pos) {
  if (!route.it) return;
  const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
  state.user = ll; showMe(ll, pos.coords.accuracy);
  // nächster Punkt auf der Route
  let best = 0, bd = Infinity;
  for (let i = 0; i < route.coords.length; i++) { const d = haversine(ll, L.latLng(route.coords[i])); if (d < bd) { bd = d; best = i; } }
  const left = Math.max(0, route.total - route.cum[best]);
  const toTarget = haversine(ll, L.latLng(route.it.lat, route.it.lon));
  // nächste Anweisung: die erste, die am aktuellen Punkt oder danach beginnt
  let mi = route.man.findIndex((m) => m.begin_shape_index >= best);
  if (mi < 0) mi = route.man.length - 1;
  const next = route.man[mi];
  $("#nbtext").textContent = next ? next.instruction : "";
  $("#nbleft").textContent = t("Noch {dist}", { dist: fmtDist(Math.min(left, toTarget + bd)) });
  document.querySelectorAll(".rt-steps li").forEach((li) => li.classList.toggle("now", +li.dataset.m === mi));
  map.panTo(ll, { animate: !reduceMotion });
  if (!route.arrived && toTarget < 25) {
    route.arrived = true;
    const it = route.it;
    stopFollow();
    toast(t("Du bist da: {name}", { name: it.title }));
    if (typeof recordVisit === "function") setTimeout(() => recordVisit(it, "gps"), 2900);
  }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && route.follow && navigator.wakeLock && !wakeLockRoute) navigator.wakeLock.request("screen").then((l) => (wakeLockRoute = l)).catch(() => {});
});
$("#nbstop").addEventListener("click", () => stopFollow());
