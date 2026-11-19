"use strict";
/* Aqua Map – Sprachen (Deutsch, Français, English, Lëtzebuergesch, Português) und Design
   Texte stehen im Code auf Deutsch; t() übersetzt sie mit der Tabelle TR aus i18n-dict.js. */

const LANGS = { de: "Deutsch", fr: "Français", en: "English", lb: "Lëtzebuergesch", pt: "Português" };
const LOCALES = { de: "de-DE", fr: "fr-LU", en: "en-GB", lb: "lb-LU", pt: "pt-PT" };
const LANG_IDX = { fr: 0, en: 1, lb: 2, pt: 3 };

const LANG = (() => {
  try { const s = JSON.parse(localStorage.getItem("aqua-lang") || "null"); if (s && LANGS[s]) return s; } catch (e) { /* ohne Speicher */ }
  const n = String(navigator.language || "de").slice(0, 2).toLowerCase();
  return LANGS[n] ? n : "de";
})();
document.documentElement.lang = LANG;

function LOC() {
  try { new Intl.NumberFormat(LOCALES[LANG]); return LOCALES[LANG]; } catch (e) { return "de-DE"; }
}
function t(key, vars) {
  let s = key;
  if (LANG !== "de" && typeof TR !== "undefined") {
    const e = TR[key];
    if (e && e[LANG_IDX[LANG]]) s = e[LANG_IDX[LANG]];
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}
const num = (n, opts) => Number(n).toLocaleString(LOC(), opts);

/* Statische Texte im HTML: data-i18n, data-i18n-ph (Platzhalter), data-i18n-aria, data-i18n-title */
function applyI18n(root = document) {
  if (LANG === "de") return;
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}
function setLang(l) {
  if (!LANGS[l] || l === LANG) return;
  try { localStorage.setItem("aqua-lang", JSON.stringify(l)); } catch (e) { /* ohne Speicher */ }
  location.reload();
}

/* Design: hell, dunkel oder wie das Gerät */
const THEME_KEY = "aqua-theme";
function themeSetting() { try { return JSON.parse(localStorage.getItem(THEME_KEY) || '"system"'); } catch (e) { return "system"; } }
function isDark() {
  const s = themeSetting();
  return s === "dark" || (s === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}
function applyThemeAttr() {
  document.documentElement.dataset.theme = isDark() ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = isDark() ? "#0E1A26" : "#13304D";
}
applyThemeAttr();
