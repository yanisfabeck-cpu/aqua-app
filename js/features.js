"use strict";
/* ============================================================
   Aqua Map – Menü, Heute (Schritte & Trinken), Rätsel, Scanner,
   Eintragen, Rangliste, Profil und Einstellungen.
   Läuft nach core.js und route.js und startet am Ende die App.
   ============================================================ */

/* ---------------- Dialog ---------------- */
function openDialog(html) {
  const back = $("#dlg"), box = $("#dlgbox");
  box.innerHTML = html; back.hidden = false;
  const close = () => { back.hidden = true; box.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  back.onclick = (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); };
  const f = box.querySelector("button, a, input"); if (f) f.focus();
  return close;
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const backBtnHTML = (label, id) => `<button type="button" class="back" id="${id}"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;
const SPLASH = `<span class="splash" aria-hidden="true"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26" fill="var(--sky-wash)"/><path d="m18 29 7 7 13-15" stroke="#00A3E0" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><i></i><i></i></span>`;

/* ---------------- Profil ---------------- */
const PROFILE_KEY = "aqua-profile-v1";
const AVATARS = ["💧", "🐟", "🐳", "🦆", "🐸", "🌊", "🐬", "🦦"];
const LEVELS = [[0, "Tropfen"], [50, "Pfütze"], [150, "Bach"], [300, "Fluss"], [600, "See"], [1000, "Ozean"]];
function blankProfile() {
  return { name: "", avatar: "💧", created: null, points: 0, riddles: {}, quiz: {}, quizBest: 0, anagrams: {}, visits: {}, scans: 0, reports: [], badges: {}, lbOptIn: null, stepAwards: {}, waterAwards: {}, photo: null, photoVer: 0, contactHint: "", contactRound: null };
}
let profile = Object.assign(blankProfile(), store.get(PROFILE_KEY, {}));

const BADGES = [
  { id: "first-riddle", name: "Erster Schluck", desc: "Dein erstes Rätsel gelöst", test: (p) => Object.keys(p.riddles).length + Object.keys(p.anagrams).length >= 1 },
  { id: "riddles-all", name: "Rätselquelle", desc: "Alle Wasser-Rätsel gelöst", test: (p) => Object.keys(p.riddles).length >= 10 },
  { id: "quiz-perfect", name: "Quiz-Profi", desc: "Alle Quizfragen in einer Runde richtig", test: (p) => p.quizBest >= 10 },
  { id: "anagram-5", name: "Buchstabenfischer", desc: "5 Wörter im Buchstabensalat gefunden", test: (p) => Object.keys(p.anagrams).length >= 5 },
  { id: "first-visit", name: "Auf Tour", desc: "Eine Wasserstelle besucht", test: (p) => Object.keys(p.visits).length >= 1 },
  { id: "visits-5", name: "Brunnenwanderer", desc: "5 verschiedene Wasserstellen besucht", test: (p) => Object.keys(p.visits).length >= 5 },
  { id: "first-report", name: "Brunnenfinder", desc: "Eine fehlende Wasserstelle gemeldet", test: (p) => p.reports.length >= 1 },
  { id: "steps-10k", name: "Zehntausender", desc: "10.000 Schritte an einem Tag gezählt", test: () => Object.values(health.days).some((d) => d.steps >= 10000) },
  { id: "water-7", name: "Gut versorgt", desc: "7 Tage dein Trinkziel erreicht", test: (p) => Object.keys(p.waterAwards).length >= 7 },
  { id: "points-300", name: "Wasserprofi", desc: "300 Punkte gesammelt", test: (p) => p.points >= 300 }
];

function saveProfile() { store.set(PROFILE_KEY, profile); renderNavAvatar(); lbQueueSync(); }
function levelOf(pts) {
  let i = 0; while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1][0]) i++;
  return { i, name: t(LEVELS[i][1]), from: LEVELS[i][0], to: LEVELS[i + 1] ? LEVELS[i + 1][0] : null, next: LEVELS[i + 1] ? t(LEVELS[i + 1][1]) : null };
}
function checkBadges() {
  const got = [];
  for (const b of BADGES) if (!profile.badges[b.id] && b.test(profile)) { profile.badges[b.id] = new Date().toISOString(); got.push(b); }
  return got;
}
function award(points, why) {
  const before = levelOf(profile.points).i;
  profile.points += points;
  const fresh = checkBadges();
  saveProfile();
  const lv = levelOf(profile.points);
  toast((lv.i > before ? t("Neues Level: {level}!", { level: lv.name }) + " " : "") + t("+{n} Punkte", { n: points }) + (why ? " " + why : ""));
  if (fresh.length) setTimeout(() => toast(t("Abzeichen erhalten: {names}", { names: fresh.map((b) => t(b.name)).join(", ") })), 2900);
  const p = $("#gpoints"); if (p) p.textContent = num(profile.points);
}
const navIconHTML = $("#navavatar").innerHTML;
// Foto (nur echte Bilddaten) oder Emoji
const isPhoto = (p) => typeof p === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p);
const avatarHTML = (photo, emoji) => isPhoto(photo) ? `<img src="${photo}" alt="" draggable="false">` : esc(emoji || "💧");
function renderNavAvatar() {
  const el = $("#navavatar");
  if (profile.name) { el.innerHTML = avatarHTML(profile.photo, profile.avatar); el.classList.add("emoji"); el.classList.toggle("photo", isPhoto(profile.photo)); }
  else { el.innerHTML = navIconHTML; el.classList.remove("emoji", "photo"); }
}
// Foto aus der Galerie oder Kamera: quadratisch zuschneiden und klein speichern (128 px, JPEG)
async function photoFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
    if (!side) throw new Error("empty");
    // in zwei Schritten verkleinern, damit das Bild nicht pixelig wird
    const mid = document.createElement("canvas"); mid.width = mid.height = Math.min(512, side);
    const mctx = mid.getContext("2d"); mctx.imageSmoothingQuality = "high";
    mctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, mid.width, mid.height);
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 128, 128);
    ctx.drawImage(mid, 0, 0, 128, 128);
    let q = 0.82, data = c.toDataURL("image/jpeg", q);
    while (data.length > 18000 && q > 0.35) { q -= 0.12; data = c.toDataURL("image/jpeg", q); }
    if (!isPhoto(data) || data.length > 20000) throw new Error("too big");
    return data;
  } finally { URL.revokeObjectURL(url); }
}
const solvedCount = () => Object.keys(profile.riddles).length + Object.keys(profile.anagrams).length + Object.keys(profile.quiz).length;
const BADGE_ICON = (on) => `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="${on ? "var(--sky-wash)" : "var(--mist)"}"/><path d="M17 6.5c-2.3 3.3-6.8 8.2-6.8 12.1a6.8 6.8 0 0 0 13.6 0c0-3.9-4.5-8.8-6.8-12.1z" fill="${on ? "#00A3E0" : "var(--line)"}"/>${on ? '<path d="m13.8 19.2 2.3 2.2 4.3-4.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ""}</svg>`;

function profileForm(editing) {
  return `<form id="profform" class="form">
    ${editing ? "" : `<p class="lead">${esc(t("Mit einem Profil sammelst du Punkte für Rätsel, Schritte, besuchte Brunnen und Meldungen, schaltest Abzeichen frei und kannst in der Rangliste mitmachen."))}</p>`}
    <label class="field"><span>${esc(t("Dein Spitzname"))}</span><input id="pname" maxlength="24" required autocomplete="nickname" value="${esc(profile.name)}" placeholder="${esc(t("z. B. Brunnenfuchs"))}"></label>
    <fieldset class="field"><legend>${esc(t("Profilbild"))}</legend>
      <div class="photo-row">
        <span class="photo-prev" id="photoprev" aria-hidden="true">${avatarHTML(profile.photo, profile.avatar)}</span>
        <div class="photo-btns">
          <label class="act file-act"><input type="file" id="photofile" accept="image/*" class="sr-only"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>${esc(t("Eigenes Foto"))}</span></label>
          <button type="button" class="act" id="photodel" ${isPhoto(profile.photo) ? "" : "hidden"}>${esc(t("Foto entfernen"))}</button>
        </div>
      </div>
      <p class="fine" id="photonote">${esc(t("Oder wähle ein Bild:"))}</p>
      <div class="avatars${isPhoto(profile.photo) ? " dim" : ""}" id="avgrid">${AVATARS.map((a) => `<label><input type="radio" name="pav" value="${a}" ${a === profile.avatar ? "checked" : ""}><span>${a}</span></label>`).join("")}</div>
      <p class="fine">${esc(t("Wenn du bei der Rangliste mitmachst, sehen andere dein Bild. Nimm kein Foto, das du nicht öffentlich zeigen willst."))}</p>
    </fieldset>
    ${!editing && profile.points ? `<p class="fine">${esc(t("Deine bisherigen {n} Punkte werden übernommen.", { n: profile.points }))}</p>` : ""}
    <div class="row2">${editing ? `<button class="act" type="button" id="profcancel">${esc(t("Abbrechen"))}</button>` : ""}<button class="act primary" type="submit">${esc(editing ? t("Speichern") : t("Profil erstellen"))}</button></div>
    <p class="fine">${esc(t("Dein Profil wird auf diesem Gerät gespeichert. Es gibt kein Konto und kein Passwort."))}</p>
  </form>`;
}
function bindProfileForm(editing) {
  let photo = profile.photo || null;
  const showPhoto = () => {
    const av = document.querySelector('input[name="pav"]:checked');
    $("#photoprev").innerHTML = avatarHTML(photo, av ? av.value : profile.avatar);
    $("#photodel").hidden = !isPhoto(photo);
    $("#avgrid").classList.toggle("dim", isPhoto(photo));
  };
  $("#photofile").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { photo = await photoFromFile(f); showPhoto(); }
    catch (er) { toast(t("Das Foto konnte nicht gelesen werden.")); }
  });
  $("#photodel").onclick = () => { photo = null; showPhoto(); };
  // Wer ein Emoji antippt, möchte das Emoji statt des Fotos
  $("#avgrid").addEventListener("change", () => { photo = null; showPhoto(); });
  $("#profform").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#pname").value.trim();
    if (!name) { $("#pname").focus(); return; }
    const av = document.querySelector('input[name="pav"]:checked');
    const isNew = !profile.name;
    if ((photo || null) !== (profile.photo || null)) { profile.photo = photo; profile.photoVer = (profile.photoVer || 0) + 1; }
    profile.name = name; profile.avatar = av ? av.value : "💧";
    if (!profile.created) profile.created = new Date().toISOString();
    saveProfile(); renderProfile();
    toast(isNew ? t("Willkommen, {name}!", { name }) : t("Profil gespeichert"));
  });
  if (editing) $("#profcancel").onclick = renderProfile;
}

function renderProfile() {
  const b = $("#profile-body");
  if (!profile.name) { b.innerHTML = profileForm(false); bindProfileForm(false); return; }
  const lv = levelOf(profile.points);
  const pct = lv.to ? Math.round((profile.points - lv.from) / (lv.to - lv.from) * 100) : 100;
  const reports = profile.reports.map((r) => `<li>${dropSVG(r.kind in CATS ? r.kind : "brunnen", 20)}<div><p class="b-name">${esc(r.desc || t(ADD_KINDS[r.kind] ? ADD_KINDS[r.kind].label : "Wasserstelle"))}</p>
      <p class="b-desc">${esc(t("Gemeldet am {date}", { date: new Date(r.date).toLocaleDateString(LOC()) }))}${r.note ? `, <a href="https://www.openstreetmap.org/note/${r.note}" target="_blank" rel="noopener">${esc(t("Hinweis #{id}", { id: r.note }))}</a>` : ""}</p></div></li>`).join("");
  b.innerHTML = `
    <div class="prof-head">
      <span class="avatar-lg" aria-hidden="true">${avatarHTML(profile.photo, profile.avatar)}</span>
      <div><p class="prof-name">${esc(profile.name)}</p><p class="prof-level">${esc(t("Level {n}: {name}", { n: lv.i + 1, name: lv.name }))}</p></div>
    </div>
    <div class="levelbar" role="progressbar" aria-label="${esc(t("Fortschritt zum nächsten Level"))}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <p class="fine">${esc(lv.to ? t("Noch {n} Punkte bis {level}", { n: lv.to - profile.points, level: lv.next }) : t("Du hast das höchste Level erreicht."))}</p>
    <dl class="stats">
      <div><dt>${esc(t("Punkte"))}</dt><dd>${num(profile.points)}</dd></div>
      <div><dt>${esc(t("Rätsel gelöst"))}</dt><dd>${solvedCount()}</dd></div>
      <div><dt>${esc(t("Brunnen besucht"))}</dt><dd>${Object.keys(profile.visits).length}</dd></div>
      <div><dt>${esc(t("Brunnen gemeldet"))}</dt><dd>${profile.reports.length}</dd></div>
    </dl>
    <h3 class="sec">${esc(t("Abzeichen"))}</h3>
    <ul class="badge-list">${BADGES.map((x) => `<li class="${profile.badges[x.id] ? "got" : "locked"}">${BADGE_ICON(!!profile.badges[x.id])}<div><p class="b-name">${esc(t(x.name))}</p><p class="b-desc">${esc(t(x.desc))}</p></div></li>`).join("")}</ul>
    <h3 class="sec">${esc(t("Meine Meldungen"))}</h3>
    ${reports ? `<ul class="badge-list">${reports}</ul>` : `<p class="fine">${esc(t("Noch keine. Fehlt eine Wasserstelle?"))} <button type="button" class="linkbtn" data-go="add">${esc(t("Jetzt eintragen"))}</button></p>`}
    <h3 class="sec">${esc(t("Gemerkte Wasserstellen"))}</h3>
    <p class="fine">${state.favs.size ? `${esc(t("{n} gemerkt.", { n: state.favs.size }))} <button type="button" class="linkbtn" id="showfavs">${esc(t("In der Liste zeigen"))}</button>` : esc(t("Noch keine. Öffne eine Wasserstelle und tippe auf „Merken“."))}</p>
    <div class="row2 prof-actions" id="profactions"><button class="act" type="button" id="profedit">${esc(t("Profil bearbeiten"))}</button><button class="act danger" type="button" id="profdel">${esc(t("Profil löschen"))}</button></div>`;
  $("#profedit").onclick = () => { b.innerHTML = profileForm(true); bindProfileForm(true); };
  $("#profdel").onclick = () => {
    $("#profactions").outerHTML = `<div class="confirm" id="profactions"><p>${esc(t("Profil wirklich löschen? Punkte, Abzeichen und die Liste deiner Meldungen auf diesem Gerät gehen verloren. Deine Meldungen bei OpenStreetMap bleiben bestehen."))}</p>
      <div class="row2"><button class="act" type="button" id="delno">${esc(t("Abbrechen"))}</button><button class="act danger" type="button" id="delyes">${esc(t("Ja, löschen"))}</button></div></div>`;
    $("#delno").onclick = renderProfile;
    $("#delyes").onclick = async () => { await lbRemove(); profile = blankProfile(); saveProfile(); drawReports(); renderProfile(); toast(t("Profil gelöscht")); };
  };
  const sf = $("#showfavs");
  if (sf) sf.onclick = () => { go("map"); $("#tab-fav").click(); if (isMobile()) { setSheet("half"); scrollToList(); } };
}

/* ---------------- Spiele: Inhalte je Sprache ---------------- */
const GAME_CONTENT = {
  de: {
    riddles: [
      ["hahn", "Ich habe einen Hahn, aber ich krähe nie. Dreh an mir, und ich schenke dir Wasser. Was bin ich?", ["wasserhahn", "hahn"], "Du findest mich in jeder Küche und in jedem Bad.", "Leitungswasser ist in Luxemburg Trinkwasser. Damit kannst du deine Flasche überall gratis auffüllen."],
      ["fluss", "Ich habe ein Bett, aber ich schlafe nie. Ich habe eine Mündung, aber ich spreche nie. Was bin ich?", ["fluss", "bach", "strom"], "Die Alzette ist einer von meiner Sorte.", "Die Alzette fließt mitten durch die Stadt Luxemburg, durch den Grund und das Pfaffenthal."],
      ["handtuch", "Je mehr ich trockne, desto nasser werde ich. Was bin ich?", ["handtuch", "badetuch", "tuch", "duschtuch"], "Du brauchst mich nach dem Duschen.", "Ein Handtuch nimmt Wasser auf, weil es aus vielen kleinen Fasern mit großer Oberfläche besteht."],
      ["flasche", "Ich habe einen Hals, aber keinen Kopf, und trage dein Wasser überallhin mit. Was bin ich?", ["flasche", "trinkflasche", "wasserflasche"], "Fülle mich an einem Trinkbrunnen wieder auf.", "Wer eine wiederverwendbare Flasche auffüllt, spart jedes Mal eine Plastikflasche."],
      ["wolke", "Ich fliege ohne Flügel und weine ohne Augen. Was bin ich?", ["wolke", "regenwolke", "wolken"], "Schau nach oben, wenn es gleich regnet.", "Wolken bestehen aus winzigen Wassertröpfchen oder Eiskristallen."],
      ["eis", "Wenn es kalt wird, werde ich hart. Wird es warm, laufe ich davon. Was bin ich?", ["eis", "eiswürfel", "eiszapfen"], "Ich bin gefrorenes Wasser.", "Wasser dehnt sich beim Gefrieren aus. Darum schwimmt Eis oben."],
      ["tau", "Ich hänge morgens an den Grashalmen und verschwinde, sobald die Sonne kommt. Was bin ich?", ["tau", "tautropfen", "morgentau"], "Ich habe nur drei Buchstaben.", "Tau entsteht, wenn feuchte Luft in der Nacht an kühlen Flächen abkühlt."],
      ["regenbogen", "Ich habe sieben Farben, aber keinen Pinsel. Ich erscheine, wenn Sonne und Regen sich treffen. Was bin ich?", ["regenbogen"], "Ich bin ein bunter Bogen am Himmel.", "Regentropfen zerlegen das Sonnenlicht in seine Farben."],
      ["quelle", "Ich komme aus der Erde, bin klar und frisch, und am Anfang jedes Baches findest du mich. Was bin ich?", ["quelle", "wasserquelle"], "In Aqua Map gibt es eine eigene Farbe für mich.", "Quellwasser ist Grundwasser, das von selbst an die Oberfläche tritt."],
      ["schnee", "Ich falle vom Himmel, bin weiß und kalt, und keine zwei von uns sehen gleich aus. Was bin ich?", ["schneeflocke", "schnee", "flocke", "schneeflocken"], "Ich komme meistens im Winter.", "Schneeflocken sind Eiskristalle und haben meistens sechs Arme."]
    ],
    quiz: [
      ["formel", "Welche chemische Formel hat Wasser?", ["H₂O", "CO₂", "O₂", "NaCl"], "Ein Wassermolekül besteht aus zwei Wasserstoffatomen und einem Sauerstoffatom."],
      ["alzette", "Welcher Fluss fließt durch die Stadt Luxemburg?", ["Alzette", "Mosel", "Rhein", "Maas"], "Die Alzette fließt durch die Unterstadt. Dort mündet auch die Petruss in sie."],
      ["mosel", "Welcher Fluss bildet im Südosten die Grenze zwischen Luxemburg und Deutschland?", ["Mosel", "Alzette", "Wiltz", "Attert"], "An der Mosel liegen zum Beispiel Schengen, Remich und Grevenmacher."],
      ["stausee", "Aus welchem See bezieht Luxemburg einen großen Teil seines Trinkwassers?", ["Obersauer-Stausee", "Bodensee", "Echternacher See", "Genfer See"], "Das Wasser aus dem Obersauer-Stausee wird bei Esch-sur-Sûre zu Trinkwasser aufbereitet."],
      ["gefrier", "Bei welcher Temperatur gefriert Wasser bei normalem Luftdruck?", ["0 °C", "4 °C", "−10 °C", "32 °C"], "32 Grad ist der Gefrierpunkt in Fahrenheit, nicht in Celsius."],
      ["dichte", "Bei welcher Temperatur ist Wasser am dichtesten?", ["bei etwa 4 °C", "bei 0 °C", "bei 20 °C", "bei 100 °C"], "Darum ist das Wasser am Grund tiefer Seen im Winter oft etwa 4 Grad warm."],
      ["trinken", "Wie viel sollten Erwachsene laut gängigen Empfehlungen pro Tag ungefähr trinken?", ["etwa 1,5 Liter", "etwa 0,3 Liter", "etwa 5 Liter", "etwa 10 Liter"], "Bei Hitze und beim Sport darf es mehr sein."],
      ["erde", "Wie viel der Erdoberfläche ist ungefähr von Wasser bedeckt?", ["etwa 71 %", "etwa 30 %", "etwa 50 %", "etwa 90 %"], "Nur ein sehr kleiner Teil davon ist Süßwasser."],
      ["refill", "Was bedeutet ein runder Refill-Aufkleber an einer Ladentür?", ["Hier wird deine Flasche gratis mit Leitungswasser gefüllt", "Hier gibt es Pfand zurück", "Hier werden Flaschen verkauft", "Hier ist Wasser im Angebot"], "In Aqua Map findest du solche Orte unter „Refill-Stationen“."],
      ["sieden", "Bei welcher Temperatur kocht Wasser auf Meereshöhe?", ["100 °C", "80 °C", "120 °C", "212 °C"], "Auf hohen Bergen kocht Wasser schon früher, weil der Luftdruck dort niedriger ist."]
    ],
    anagrams: [["WASSER", "Ohne mich gibt es kein Leben."], ["QUELLE", "Hier beginnt ein Bach."], ["BRUNNEN", "Hier füllst du deine Flasche auf."], ["TROPFEN", "Der kleinste Teil vom Regen."], ["MOSEL", "Fluss an der Grenze zu Deutschland."], ["ALZETTE", "Fluss durch die Hauptstadt."], ["REGEN", "Er fällt aus den Wolken."], ["WELLE", "Sie rollt über den See."], ["FLASCHE", "Nimm sie immer wieder mit."], ["SAUER", "Fluss, an dem Echternach liegt."]]
  },
  fr: {
    riddles: [
      ["hahn", "On me tourne et je te donne de l'eau. On me trouve dans chaque cuisine et chaque salle de bain. Qui suis-je ?", ["robinet"], "J'ai une poignée et un bec.", "Au Luxembourg, l'eau du robinet est potable. Tu peux remplir ta gourde gratuitement presque partout."],
      ["fluss", "J'ai un lit mais je ne dors jamais. J'ai une embouchure mais je ne parle jamais. Qui suis-je ?", ["riviere", "fleuve", "ruisseau"], "L'Alzette en est une.", "L'Alzette traverse la ville de Luxembourg, par le Grund et le Pfaffenthal."],
      ["handtuch", "Plus je sèche, plus je suis mouillée. Qui suis-je ?", ["serviette", "essuie", "serviette de bain"], "On m'utilise après la douche.", "Une serviette absorbe l'eau grâce à ses nombreuses petites fibres."],
      ["flasche", "J'ai un col mais pas de tête, et je transporte ton eau partout. Qui suis-je ?", ["bouteille", "gourde"], "Remplis-moi à une fontaine.", "Remplir une bouteille réutilisable, c'est une bouteille en plastique de moins."],
      ["wolke", "Je vole sans ailes et je pleure sans yeux. Qui suis-je ?", ["nuage", "nuages"], "Lève les yeux quand il va pleuvoir.", "Les nuages sont faits de minuscules gouttelettes d'eau ou de cristaux de glace."],
      ["eis", "Quand il fait froid, je deviens dur. Quand il fait chaud, je m'enfuis. Qui suis-je ?", ["glace", "glacon"], "Je suis de l'eau gelée.", "L'eau prend plus de place en gelant. C'est pour ça que la glace flotte."],
      ["tau", "Le matin, je pends aux brins d'herbe et je disparais dès que le soleil arrive. Qui suis-je ?", ["rosee"], "Je commence par un R.", "La rosée se forme quand l'air humide se refroidit la nuit sur des surfaces froides."],
      ["regenbogen", "J'ai sept couleurs mais pas de pinceau. J'apparais quand le soleil et la pluie se rencontrent. Qui suis-je ?", ["arc-en-ciel", "arc en ciel"], "Je suis un arc coloré dans le ciel.", "Les gouttes de pluie décomposent la lumière du soleil en couleurs."],
      ["quelle", "Je sors de la terre, je suis claire et fraîche, et on me trouve au début de chaque ruisseau. Qui suis-je ?", ["source"], "Dans Aqua Map, j'ai ma propre couleur.", "L'eau de source est de l'eau souterraine qui remonte seule à la surface."],
      ["schnee", "Je tombe du ciel, je suis blanc et froid, et aucun de nous ne se ressemble. Qui suis-je ?", ["flocon", "flocon de neige", "neige"], "J'arrive surtout en hiver.", "Les flocons de neige sont des cristaux de glace, le plus souvent à six branches."]
    ],
    quiz: [
      ["formel", "Quelle est la formule chimique de l'eau ?", ["H₂O", "CO₂", "O₂", "NaCl"], "Une molécule d'eau compte deux atomes d'hydrogène et un atome d'oxygène."],
      ["alzette", "Quelle rivière traverse la ville de Luxembourg ?", ["Alzette", "Moselle", "Rhin", "Meuse"], "L'Alzette traverse la ville basse, où la Pétrusse se jette aussi."],
      ["mosel", "Quelle rivière forme au sud-est la frontière entre le Luxembourg et l'Allemagne ?", ["Moselle", "Alzette", "Wiltz", "Attert"], "Schengen, Remich et Grevenmacher se trouvent par exemple sur la Moselle."],
      ["stausee", "De quel lac le Luxembourg tire-t-il une grande partie de son eau potable ?", ["Lac de la Haute-Sûre", "Lac de Constance", "Lac d'Echternach", "Lac Léman"], "L'eau du lac de la Haute-Sûre est potabilisée à Esch-sur-Sûre."],
      ["gefrier", "À quelle température l'eau gèle-t-elle à pression normale ?", ["0 °C", "4 °C", "−10 °C", "32 °C"], "32 degrés, c'est le point de congélation en Fahrenheit, pas en Celsius."],
      ["dichte", "À quelle température l'eau est-elle la plus dense ?", ["vers 4 °C", "à 0 °C", "à 20 °C", "à 100 °C"], "C'est pourquoi l'eau au fond des lacs profonds est souvent à environ 4 degrés en hiver."],
      ["trinken", "Combien un adulte devrait-il boire environ par jour selon les recommandations courantes ?", ["environ 1,5 litre", "environ 0,3 litre", "environ 5 litres", "environ 10 litres"], "Par forte chaleur ou pendant le sport, il en faut plus."],
      ["erde", "Quelle part de la surface de la Terre est couverte d'eau ?", ["environ 71 %", "environ 30 %", "environ 50 %", "environ 90 %"], "Seule une très petite partie est de l'eau douce."],
      ["refill", "Que signifie un autocollant rond « Refill » sur la porte d'un magasin ?", ["On y remplit ta gourde gratuitement avec l'eau du robinet", "On y rend la consigne", "On y vend des bouteilles", "L'eau y est en promotion"], "Dans Aqua Map, tu trouves ces lieux sous « Stations Refill »."],
      ["sieden", "À quelle température l'eau bout-elle au niveau de la mer ?", ["100 °C", "80 °C", "120 °C", "212 °C"], "En haute montagne, l'eau bout plus tôt car la pression de l'air est plus basse."]
    ],
    anagrams: [["EAU", "Sans moi, pas de vie."], ["SOURCE", "Ici commence un ruisseau."], ["FONTAINE", "Ici tu remplis ta gourde."], ["GOUTTE", "La plus petite partie de la pluie."], ["MOSELLE", "Rivière à la frontière allemande."], ["ALZETTE", "Rivière de la capitale."], ["PLUIE", "Elle tombe des nuages."], ["VAGUE", "Elle roule sur le lac."], ["GOURDE", "Emporte-la partout."], ["NUAGE", "Il flotte dans le ciel."]]
  },
  en: {
    riddles: [
      ["hahn", "Turn me and I give you water. You find me in every kitchen and every bathroom. What am I?", ["tap", "faucet", "water tap"], "I have a handle and a spout.", "In Luxembourg, tap water is drinking water. You can refill your bottle for free almost anywhere."],
      ["fluss", "I have a bed but never sleep. I have a mouth but never speak. What am I?", ["river", "stream", "brook"], "The Alzette is one of us.", "The Alzette flows right through Luxembourg City, through the Grund and Pfaffenthal."],
      ["handtuch", "What gets wetter the more it dries?", ["towel", "bath towel"], "You need me after a shower.", "A towel soaks up water thanks to its many tiny fibres."],
      ["flasche", "I have a neck but no head, and I carry your water everywhere. What am I?", ["bottle", "water bottle"], "Refill me at a drinking fountain.", "Every refill of a reusable bottle saves a plastic one."],
      ["wolke", "I fly without wings and cry without eyes. What am I?", ["cloud", "clouds", "rain cloud"], "Look up when it's about to rain.", "Clouds are made of tiny water droplets or ice crystals."],
      ["eis", "When it gets cold, I turn hard. When it gets warm, I run away. What am I?", ["ice", "ice cube", "icicle"], "I'm frozen water.", "Water expands when it freezes. That's why ice floats."],
      ["tau", "In the morning I hang on blades of grass and vanish as soon as the sun comes out. What am I?", ["dew", "dewdrop", "morning dew"], "I only have three letters.", "Dew forms when moist air cools on cold surfaces at night."],
      ["regenbogen", "I have seven colours but no brush. I appear when sun and rain meet. What am I?", ["rainbow"], "I'm a colourful arc in the sky.", "Raindrops split sunlight into its colours."],
      ["quelle", "I come out of the ground, clear and fresh, and you find me at the start of every stream. What am I?", ["spring", "water spring", "source"], "In Aqua Map I have my own colour.", "Spring water is groundwater that rises to the surface on its own."],
      ["schnee", "I fall from the sky, white and cold, and no two of us look the same. What am I?", ["snowflake", "snow", "flake", "snowflakes"], "I usually come in winter.", "Snowflakes are ice crystals, usually with six arms."]
    ],
    quiz: [
      ["formel", "What is the chemical formula of water?", ["H₂O", "CO₂", "O₂", "NaCl"], "A water molecule has two hydrogen atoms and one oxygen atom."],
      ["alzette", "Which river flows through Luxembourg City?", ["Alzette", "Moselle", "Rhine", "Meuse"], "The Alzette flows through the lower town, where the Pétrusse joins it."],
      ["mosel", "Which river forms the south-eastern border between Luxembourg and Germany?", ["Moselle", "Alzette", "Wiltz", "Attert"], "Schengen, Remich and Grevenmacher lie on the Moselle."],
      ["stausee", "From which lake does Luxembourg get a large share of its drinking water?", ["Upper Sûre Lake", "Lake Constance", "Echternach Lake", "Lake Geneva"], "Water from the Upper Sûre Lake is treated into drinking water at Esch-sur-Sûre."],
      ["gefrier", "At what temperature does water freeze at normal air pressure?", ["0 °C", "4 °C", "−10 °C", "32 °C"], "32 degrees is the freezing point in Fahrenheit, not Celsius."],
      ["dichte", "At what temperature is water densest?", ["at about 4 °C", "at 0 °C", "at 20 °C", "at 100 °C"], "That's why the water at the bottom of deep lakes is often about 4 degrees in winter."],
      ["trinken", "Roughly how much should adults drink per day according to common advice?", ["about 1.5 litres", "about 0.3 litres", "about 5 litres", "about 10 litres"], "In hot weather or during sport you need more."],
      ["erde", "Roughly how much of the Earth's surface is covered by water?", ["about 71 %", "about 30 %", "about 50 %", "about 90 %"], "Only a very small part of it is fresh water."],
      ["refill", "What does a round Refill sticker on a shop door mean?", ["They'll refill your bottle with tap water for free", "You can return deposit bottles", "They sell bottles", "Water is on sale"], "In Aqua Map you find these places under “Refill stations”."],
      ["sieden", "At what temperature does water boil at sea level?", ["100 °C", "80 °C", "120 °C", "212 °C"], "On high mountains water boils earlier because the air pressure is lower."]
    ],
    anagrams: [["WATER", "No life without me."], ["SPRING", "Where a stream begins."], ["FOUNTAIN", "Where you refill your bottle."], ["DROPLET", "The smallest part of rain."], ["MOSELLE", "River on the German border."], ["ALZETTE", "River through the capital."], ["RAIN", "It falls from the clouds."], ["WAVE", "It rolls across the lake."], ["BOTTLE", "Take it with you every time."], ["CLOUD", "It floats in the sky."]]
  },
  lb: {
    riddles: [
      ["hahn", "Dréins de un mir, da kriss de Waasser. Ech sinn an all Kichen an an all Buedzëmmer. Wat sinn ech?", ["krunn", "waasserkrunn", "wasserhahn", "hahn"], "Ech hunn e Grëff an e Schniewel.", "Zu Lëtzebuerg ass d'Waasser aus der Krunn Drénkwaasser. Domat kanns de deng Fläsch bal iwwerall gratis fëllen."],
      ["fluss", "Ech hunn e Bett, mee ech schlofen ni. Ech hunn eng Mëndung, mee ech schwätzen ni. Wat sinn ech?", ["floss", "baach", "fluss", "bach"], "D'Uelzecht ass esou een.", "D'Uelzecht fléisst mëtten duerch d'Stad Lëtzebuerg, duerch de Gronn an de Pafendall."],
      ["handtuch", "Wat gëtt ëmmer méi naass, wat et méi dréchent?", ["handduch", "duch", "handtuch"], "Du brauchs mech nom Duschen.", "En Handduch hëlt Waasser op, well et aus ganz ville klenge Fasere besteet."],
      ["flasche", "Ech hunn en Hals, mee kee Kapp, an ech droen däi Waasser iwwerall mat. Wat sinn ech?", ["fläsch", "flasch", "waasserfläsch", "flasche"], "Fëll mech bei engem Drénkbuer op.", "Wien eng Fläsch nees opfëllt, spuert all Kéier eng Plastiksfläsch."],
      ["wolke", "Ech fléien ouni Flilleken a kräischen ouni Aen. Wat sinn ech?", ["wollek", "wolleken", "wolke"], "Kuck no uewen, wann et geschwë reent.", "Wolleke bestinn aus klengen Drëpse Waasser oder aus Äiskristaller."],
      ["eis", "Wann et kal gëtt, ginn ech haart. Wann et waarm gëtt, lafen ech fort. Wat sinn ech?", ["äis", "ais", "eis"], "Ech si gefruerent Waasser.", "Waasser gëtt méi grouss, wann et afréiert. Dofir schwëmmt d'Äis uewen."],
      ["tau", "Moies hänken ech un de Grashällemer a verschwannen, soubal d'Sonn kënnt. Wat sinn ech?", ["dau", "daun", "tau"], "Ech hu just dräi Buschtawen.", "Dau entsteet, wann déi fiicht Loft sech an der Nuecht op kale Flächen ofkillt."],
      ["regenbogen", "Ech hu siwe Faarwen, mee kee Pinsel. Ech kommen, wann d'Sonn an de Reen sech treffen. Wat sinn ech?", ["reebou", "reeboun", "regenbogen"], "Ech sinn e faarwege Bou um Himmel.", "D'Reendrëpsen deelen d'Sonneliicht a seng Faarwen op."],
      ["quelle", "Ech kommen aus der Äerd, si kloer a frësch, an um Ufank vun all Baach fënns de mech. Wat sinn ech?", ["quell", "quelle", "buer"], "An Aqua Map hunn ech meng eege Faarf.", "Quellwaasser ass Grondwaasser, dat vu selwer un d'Uewerfläch kënnt."],
      ["schnee", "Ech falen aus dem Himmel, si wäiss a kal, a keen vun eis gesäit d'selwecht aus. Wat sinn ech?", ["schnéiflack", "schneiflack", "schnéi", "schnee", "schneeflocke"], "Ech komme meeschtens am Wanter.", "Schnéiflacke sinn Äiskristaller a meeschtens mat sechs Äerm."]
    ],
    quiz: [
      ["formel", "Wéi eng chemesch Formel huet Waasser?", ["H₂O", "CO₂", "O₂", "NaCl"], "E Waassermolekül huet zwee Waasserstoffatomer an een Sauerstoffatom."],
      ["alzette", "Wéi e Floss fléisst duerch d'Stad Lëtzebuerg?", ["Uelzecht", "Musel", "Rhäin", "Maas"], "D'Uelzecht fléisst duerch d'Ënnerstad. Do fléisst och d'Péitruss an d'Uelzecht."],
      ["mosel", "Wéi e Floss mécht am Südosten d'Grenz tëscht Lëtzebuerg an Däitschland?", ["Musel", "Uelzecht", "Wolz", "Atert"], "Un der Musel leie Schengen, Réimech a Gréiwemaacher."],
      ["stausee", "Aus wéi engem Séi kritt Lëtzebuerg e groussen Deel vu sengem Drénkwaasser?", ["Stauséi vun der Uewersauer", "Bodensee", "Iechternacher Séi", "Genfer Séi"], "D'Waasser aus dem Uewersauer-Stauséi gëtt zu Esch-Sauer zu Drénkwaasser opbereet."],
      ["gefrier", "Bei wéi enger Temperatur fréiert Waasser bei normalem Loftdrock?", ["0 °C", "4 °C", "−10 °C", "32 °C"], "32 Grad ass de Gefréierpunkt a Fahrenheit, net a Celsius."],
      ["dichte", "Bei wéi enger Temperatur ass Waasser am dichtsten?", ["bei ongeféier 4 °C", "bei 0 °C", "bei 20 °C", "bei 100 °C"], "Dofir ass d'Waasser um Buedem vun déiwe Séien am Wanter dacks ongeféier 4 Grad waarm."],
      ["trinken", "Wéi vill sollen Erwuessener no den üblechen Empfeelungen ongeféier pro Dag drénken?", ["ongeféier 1,5 Liter", "ongeféier 0,3 Liter", "ongeféier 5 Liter", "ongeféier 10 Liter"], "Bei Hëtzt a beim Sport dierf et méi sinn."],
      ["erde", "Wéi vill vun der Äerduewerfläch ass ongeféier vu Waasser bedeckt?", ["ongeféier 71 %", "ongeféier 30 %", "ongeféier 50 %", "ongeféier 90 %"], "Just e ganz klengen Deel dovun ass Séisswaasser."],
      ["refill", "Wat bedeit e ronnen Refill-Autocollant op der Dier vun engem Geschäft?", ["Hei gëtt deng Fläsch gratis mat Krunnewaasser gefëllt", "Hei kriss de Pant zeréck", "Hei gi Fläsche verkaaft", "Hei ass Waasser am Ugebuet"], "An Aqua Map fënns de dës Plazen ënner „Refill-Statiounen“."],
      ["sieden", "Bei wéi enger Temperatur kacht Waasser um Niveau vum Mier?", ["100 °C", "80 °C", "120 °C", "212 °C"], "Op héije Bierger kacht Waasser méi fréi, well de Loftdrock do méi niddreg ass."]
    ],
    anagrams: [["WAASSER", "Ouni mech gëtt et kee Liewen."], ["QUELL", "Hei fänkt eng Baach un."], ["MUSEL", "Floss un der Grenz mat Däitschland."], ["UELZECHT", "Floss duerch d'Haaptstad."], ["SAUER", "Floss, un deem Iechternach läit."], ["REEN", "E fält aus de Wolleken."], ["WOLLEK", "Si schwëmmt um Himmel."], ["FLÄSCH", "Huel se ëmmer nees mat."], ["SÉI", "Grousst Waasser am Norden."], ["DRËPS", "Dee klengsten Deel vum Reen."]]
  },
  pt: {
    riddles: [
      ["hahn", "Rodam-me e eu dou-te água. Estou em todas as cozinhas e casas de banho. Quem sou eu?", ["torneira"], "Tenho um manípulo e uma bica.", "No Luxemburgo, a água da torneira é potável. Podes encher a garrafa de graça em quase todo o lado."],
      ["fluss", "Tenho leito mas nunca durmo. Tenho foz mas nunca falo. Quem sou eu?", ["rio", "ribeiro", "riacho"], "O Alzette é um de nós.", "O Alzette atravessa a cidade do Luxemburgo, pelo Grund e por Pfaffenthal."],
      ["handtuch", "Quanto mais seco, mais molhada fico. Quem sou eu?", ["toalha", "toalha de banho"], "Precisas de mim depois do duche.", "Uma toalha absorve água graças às suas muitas fibras pequenas."],
      ["flasche", "Tenho gargalo mas não tenho cabeça, e levo a tua água para todo o lado. Quem sou eu?", ["garrafa", "cantil"], "Enche-me num bebedouro.", "Cada vez que enches uma garrafa reutilizável, poupas uma de plástico."],
      ["wolke", "Voo sem asas e choro sem olhos. Quem sou eu?", ["nuvem", "nuvens"], "Olha para cima quando estiver para chover.", "As nuvens são feitas de gotinhas de água ou de cristais de gelo."],
      ["eis", "Quando faz frio, fico duro. Quando aquece, fujo. Quem sou eu?", ["gelo", "cubo de gelo"], "Sou água congelada.", "A água expande-se quando congela. Por isso o gelo flutua."],
      ["tau", "De manhã estou nas folhas de relva e desapareço assim que chega o sol. Quem sou eu?", ["orvalho", "orvalhada"], "Começo pela letra O.", "O orvalho forma-se quando o ar húmido arrefece durante a noite em superfícies frias."],
      ["regenbogen", "Tenho sete cores mas nenhum pincel. Apareço quando o sol e a chuva se encontram. Quem sou eu?", ["arco-íris", "arco iris"], "Sou um arco colorido no céu.", "As gotas de chuva separam a luz do sol nas suas cores."],
      ["quelle", "Saio da terra, límpida e fresca, e estou no início de cada ribeiro. Quem sou eu?", ["nascente", "fonte"], "Na Aqua Map tenho a minha própria cor.", "A água de nascente é água subterrânea que sobe sozinha à superfície."],
      ["schnee", "Caio do céu, sou branco e frio, e não há dois de nós iguais. Quem sou eu?", ["floco de neve", "neve", "floco", "flocos de neve"], "Chego sobretudo no inverno.", "Os flocos de neve são cristais de gelo, quase sempre com seis braços."]
    ],
    quiz: [
      ["formel", "Qual é a fórmula química da água?", ["H₂O", "CO₂", "O₂", "NaCl"], "Uma molécula de água tem dois átomos de hidrogénio e um de oxigénio."],
      ["alzette", "Que rio atravessa a cidade do Luxemburgo?", ["Alzette", "Mosela", "Reno", "Mosa"], "O Alzette passa pela cidade baixa, onde o Pétrusse também desagua nele."],
      ["mosel", "Que rio faz a fronteira entre o Luxemburgo e a Alemanha, a sudeste?", ["Mosela", "Alzette", "Wiltz", "Attert"], "Schengen, Remich e Grevenmacher ficam junto ao Mosela."],
      ["stausee", "De que lago vem grande parte da água potável do Luxemburgo?", ["Lago da Alta Sûre", "Lago de Constança", "Lago de Echternach", "Lago Léman"], "A água do lago da Alta Sûre é tratada em Esch-sur-Sûre para se tornar potável."],
      ["gefrier", "A que temperatura congela a água à pressão normal?", ["0 °C", "4 °C", "−10 °C", "32 °C"], "32 graus é o ponto de congelação em Fahrenheit, não em Celsius."],
      ["dichte", "A que temperatura é que a água é mais densa?", ["a cerca de 4 °C", "a 0 °C", "a 20 °C", "a 100 °C"], "Por isso, no inverno, a água no fundo dos lagos profundos está muitas vezes a cerca de 4 graus."],
      ["trinken", "Quanto deve um adulto beber por dia, segundo as recomendações habituais?", ["cerca de 1,5 litros", "cerca de 0,3 litros", "cerca de 5 litros", "cerca de 10 litros"], "Com calor ou a fazer desporto, é preciso beber mais."],
      ["erde", "Que parte da superfície da Terra está coberta de água?", ["cerca de 71 %", "cerca de 30 %", "cerca de 50 %", "cerca de 90 %"], "Só uma parte muito pequena é água doce."],
      ["refill", "O que significa um autocolante redondo «Refill» na porta de uma loja?", ["Enchem-te a garrafa de graça com água da torneira", "Aceitam garrafas com tara", "Vendem garrafas", "A água está em promoção"], "Na Aqua Map encontras estes locais em «Estações Refill»."],
      ["sieden", "A que temperatura ferve a água ao nível do mar?", ["100 °C", "80 °C", "120 °C", "212 °C"], "Nas montanhas altas, a água ferve mais cedo porque a pressão do ar é mais baixa."]
    ],
    anagrams: [["ÁGUA", "Sem mim não há vida."], ["FONTE", "Aqui enches a garrafa."], ["NASCENTE", "Aqui começa um ribeiro."], ["GOTA", "A parte mais pequena da chuva."], ["MOSELA", "Rio na fronteira com a Alemanha."], ["ALZETTE", "Rio que atravessa a capital."], ["CHUVA", "Cai das nuvens."], ["ONDA", "Rola pelo lago."], ["GARRAFA", "Leva-a sempre contigo."], ["NUVEM", "Flutua no céu."]]
  }
};
const GC = GAME_CONTENT[LANG] || GAME_CONTENT.de;
const RIDDLES = GC.riddles.map(([id, q, a, hint, fact]) => ({ id, q, a: LANG === "lb" ? a.concat(GAME_CONTENT.de.riddles.find((r) => r[0] === id)[2]) : a, hint, fact }));
const QUIZ = GC.quiz.map(([id, q, o, e]) => ({ id, q, o, e }));
const ANAGRAMS = GC.anagrams.map(([w, hint]) => ({ w, hint }));

/* ---------------- Spiele: Logik ---------------- */
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function lev(a, b) {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const ARTICLES = /\b(der|die|das|ein|eine|einen|ich bin|du bist|es ist|le|la|les|l|un|une|je suis|c est|the|a|an|it s|its|it is|i am|den|d|en|eng|ech sinn|et ass|o|os|as|um|uma|eu sou|sou|e um|e uma)\b/g;
const cleanAnswer = (s) => norm(s).replace(/ß/g, "ss").replace(/[^a-z ]/g, " ").replace(ARTICLES, " ").replace(/\s+/g, "").trim();
function isRight(input, answers) {
  const x = cleanAnswer(input); if (!x) return false;
  return answers.some((a) => { const y = cleanAnswer(a); return x === y || (y.length >= 5 && lev(x, y) <= 1); });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let game = null;
function renderGames() {
  if (game) return renderGame();
  const nR = Object.keys(profile.riddles).length, nQ = Object.keys(profile.quiz).length;
  const nA = Object.keys(profile.anagrams).filter((k) => k.startsWith(LANG + ":")).length;
  const lv = levelOf(profile.points);
  $("#games-body").innerHTML = `${backBtnHTML(t("Heute"), "gtoday")}
    <p class="points-line"><span class="pts"><strong id="gpoints">${num(profile.points)}</strong> ${esc(t("Punkte"))}</span>${profile.name ? `<span class="fine">${esc(t("Level {n}: {name}", { n: lv.i + 1, name: lv.name }))}</span>` : `<button type="button" class="linkbtn" data-go="profile">${esc(t("Profil erstellen, um Abzeichen zu sammeln"))}</button>`}</p>
    <ul class="modes">
      <li><button type="button" class="mode" data-mode="riddle">${dropSVG("brunnen", 30)}<span class="m-main"><span class="m-title">${esc(t("Wasser-Rätsel"))}</span><span class="m-desc">${esc(t("Errate, was gemeint ist. Tipps helfen dir weiter."))}</span></span><span class="m-prog">${esc(t("{a} von {b}", { a: nR, b: RIDDLES.length }))}</span></button></li>
      <li><button type="button" class="mode" data-mode="quiz">${dropSVG("hahn", 30)}<span class="m-main"><span class="m-title">${esc(t("Wasser-Quiz"))}</span><span class="m-desc">${esc(t("10 Fragen zu Wasser und zu Luxemburgs Flüssen."))}</span></span><span class="m-prog">${esc(t("{a} von {b}", { a: nQ, b: QUIZ.length }))}</span></button></li>
      <li><button type="button" class="mode" data-mode="anagram">${dropSVG("refill", 30)}<span class="m-main"><span class="m-title">${esc(t("Buchstabensalat"))}</span><span class="m-desc">${esc(t("Bring die Buchstaben in die richtige Reihenfolge."))}</span></span><span class="m-prog">${esc(t("{a} von {b}", { a: nA, b: ANAGRAMS.length }))}</span></button></li>
    </ul>
    <p class="fine">${esc(t("Punkte gibt es für jedes Rätsel beim ersten Lösen. Ein Tipp kostet ein paar Punkte."))}</p>`;
  document.querySelectorAll(".mode").forEach((b) => b.onclick = () => {
    const m = b.dataset.mode;
    if (m === "riddle") startRiddle(); else if (m === "quiz") startQuiz(); else startAnagram();
  });
  $("#gtoday").onclick = () => go("today");
}
function renderGame() {
  if (game.mode === "riddle") renderRiddle(); else if (game.mode === "quiz") renderQuiz(); else renderAnagram();
  $("#page-games").scrollTop = 0;
}
$("#games-body").addEventListener("click", (e) => { if (e.target.closest("#gback")) { game = null; renderGames(); } });
const gameBack = () => backBtnHTML(t("Alle Spiele"), "gback");
const firstOpen = (list, done, key) => { const i = list.findIndex((x) => !done[key(x)]); return i < 0 ? 0 : i; };

/* Rätsel */
function startRiddle(i) { game = { mode: "riddle", i: i ?? firstOpen(RIDDLES, profile.riddles, (r) => r.id), hints: 0, solved: false }; renderGame(); }
function renderRiddle() {
  const r = RIDDLES[game.i], was = !!profile.riddles[r.id];
  const ans = r.a[0];
  const hint = game.hints >= 1 ? `<p class="hint">${esc(t("Tipp: {hint}", { hint: r.hint }))}</p>` : "";
  const hint2 = game.hints >= 2 ? `<p class="hint">${esc(t("Das Wort hat {n} Buchstaben und beginnt mit „{c}“.", { n: ans.replace(/[^\p{L}]/gu, "").length, c: ans[0].toUpperCase() }))}</p>` : "";
  const worth = Math.max(10, 30 - game.hints * 10);
  $("#games-body").innerHTML = `${gameBack()}
    <p class="g-prog">${esc(t("Rätsel {i} von {n}", { i: game.i + 1, n: RIDDLES.length }))}, ${esc(was ? t("schon gelöst") : t("{n} Punkte", { n: worth }))}</p>
    <p class="riddle">${esc(r.q)}</p>
    ${game.solved ? "" : `<form id="rform" class="answer"><label class="sr-only" for="ranswer">${esc(t("Deine Antwort"))}</label><input id="ranswer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t("Deine Antwort"))}"><button class="act primary" type="submit">${esc(t("Prüfen"))}</button></form>`}
    ${hint}${hint2}
    <div id="rfeedback" aria-live="polite"></div>
    <div class="g-nav">${!game.solved && game.hints < 2 ? `<button type="button" class="linkbtn" id="rhint">${esc(game.hints ? t("Noch ein Tipp") : t("Tipp anzeigen"))}</button>` : "<span></span>"}<button type="button" class="linkbtn" id="rnext">${esc(game.solved ? t("Nächstes Rätsel") : t("Überspringen"))}</button></div>`;
  if (game.solved) $("#rfeedback").innerHTML = `<div class="good">${SPLASH}<div><p class="good-t">${esc(t("Richtig! Gesucht war: {w}", { w: cap(ans) }))}</p>${game.lastPoints ? `<p>${esc(t("+{n} Punkte", { n: game.lastPoints }))}</p>` : ""}<p class="fact">${esc(r.fact)}</p></div></div>`;
  const f = $("#rform");
  if (f) f.onsubmit = (e) => {
    e.preventDefault();
    const v = $("#ranswer").value;
    if (!v.trim()) return;
    if (isRight(v, r.a)) {
      game.solved = true; game.lastPoints = 0;
      if (!profile.riddles[r.id]) { profile.riddles[r.id] = new Date().toISOString(); game.lastPoints = worth; award(worth, t("für das Rätsel")); }
      renderRiddle();
    } else {
      const inp = $("#ranswer"); inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
      $("#rfeedback").innerHTML = `<p class="bad">${esc(game.hints < 2 ? t("Leider nicht. Versuch es noch einmal oder hol dir einen Tipp.") : t("Leider nicht. Versuch es noch einmal."))}</p>`;
      inp.select();
    }
  };
  const h = $("#rhint"); if (h) h.onclick = () => { game.hints++; renderRiddle(); };
  $("#rnext").onclick = () => startRiddle((game.i + 1) % RIDDLES.length);
  if (f && !isMobile()) $("#ranswer").focus();
}

/* Quiz */
function startQuiz() { game = { mode: "quiz", order: shuffle([...QUIZ.keys()]), pos: 0, right: 0, picked: null, opts: null }; renderGame(); }
function renderQuiz() {
  const b = $("#games-body");
  if (game.pos >= game.order.length) {
    const first = game.right > profile.quizBest;
    profile.quizBest = Math.max(profile.quizBest, game.right); const fresh = checkBadges(); saveProfile();
    if (fresh.length) toast(t("Abzeichen erhalten: {names}", { names: fresh.map((x) => t(x.name)).join(", ") }));
    b.innerHTML = `${gameBack()}<div class="good big">${SPLASH}<div><p class="good-t">${esc(t("{a} von {b} richtig", { a: game.right, b: QUIZ.length }))}</p>
      <p>${esc(game.right === QUIZ.length ? t("Perfekt! Du bist ein echter Wasserprofi.") : game.right >= 7 ? t("Sehr gut!") : t("Beim nächsten Mal klappt es noch besser."))}${first ? " " + esc(t("Neuer Bestwert.")) : ""}</p></div></div>
      <div class="row2"><button type="button" class="act" id="qagain">${esc(t("Nochmal spielen"))}</button><button type="button" class="act primary" id="qhome">${esc(t("Alle Spiele"))}</button></div>`;
    $("#qagain").onclick = startQuiz; $("#qhome").onclick = () => { game = null; renderGames(); };
    return;
  }
  const q = QUIZ[game.order[game.pos]];
  if (!game.opts) game.opts = shuffle([...q.o]);
  const ans = q.o[0], done = game.picked != null;
  b.innerHTML = `${gameBack()}
    <p class="g-prog">${esc(t("Frage {i} von {n}, {r} richtig", { i: game.pos + 1, n: QUIZ.length, r: game.right }))}</p>
    <p class="riddle">${esc(q.q)}</p>
    <div class="options">${game.opts.map((o, i) => `<button type="button" class="opt${done ? (o === ans ? " right" : o === game.picked ? " wrong" : "") : ""}" data-o="${i}" ${done ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
    <div id="qfeedback" aria-live="polite">${done ? `<p class="${game.picked === ans ? "goodline" : "bad"}">${esc(game.picked === ans ? t("Richtig!") : t("Leider falsch. Richtig ist: {a}.", { a: ans }))} ${esc(q.e)}</p>` : ""}</div>
    ${done ? `<button type="button" class="act primary wide" id="qnext">${esc(game.pos + 1 < QUIZ.length ? t("Nächste Frage") : t("Ergebnis ansehen"))}</button>` : ""}`;
  b.querySelectorAll(".opt").forEach((o) => o.onclick = () => {
    game.picked = game.opts[+o.dataset.o];
    if (game.picked === ans) {
      game.right++;
      if (!profile.quiz[q.id]) { profile.quiz[q.id] = new Date().toISOString(); award(10, t("für die richtige Antwort")); }
    }
    renderGame();
  });
  const n = $("#qnext"); if (n) n.onclick = () => { game.pos++; game.picked = null; game.opts = null; renderGame(); };
}

/* Buchstabensalat */
function startAnagram(i) {
  const idx = i ?? firstOpen(ANAGRAMS, profile.anagrams, (a) => LANG + ":" + a.w);
  const w = ANAGRAMS[idx].w;
  let letters; do { letters = shuffle([...w]); } while (letters.join("") === w && w.length > 1);
  game = { mode: "anagram", i: idx, tiles: letters.map((ch, k) => ({ ch, k, used: false })), built: [], hints: 0, solved: false };
  renderGame();
}
function renderAnagram() {
  const a = ANAGRAMS[game.i], w = a.w, key = LANG + ":" + w, was = !!profile.anagrams[key];
  const chars = [...w];
  const worth = Math.max(5, 15 - game.hints * 5);
  const slots = chars.map((_, k) => { const tl = game.built[k]; return `<button type="button" class="slot${tl ? " full" : ""}${k < game.hints ? " fixed" : ""}" data-s="${k}" ${!tl || k < game.hints || game.solved ? "disabled" : ""} aria-label="${esc(tl ? t("Buchstabe {c} zurücklegen", { c: tl.ch }) : t("leeres Feld"))}">${tl ? tl.ch : ""}</button>`; }).join("");
  $("#games-body").innerHTML = `${gameBack()}
    <p class="g-prog">${esc(t("Wort {i} von {n}", { i: game.i + 1, n: ANAGRAMS.length }))}, ${esc(was ? t("schon gelöst") : t("{n} Punkte", { n: worth }))}</p>
    <p class="riddle small">${esc(a.hint)}</p>
    <div class="slots" style="--n:${chars.length}">${slots}</div>
    ${game.solved ? "" : `<div class="tiles">${game.tiles.map((tl, k) => `<button type="button" class="tile" data-t="${k}" ${tl.used ? "disabled" : ""}>${tl.ch}</button>`).join("")}</div>`}
    <div id="afeedback" aria-live="polite"></div>
    <div class="g-nav">${game.solved ? "<span></span>" : `<span class="gn-left"><button type="button" class="linkbtn" id="amix">${esc(t("Mischen"))}</button>${game.hints < chars.length - 1 ? `<button type="button" class="linkbtn" id="ahint">${esc(t("Tipp"))}</button>` : ""}</span>`}<button type="button" class="linkbtn" id="anext">${esc(game.solved ? t("Nächstes Wort") : t("Überspringen"))}</button></div>`;
  if (game.solved) $("#afeedback").innerHTML = `<div class="good">${SPLASH}<div><p class="good-t">${esc(t("Richtig: {w}", { w: chars[0] + chars.slice(1).join("").toLowerCase() }))}</p>${game.lastPoints ? `<p>${esc(t("+{n} Punkte", { n: game.lastPoints }))}</p>` : ""}</div></div>`;
  document.querySelectorAll(".tile").forEach((b) => b.onclick = () => {
    const tl = game.tiles[+b.dataset.t]; if (tl.used) return;
    tl.used = true; game.built.push(tl);
    if (game.built.length === chars.length) {
      if (game.built.map((x) => x.ch).join("") === w) {
        game.solved = true; game.lastPoints = 0;
        if (!profile.anagrams[key]) { profile.anagrams[key] = new Date().toISOString(); game.lastPoints = worth; award(worth, t("für das Wort")); }
      } else { renderAnagram(); $("#afeedback").innerHTML = `<p class="bad">${esc(t("Nicht ganz. Tippe oben auf Buchstaben, um sie zurückzulegen."))}</p>`; return; }
    }
    renderAnagram();
  });
  document.querySelectorAll(".slot.full:not(.fixed)").forEach((b) => b.onclick = () => {
    const removed = game.built.splice(+b.dataset.s);
    removed.forEach((tl) => (tl.used = false));
    renderAnagram();
  });
  const mix = $("#amix"); if (mix) mix.onclick = () => { const free = game.tiles.filter((tl) => !tl.used); shuffle(free); game.tiles = game.tiles.filter((tl) => tl.used).concat(free); renderAnagram(); };
  const h = $("#ahint"); if (h) h.onclick = () => {
    game.hints++;
    game.tiles.forEach((tl) => (tl.used = false)); game.built = [];
    for (let k = 0; k < game.hints; k++) { const tl = game.tiles.find((x) => !x.used && x.ch === chars[k]); tl.used = true; game.built.push(tl); }
    renderAnagram();
  };
  $("#anext").onclick = () => startAnagram((game.i + 1) % ANAGRAMS.length);
}

/* ---------------- Besuche (QR-Code oder GPS) ---------------- */
function recordVisit(it) {
  const d = today();
  const first = !profile.visits[it.id], already = profile.visits[it.id] === d;
  if (already) { saveProfile(); return { pts: 0, line: t("Du warst heute schon hier. Morgen gibt es wieder Punkte.") }; }
  profile.visits[it.id] = d;
  const pts = first ? 20 : 5;
  award(pts, t("für deinen Besuch"));
  return { pts, line: t("Besuch gespeichert: +{n} Punkte.", { n: pts }) };
}

/* ---------------- QR-Scanner ---------------- */
const scanner = { stream: null, timer: null, detector: null, active: false, canvas: document.createElement("canvas") };
async function getDetector() {
  if (scanner.detector !== null || !("BarcodeDetector" in window)) return scanner.detector;
  try { const f = await BarcodeDetector.getSupportedFormats(); scanner.detector = f.includes("qr_code") ? new BarcodeDetector({ formats: ["qr_code"] }) : null; }
  catch (e) { scanner.detector = null; }
  return scanner.detector;
}
async function startScanner() {
  scanner.active = true;
  const msg = $("#scanmsg"), box = $("#scanner");
  $("#scanrestart").hidden = true; box.hidden = false; $("#scanresult").hidden = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    box.classList.add("nocam"); msg.textContent = t("Hier ist kein Kamerazugriff möglich. Wähle stattdessen ein Foto mit QR-Code."); return;
  }
  box.classList.remove("nocam"); msg.textContent = t("Kamera wird gestartet …");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (!scanner.active) { stream.getTracks().forEach((tr) => tr.stop()); return; }
    scanner.stream = stream;
    const v = $("#scanvideo"); v.srcObject = stream; await v.play().catch(() => {});
    msg.textContent = t("Halte den QR-Code in den Rahmen.");
    await getDetector();
    tick();
  } catch (e) {
    box.classList.add("nocam");
    msg.textContent = e.name === "NotAllowedError" ? t("Kamerazugriff verweigert. Erlaube die Kamera in den Browser-Einstellungen oder wähle ein Foto mit QR-Code.")
      : e.name === "NotFoundError" ? t("Keine Kamera gefunden. Wähle stattdessen ein Foto mit QR-Code.")
      : t("Die Kamera konnte nicht gestartet werden. Wähle stattdessen ein Foto mit QR-Code.");
    $("#scanrestart").hidden = false;
  }
}
function stopScanner() {
  scanner.active = false; clearTimeout(scanner.timer);
  if (scanner.stream) { scanner.stream.getTracks().forEach((tr) => tr.stop()); scanner.stream = null; }
  const v = $("#scanvideo"); v.pause(); v.srcObject = null;
}
async function tick() {
  if (!scanner.active || !scanner.stream) return;
  const v = $("#scanvideo");
  if (v.readyState >= 2 && v.videoWidth) {
    const text = await decodeQR(v, v.videoWidth, v.videoHeight, false);
    if (text && scanner.active) { stopScanner(); onScanned(text); return; }
  }
  scanner.timer = setTimeout(tick, 140);
}
async function decodeQR(src, w, h, thorough) {
  const det = scanner.detector;
  if (det) { try { const r = await det.detect(src); if (r.length) return r[0].rawValue; if (!thorough) return null; } catch (e) { /* weiter mit jsQR */ } }
  if (typeof jsQR !== "function") return null;
  const scale = Math.min(1, (thorough ? 1600 : 800) / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const c = scanner.canvas; c.width = cw; c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, cw, ch);
  const res = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: thorough ? "attemptBoth" : "dontInvert" });
  return res ? res.data : null;
}
$("#scanfile").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0]; e.target.value = "";
  if (!file) return;
  stopScanner();
  const msg = $("#scanmsg");
  try {
    const img = new Image(); const url = URL.createObjectURL(file);
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
    await getDetector();
    const text = await decodeQR(img, img.naturalWidth, img.naturalHeight, true);
    URL.revokeObjectURL(url);
    if (text) onScanned(text);
    else { $("#scanner").classList.add("nocam"); msg.textContent = t("Auf dem Foto wurde kein QR-Code gefunden. Versuche ein schärferes Foto, auf dem der Code groß zu sehen ist."); $("#scanrestart").hidden = false; }
  } catch (err) { msg.textContent = t("Das Foto konnte nicht gelesen werden."); $("#scanrestart").hidden = false; }
});
$("#scanrestart").addEventListener("click", startScanner);

function onScanned(text) {
  if (navigator.vibrate) navigator.vibrate(60);
  profile.scans++;
  $("#scanner").hidden = true;
  const r = $("#scanresult"); r.hidden = false;
  const m = /(?:#|aquamap:)([nwr]\d{1,12})\b/.exec(text);
  const again = `<button type="button" class="act" id="scanagain">${esc(t("Weiter scannen"))}</button>`;
  if (m && state.byId.has(m[1])) {
    const it = state.byId.get(m[1]);
    const res = recordVisit(it);
    r.innerHTML = `<div class="good">${SPLASH}<div><p class="good-t">${esc(it.title)}</p><p>${esc([it.locality, it.name ? it.sub : ""].filter(Boolean).join(", ") || CATS[it.cat].one)}</p><p class="fact">${esc(res.line)}</p></div></div>
      <div class="row2">${again}<button type="button" class="act primary" id="scanshow">${esc(t("Auf der Karte zeigen"))}</button></div>`;
    $("#scanshow").onclick = () => { go("map"); select(it.id, { from: "search" }); };
  } else if (m) {
    saveProfile();
    r.innerHTML = `<p class="hint">${esc(t("Dieser Code gehört zu einer Aqua-Map-Wasserstelle, die gerade nicht geladen ist. Öffne die Karte mit Internetverbindung und scanne noch einmal."))}</p><div class="row2">${again}</div>`;
  } else if (/^https?:\/\//i.test(text)) {
    saveProfile();
    r.innerHTML = `<p class="res-label">${esc(t("Link gefunden"))}</p><p class="res-text">${esc(text)}</p><p class="fine">${esc(t("Öffne nur Links, denen du vertraust."))}</p>
      <div class="row2"><a class="act primary" href="${esc(text)}" target="_blank" rel="noopener noreferrer">${esc(t("Link öffnen"))}</a><button type="button" class="act" id="scancopy">${esc(t("Kopieren"))}</button></div><div class="row2">${again}</div>`;
  } else {
    saveProfile();
    r.innerHTML = `<p class="res-label">${esc(t("Text gefunden"))}</p><p class="res-text">${esc(text)}</p><div class="row2"><button type="button" class="act" id="scancopy">${esc(t("Kopieren"))}</button>${again}</div>`;
  }
  const c = $("#scancopy"); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(text); toast(t("Kopiert")); } catch (e) { toast(t("Kopieren nicht möglich")); } };
  $("#scanagain").onclick = startScanner;
}
document.addEventListener("visibilitychange", () => {
  if (view !== "scan") return;
  if (document.hidden) stopScanner(); else if ($("#scanresult").hidden) startScanner();
});

/* QR-Code für eine Wasserstelle */
function fountainURL(it) { return location.href.split("#")[0].split("?")[0] + "#" + it.id; }
function showFountainQR(it) {
  const qr = qrcode(0, "M"); qr.addData(fountainURL(it)); qr.make();
  const svg = qr.createSvgTag({ cellSize: 8, margin: 3, scalable: true });
  openDialog(`<h2>${esc(t("QR-Code für diese Wasserstelle"))}</h2><p>${esc(it.title)}${it.locality ? ", " + esc(it.locality) : ""}</p>
    <div class="qrbox">${svg}</div>
    <p class="fine">${esc(t("Drucke den Code als Aufkleber aus und bring ihn an der Wasserstelle an. Wer ihn mit Aqua Map scannt, sieht alle Infos und sammelt Punkte."))}</p>
    <div class="row2"><button type="button" class="act" data-close>${esc(t("Schließen"))}</button><a class="act primary" id="qrdl" download="aqua-map-${it.id}.png">${esc(t("Als Bild speichern"))}</a></div>`);
  const n = qr.getModuleCount(), cell = 12, m = 4, c = document.createElement("canvas");
  c.width = c.height = (n + m * 2) * cell;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = "#13304D";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  $("#qrdl").href = c.toDataURL("image/png");
}

/* ---------------- Fehlende Wasserstelle eintragen ---------------- */
const ADD_KINDS = {
  brunnen: { label: "Trinkbrunnen", note: "Trinkbrunnen", tags: "amenity=drinking_water" },
  hahn: { label: "Wasserhahn", note: "Wasserhahn mit Trinkwasser", tags: "man_made=water_tap, drinking_water=yes" },
  refill: { label: "Refill-Station (Café, Laden)", note: "Refill-Station: Hier wird die Flasche gratis mit Leitungswasser gefüllt", tags: "drinking_water:refill=yes (am Café oder Geschäft)" },
  quelle: { label: "Quelle", note: "Quelle mit Trinkwasser", tags: "natural=spring, drinking_water=yes" }
};
const NOTES_API = "https://api.openstreetmap.org/api/0.6/notes.json";
const addState = { step: "pick", latlng: null, data: null, marker: null, sending: false, noteId: null };
const PIN_SVG = '<svg width="40" height="50" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 1a8.5 8.5 0 0 0-8.5 8.5C3.5 15.8 12 28 12 28s8.5-12.2 8.5-18.5A8.5 8.5 0 0 0 12 1z" fill="#13304D" stroke="#fff" stroke-width="1.4"/><path d="M12 4.6c-1.3 1.8-3.6 4.4-3.6 6.4a3.6 3.6 0 0 0 7.2 0c0-2-2.3-4.6-3.6-6.4z" fill="#00A3E0"/></svg>';
$("#pickpin").innerHTML = PIN_SVG + '<span class="pickdot"></span>';

function pickPoint() {
  const r = map.getContainer().getBoundingClientRect();
  if (isMobile()) {
    const cardTop = $("#page-add").getBoundingClientRect().top;
    return L.point(r.width / 2, Math.max(90, cardTop / 2 + 20));
  }
  const left = document.querySelector(".side").getBoundingClientRect().right;
  return L.point((left + r.width) / 2, r.height / 2);
}
function positionPin() {
  if (view !== "add" || addState.step !== "pick") { $("#pickpin").hidden = true; return; }
  const p = pickPoint(), pin = $("#pickpin");
  pin.style.left = p.x + "px"; pin.style.top = p.y + "px"; pin.hidden = false;
}
function alignTo(latlng) {
  const target = map.latLngToContainerPoint(latlng), pp = pickPoint();
  map.panBy(target.subtract(pp), { animate: false });
}
function enterAdd() {
  addState.step = "pick"; addState.noteId = null;
  addState.data = { kind: "brunnen", desc: "", bottle: "?", wheel: "?", winter: "?", note: "" };
  renderAdd();
  requestAnimationFrame(() => {
    const c = state.user || map.getCenter();
    if (map.getZoom() < 16) map.setView(c, 17, { animate: false });
    alignTo(c); positionPin();
  });
}
function leaveAdd() {
  $("#pickpin").hidden = true;
  if (addState.marker) { map.removeLayer(addState.marker); addState.marker = null; }
}
function seg(name, val, opts) {
  return `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === val ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
}
const YN = () => [["ja", t("Ja")], ["nein", t("Nein")], ["?", t("Weiß nicht")]];
function renderAdd() {
  const b = $("#add-body"), d = addState.data;
  if (addState.marker && addState.step === "pick") { map.removeLayer(addState.marker); addState.marker = null; }
  if (addState.step === "pick") {
    b.innerHTML = `<p class="step">${esc(t("Schritt {a} von {b}", { a: 1, b: 2 }))}</p><h2 id="add-t">${esc(t("Wo ist die Wasserstelle?"))}</h2>
      <p class="lead">${esc(t("Verschiebe die Karte, bis die Nadel genau auf der fehlenden Wasserstelle steht."))}</p>
      <div class="row2"><button type="button" class="act" id="addme">${esc(t("Mein Standort"))}</button><button type="button" class="act primary" id="addnext">${esc(t("Weiter"))}</button></div>
      <p class="fine"><button type="button" class="linkbtn" data-go="map">${esc(t("Abbrechen"))}</button> · ${esc(t("Du kennst dich mit OpenStreetMap aus?"))} <a id="addlink" href="https://mapcomplete.org/drinking_water.html" target="_blank" rel="noopener">${esc(t("Direkt mit MapComplete eintragen"))}</a></p>`;
    updateAddLink();
    $("#addme").onclick = async () => {
      try { const ll = await getPosition(); map.setView(ll, 18, { animate: false }); alignTo(ll); positionPin(); }
      catch (err) { toast(geoError(err)); }
    };
    $("#addnext").onclick = () => {
      if (map.getZoom() < 16) { const ll = map.containerPointToLatLng(pickPoint()); map.setView(ll, 17, { animate: false }); alignTo(ll); positionPin(); toast(t("Zoome näher heran, damit die Position genau ist.")); return; }
      addState.latlng = map.containerPointToLatLng(pickPoint());
      if (!LU_BOUNDS.pad(0.05).contains(addState.latlng)) { toast(t("Diese Stelle liegt außerhalb von Luxemburg.")); return; }
      addState.step = "form"; renderAdd();
    };
  } else if (addState.step === "form") {
    const ll = addState.latlng;
    let near = null;
    for (const it of state.items) { const dd = haversine(ll, L.latLng(it.lat, it.lon)); if (dd < 30 && (!near || dd < near.d)) near = { it, d: dd }; }
    b.innerHTML = `<form id="addform" class="form">
      <p class="step">${esc(t("Schritt {a} von {b}", { a: 2, b: 2 }))}</p><h2 id="add-t">${esc(t("Was gibt es dort?"))}</h2>
      ${near ? `<p class="hint warn">${esc(t("In {d} m Entfernung ist schon „{name}“ eingetragen. Prüfe, ob es dieselbe Stelle ist.", { d: Math.max(1, Math.round(near.d)), name: near.it.title }))}</p>` : ""}
      <fieldset class="field"><legend>${esc(t("Art der Wasserstelle"))}</legend>${seg("akind", d.kind, Object.entries(ADD_KINDS).map(([k, v]) => [k, t(v.label)]))}</fieldset>
      <label class="field"><span>${esc(t("Name oder kurze Beschreibung"))} <span class="opt-l">${esc(t("freiwillig"))}</span></span><input id="adesc" maxlength="120" value="${esc(d.desc)}" placeholder="${esc(t("z. B. Brunnen am Spielplatz"))}"></label>
      <fieldset class="field"><legend>${esc(t("Kann man eine Flasche füllen?"))}</legend>${seg("abottle", d.bottle, YN())}</fieldset>
      <fieldset class="field"><legend>${esc(t("Rollstuhlgerecht?"))}</legend>${seg("awheel", d.wheel, YN())}</fieldset>
      <fieldset class="field"><legend>${esc(t("Auch im Winter in Betrieb?"))}</legend>${seg("awinter", d.winter, YN())}</fieldset>
      <label class="field"><span>${esc(t("Bemerkung"))} <span class="opt-l">${esc(t("freiwillig"))}</span></span><textarea id="anote" rows="2" maxlength="400">${esc(d.note)}</textarea></label>
      <p class="fine">${esc(t("Deine Meldung wird ohne deinen Namen als öffentlicher Hinweis bei OpenStreetMap gespeichert. Freiwillige prüfen ihn und tragen die Wasserstelle ein. Danach erscheint sie in Aqua Map für alle."))}</p>
      <div id="adderr"></div>
      <div class="row2"><button type="button" class="act" id="addback">${esc(t("Position ändern"))}</button><button type="submit" class="act primary" id="addsend">${esc(t("Meldung senden"))}</button></div>
    </form>`;
    if (!addState.marker) addState.marker = L.marker(ll, { icon: L.divIcon({ className: "wk-place", html: PIN_SVG, iconSize: [40, 50], iconAnchor: [20, 48] }), interactive: false, zIndexOffset: 3000 }).addTo(map);
    requestAnimationFrame(() => { if (isMobile()) alignTo(ll); });
    const sync = () => {
      d.kind = document.querySelector('input[name="akind"]:checked').value;
      d.bottle = document.querySelector('input[name="abottle"]:checked').value;
      d.wheel = document.querySelector('input[name="awheel"]:checked').value;
      d.winter = document.querySelector('input[name="awinter"]:checked').value;
      d.desc = $("#adesc").value.trim(); d.note = $("#anote").value.trim();
    };
    $("#addform").addEventListener("change", sync);
    $("#addback").onclick = () => { sync(); addState.step = "pick"; renderAdd(); requestAnimationFrame(() => { alignTo(ll); positionPin(); }); };
    $("#addform").onsubmit = (e) => { e.preventDefault(); sync(); sendReport(); };
  } else {
    b.innerHTML = `<div class="good big">${SPLASH}<div><h2 id="add-t" class="good-t">${esc(t("Danke für deine Meldung!"))}</h2>
      <p>${esc(t("Sie ist als Hinweis #{id} bei OpenStreetMap angekommen. Sobald jemand die Wasserstelle einträgt, erscheint sie in Aqua Map für alle.", { id: addState.noteId }))}</p>
      <p><a href="https://www.openstreetmap.org/note/${addState.noteId}" target="_blank" rel="noopener">${esc(t("Hinweis ansehen"))}</a></p></div></div>
      <div class="row2"><button type="button" class="act" id="addagain">${esc(t("Noch eine melden"))}</button><button type="button" class="act primary" data-go="map">${esc(t("Zur Karte"))}</button></div>`;
    $("#addagain").onclick = () => { if (addState.marker) { map.removeLayer(addState.marker); addState.marker = null; } enterAdd(); };
  }
  positionPin();
}
function reportText(d) {
  // Die Meldung bleibt auf Deutsch, damit die Freiwilligen sie einheitlich lesen können
  const yn = (v) => (v === "ja" ? "ja" : v === "nein" ? "nein" : "unbekannt");
  const k = ADD_KINDS[d.kind];
  const tags = [k.tags];
  if (d.bottle === "ja") tags.push("bottle=yes");
  if (d.wheel === "ja") tags.push("wheelchair=yes"); else if (d.wheel === "nein") tags.push("wheelchair=no");
  if (d.winter === "nein") tags.push("seasonal=yes"); else if (d.winter === "ja") tags.push("seasonal=no");
  const lines = ["Fehlende Wasserstelle, gemeldet über die App Aqua Map", `Art: ${k.note}`];
  if (d.desc) lines.push(`Beschreibung: ${d.desc}`);
  lines.push(`Flasche befüllbar: ${yn(d.bottle)}`, `Rollstuhlgerecht: ${yn(d.wheel)}`, `Im Winter in Betrieb: ${yn(d.winter)}`);
  if (d.note) lines.push(`Bemerkung: ${d.note}`);
  lines.push("", `Vorschlag für Tags: ${tags.join(", ")}`);
  return lines.join("\n");
}
async function sendReport() {
  if (addState.sending) return;
  addState.sending = true;
  const btn = $("#addsend"); btn.disabled = true; btn.textContent = t("Wird gesendet …");
  const ll = addState.latlng, d = addState.data, text = reportText(d);
  try {
    if (!navigator.onLine) throw new Error("offline");
    const res = await fetch(NOTES_API, { method: "POST", body: new URLSearchParams({ lat: ll.lat.toFixed(6), lon: ll.lng.toFixed(6), text }) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const id = j && j.properties && j.properties.id;
    if (!id) throw new Error("no id");
    addState.noteId = id;
    profile.reports.unshift({ note: id, lat: ll.lat, lon: ll.lng, kind: d.kind, desc: d.desc, date: new Date().toISOString() });
    award(20, t("für deine Meldung"));
    drawReports();
    addState.step = "done"; renderAdd();
  } catch (e) {
    btn.disabled = false; btn.textContent = t("Erneut senden");
    $("#adderr").innerHTML = `<p class="hint warn">${esc(e.message === "offline" ? t("Die Meldung konnte nicht gesendet werden, weil du offline bist. Versuche es gleich noch einmal.") : t("Die Meldung konnte nicht gesendet werden. Versuche es gleich noch einmal."))} ${esc(t("Alternativ kannst du den Text kopieren und auf openstreetmap.org selbst als Hinweis eintragen."))} <a href="https://www.openstreetmap.org/note/new#map=19/${ll.lat.toFixed(5)}/${ll.lng.toFixed(5)}" target="_blank" rel="noopener">openstreetmap.org</a> <button type="button" class="linkbtn" id="addcopy">${esc(t("Text kopieren"))}</button></p>`;
    $("#addcopy").onclick = async () => { try { await navigator.clipboard.writeText(text); toast(t("Text kopiert")); } catch (er) { toast(t("Kopieren nicht möglich")); } };
  } finally { addState.sending = false; }
}
const reportsLayer = L.layerGroup().addTo(map);
function drawReports() {
  reportsLayer.clearLayers();
  for (const r of profile.reports) {
    const m = L.marker([r.lat, r.lon], { icon: L.divIcon({ className: "wk-pin reported", html: dropSVG(r.kind in CATS ? r.kind : "brunnen", 24), iconSize: [24, 32], iconAnchor: [12, 31] }), title: t("Von dir gemeldet, wird geprüft"), keyboard: false });
    m.on("click", () => toast(t("Von dir gemeldet am {date}. Freiwillige prüfen die Meldung.", { date: new Date(r.date).toLocaleDateString(LOC()) })));
    m.addTo(reportsLayer);
  }
}
if (typeof ResizeObserver === "function") new ResizeObserver(() => { document.documentElement.style.setProperty("--add-h", $("#page-add").getBoundingClientRect().height + "px"); positionPin(); }).observe($("#page-add"));
map.on("resize", positionPin);

/* ---------------- Heute: Schritte und Trinken ---------------- */
const HEALTH_KEY = "aqua-health-v1";
const health = Object.assign({ days: {}, goalSteps: 8000, goalGlasses: 6, glassMl: 250, keepAwake: true, rem: {}, lastDrink: 0 }, store.get(HEALTH_KEY, {}));
health.rem = Object.assign({ on: false, every: 120, from: "08:00", to: "21:00" }, health.rem);
const day = (k = today()) => (health.days[k] = health.days[k] || { steps: 0, glasses: 0 });
let healthSaveTimer;
function saveHealth(now) { clearTimeout(healthSaveTimer); if (now) store.set(HEALTH_KEY, health); else healthSaveTimer = setTimeout(() => store.set(HEALTH_KEY, health), 1500); }

// Schrittzähler über den Bewegungssensor (zählt, solange Aqua Map geöffnet ist)
const pedo = { on: false, base: 9.81, got: false, above: false, last: 0, streak: [], wake: null, check: null };
function onMotion(e) {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
  pedo.got = true;
  const mag = Math.hypot(a.x, a.y, a.z);
  pedo.base = pedo.base * 0.95 + mag * 0.05;
  const dyn = mag - pedo.base, now = e.timeStamp || performance.now();
  if (!pedo.above && dyn > 1.2 && now - pedo.last > 280) {
    pedo.above = true;
    if (now - pedo.last > 2000) pedo.streak = [];
    pedo.last = now; pedo.streak.push(now);
    // erst ab 4 Schritten in Folge zählen, damit Wackeln nicht als Gehen gilt
    if (pedo.streak.length === 4) addSteps(4); else if (pedo.streak.length > 4) addSteps(1);
  } else if (pedo.above && dyn < 0.4) pedo.above = false;
}
function addSteps(n) {
  const d = day(); const before = d.steps; d.steps += n;
  saveHealth();
  // 5 Punkte je 1.000 Schritte pro Tag
  const k = Math.floor(d.steps / 1000);
  if (k > Math.floor(before / 1000)) {
    const key = today(); const had = profile.stepAwards[key] || 0;
    if (k > had) { profile.stepAwards[key] = k; award((k - had) * 5, t("für deine Schritte")); }
  }
  if (view === "today") updateStepsUI();
}
async function startPedometer() {
  if (typeof DeviceMotionEvent === "undefined") { toast(t("Dieses Gerät hat keinen Bewegungssensor. Der Schrittzähler funktioniert nur auf dem Handy.")); return false; }
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try { const r = await DeviceMotionEvent.requestPermission(); if (r !== "granted") { toast(t("Zugriff auf den Bewegungssensor verweigert.")); return false; } }
    catch (e) { toast(t("Zugriff auf den Bewegungssensor verweigert.")); return false; }
  }
  window.addEventListener("devicemotion", onMotion);
  pedo.on = true; pedo.streak = []; pedo.got = false;
  if (health.keepAwake) requestWake();
  // Kommen nach 6 Sekunden keine Sensordaten, hat das Gerät keinen Sensor (z. B. am Computer)
  pedo.check = setTimeout(() => { if (pedo.on && !pedo.got) { stopPedometer(); toast(t("Dieses Gerät hat keinen Bewegungssensor. Der Schrittzähler funktioniert nur auf dem Handy.")); } }, 6000);
  return true;
}
function stopPedometer() {
  window.removeEventListener("devicemotion", onMotion);
  pedo.on = false; clearTimeout(pedo.check);
  if (pedo.wake) { pedo.wake.release().catch(() => {}); pedo.wake = null; }
  saveHealth(true);
  if (view === "today") renderToday();
}
function requestWake() { if (navigator.wakeLock && !pedo.wake) navigator.wakeLock.request("screen").then((l) => { pedo.wake = l; l.addEventListener("release", () => (pedo.wake = null)); }).catch(() => {}); }
document.addEventListener("visibilitychange", () => { if (!document.hidden && pedo.on && health.keepAwake) requestWake(); });

function addGlass(delta) {
  const d = day(); const before = d.glasses;
  d.glasses = Math.max(0, Math.min(30, d.glasses + delta));
  if (delta > 0) { health.lastDrink = Date.now(); scheduleReminder(); }
  saveHealth(true);
  if (before < health.goalGlasses && d.glasses >= health.goalGlasses && !profile.waterAwards[today()]) {
    profile.waterAwards[today()] = true; award(10, t("für dein Trinkziel"));
  }
  renderToday();
}

// Erinnerungen: in der App (solange sie offen ist) und als Kalendertermine (auch wenn die App zu ist)
let remTimer = null;
const hm = (s) => { const [h, m] = String(s).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function nextReminderAt(from = Date.now()) {
  const r = health.rem; if (!r.on) return null;
  const base = Math.max(health.lastDrink || 0, from - r.every * 60000);
  const t0 = new Date(Math.max(base + r.every * 60000, from + 60000));
  const mins = t0.getHours() * 60 + t0.getMinutes();
  if (mins < hm(r.from)) t0.setHours(Math.floor(hm(r.from) / 60), hm(r.from) % 60, 0, 0);
  else if (mins > hm(r.to)) { t0.setDate(t0.getDate() + 1); t0.setHours(Math.floor(hm(r.from) / 60), hm(r.from) % 60, 0, 0); }
  return t0.getTime();
}
function scheduleReminder() {
  clearTimeout(remTimer); remTimer = null;
  const at = nextReminderAt(); if (!at) return;
  const wait = at - Date.now(); if (wait > 2 ** 31 - 1) return;
  remTimer = setTimeout(fireReminder, Math.max(1000, wait));
}
async function fireReminder() {
  const msg = t("Zeit für ein Glas Wasser! 💧");
  if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) reg.showNotification("Aqua Map", { body: msg, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "aqua-drink" }); else new Notification("Aqua Map", { body: msg }); }
    catch (e) { /* ohne Benachrichtigung */ }
  } else {
    showDrinkBanner(msg);
  }
  // nach 15 Minuten noch einmal, falls nicht getrunken
  health.lastDrink = Date.now() - health.rem.every * 60000 + 15 * 60000;
  scheduleReminder();
}
function showDrinkBanner(msg) {
  const el = $("#drinkbanner");
  el.innerHTML = `<span>${esc(msg)}</span><button type="button" class="act primary" id="dbdrink">${esc(t("+1 Glas"))}</button><button type="button" class="install-x" id="dbx" aria-label="${esc(t("Schließen"))}"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>`;
  el.hidden = false;
  $("#dbdrink").onclick = () => { el.hidden = true; addGlass(1); toast(t("Prost! Glas gezählt.")); };
  $("#dbx").onclick = () => { el.hidden = true; };
}
function reminderTimes() {
  const r = health.rem, out = [];
  for (let m = hm(r.from); m <= hm(r.to); m += r.every) out.push(m);
  return out;
}
function downloadICS() {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date(), tm = new Date(now.getTime() + 86400000);
  const d0 = `${tm.getFullYear()}${pad(tm.getMonth() + 1)}${pad(tm.getDate())}`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const title = t("Zeit für ein Glas Wasser! 💧"), desc = t("Erinnerung von Aqua Map. Freie Wasserstellen in deiner Nähe findest du in der App.");
  const ev = reminderTimes().map((m) => [
    "BEGIN:VEVENT", `UID:aquamap-drink-${pad(Math.floor(m / 60))}${pad(m % 60)}@aqua-map`, `DTSTAMP:${stamp}`,
    `DTSTART:${d0}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`, "DURATION:PT5M", "RRULE:FREQ=DAILY",
    `SUMMARY:${title}`, `DESCRIPTION:${desc}`, "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"
  ].join("\r\n"));
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aqua Map//Trinkerinnerung//DE", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "aqua-map-trinken.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(t("Kalenderdatei erstellt. Öffne sie, um die Erinnerungen in deinen Kalender zu übernehmen."));
  return ics;
}

// Lëtzebuergesch kennen nicht alle Browser für Datumsnamen, darum stehen sie hier selbst
const LB_DAYS = ["Sonndeg", "Méindeg", "Dënschdeg", "Mëttwoch", "Donneschdeg", "Freideg", "Samschdeg"];
const LB_MONTHS = ["Januar", "Februar", "Mäerz", "Abrëll", "Mee", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const longDate = (dt) => LANG === "lb" ? `${LB_DAYS[dt.getDay()]}, ${dt.getDate()}. ${LB_MONTHS[dt.getMonth()]}` : dt.toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long" });
const narrowDay = (dt) => LANG === "lb" ? LB_DAYS[dt.getDay()][0] : dt.toLocaleDateString(LOC(), { weekday: "narrow" });
const DROP_BIG = "M60 6C46 26 14 60 14 95a46 46 0 0 0 92 0c0-35-32-69-46-89z";
const dayKey = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
function renderToday() {
  const b = $("#today-body"); if (!b) return;
  const d = day();
  const pctW = Math.min(1, d.glasses / health.goalGlasses);
  const ml = d.glasses * health.glassMl;
  const fillY = 141 - pctW * 135;
  const week = [];
  for (let i = 6; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); week.push({ s: (health.days[dayKey(dt)] || {}).steps || 0, label: narrowDay(dt) }); }
  const maxS = Math.max(health.goalSteps, ...week.map((w) => w.s));
  const r = health.rem;
  const everyOpts = [[60, t("jede Stunde")], [90, t("alle 1,5 Stunden")], [120, t("alle 2 Stunden")], [180, t("alle 3 Stunden")]];
  const nextAt = nextReminderAt();
  b.innerHTML = `
    <p class="today-date">${esc(longDate(new Date()))}</p>

    <section class="card water-card" aria-labelledby="w-t">
      <h3 id="w-t" class="card-t">${esc(t("Trinken"))}</h3>
      <div class="water-row">
        <svg class="bigdrop" viewBox="0 0 120 147" width="112" height="137" role="img" aria-label="${esc(t("{a} von {b} Gläsern getrunken", { a: d.glasses, b: health.goalGlasses }))}">
          <defs><clipPath id="dropclip"><path d="${DROP_BIG}"/></clipPath></defs>
          <path d="${DROP_BIG}" fill="var(--sky-wash)"/>
          <g clip-path="url(#dropclip)"><path class="wave" d="M-40 ${fillY} q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V160 H-40 Z" fill="#00A3E0"/></g>
          <path d="${DROP_BIG}" fill="none" stroke="#00A3E0" stroke-width="3"/>
        </svg>
        <div class="water-info">
          <p class="big-num"><strong>${d.glasses}</strong> / ${health.goalGlasses}</p>
          <p class="fine">${esc(t("Gläser à {ml} ml, heute {l} Liter", { ml: health.glassMl, l: num(ml / 1000, { maximumFractionDigits: 2 }) }))}</p>
          <div class="glass-btns"><button type="button" class="act" id="gminus" aria-label="${esc(t("Ein Glas weniger"))}">−</button><button type="button" class="act primary" id="gplus">${esc(t("+1 Glas"))}</button></div>
        </div>
      </div>
      ${d.glasses >= health.goalGlasses ? `<p class="goodline">${esc(t("Trinkziel für heute erreicht. Super!"))}</p>` : ""}
    </section>

    <section class="card" aria-labelledby="r-t">
      <h3 id="r-t" class="card-t">${esc(t("Ans Trinken erinnern"))}</h3>
      <label class="switch"><input type="checkbox" id="remon" ${r.on ? "checked" : ""}><span>${esc(t("Erinnerungen einschalten"))}</span></label>
      ${r.on ? `<div class="rem-opts">
        <label class="field"><span>${esc(t("Wie oft?"))}</span><select id="remevery">${everyOpts.map(([v, l]) => `<option value="${v}" ${v === r.every ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <div class="row2 times"><label class="field"><span>${esc(t("Von"))}</span><input type="time" id="remfrom" value="${r.from}"></label><label class="field"><span>${esc(t("Bis"))}</span><input type="time" id="remto" value="${r.to}"></label></div>
        ${nextAt ? `<p class="fine">${esc(t("Nächste Erinnerung: {time} Uhr", { time: new Date(nextAt).toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" }) }))}</p>` : ""}
        <p class="hint">${esc(t("Solange Aqua Map geöffnet ist, erinnert dich die App selbst. Damit du auch bei geschlossener App erinnert wirst, trag die Erinnerungen in deinen Kalender ein."))}</p>
        <button type="button" class="act wide" id="remics">${esc(t("In den Kalender eintragen"))}</button>
      </div>` : ""}
    </section>

    <section class="card" aria-labelledby="s-t">
      <h3 id="s-t" class="card-t">${esc(t("Schritte"))}</h3>
      <div class="steps-row">
        <div class="ring" style="--p:${Math.min(100, Math.round(d.steps / health.goalSteps * 100))}"><div><strong id="stepsnum">${num(d.steps)}</strong><span>${esc(t("von {n}", { n: num(health.goalSteps) }))}</span></div></div>
        <div class="steps-info">
          <p class="fine" id="stepskm">${esc(t("ca. {km} km", { km: num(d.steps * 0.75 / 1000, { maximumFractionDigits: 1 }) }))}</p>
          <button type="button" class="act ${pedo.on ? "" : "primary"}" id="pedobtn">${esc(pedo.on ? t("Zählen pausieren") : t("Schritte zählen"))}</button>
          ${pedo.on ? `<p class="fine live">${esc(t("Zählt gerade …"))}</p>` : ""}
        </div>
      </div>
      <div class="week" aria-label="${esc(t("Schritte der letzten 7 Tage"))}" data-goal="${esc(num(maxS))}">${week.map((w) => `<div class="wk"><span class="bar" style="height:${Math.max(3, Math.round(w.s / maxS * 56))}px" title="${num(w.s)}"></span><small>${esc(w.label)}</small></div>`).join("")}</div>
      <label class="switch"><input type="checkbox" id="keepawake" ${health.keepAwake ? "checked" : ""}><span>${esc(t("Bildschirm beim Zählen anlassen"))}</span></label>
      <p class="fine">${esc(t("Schritte werden gezählt, solange Aqua Map geöffnet ist. Für 1.000 Schritte gibt es 5 Punkte."))}</p>
    </section>

    <section class="card" aria-labelledby="g-t">
      <h3 id="g-t" class="card-t">${esc(t("Rätsel & Spiele"))}</h3>
      <p class="fine">${esc(t("Löse Rätsel rund ums Wasser und sammle Punkte."))}</p>
      <button type="button" class="act primary wide" data-go="games">${esc(t("Zu den Rätseln"))}</button>
    </section>

    <section class="card" aria-labelledby="goal-t">
      <h3 id="goal-t" class="card-t">${esc(t("Deine Ziele"))}</h3>
      <div class="row2"><label class="field"><span>${esc(t("Gläser pro Tag"))}</span><input type="number" id="goalg" min="1" max="20" value="${health.goalGlasses}"></label>
      <label class="field"><span>${esc(t("Schritte pro Tag"))}</span><input type="number" id="goals" min="1000" max="50000" step="500" value="${health.goalSteps}"></label></div>
    </section>`;
  $("#gplus").onclick = () => addGlass(1);
  $("#gminus").onclick = () => addGlass(-1);
  $("#pedobtn").onclick = async () => { if (pedo.on) stopPedometer(); else if (await startPedometer()) renderToday(); };
  $("#keepawake").onchange = (e) => { health.keepAwake = e.target.checked; saveHealth(true); if (pedo.on) { if (health.keepAwake) requestWake(); else if (pedo.wake) { pedo.wake.release().catch(() => {}); pedo.wake = null; } } };
  $("#remon").onchange = async (e) => {
    health.rem.on = e.target.checked; saveHealth(true);
    if (health.rem.on && "Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (er) { /* egal */ } }
    scheduleReminder(); renderToday();
  };
  const remSet = () => { health.rem.every = +$("#remevery").value; health.rem.from = $("#remfrom").value || "08:00"; health.rem.to = $("#remto").value || "21:00"; saveHealth(true); scheduleReminder(); };
  if (r.on) { $("#remevery").onchange = () => { remSet(); renderToday(); }; $("#remfrom").onchange = () => { remSet(); renderToday(); }; $("#remto").onchange = () => { remSet(); renderToday(); }; $("#remics").onclick = downloadICS; }
  $("#goalg").onchange = (e) => { health.goalGlasses = Math.max(1, Math.min(20, +e.target.value || 6)); saveHealth(true); renderToday(); };
  $("#goals").onchange = (e) => { health.goalSteps = Math.max(1000, Math.min(50000, +e.target.value || 8000)); saveHealth(true); renderToday(); };
}
function updateStepsUI() {
  const d = day(), n = $("#stepsnum"); if (!n) return;
  n.textContent = num(d.steps);
  $("#stepskm").textContent = t("ca. {km} km", { km: num(d.steps * 0.75 / 1000, { maximumFractionDigits: 1 }) });
  const ring = document.querySelector(".ring"); if (ring) ring.style.setProperty("--p", Math.min(100, Math.round(d.steps / health.goalSteps * 100)));
}

/* ---------------- Rangliste und Gewinnspiel ---------------- */
// Online-Datenbank (Supabase, Frankfurt). Der Schlüssel ist öffentlich: er erlaubt nur das Lesen
// der Rangliste und die Funktionen upsert_score, remove_score, set_contact und contest_info, die das Geheimnis prüfen.
const LB = { url: "https://zwperzojxovytftcvuwf.supabase.co", key: "sb_publishable_HRJUl4dzeOSkGSbj73zraQ_MaDNycjA" };
const lbReady = () => !!(LB.url && LB.key);
const lbIdent = (() => { let v = store.get("aqua-lb-id", null); if (!v) { const rnd = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); v = { id: rnd(), secret: rnd() + rnd() }; store.set("aqua-lb-id", v); } return v; })();
async function lbCall(path, opts = {}) {
  // Publishable Keys gehören nur in den apikey-Header (sie sind kein JWT)
  const auth = LB.key.startsWith("eyJ") ? { Authorization: `Bearer ${LB.key}` } : {};
  const res = await fetch(`${LB.url}/rest/v1/${path}`, { ...opts, headers: { apikey: LB.key, ...auth, "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}
const rpc = (fn, body) => lbCall("rpc/" + fn, { method: "POST", body: JSON.stringify(body || {}) });
const winCode = (id) => { const h = String(id).replace(/-/g, "").toUpperCase(); return `AQ-${h.slice(0, 4)}-${h.slice(-4)}`; };
const LB_PHOTO_KEY = "aqua-lb-photo";
let lbTimer = null;
function lbQueueSync() { if (!lbReady()) return; clearTimeout(lbTimer); lbTimer = setTimeout(lbSync, 2500); }
async function lbSync() {
  if (!lbReady() || !profile.name || profile.lbOptIn !== true || !navigator.onLine) return;
  const body = { p_id: lbIdent.id, p_secret: lbIdent.secret, p_name: profile.name, p_avatar: profile.avatar, p_points: profile.points };
  // Das Foto nur schicken, wenn es sich geändert hat
  const photoChanged = store.get(LB_PHOTO_KEY, -1) !== (profile.photoVer || 0);
  if (photoChanged) body.p_photo = isPhoto(profile.photo) ? profile.photo : "";
  try { await rpc("upsert_score", body); if (photoChanged) store.set(LB_PHOTO_KEY, profile.photoVer || 0); }
  catch (e) { /* später erneut */ }
}
async function lbRemove() {
  store.set(LB_PHOTO_KEY, -1);
  profile.contactHint = ""; profile.contactRound = null;
  if (!lbReady()) return;
  try { await rpc("remove_score", { p_id: lbIdent.id, p_secret: lbIdent.secret }); } catch (e) { /* egal */ }
}

// Gewinnspiel
let contest = null, contestAt = 0;
async function loadContest(force) {
  if (!lbReady() || !navigator.onLine) return contest;
  if (!force && contest && Date.now() - contestAt < 60000) return contest;
  try {
    const r = await rpc("contest_info");
    const c = await r.json();
    if (c && c.id) { c.off = Date.parse(c.now) - Date.now() || 0; contest = c; } else contest = null;
    contestAt = Date.now();
  } catch (e) { /* alter Stand bleibt */ }
  return contest;
}
const contestOpen = (c) => !!c && !c.decided && Date.parse(c.ends_at) > Date.now() + (c.off || 0);
const dayMonth = (d) => LANG === "lb" ? `${d.getDate()}. ${LB_MONTHS[d.getMonth()]}` : d.toLocaleDateString(LOC(), { day: "numeric", month: "long" });
function countdown(c) {
  const ms = Date.parse(c.ends_at) - (Date.now() + (c.off || 0));
  if (ms <= 0) return t("Beendet");
  const days = Math.floor(ms / 86400000);
  if (days >= 2) return t("Noch {n} Tage", { n: days });
  if (days === 1) return t("Noch 1 Tag");
  return t("Noch {n} Std.", { n: Math.max(1, Math.ceil(ms / 3600000)) });
}
const BOTTLE_SVG = `<svg class="prize-bottle" viewBox="0 0 90 160" width="78" height="139" aria-hidden="true">
  <defs><clipPath id="bottleclip"><rect x="15" y="44" width="60" height="108" rx="17"/></clipPath></defs>
  <rect x="31" y="5" width="28" height="13" rx="5" fill="#00A3E0"/>
  <rect class="b-neck" x="34" y="16" width="22" height="14" rx="3" fill="#D8EEF8"/>
  <path class="b-neck" d="M30 29h30l15 17H15z" fill="#D8EEF8"/>
  <rect class="b-body" x="15" y="44" width="60" height="108" rx="17" fill="rgba(255,255,255,.12)"/>
  <g clip-path="url(#bottleclip)"><path class="wave" d="M-40 84 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V170 H-40 Z" fill="#00A3E0"/></g>
  <rect class="b-line" x="15" y="44" width="60" height="108" rx="17" fill="none" stroke="#fff" stroke-width="3"/>
  <path d="M45 98c-3.2 4.6-8.6 10.5-8.6 15.3a8.6 8.6 0 0 0 17.2 0c0-4.8-5.4-10.7-8.6-15.3z" fill="#fff"/>
  <path class="b-shine" d="M24 60v40" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>
</svg>`;
const TROPHY = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 14v4M8 20h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
function rulesHTML(c) {
  return `<details class="prize-rules"><summary>${esc(t("Teilnahmebedingungen"))}</summary><ol>
    <li>${esc(t("Mitmachen ist kostenlos. Du brauchst ein Profil und musst bei der Rangliste mitmachen."))}</li>
    <li>${esc(t("Es zählen die Punkte, die du während des Gewinnspiels sammelst, höchstens 500 pro Tag."))}</li>
    <li>${esc(t("Wer am {date} um 23:59 Uhr auf Platz 1 liegt, gewinnt eine Trinkflasche. Bei Gleichstand gewinnt, wer die Punktzahl zuerst erreicht hat.", { date: dayMonth(new Date(c.ends_at)) }))}</li>
    <li>${esc(t("Der Gewinner sieht die Nachricht in der App. Wer einen Kontakt angegeben hat, wird zusätzlich benachrichtigt."))}</li>
    <li>${esc(t("Kontaktangaben nutzen wir nur, um den Gewinner zu benachrichtigen. Nach dem Gewinnspiel löschen wir alle anderen."))}</li>
    <li>${esc(t("Wer schummelt, wird ausgeschlossen."))}</li></ol></details>`;
}
function prizeHTML(c, me) {
  if (!c) return "";
  if (!c.decided && !contestOpen(c)) {
    // gerade zu Ende, Gewinner wird beim nächsten Laden festgestellt
    return `<section class="prize"><div class="prize-main"><p class="prize-tag">${TROPHY}${esc(t("Gewinnspiel"))}</p><p class="prize-t">${esc(t("Das Gewinnspiel ist vorbei"))}</p><p class="prize-sub">${esc(t("Der Gewinner wird gerade ermittelt."))}</p></div>${BOTTLE_SVG}</section>`;
  }
  if (c.decided) {
    const iWon = c.winner_id && c.winner_id === lbIdent.id;
    if (iWon) return `<section class="prize won"><div class="prize-main"><p class="prize-tag">${TROPHY}${esc(t("Gewinnspiel"))}</p><p class="prize-t">${esc(t("Du hast gewonnen!"))}</p>
      <p class="prize-sub">${esc(t("Du bist auf Platz 1 und bekommst die Trinkflasche."))}</p>
      <p class="prize-code">${esc(t("Dein Gewinncode"))} <strong>${esc(winCode(lbIdent.id))}</strong></p>
      <button type="button" class="act prize-btn" data-contact>${esc(profile.contactHint ? t("Kontakt ändern") : t("Kontakt angeben"))}</button></div>${BOTTLE_SVG}</section>`;
    return `<section class="prize"><div class="prize-main"><p class="prize-tag">${TROPHY}${esc(t("Gewinnspiel beendet"))}</p>
      ${c.winner_id ? `<div class="prize-winner"><span class="lb-av">${avatarHTML(c.winner_photo, c.winner_avatar)}</span><p class="prize-t small">${esc(t("{name} hat die Trinkflasche gewonnen", { name: c.winner_name || "?" }))}</p></div>
      <p class="prize-sub">${esc(t("Mit {n} Punkten. Herzlichen Glückwunsch!", { n: num(c.winner_points || 0) }))}</p>` : `<p class="prize-t small">${esc(t("Diesmal hat niemand Punkte gesammelt."))}</p>`}
      <p class="prize-sub">${esc(t("Bald gibt es ein neues Gewinnspiel."))}</p></div>${BOTTLE_SVG}</section>`;
  }
  const end = new Date(c.ends_at);
  return `<section class="prize" aria-labelledby="prize-t"><div class="prize-main">
      <p class="prize-tag">${TROPHY}${esc(t("Gewinnspiel"))}</p>
      <p class="prize-t" id="prize-t">${esc(t("Platz 1 gewinnt eine Trinkflasche"))}</p>
      <p class="prize-sub">${esc(t("Sammle bis zum {date} die meisten Punkte.", { date: dayMonth(end) }))}</p>
      <span class="prize-count">${esc(countdown(c))}</span>
      ${rulesHTML(c)}
    </div>${BOTTLE_SVG}</section>`;
}
const maskContact = (v) => { v = String(v || "").trim(); if (v.length <= 4) return "•".repeat(v.length); return v.slice(0, 2) + "•••" + v.slice(-3); };
// Nach dem Ende bleibt der Kontakt nur beim Gewinner gespeichert
const contactValid = (c) => {
  if (!profile.contactHint) return false;
  if (!c) return true;
  if (c.decided) return c.winner_id === lbIdent.id;
  return profile.contactRound == null || profile.contactRound === c.id;
};
function contactFieldHTML() {
  return `<label class="field"><span>${esc(t("Kontakt, falls du gewinnst"))} <span class="opt-l">${esc(t("freiwillig"))}</span></span><input id="lbcontact" maxlength="120" autocomplete="email" inputmode="email" placeholder="${esc(t("E-Mail oder Telefonnummer"))}"></label>
    <p class="fine">${esc(t("Nur das Aqua-Map-Team sieht diese Angabe. Wir nutzen sie nur, um dich bei einem Gewinn zu benachrichtigen, und löschen sie nach dem Gewinnspiel, außer beim Gewinner. Bist du unter 16, frag vorher deine Eltern."))}</p>`;
}
async function saveContact(value) {
  value = String(value || "").trim().slice(0, 120);
  try {
    await lbSync();
    const r = await rpc("set_contact", { p_id: lbIdent.id, p_secret: lbIdent.secret, p_contact: value });
    if (!(await r.json())) throw new Error("nope");
    profile.contactHint = value ? maskContact(value) : ""; profile.contactRound = contest ? contest.id : null;
    saveProfile();
    toast(value ? t("Kontakt gespeichert. Wir melden uns, wenn du gewinnst.") : t("Kontakt gelöscht"));
    return true;
  } catch (e) { toast(t("Das hat nicht geklappt. Prüfe deine Internetverbindung.")); return false; }
}
function openContactDialog() {
  const close = openDialog(`<h2>${esc(t("Kontakt für das Gewinnspiel"))}</h2>
    <form id="ctform" class="form">${contactFieldHTML()}
      ${profile.contactHint ? `<p class="fine">${esc(t("Hinterlegt: {c}", { c: profile.contactHint }))}</p>` : ""}
      <div class="row2"><button type="button" class="act" data-close>${esc(t("Abbrechen"))}</button><button type="submit" class="act primary">${esc(t("Speichern"))}</button></div>
      ${profile.contactHint ? `<button type="button" class="linkbtn" id="ctdel">${esc(t("Kontakt löschen"))}</button>` : ""}
    </form>`);
  $("#ctform").onsubmit = async (e) => { e.preventDefault(); const v = $("#lbcontact").value.trim(); if (!v) { $("#lbcontact").focus(); return; } if (await saveContact(v)) { close(); if (view === "ranking") renderRanking(); } };
  const d = $("#ctdel"); if (d) d.onclick = async () => { if (await saveContact("")) { close(); if (view === "ranking") renderRanking(); } };
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-contact]")) openContactDialog(); });

// Gewinner bekommt beim Öffnen der App eine Nachricht
async function checkWin() {
  if (!lbReady() || profile.lbOptIn !== true || !profile.name) return;
  const c = await loadContest(true);
  if (!c || !c.decided || c.winner_id !== lbIdent.id) return;
  const k = "aqua-won-" + c.id; if (store.get(k, false)) return;
  store.set(k, true);
  if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([90, 60, 90, 60, 160]);
  openDialog(`<div class="won-dlg">${BOTTLE_SVG}<h2>${esc(t("Du hast gewonnen!"))}</h2>
    <p>${esc(t("Du bist auf Platz 1 und bekommst die Trinkflasche."))}</p>
    <p class="prize-code">${esc(t("Dein Gewinncode"))} <strong>${esc(winCode(lbIdent.id))}</strong></p>
    <p class="fine">${esc(contactValid(c) ? t("Wir melden uns über deinen hinterlegten Kontakt. Zeig den Code, wenn du die Flasche bekommst.") : t("Gib an, wie wir dich erreichen können, damit du die Flasche bekommst. Zeig den Code bei der Übergabe."))}</p>
    <div class="row2"><button type="button" class="act" data-close>${esc(t("Schließen"))}</button><button type="button" class="act primary" data-contact data-close>${esc(contactValid(c) ? t("Kontakt ändern") : t("Kontakt angeben"))}</button></div></div>`);
}

function howPoints() {
  return `<h3 class="sec">${esc(t("So sammelst du Punkte"))}</h3><ul class="how">
    <li>${esc(t("Rätsel lösen: bis zu 30 Punkte"))}</li><li>${esc(t("Wasserstelle besuchen (QR-Code oder Route): 20 Punkte"))}</li>
    <li>${esc(t("Fehlende Wasserstelle melden: 20 Punkte"))}</li><li>${esc(t("Trinkziel erreichen: 10 Punkte pro Tag"))}</li><li>${esc(t("1.000 Schritte: 5 Punkte"))}</li></ul>`;
}
const RANK_DOT = (n) => `<span class="pod-block">${n}</span>`;
function podiumHTML(rows, key) {
  const top = rows.filter((x) => (x[key] || 0) > 0).slice(0, 3);
  if (!top.length) return "";
  const slot = (x, place) => x ? `<div class="pod p${place}${x.id === lbIdent.id ? " me" : ""}"><span class="pod-av"><span class="lb-av">${avatarHTML(x.photo, x.avatar)}</span>${place === 1 && contest && !contest.decided ? `<span class="pod-prize" title="${esc(t("Gewinnt die Trinkflasche"))}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="3" rx="1" fill="currentColor"/><path d="M8 6h8l2 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z" fill="currentColor"/></svg></span>` : ""}</span>
      <span class="pod-name">${esc(x.name)}</span><span class="pod-pts">${num(x[key] || 0)}</span>${RANK_DOT(place)}</div>` : `<div class="pod p${place} empty">${RANK_DOT(place)}</div>`;
  return `<div class="podium" aria-label="${esc(t("Die ersten drei"))}">${slot(top[1], 2)}${slot(top[0], 1)}${slot(top[2], 3)}</div>`;
}
async function renderRanking() {
  const b = $("#ranking-body");
  const c = lbReady() ? await loadContest() : null;
  if (view !== "ranking") return;
  const prize = prizeHTML(c);
  const meBox = (rank, pts, extra) => `<div class="lb-me"><span class="lb-av">${profile.name ? avatarHTML(profile.photo, profile.avatar) : "💧"}</span><div class="lb-me-main"><span class="lb-name">${esc(profile.name || t("Du"))}</span>${extra ? `<span class="lb-me-sub">${esc(extra)}</span>` : ""}</div><span class="lb-pts">${rank ? esc(t("Platz {n}", { n: rank })) + "<br>" : ""}<small>${esc(t("{n} Punkte", { n: num(pts) }))}</small></span></div>`;
  if (!profile.name) {
    b.innerHTML = `${prize}<p class="lead">${esc(t("Erstelle zuerst ein Profil mit Spitzname, um in der Rangliste mitzumachen."))}</p><button type="button" class="act primary wide" data-go="profile">${esc(t("Profil erstellen"))}</button>${howPoints()}`;
    return;
  }
  if (!lbReady()) { b.innerHTML = `${meBox(0, profile.points)}<p class="hint">${esc(t("Die gemeinsame Rangliste wird gerade eingerichtet. Bis dahin siehst du hier deine eigenen Punkte."))}</p>${howPoints()}`; return; }
  if (profile.lbOptIn == null || profile.lbOptIn === false) {
    const first = profile.lbOptIn == null;
    b.innerHTML = `${prize}<section class="card join-card"><h3 class="card-t">${esc(contestOpen(c) ? t("Beim Gewinnspiel mitmachen?") : t("Bei der Rangliste mitmachen?"))}</h3>
      <p>${esc(t("Dann sehen alle Aqua-Map-Nutzer deinen Spitznamen, dein Bild und deine Punkte. Mehr nicht. Du kannst das in den Einstellungen jederzeit wieder ausschalten."))}</p>
      ${contestOpen(c) ? contactFieldHTML() : ""}
      <div class="row2">${first ? `<button type="button" class="act" id="lbno">${esc(t("Nein danke"))}</button>` : ""}<button type="button" class="act primary${first ? "" : " wide"}" id="lbyes">${esc(t("Mitmachen"))}</button></div></section>${howPoints()}`;
    $("#lbyes").onclick = async () => {
      const ct = $("#lbcontact") ? $("#lbcontact").value.trim() : "";
      profile.lbOptIn = true; saveProfile(); await lbSync();
      if (ct) await saveContact(ct);
      renderRanking();
    };
    const no = $("#lbno"); if (no) no.onclick = () => { profile.lbOptIn = false; saveProfile(); renderRanking(); };
    return;
  }
  b.innerHTML = `${prize}${meBox(0, profile.points)}<p class="fine">${esc(t("Rangliste wird geladen …"))}</p>`;
  try {
    await lbSync();
    const key = c ? "round_points" : "points", tie = c ? "round_updated_at" : "updated_at";
    const [rowsRes, meRes] = await Promise.all([
      lbCall(`leaderboard_public?select=id,name,avatar,photo,${key}&order=${key}.desc,${tie}.asc&limit=50`),
      lbCall(`leaderboard_public?select=${key}&id=eq.${encodeURIComponent(lbIdent.id)}`)
    ]);
    const rows = await rowsRes.json(), mine = ((await meRes.json())[0] || {})[key] || 0;
    let myRank = rows.findIndex((x) => x.id === lbIdent.id) + 1;
    if (!myRank) {
      const cr = await lbCall(`leaderboard_public?select=id&${key}=gt.${mine}&limit=1`, { headers: { Prefer: "count=exact" } });
      const m = /\/(\d+)/.exec(cr.headers.get("content-range") || ""); myRank = m ? +m[1] + 1 : 0;
    }
    if (view !== "ranking") return;
    if (profile.contactHint && !contactValid(c)) { profile.contactHint = ""; profile.contactRound = null; saveProfile(); }
    const lead = rows[0] ? rows[0][key] || 0 : 0;
    let extra = "";
    if (c && contestOpen(c)) extra = mine <= 0 ? t("Sammle Punkte, um ins Gewinnspiel zu kommen.") : myRank === 1 ? t("Du liegst vorne! Halte durch bis zum Ende.") : t("Noch {n} Punkte bis Platz 1", { n: num(lead - mine + 1) });
    const rest = rows.filter((x, i) => i >= 3 || (x[key] || 0) <= 0);
    b.innerHTML = `${prize}${meBox(myRank, c ? mine : profile.points, extra)}
      ${c && contestOpen(c) ? `<div class="lb-contact"><span>${esc(contactValid(c) ? t("Kontakt für den Gewinnfall: {c}", { c: profile.contactHint }) : t("Noch kein Kontakt für den Gewinnfall hinterlegt."))}</span><button type="button" class="linkbtn" data-contact>${esc(contactValid(c) ? t("Ändern") : t("Hinzufügen"))}</button></div>` : ""}
      ${podiumHTML(rows, key)}
      ${rest.length ? `<ol class="lb-list" start="${rows.length - rest.length + 1}">${rest.map((x) => `<li class="${x.id === lbIdent.id ? "me" : ""}"><span class="lb-rank">${rows.indexOf(x) + 1}</span><span class="lb-av">${avatarHTML(x.photo, x.avatar)}</span><span class="lb-name">${esc(x.name)}</span><span class="lb-pts">${num(x[key] || 0)}</span></li>`).join("")}</ol>` : ""}
      ${rows.length ? "" : `<p class="lead">${esc(t("Noch niemand dabei. Sei die oder der Erste!"))}</p>`}
      ${c ? `<p class="fine">${esc(t("In der Rangliste stehen die Punkte aus dem Gewinnspiel. Deine Gesamtpunkte siehst du im Profil."))}</p>` : ""}
      <button type="button" class="act wide" id="lbreload">${esc(t("Aktualisieren"))}</button>${howPoints()}`;
    $("#lbreload").onclick = () => { contestAt = 0; renderRanking(); };
  } catch (e) {
    b.innerHTML = `${prize}${meBox(0, profile.points)}<p class="hint warn">${esc(t("Die Rangliste konnte nicht geladen werden. Prüfe deine Internetverbindung."))}</p><button type="button" class="act wide" id="lbreload">${esc(t("Erneut versuchen"))}</button>`;
    $("#lbreload").onclick = renderRanking;
  }
}

/* ---------------- Einstellungen ---------------- */
const WATER_INFO = {
  de: [
    ["", "Öffentliche Trinkbrunnen und Wasserhähne hängen am normalen Trinkwassernetz. Aus ihnen kommt dasselbe Wasser wie zu Hause aus dem Hahn. In Refill-Stationen bekommst du das Leitungswasser des Betriebs."],
    ["Grundwasser und Stausee", "In Luxemburg stammt etwa die Hälfte des Trinkwassers aus Grundwasser, gefasst in rund 270 Quellen und etwa 40 Brunnen. Die andere Hälfte kommt aus dem Obersauer-Stausee. Je nach Jahr verschiebt sich das Verhältnis etwas."],
    ["Der Luxemburger Sandstein", "Rund zwei Drittel des genutzten Grundwassers kommen aus dem Luxemburger Sandstein. Diese Gesteinsschicht speichert Regenwasser wie ein großer Schwamm und filtert es dabei."],
    ["Aufbereitung am Stausee", "Das Seewasser wird vom Syndikat SEBES bei Esch-sur-Sûre in mehreren Schritten aufbereitet, unter anderem mit Filtration und Ozon, bevor es ins Netz geht."],
    ["Stadt Luxemburg", "Die Hauptstadt bezieht ihr Wasser zu etwa 70 % aus eigenen Quellen und zu etwa 30 % vom SEBES. Der Service des eaux der Stadt kontrolliert das Trinkwasser mehr als 2.000 Mal im Jahr. Die Analysen findest du auf eaux.vdl.lu."],
    ["Quellen in der App", "Als „Quelle“ markierte Stellen sind natürliche Quellen oder alte Brunnen. Deren Wasser wird nicht unbedingt amtlich überwacht. Trink dort nur, wenn ein Schild das Wasser als Trinkwasser ausweist."]
  ],
  fr: [
    ["", "Les fontaines et robinets publics sont raccordés au réseau d'eau potable normal. Il en sort la même eau que celle du robinet à la maison. Dans les stations Refill, tu reçois l'eau du robinet de l'établissement."],
    ["Eaux souterraines et lac", "Au Luxembourg, environ la moitié de l'eau potable provient des eaux souterraines, captées dans quelque 270 sources et environ 40 puits. L'autre moitié vient du lac de la Haute-Sûre. Selon les années, la part varie un peu."],
    ["Le grès de Luxembourg", "Environ deux tiers des eaux souterraines utilisées proviennent du grès de Luxembourg. Cette couche de roche stocke l'eau de pluie comme une grande éponge et la filtre."],
    ["Traitement au lac", "L'eau du lac est traitée par le syndicat SEBES à Esch-sur-Sûre en plusieurs étapes, notamment par filtration et à l'ozone, avant d'entrer dans le réseau."],
    ["Ville de Luxembourg", "La capitale tire environ 70 % de son eau de ses propres sources et environ 30 % du SEBES. Le Service des eaux de la Ville contrôle l'eau potable plus de 2 000 fois par an. Les analyses sont sur eaux.vdl.lu."],
    ["Les sources dans l'app", "Les lieux marqués « Source » sont des sources naturelles ou d'anciens puits. Leur eau n'est pas forcément contrôlée officiellement. N'y bois que si un panneau indique de l'eau potable."]
  ],
  en: [
    ["", "Public drinking fountains and taps are connected to the normal drinking water network. They give you the same water as the tap at home. At Refill stations you get the venue's tap water."],
    ["Groundwater and reservoir", "In Luxembourg, about half of the drinking water comes from groundwater, collected in around 270 springs and about 40 wells. The other half comes from the Upper Sûre reservoir. The share shifts a little from year to year."],
    ["Luxembourg Sandstone", "About two thirds of the groundwater used comes from the Luxembourg Sandstone. This rock layer stores rainwater like a big sponge and filters it."],
    ["Treatment at the reservoir", "The lake water is treated by the SEBES syndicate at Esch-sur-Sûre in several steps, including filtration and ozone, before it enters the network."],
    ["Luxembourg City", "The capital gets about 70 % of its water from its own springs and about 30 % from SEBES. The city's water service tests the drinking water more than 2,000 times a year. The results are on eaux.vdl.lu."],
    ["Springs in the app", "Places marked “Spring” are natural springs or old wells. Their water is not necessarily officially monitored. Only drink there if a sign says it is drinking water."]
  ],
  lb: [
    ["", "Ëffentlech Drénkbueren a Krunnen hänken um normale Drénkwaassernetz. Do kënnt dat selwecht Waasser eraus wéi doheem aus der Krunn. An de Refill-Statioune kriss de d'Krunnewaasser vum Betrib."],
    ["Grondwaasser a Stauséi", "Zu Lëtzebuerg kënnt ongeféier d'Halschent vum Drénkwaasser aus dem Grondwaasser, gefaasst a ronn 270 Quellen an ongeféier 40 Pëtzer. Déi aner Halschent kënnt aus dem Stauséi vun der Uewersauer. Jee no Joer verschitt sech dat e bëssen."],
    ["De Lëtzebuerger Sandsteen", "Ronn zwee Drëttel vum genotzte Grondwaasser kommen aus dem Lëtzebuerger Sandsteen. Dës Steeschicht späichert Reewaasser wéi e grousse Schwamm a filtert et dobäi."],
    ["Opbereedung um Stauséi", "D'Waasser aus dem Séi gëtt vum Syndikat SEBES zu Esch-Sauer a méi Etappen opbereet, ënner anerem mat Filtratioun an Ozon, ier et an d'Netz geet."],
    ["Stad Lëtzebuerg", "D'Haaptstad kritt hiert Waasser zu ongeféier 70 % aus egene Quellen an zu ongeféier 30 % vum SEBES. De Service des eaux vun der Stad kontrolléiert d'Drénkwaasser méi wéi 2.000 Mol am Joer. D'Analysen fënns de op eaux.vdl.lu."],
    ["Quellen an der App", "Plazen, déi als „Quell“ markéiert sinn, sinn natierlech Quellen oder al Pëtzer. Hiert Waasser gëtt net onbedéngt offiziell iwwerwaacht. Drénk do nëmmen, wann e Schëld d'Waasser als Drénkwaasser ausweist."]
  ],
  pt: [
    ["", "Os bebedouros e as torneiras públicas estão ligados à rede normal de água potável. Sai deles a mesma água que da torneira de casa. Nas estações Refill recebes a água da torneira do estabelecimento."],
    ["Água subterrânea e barragem", "No Luxemburgo, cerca de metade da água potável vem de águas subterrâneas, captadas em cerca de 270 nascentes e cerca de 40 furos. A outra metade vem da barragem da Alta Sûre. A proporção varia um pouco de ano para ano."],
    ["O arenito do Luxemburgo", "Cerca de dois terços das águas subterrâneas utilizadas vêm do arenito do Luxemburgo. Esta camada de rocha guarda a água da chuva como uma grande esponja e filtra-a."],
    ["Tratamento na barragem", "A água do lago é tratada pelo sindicato SEBES em Esch-sur-Sûre em várias etapas, incluindo filtração e ozono, antes de entrar na rede."],
    ["Cidade do Luxemburgo", "A capital recebe cerca de 70 % da água das suas próprias nascentes e cerca de 30 % do SEBES. O serviço de águas da cidade controla a água potável mais de 2000 vezes por ano. As análises estão em eaux.vdl.lu."],
    ["As nascentes na app", "Os locais marcados como «Nascente» são nascentes naturais ou poços antigos. A água não é necessariamente controlada oficialmente. Só bebas lá se uma placa indicar que é água potável."]
  ]
};
function renderSettings() {
  const b = $("#settings-body");
  const th = themeSetting();
  const info = WATER_INFO[LANG] || WATER_INFO.de;
  b.innerHTML = `${backBtnHTML(t("Profil"), "sback")}
    <section class="card"><h3 class="card-t">${esc(t("Sprache"))}</h3>
      <div class="seg" role="radiogroup">${Object.entries(LANGS).map(([k, l]) => `<label><input type="radio" name="slang" value="${k}" ${k === LANG ? "checked" : ""}><span lang="${k}">${l}</span></label>`).join("")}</div>
      ${LANG === "lb" ? `<p class="fine">${esc(t("Nicht alles gibt es auf Luxemburgisch, zum Beispiel die Wegbeschreibung. Dort erscheint Deutsch."))}</p>` : ""}
    </section>
    <section class="card"><h3 class="card-t">${esc(t("Design"))}</h3>
      <div class="seg" role="radiogroup">${[["light", t("Hell")], ["dark", t("Dunkel")], ["system", t("Wie das Gerät")]].map(([k, l]) => `<label><input type="radio" name="stheme" value="${k}" ${k === th ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>
    </section>
    <section class="card"><h3 class="card-t">${esc(t("Rangliste"))}</h3>
      <label class="switch"><input type="checkbox" id="slb" ${profile.lbOptIn ? "checked" : ""} ${profile.name ? "" : "disabled"}><span>${esc(t("Mit Spitzname in der Rangliste erscheinen"))}</span></label>
      ${profile.name ? "" : `<p class="fine">${esc(t("Dafür brauchst du zuerst ein Profil."))}</p>`}
    </section>
    <section class="card water-info-card"><h3 class="card-t">${esc(t("Woher kommt das Wasser?"))}</h3>
      ${info.map(([h, p]) => (h ? `<h4>${esc(h)}</h4>` : "") + `<p>${esc(p)}</p>`).join("")}
      <p class="fine">${esc(t("Quellen: Ville de Luxembourg, Service des eaux; Regierung Luxemburg, Wasserwirtschaftsamt; SEBES."))}</p>
    </section>
    <section class="card"><h3 class="card-t">${esc(t("Über Aqua Map"))}</h3>
      <p class="fine">${esc(t("Wasserstellen und Ortsnamen: OpenStreetMap-Mitwirkende (ODbL). Karte: OpenFreeMap, OpenMapTiles. Satellit: Esri. Ortssuche: Photon. Routen: Valhalla (FOSSGIS). Angaben ohne Gewähr."))}</p>
      <button type="button" class="act danger wide" id="sreset">${esc(t("Alle Daten auf diesem Gerät löschen"))}</button>
    </section>`;
  $("#sback").onclick = () => go("profile");
  b.querySelectorAll('input[name="slang"]').forEach((rb) => rb.onchange = () => setLang(rb.value));
  b.querySelectorAll('input[name="stheme"]').forEach((rb) => rb.onchange = () => {
    try { localStorage.setItem(THEME_KEY, JSON.stringify(rb.value)); } catch (e) { /* egal */ }
    applyThemeAttr(); themeMap(true);
  });
  $("#slb").onchange = async (e) => { profile.lbOptIn = e.target.checked; saveProfile(); if (!profile.lbOptIn) { await lbRemove(); saveProfile(); } else lbSync(); };
  $("#sreset").onclick = () => {
    $("#sreset").outerHTML = `<div class="confirm" id="sreset"><p>${esc(t("Wirklich alles löschen? Profil, Punkte, Schritte, gemerkte Stellen und Einstellungen auf diesem Gerät gehen verloren."))}</p>
      <div class="row2"><button class="act" type="button" id="rno">${esc(t("Abbrechen"))}</button><button class="act danger" type="button" id="ryes">${esc(t("Ja, alles löschen"))}</button></div></div>`;
    $("#rno").onclick = renderSettings;
    $("#ryes").onclick = async () => { await lbRemove(); try { Object.keys(localStorage).filter((k) => k.startsWith("aqua-")).forEach((k) => localStorage.removeItem(k)); } catch (er) { /* egal */ } location.reload(); };
  };
}
const mqDark = window.matchMedia("(prefers-color-scheme: dark)");
if (mqDark.addEventListener) mqDark.addEventListener("change", () => { if (themeSetting() === "system") { applyThemeAttr(); themeMap(true); } });

/* ---------------- Navigation ---------------- */
let view = "map";
const VIEWS = ["map", "today", "games", "scan", "ranking", "profile", "settings", "add"];
const NAV_OF = { map: "map", add: "map", today: "today", games: "today", scan: "scan", ranking: "ranking", profile: "profile", settings: "profile" };
function go(v) {
  if (!VIEWS.includes(v)) return;
  if (v === view) { if (v === "games" && game) { game = null; renderGames(); } return; }
  if (view === "scan") stopScanner();
  if (view === "add") leaveAdd();
  view = v; document.body.dataset.view = v;
  document.querySelectorAll("#nav button").forEach((b) => { if (b.dataset.go === NAV_OF[v]) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  hideResults();
  if (v === "today") renderToday();
  if (v === "games") renderGames();
  if (v === "profile") renderProfile();
  if (v === "settings") renderSettings();
  if (v === "ranking") renderRanking();
  if (v === "scan") startScanner();
  if (v === "add") enterAdd();
  if (v === "map") setSheet(sheetState);
  setTimeout(() => { map.invalidateSize(); positionPin(); }, 40);
  const page = document.getElementById("page-" + v);
  if (page) { page.scrollTop = 0; const h = page.querySelector("h2"); if (h && !isMobile()) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { e.preventDefault(); const d = $("#dlg"); if (!d.hidden && d.contains(b)) d.hidden = true; go(b.dataset.go); } });

function onDataReady() { drawReports(); }

/* ---------------- Start ---------------- */
document.title = t("Aqua Map – Gratis Trinkwasser in Luxemburg");
renderNavAvatar();
drawReports();
coreInit();
scheduleReminder();
if (profile.lbOptIn) { lbQueueSync(); setTimeout(checkWin, 2500); }
window.addEventListener("online", () => { if (profile.lbOptIn) lbQueueSync(); });
if (/^#(spiel|raetsel)$/.test(location.hash)) go("games");
