"use strict";
/* ============================================================
   Aqua Map – Menü, Profil, Rätsel, QR-Scanner, Eintragen
   Läuft nach core.js und startet am Ende die App.
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

/* ---------------- Profil ---------------- */
const PROFILE_KEY = "aqua-profile-v1";
const AVATARS = ["💧", "🐟", "🐳", "🦆", "🐸", "🌊", "🐬", "🦦"];
const LEVELS = [[0, "Tropfen"], [50, "Pfütze"], [150, "Bach"], [300, "Fluss"], [600, "See"], [1000, "Ozean"]];
function blankProfile() {
  return { name: "", avatar: "💧", created: null, points: 0, riddles: {}, quiz: {}, quizBest: 0, anagrams: {}, visits: {}, scans: 0, reports: [], badges: {} };
}
let profile = Object.assign(blankProfile(), store.get(PROFILE_KEY, {}));

const BADGES = [
  { id: "first-riddle", name: "Erster Schluck", desc: "Dein erstes Rätsel gelöst", test: (p) => Object.keys(p.riddles).length + Object.keys(p.anagrams).length >= 1 },
  { id: "riddles-all", name: "Rätselquelle", desc: "Alle Wasser-Rätsel gelöst", test: (p) => Object.keys(p.riddles).length >= RIDDLES.length },
  { id: "quiz-perfect", name: "Quiz-Profi", desc: "Alle Quizfragen in einer Runde richtig", test: (p) => p.quizBest >= QUIZ.length },
  { id: "anagram-5", name: "Buchstabenfischer", desc: "5 Wörter im Buchstabensalat gefunden", test: (p) => Object.keys(p.anagrams).length >= 5 },
  { id: "first-visit", name: "Auf Tour", desc: "Eine Wasserstelle per QR-Code besucht", test: (p) => Object.keys(p.visits).length >= 1 },
  { id: "visits-5", name: "Brunnenwanderer", desc: "5 verschiedene Wasserstellen besucht", test: (p) => Object.keys(p.visits).length >= 5 },
  { id: "first-report", name: "Brunnenfinder", desc: "Eine fehlende Wasserstelle gemeldet", test: (p) => p.reports.length >= 1 },
  { id: "points-300", name: "Wasserprofi", desc: "300 Punkte gesammelt", test: (p) => p.points >= 300 }
];

function saveProfile() { store.set(PROFILE_KEY, profile); renderNavAvatar(); }
function levelOf(pts) {
  let i = 0; while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1][0]) i++;
  return { i, name: LEVELS[i][1], from: LEVELS[i][0], to: LEVELS[i + 1] ? LEVELS[i + 1][0] : null, next: LEVELS[i + 1] ? LEVELS[i + 1][1] : null };
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
  toast((lv.i > before ? `Neues Level: ${lv.name}! ` : "") + `+${points} Punkte${why ? " für " + why : ""}`);
  if (fresh.length) setTimeout(() => toast(`Abzeichen erhalten: ${fresh.map((b) => b.name).join(", ")}`), 2700);
  updatePointsPill();
}
const navIconHTML = $("#navavatar").innerHTML;
function renderNavAvatar() {
  const el = $("#navavatar");
  if (profile.name) { el.textContent = profile.avatar; el.classList.add("emoji"); }
  else { el.innerHTML = navIconHTML; el.classList.remove("emoji"); }
}
const solvedCount = () => Object.keys(profile.riddles).length + Object.keys(profile.anagrams).length + Object.keys(profile.quiz).length;
const BADGE_ICON = (on) => `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="${on ? "#E3F4FB" : "#EEF4F8"}"/><path d="M17 6.5c-2.3 3.3-6.8 8.2-6.8 12.1a6.8 6.8 0 0 0 13.6 0c0-3.9-4.5-8.8-6.8-12.1z" fill="${on ? "#00A3E0" : "#C3D2DD"}"/>${on ? '<path d="m13.8 19.2 2.3 2.2 4.3-4.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ""}</svg>`;

function profileForm(editing) {
  return `<form id="profform" class="form">
    ${editing ? "" : `<p class="lead">Mit einem Profil sammelst du Punkte für gelöste Rätsel, besuchte Brunnen und Meldungen und schaltest Abzeichen frei.</p>`}
    <label class="field"><span>Dein Spitzname</span><input id="pname" maxlength="24" required autocomplete="nickname" value="${esc(profile.name)}" placeholder="z. B. Brunnenfuchs"></label>
    <fieldset class="field"><legend>Wähle ein Bild</legend>
      <div class="avatars">${AVATARS.map((a) => `<label><input type="radio" name="pav" value="${a}" ${a === profile.avatar ? "checked" : ""}><span>${a}</span></label>`).join("")}</div>
    </fieldset>
    ${!editing && profile.points ? `<p class="fine">Deine bisherigen ${profile.points} Punkte werden übernommen.</p>` : ""}
    <div class="row2">${editing ? `<button class="act" type="button" id="profcancel">Abbrechen</button>` : ""}<button class="act primary" type="submit">${editing ? "Speichern" : "Profil erstellen"}</button></div>
    <p class="fine">Dein Profil wird nur auf diesem Gerät gespeichert. Es gibt kein Konto und kein Passwort.</p>
  </form>`;
}
function bindProfileForm(editing) {
  $("#profform").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#pname").value.trim();
    if (!name) { $("#pname").focus(); return; }
    const av = document.querySelector('input[name="pav"]:checked');
    const isNew = !profile.name;
    profile.name = name; profile.avatar = av ? av.value : "💧";
    if (!profile.created) profile.created = new Date().toISOString();
    saveProfile(); renderProfile();
    toast(isNew ? `Willkommen, ${name}!` : "Profil gespeichert");
  });
  if (editing) $("#profcancel").onclick = renderProfile;
}

function renderProfile() {
  const b = $("#profile-body");
  if (!profile.name) { b.innerHTML = profileForm(false); bindProfileForm(false); return; }
  const lv = levelOf(profile.points);
  const pct = lv.to ? Math.round((profile.points - lv.from) / (lv.to - lv.from) * 100) : 100;
  const reports = profile.reports.map((r) => `<li>${dropSVG(r.kind in CATS ? r.kind : "brunnen", 20)}<div><p class="b-name">${esc(r.desc || ADD_KINDS[r.kind]?.label || "Wasserstelle")}</p>
      <p class="b-desc">Gemeldet am ${new Date(r.date).toLocaleDateString("de-DE")}${r.note ? `, <a href="https://www.openstreetmap.org/note/${r.note}" target="_blank" rel="noopener">Hinweis #${r.note}</a>` : ""}</p></div></li>`).join("");
  b.innerHTML = `
    <div class="prof-head">
      <span class="avatar-lg" aria-hidden="true">${profile.avatar}</span>
      <div><p class="prof-name">${esc(profile.name)}</p><p class="prof-level">Level ${lv.i + 1}: ${lv.name}</p></div>
    </div>
    <div class="levelbar" role="progressbar" aria-label="Fortschritt zum nächsten Level" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <p class="fine">${lv.to ? `Noch ${lv.to - profile.points} Punkte bis ${lv.next}` : "Du hast das höchste Level erreicht."}</p>
    <dl class="stats">
      <div><dt>Punkte</dt><dd>${profile.points}</dd></div>
      <div><dt>Rätsel gelöst</dt><dd>${solvedCount()}</dd></div>
      <div><dt>Brunnen besucht</dt><dd>${Object.keys(profile.visits).length}</dd></div>
      <div><dt>Brunnen gemeldet</dt><dd>${profile.reports.length}</dd></div>
    </dl>
    <h3 class="sec">Abzeichen</h3>
    <ul class="badge-list">${BADGES.map((x) => `<li class="${profile.badges[x.id] ? "got" : "locked"}">${BADGE_ICON(!!profile.badges[x.id])}<div><p class="b-name">${x.name}</p><p class="b-desc">${x.desc}</p></div></li>`).join("")}</ul>
    <h3 class="sec">Meine Meldungen</h3>
    ${reports ? `<ul class="badge-list">${reports}</ul>` : `<p class="fine">Noch keine. Fehlt eine Wasserstelle? <button type="button" class="linkbtn" data-go="add">Jetzt eintragen</button></p>`}
    <h3 class="sec">Gemerkte Wasserstellen</h3>
    <p class="fine">${state.favs.size ? `${state.favs.size} gemerkt. <button type="button" class="linkbtn" id="showfavs">In der Liste zeigen</button>` : "Noch keine. Öffne eine Wasserstelle und tippe auf „Merken“."}</p>
    <div class="row2 prof-actions" id="profactions"><button class="act" type="button" id="profedit">Profil bearbeiten</button><button class="act danger" type="button" id="profdel">Profil löschen</button></div>
    <p class="fine">Dein Profil wird nur auf diesem Gerät gespeichert. Es gibt kein Konto und kein Passwort.</p>`;
  $("#profedit").onclick = () => { b.innerHTML = profileForm(true); bindProfileForm(true); };
  $("#profdel").onclick = () => {
    $("#profactions").outerHTML = `<div class="confirm" id="profactions"><p>Profil wirklich löschen? Punkte, Abzeichen und die Liste deiner Meldungen auf diesem Gerät gehen verloren. Deine Meldungen bei OpenStreetMap bleiben bestehen.</p>
      <div class="row2"><button class="act" type="button" id="delno">Abbrechen</button><button class="act danger" type="button" id="delyes">Ja, löschen</button></div></div>`;
    $("#delno").onclick = renderProfile;
    $("#delyes").onclick = () => { profile = blankProfile(); saveProfile(); drawReports(); renderProfile(); toast("Profil gelöscht"); };
  };
  const sf = $("#showfavs");
  if (sf) sf.onclick = () => { go("map"); $("#tab-fav").click(); if (isMobile()) { setSheet("half"); scrollToList(); } };
}

/* ---------------- Spiele: Inhalte ---------------- */
const RIDDLES = [
  { id: "hahn", q: "Ich habe einen Hahn, aber ich krähe nie. Dreh an mir, und ich schenke dir Wasser. Was bin ich?", a: ["wasserhahn", "hahn"], hint: "Du findest mich in jeder Küche und in jedem Bad.", fact: "Leitungswasser ist in Luxemburg Trinkwasser. Damit kannst du deine Flasche überall gratis auffüllen." },
  { id: "fluss", q: "Ich habe ein Bett, aber ich schlafe nie. Ich habe eine Mündung, aber ich spreche nie. Was bin ich?", a: ["fluss", "bach", "strom"], hint: "Die Alzette ist einer von meiner Sorte.", fact: "Die Alzette fließt mitten durch die Stadt Luxemburg, durch den Grund und das Pfaffenthal." },
  { id: "handtuch", q: "Je mehr ich trockne, desto nasser werde ich. Was bin ich?", a: ["handtuch", "badetuch", "tuch", "duschtuch"], hint: "Du brauchst mich nach dem Duschen.", fact: "Ein Handtuch nimmt Wasser auf, weil es aus vielen kleinen Fasern mit großer Oberfläche besteht." },
  { id: "flasche", q: "Ich habe einen Hals, aber keinen Kopf, und trage dein Wasser überallhin mit. Was bin ich?", a: ["flasche", "trinkflasche", "wasserflasche"], hint: "Fülle mich an einem Trinkbrunnen wieder auf.", fact: "Wer eine wiederverwendbare Flasche auffüllt, spart jedes Mal eine Plastikflasche." },
  { id: "wolke", q: "Ich fliege ohne Flügel und weine ohne Augen. Was bin ich?", a: ["wolke", "regenwolke", "wolken"], hint: "Schau nach oben, wenn es gleich regnet.", fact: "Wolken bestehen aus winzigen Wassertröpfchen oder Eiskristallen." },
  { id: "eis", q: "Wenn es kalt wird, werde ich hart. Wird es warm, laufe ich davon. Was bin ich?", a: ["eis", "eiswurfel", "eiszapfen"], hint: "Ich bin gefrorenes Wasser.", fact: "Wasser dehnt sich beim Gefrieren aus. Darum schwimmt Eis oben." },
  { id: "tau", q: "Ich hänge morgens an den Grashalmen und verschwinde, sobald die Sonne kommt. Was bin ich?", a: ["tau", "tautropfen", "morgentau"], hint: "Ich habe nur drei Buchstaben.", fact: "Tau entsteht, wenn feuchte Luft in der Nacht an kühlen Flächen abkühlt." },
  { id: "regenbogen", q: "Ich habe sieben Farben, aber keinen Pinsel. Ich erscheine, wenn Sonne und Regen sich treffen. Was bin ich?", a: ["regenbogen"], hint: "Ich bin ein bunter Bogen am Himmel.", fact: "Regentropfen zerlegen das Sonnenlicht in seine Farben." },
  { id: "quelle", q: "Ich komme aus der Erde, bin klar und frisch, und am Anfang jedes Baches findest du mich. Was bin ich?", a: ["quelle", "wasserquelle"], hint: "In Aqua Map gibt es eine eigene Farbe für mich.", fact: "Quellwasser ist Grundwasser, das von selbst an die Oberfläche tritt." },
  { id: "schnee", q: "Ich falle vom Himmel, bin weiß und kalt, und keine zwei von uns sehen gleich aus. Was bin ich?", a: ["schneeflocke", "schnee", "flocke", "schneeflocken"], hint: "Ich komme meistens im Winter.", fact: "Schneeflocken sind Eiskristalle und haben meistens sechs Arme." }
];
const QUIZ = [
  { id: "formel", q: "Welche chemische Formel hat Wasser?", o: ["H₂O", "CO₂", "O₂", "NaCl"], e: "Ein Wassermolekül besteht aus zwei Wasserstoffatomen und einem Sauerstoffatom." },
  { id: "alzette", q: "Welcher Fluss fließt durch die Stadt Luxemburg?", o: ["Alzette", "Mosel", "Rhein", "Maas"], e: "Die Alzette fließt durch die Unterstadt. Dort mündet auch die Petruss in sie." },
  { id: "mosel", q: "Welcher Fluss bildet im Südosten die Grenze zwischen Luxemburg und Deutschland?", o: ["Mosel", "Alzette", "Wiltz", "Attert"], e: "An der Mosel liegen zum Beispiel Schengen, Remich und Grevenmacher." },
  { id: "stausee", q: "Aus welchem See bezieht Luxemburg einen großen Teil seines Trinkwassers?", o: ["Obersauer-Stausee", "Bodensee", "Echternacher See", "Genfer See"], e: "Das Wasser aus dem Obersauer-Stausee wird bei Esch-sur-Sûre zu Trinkwasser aufbereitet." },
  { id: "gefrier", q: "Bei welcher Temperatur gefriert Wasser bei normalem Luftdruck?", o: ["0 °C", "4 °C", "−10 °C", "32 °C"], e: "32 Grad ist der Gefrierpunkt in Fahrenheit, nicht in Celsius." },
  { id: "dichte", q: "Bei welcher Temperatur ist Wasser am dichtesten?", o: ["bei etwa 4 °C", "bei 0 °C", "bei 20 °C", "bei 100 °C"], e: "Darum ist das Wasser am Grund tiefer Seen im Winter oft etwa 4 Grad warm." },
  { id: "trinken", q: "Wie viel sollten Erwachsene laut gängigen Empfehlungen pro Tag ungefähr trinken?", o: ["etwa 1,5 Liter", "etwa 0,3 Liter", "etwa 5 Liter", "etwa 10 Liter"], e: "Bei Hitze und beim Sport darf es mehr sein." },
  { id: "erde", q: "Wie viel der Erdoberfläche ist ungefähr von Wasser bedeckt?", o: ["etwa 71 %", "etwa 30 %", "etwa 50 %", "etwa 90 %"], e: "Nur ein sehr kleiner Teil davon ist Süßwasser." },
  { id: "refill", q: "Was bedeutet ein runder Refill-Aufkleber an einer Ladentür?", o: ["Hier wird deine Flasche gratis mit Leitungswasser gefüllt", "Hier gibt es Pfand zurück", "Hier werden Flaschen verkauft", "Hier ist Wasser im Angebot"], e: "In Aqua Map findest du solche Orte unter „Refill-Stationen“." },
  { id: "sieden", q: "Bei welcher Temperatur kocht Wasser auf Meereshöhe?", o: ["100 °C", "80 °C", "120 °C", "212 °C"], e: "Auf hohen Bergen kocht Wasser schon früher, weil der Luftdruck dort niedriger ist." }
];
const ANAGRAMS = [
  { w: "WASSER", hint: "Ohne mich gibt es kein Leben." },
  { w: "QUELLE", hint: "Hier beginnt ein Bach." },
  { w: "BRUNNEN", hint: "Hier füllst du deine Flasche auf." },
  { w: "TROPFEN", hint: "Der kleinste Teil vom Regen." },
  { w: "MOSEL", hint: "Fluss an der Grenze zu Deutschland." },
  { w: "ALZETTE", hint: "Fluss durch die Hauptstadt." },
  { w: "REGEN", hint: "Er fällt aus den Wolken." },
  { w: "WELLE", hint: "Sie rollt über den See." },
  { w: "FLASCHE", hint: "Nimm sie immer wieder mit." },
  { w: "SAUER", hint: "Fluss, an dem Echternach liegt." }
];

/* ---------------- Spiele: Logik ---------------- */
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function lev(a, b) {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const cleanAnswer = (s) => norm(s).replace(/ß/g, "ss").replace(/[^a-z ]/g, " ").replace(/\b(der|die|das|ein|eine|einen|ich bin|du bist|es ist)\b/g, " ").replace(/\s+/g, "").trim();
function isRight(input, answers) {
  const x = cleanAnswer(input); if (!x) return false;
  return answers.some((a) => { const y = cleanAnswer(a); return x === y || (y.length >= 5 && lev(x, y) <= 1); });
}
const SPLASH = `<span class="splash" aria-hidden="true"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26" fill="#E3F4FB"/><path d="m18 29 7 7 13-15" stroke="#00A3E0" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><i></i><i></i></span>`;

let game = null;
function updatePointsPill() { const p = $("#gpoints"); if (p) p.textContent = profile.points; }
function renderGames() {
  if (game) return renderGame();
  const nR = Object.keys(profile.riddles).length, nQ = Object.keys(profile.quiz).length, nA = Object.keys(profile.anagrams).length;
  $("#games-body").innerHTML = `
    <p class="points-line"><span class="pts"><strong id="gpoints">${profile.points}</strong> Punkte</span>${profile.name ? `<span class="fine">Level ${levelOf(profile.points).i + 1}: ${levelOf(profile.points).name}</span>` : `<button type="button" class="linkbtn" data-go="profile">Profil erstellen, um Abzeichen zu sammeln</button>`}</p>
    <ul class="modes">
      <li><button type="button" class="mode" data-mode="riddle">${dropSVG("brunnen", 30)}<span class="m-main"><span class="m-title">Wasser-Rätsel</span><span class="m-desc">Errate, was gemeint ist. Tipps helfen dir weiter.</span></span><span class="m-prog">${nR} von ${RIDDLES.length}</span></button></li>
      <li><button type="button" class="mode" data-mode="quiz">${dropSVG("hahn", 30)}<span class="m-main"><span class="m-title">Wasser-Quiz</span><span class="m-desc">10 Fragen zu Wasser und zu Luxemburgs Flüssen.</span></span><span class="m-prog">${nQ} von ${QUIZ.length}</span></button></li>
      <li><button type="button" class="mode" data-mode="anagram">${dropSVG("refill", 30)}<span class="m-main"><span class="m-title">Buchstabensalat</span><span class="m-desc">Bring die Buchstaben in die richtige Reihenfolge.</span></span><span class="m-prog">${nA} von ${ANAGRAMS.length}</span></button></li>
    </ul>
    <p class="fine">Punkte gibt es für jedes Rätsel beim ersten Lösen. Ein Tipp kostet ein paar Punkte.</p>`;
  document.querySelectorAll(".mode").forEach((b) => b.onclick = () => {
    const m = b.dataset.mode;
    if (m === "riddle") startRiddle(); else if (m === "quiz") startQuiz(); else startAnagram();
  });
}
function renderGame() {
  if (game.mode === "riddle") renderRiddle(); else if (game.mode === "quiz") renderQuiz(); else renderAnagram();
  $("#page-games").scrollTop = 0;
}
$("#games-body").addEventListener("click", (e) => { if (e.target.closest("#gback")) { game = null; renderGames(); } });
const backBtn = `<button type="button" class="back" id="gback"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Alle Spiele</button>`;
const firstOpen = (list, done, key) => { const i = list.findIndex((x) => !done[key(x)]); return i < 0 ? 0 : i; };

/* Rätsel */
function startRiddle(i) { game = { mode: "riddle", i: i ?? firstOpen(RIDDLES, profile.riddles, (r) => r.id), hints: 0, solved: false }; renderGame(); }
function renderRiddle() {
  const r = RIDDLES[game.i], was = !!profile.riddles[r.id];
  const hint = game.hints >= 1 ? `<p class="hint">Tipp: ${esc(r.hint)}</p>` : "";
  const hint2 = game.hints >= 2 ? `<p class="hint">Das Wort hat ${r.a[0].length} Buchstaben und beginnt mit „${r.a[0][0].toUpperCase()}“.</p>` : "";
  const worth = Math.max(10, 30 - game.hints * 10);
  $("#games-body").innerHTML = `${backBtn}
    <p class="g-prog">Rätsel ${game.i + 1} von ${RIDDLES.length}${was ? ", schon gelöst" : `, ${worth} Punkte`}</p>
    <p class="riddle">${esc(r.q)}</p>
    ${game.solved ? "" : `<form id="rform" class="answer"><label class="sr-only" for="ranswer">Deine Antwort</label><input id="ranswer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Deine Antwort"><button class="act primary" type="submit">Prüfen</button></form>`}
    ${hint}${hint2}
    <div id="rfeedback" aria-live="polite"></div>
    <div class="g-nav">${!game.solved && game.hints < 2 ? `<button type="button" class="linkbtn" id="rhint">${game.hints ? "Noch ein Tipp" : "Tipp anzeigen"}</button>` : "<span></span>"}<button type="button" class="linkbtn" id="rnext">${game.solved ? "Nächstes Rätsel" : "Überspringen"}</button></div>`;
  if (game.solved) showRiddleSuccess(r, game.lastPoints);
  const f = $("#rform");
  if (f) f.onsubmit = (e) => {
    e.preventDefault();
    const v = $("#ranswer").value;
    if (!v.trim()) return;
    if (isRight(v, r.a)) {
      game.solved = true;
      game.lastPoints = 0;
      if (!profile.riddles[r.id]) { profile.riddles[r.id] = new Date().toISOString(); game.lastPoints = worth; award(worth, "das Rätsel"); }
      renderRiddle();
    } else {
      const inp = $("#ranswer"); inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
      $("#rfeedback").innerHTML = `<p class="bad">Leider nicht. Versuch es noch einmal${game.hints < 2 ? " oder hol dir einen Tipp" : ""}.</p>`;
      inp.select();
    }
  };
  const h = $("#rhint"); if (h) h.onclick = () => { game.hints++; renderRiddle(); };
  $("#rnext").onclick = () => { const n = (game.i + 1) % RIDDLES.length; startRiddle(n); };
  if (f && !isMobile()) $("#ranswer").focus();
}
function showRiddleSuccess(r, pts) {
  $("#rfeedback").innerHTML = `<div class="good">${SPLASH}<div><p class="good-t">Richtig! Gesucht war: ${esc(r.a[0][0].toUpperCase() + r.a[0].slice(1).replace("wurfel", "würfel"))}</p>
    ${pts ? `<p>+${pts} Punkte</p>` : ""}<p class="fact">${esc(r.fact)}</p></div></div>`;
}

/* Quiz */
function startQuiz() { game = { mode: "quiz", order: shuffle([...QUIZ.keys()]), pos: 0, right: 0, picked: null, opts: null }; renderGame(); }
function renderQuiz() {
  const b = $("#games-body");
  if (game.pos >= game.order.length) {
    const first = game.right > profile.quizBest;
    profile.quizBest = Math.max(profile.quizBest, game.right); const fresh = checkBadges(); saveProfile();
    if (fresh.length) toast(`Abzeichen erhalten: ${fresh.map((x) => x.name).join(", ")}`);
    b.innerHTML = `${backBtn}<div class="good big">${SPLASH}<div><p class="good-t">${game.right} von ${QUIZ.length} richtig</p>
      <p>${game.right === QUIZ.length ? "Perfekt! Du bist ein echter Wasserprofi." : game.right >= 7 ? "Sehr gut!" : "Beim nächsten Mal klappt es noch besser."}${first ? " Neuer Bestwert." : ""}</p></div></div>
      <div class="row2"><button type="button" class="act" id="qagain">Nochmal spielen</button><button type="button" class="act primary" id="qhome">Alle Spiele</button></div>`;
    $("#qagain").onclick = startQuiz; $("#qhome").onclick = () => { game = null; renderGames(); };
    return;
  }
  const q = QUIZ[game.order[game.pos]];
  if (!game.opts) game.opts = shuffle([...q.o]);
  const ans = q.o[0], done = game.picked != null;
  b.innerHTML = `${backBtn}
    <p class="g-prog">Frage ${game.pos + 1} von ${QUIZ.length}, ${game.right} richtig</p>
    <p class="riddle">${esc(q.q)}</p>
    <div class="options">${game.opts.map((o, i) => `<button type="button" class="opt${done ? (o === ans ? " right" : o === game.picked ? " wrong" : "") : ""}" data-o="${i}" ${done ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
    <div id="qfeedback" aria-live="polite">${done ? `<p class="${game.picked === ans ? "goodline" : "bad"}">${game.picked === ans ? "Richtig!" : `Leider falsch. Richtig ist: ${esc(ans)}.`} ${esc(q.e)}</p>` : ""}</div>
    ${done ? `<button type="button" class="act primary wide" id="qnext">${game.pos + 1 < QUIZ.length ? "Nächste Frage" : "Ergebnis ansehen"}</button>` : ""}`;
  b.querySelectorAll(".opt").forEach((o) => o.onclick = () => {
    game.picked = game.opts[+o.dataset.o];
    if (game.picked === ans) {
      game.right++;
      if (!profile.quiz[q.id]) { profile.quiz[q.id] = new Date().toISOString(); award(10, "die richtige Antwort"); }
    }
    renderGame();
  });
  const n = $("#qnext"); if (n) n.onclick = () => { game.pos++; game.picked = null; game.opts = null; renderGame(); };
}

/* Buchstabensalat */
function startAnagram(i) {
  const idx = i ?? firstOpen(ANAGRAMS, profile.anagrams, (a) => a.w);
  const w = ANAGRAMS[idx].w;
  let letters; do { letters = shuffle(w.split("")); } while (letters.join("") === w && w.length > 1);
  game = { mode: "anagram", i: idx, tiles: letters.map((ch, k) => ({ ch, k, used: false })), built: [], hints: 0, solved: false };
  renderGame();
}
function renderAnagram() {
  const a = ANAGRAMS[game.i], w = a.w, was = !!profile.anagrams[w];
  const worth = Math.max(5, 15 - game.hints * 5);
  const slots = w.split("").map((_, k) => { const t = game.built[k]; return `<button type="button" class="slot${t ? " full" : ""}${k < game.hints ? " fixed" : ""}" data-s="${k}" ${!t || k < game.hints || game.solved ? "disabled" : ""} aria-label="${t ? "Buchstabe " + t.ch + " zurücklegen" : "leeres Feld"}">${t ? t.ch : ""}</button>`; }).join("");
  $("#games-body").innerHTML = `${backBtn}
    <p class="g-prog">Wort ${game.i + 1} von ${ANAGRAMS.length}${was ? ", schon gelöst" : `, ${worth} Punkte`}</p>
    <p class="riddle small">${esc(a.hint)}</p>
    <div class="slots" style="--n:${w.length}">${slots}</div>
    ${game.solved ? "" : `<div class="tiles">${game.tiles.map((t, k) => `<button type="button" class="tile" data-t="${k}" ${t.used ? "disabled" : ""}>${t.ch}</button>`).join("")}</div>`}
    <div id="afeedback" aria-live="polite"></div>
    <div class="g-nav">${game.solved ? "<span></span>" : `<span class="gn-left"><button type="button" class="linkbtn" id="amix">Mischen</button>${game.hints < w.length - 1 ? `<button type="button" class="linkbtn" id="ahint">Tipp</button>` : ""}</span>`}<button type="button" class="linkbtn" id="anext">${game.solved ? "Nächstes Wort" : "Überspringen"}</button></div>`;
  if (game.solved) $("#afeedback").innerHTML = `<div class="good">${SPLASH}<div><p class="good-t">Richtig: ${w[0] + w.slice(1).toLowerCase()}</p>${game.lastPoints ? `<p>+${game.lastPoints} Punkte</p>` : ""}</div></div>`;
  document.querySelectorAll(".tile").forEach((b) => b.onclick = () => {
    const t = game.tiles[+b.dataset.t]; if (t.used) return;
    t.used = true; game.built.push(t);
    if (game.built.length === w.length) {
      if (game.built.map((x) => x.ch).join("") === w) {
        game.solved = true; game.lastPoints = 0;
        if (!profile.anagrams[w]) { profile.anagrams[w] = new Date().toISOString(); game.lastPoints = worth; award(worth, "das Wort"); }
      } else { renderAnagram(); $("#afeedback").innerHTML = `<p class="bad">Nicht ganz. Tippe oben auf Buchstaben, um sie zurückzulegen.</p>`; return; }
    }
    renderAnagram();
  });
  document.querySelectorAll(".slot.full:not(.fixed)").forEach((b) => b.onclick = () => {
    const k = +b.dataset.s; const removed = game.built.splice(k);
    removed.forEach((t) => (t.used = false));
    renderAnagram();
  });
  const mix = $("#amix"); if (mix) mix.onclick = () => { const free = game.tiles.filter((t) => !t.used); shuffle(free); game.tiles = game.tiles.filter((t) => t.used).concat(free); renderAnagram(); };
  const h = $("#ahint"); if (h) h.onclick = () => {
    game.hints++;
    game.tiles.forEach((t) => (t.used = false)); game.built = [];
    for (let k = 0; k < game.hints; k++) { const t = game.tiles.find((x) => !x.used && x.ch === w[k]); t.used = true; game.built.push(t); }
    renderAnagram();
  };
  $("#anext").onclick = () => startAnagram((game.i + 1) % ANAGRAMS.length);
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
    box.classList.add("nocam"); msg.textContent = "Hier ist kein Kamerazugriff möglich. Wähle stattdessen ein Foto mit QR-Code."; return;
  }
  box.classList.remove("nocam"); msg.textContent = "Kamera wird gestartet …";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (!scanner.active) { stream.getTracks().forEach((t) => t.stop()); return; }
    scanner.stream = stream;
    const v = $("#scanvideo"); v.srcObject = stream; await v.play().catch(() => {});
    msg.textContent = "Halte den QR-Code in den Rahmen.";
    await getDetector();
    tick();
  } catch (e) {
    box.classList.add("nocam");
    msg.textContent = e.name === "NotAllowedError" ? "Kamerazugriff verweigert. Erlaube die Kamera in den Browser-Einstellungen oder wähle ein Foto mit QR-Code."
      : e.name === "NotFoundError" ? "Keine Kamera gefunden. Wähle stattdessen ein Foto mit QR-Code."
      : "Die Kamera konnte nicht gestartet werden. Wähle stattdessen ein Foto mit QR-Code.";
    $("#scanrestart").hidden = false;
  }
}
function stopScanner() {
  scanner.active = false; clearTimeout(scanner.timer);
  if (scanner.stream) { scanner.stream.getTracks().forEach((t) => t.stop()); scanner.stream = null; }
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
    else { $("#scanner").classList.add("nocam"); msg.textContent = "Auf dem Foto wurde kein QR-Code gefunden. Versuche ein schärferes Foto, auf dem der Code groß zu sehen ist."; $("#scanrestart").hidden = false; }
  } catch (err) { msg.textContent = "Das Foto konnte nicht gelesen werden."; $("#scanrestart").hidden = false; }
});
$("#scanrestart").addEventListener("click", startScanner);

function onScanned(text) {
  if (navigator.vibrate) navigator.vibrate(60);
  profile.scans++;
  $("#scanner").hidden = true;
  const r = $("#scanresult"); r.hidden = false;
  const m = /(?:#|aquamap:)([nwr]\d{1,12})\b/.exec(text);
  const again = `<button type="button" class="act" id="scanagain">Weiter scannen</button>`;
  if (m && state.byId.has(m[1])) {
    const it = state.byId.get(m[1]);
    const today = new Date().toISOString().slice(0, 10);
    const first = !profile.visits[it.id], already = profile.visits[it.id] === today;
    let line = "Du warst heute schon hier. Morgen gibt es wieder Punkte.";
    if (!already) { profile.visits[it.id] = today; const pts = first ? 20 : 5; line = `Besuch gespeichert: +${pts} Punkte.`; award(pts, "deinen Besuch"); }
    else saveProfile();
    r.innerHTML = `<div class="good">${SPLASH}<div><p class="good-t">${esc(it.title)}</p><p>${esc([it.locality, it.name ? it.sub : ""].filter(Boolean).join(", ") || CATS[it.cat].one)}</p><p class="fact">${line}</p></div></div>
      <div class="row2">${again}<button type="button" class="act primary" id="scanshow">Auf der Karte zeigen</button></div>`;
    $("#scanshow").onclick = () => { go("map"); select(it.id, { from: "search" }); };
  } else if (m) {
    saveProfile();
    r.innerHTML = `<p class="hint">Dieser Code gehört zu einer Aqua-Map-Wasserstelle, die gerade nicht geladen ist. Öffne die Karte mit Internetverbindung und scanne noch einmal.</p><div class="row2">${again}</div>`;
  } else if (/^https?:\/\//i.test(text)) {
    saveProfile();
    r.innerHTML = `<p class="res-label">Link gefunden</p><p class="res-text">${esc(text)}</p><p class="fine">Öffne nur Links, denen du vertraust.</p>
      <div class="row2"><a class="act primary" href="${esc(text)}" target="_blank" rel="noopener noreferrer">Link öffnen</a><button type="button" class="act" id="scancopy">Kopieren</button></div><div class="row2">${again}</div>`;
  } else {
    saveProfile();
    r.innerHTML = `<p class="res-label">Text gefunden</p><p class="res-text">${esc(text)}</p><div class="row2"><button type="button" class="act" id="scancopy">Kopieren</button>${again}</div>`;
  }
  const c = $("#scancopy"); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(text); toast("Kopiert"); } catch (e) { toast("Kopieren nicht möglich"); } };
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
  openDialog(`<h2>QR-Code für diese Wasserstelle</h2><p>${esc(it.title)}${it.locality ? ", " + esc(it.locality) : ""}</p>
    <div class="qrbox">${svg}</div>
    <p class="fine">Drucke den Code als Aufkleber aus und bring ihn an der Wasserstelle an. Wer ihn mit Aqua Map scannt, sieht alle Infos und sammelt Punkte.</p>
    <div class="row2"><button type="button" class="act" data-close>Schließen</button><a class="act primary" id="qrdl" download="aqua-map-${it.id}.png">Als Bild speichern</a></div>`);
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
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat") || "0");
    const cardTop = $("#page-add").getBoundingClientRect().top;
    return L.point(r.width / 2, Math.max(90, (top + cardTop) / 2 + 20));
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
  return `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === val ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
}
function renderAdd() {
  const b = $("#add-body"), d = addState.data;
  if (addState.marker && addState.step === "pick") { map.removeLayer(addState.marker); addState.marker = null; }
  if (addState.step === "pick") {
    b.innerHTML = `<p class="step">Schritt 1 von 2</p><h2 id="add-t">Wo ist die Wasserstelle?</h2>
      <p class="lead">Verschiebe die Karte, bis die Nadel genau auf der fehlenden Wasserstelle steht.</p>
      <div class="row2"><button type="button" class="act" id="addme">Mein Standort</button><button type="button" class="act primary" id="addnext">Weiter</button></div>
      <p class="fine">Du kennst dich mit OpenStreetMap aus? <a id="addlink" href="https://mapcomplete.org/drinking_water.html" target="_blank" rel="noopener">Direkt mit MapComplete eintragen</a></p>`;
    updateAddLink();
    $("#addme").onclick = () => {
      if (!navigator.geolocation) { toast("Standort ist hier nicht verfügbar."); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        state.user = ll; map.setView(ll, 18, { animate: false }); alignTo(ll); positionPin();
      }, () => toast("Standort konnte nicht bestimmt werden."), { enableHighAccuracy: true, timeout: 12000 });
    };
    $("#addnext").onclick = () => {
      if (map.getZoom() < 16) { const ll = map.containerPointToLatLng(pickPoint()); map.setView(ll, 17, { animate: false }); alignTo(ll); positionPin(); toast("Zoome näher heran, damit die Position genau ist."); return; }
      addState.latlng = map.containerPointToLatLng(pickPoint());
      if (!LU_BOUNDS.pad(0.05).contains(addState.latlng)) { toast("Diese Stelle liegt außerhalb von Luxemburg."); return; }
      addState.step = "form"; renderAdd();
    };
  } else if (addState.step === "form") {
    const ll = addState.latlng;
    let near = null;
    for (const it of state.items) { const dd = haversine(ll, L.latLng(it.lat, it.lon)); if (dd < 30 && (!near || dd < near.d)) near = { it, d: dd }; }
    b.innerHTML = `<form id="addform" class="form">
      <p class="step">Schritt 2 von 2</p><h2 id="add-t">Was gibt es dort?</h2>
      ${near ? `<p class="hint warn">In ${Math.max(1, Math.round(near.d))} m Entfernung ist schon „${esc(near.it.title)}“ eingetragen. Prüfe, ob es dieselbe Stelle ist.</p>` : ""}
      <fieldset class="field"><legend>Art der Wasserstelle</legend>${seg("akind", d.kind, Object.entries(ADD_KINDS).map(([k, v]) => [k, v.label]))}</fieldset>
      <label class="field"><span>Name oder kurze Beschreibung <span class="opt-l">freiwillig</span></span><input id="adesc" maxlength="120" value="${esc(d.desc)}" placeholder="z. B. Brunnen am Spielplatz"></label>
      <fieldset class="field"><legend>Kann man eine Flasche füllen?</legend>${seg("abottle", d.bottle, [["ja", "Ja"], ["nein", "Nein"], ["?", "Weiß nicht"]])}</fieldset>
      <fieldset class="field"><legend>Rollstuhlgerecht?</legend>${seg("awheel", d.wheel, [["ja", "Ja"], ["nein", "Nein"], ["?", "Weiß nicht"]])}</fieldset>
      <fieldset class="field"><legend>Auch im Winter in Betrieb?</legend>${seg("awinter", d.winter, [["ja", "Ja"], ["nein", "Nein"], ["?", "Weiß nicht"]])}</fieldset>
      <label class="field"><span>Bemerkung <span class="opt-l">freiwillig</span></span><textarea id="anote" rows="2" maxlength="400">${esc(d.note)}</textarea></label>
      <p class="fine">Deine Meldung wird ohne deinen Namen als öffentlicher Hinweis bei OpenStreetMap gespeichert. Freiwillige prüfen ihn und tragen die Wasserstelle ein. Danach erscheint sie in Aqua Map für alle.</p>
      <div id="adderr"></div>
      <div class="row2"><button type="button" class="act" id="addback">Position ändern</button><button type="submit" class="act primary" id="addsend">Meldung senden</button></div>
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
    b.innerHTML = `<div class="good big">${SPLASH}<div><h2 id="add-t" class="good-t">Danke für deine Meldung!</h2>
      <p>Sie ist als Hinweis #${addState.noteId} bei OpenStreetMap angekommen. Sobald jemand die Wasserstelle einträgt, erscheint sie in Aqua Map für alle.</p>
      <p><a href="https://www.openstreetmap.org/note/${addState.noteId}" target="_blank" rel="noopener">Hinweis ansehen</a></p></div></div>
      <div class="row2"><button type="button" class="act" id="addagain">Noch eine melden</button><button type="button" class="act primary" data-go="map">Zur Karte</button></div>`;
    $("#addagain").onclick = () => { if (addState.marker) { map.removeLayer(addState.marker); addState.marker = null; } enterAdd(); };
  }
  positionPin();
}
function reportText(d) {
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
  const btn = $("#addsend"); btn.disabled = true; btn.textContent = "Wird gesendet …";
  const ll = addState.latlng, d = addState.data, text = reportText(d);
  try {
    if (!navigator.onLine) throw new Error("offline");
    const res = await fetch(NOTES_API, { method: "POST", body: new URLSearchParams({ lat: ll.lat.toFixed(6), lon: ll.lng.toFixed(6), text }) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const id = j && j.properties && j.properties.id;
    if (!id) throw new Error("keine ID");
    addState.noteId = id;
    profile.reports.unshift({ note: id, lat: ll.lat, lon: ll.lng, kind: d.kind, desc: d.desc, date: new Date().toISOString() });
    award(20, "deine Meldung");
    drawReports();
    addState.step = "done"; renderAdd();
  } catch (e) {
    btn.disabled = false; btn.textContent = "Erneut senden";
    $("#adderr").innerHTML = `<p class="hint warn">Die Meldung konnte nicht gesendet werden${e.message === "offline" ? ", weil du offline bist" : ""}. Versuche es gleich noch einmal. Alternativ kannst du den Text kopieren und auf <a href="https://www.openstreetmap.org/note/new#map=19/${ll.lat.toFixed(5)}/${ll.lng.toFixed(5)}" target="_blank" rel="noopener">openstreetmap.org</a> selbst als Hinweis eintragen. <button type="button" class="linkbtn" id="addcopy">Text kopieren</button></p>`;
    $("#addcopy").onclick = async () => { try { await navigator.clipboard.writeText(text); toast("Text kopiert"); } catch (er) { toast("Kopieren nicht möglich"); } };
  } finally { addState.sending = false; }
}
const reportsLayer = L.layerGroup().addTo(map);
function drawReports() {
  reportsLayer.clearLayers();
  for (const r of profile.reports) {
    const m = L.marker([r.lat, r.lon], { icon: L.divIcon({ className: "wk-pin reported", html: dropSVG(r.kind in CATS ? r.kind : "brunnen", 24), iconSize: [24, 32], iconAnchor: [12, 31] }), title: "Von dir gemeldet, wird geprüft", keyboard: false });
    m.on("click", () => toast(`Von dir gemeldet am ${new Date(r.date).toLocaleDateString("de-DE")}. Freiwillige prüfen die Meldung.`));
    m.addTo(reportsLayer);
  }
}
if (typeof ResizeObserver === "function") new ResizeObserver(() => { document.documentElement.style.setProperty("--add-h", $("#page-add").getBoundingClientRect().height + "px"); positionPin(); }).observe($("#page-add"));
map.on("resize", positionPin);

/* ---------------- Navigation ---------------- */
let view = "map";
const VIEWS = ["map", "games", "scan", "add", "profile"];
function go(v) {
  if (!VIEWS.includes(v)) return;
  if (v === view) { if (v === "games" && game) { game = null; renderGames(); } return; }
  if (view === "scan") stopScanner();
  if (view === "add") leaveAdd();
  view = v; document.body.dataset.view = v;
  document.querySelectorAll("#nav button").forEach((b) => { if (b.dataset.go === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  hideResults();
  if (v === "games") renderGames();
  if (v === "profile") renderProfile();
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
renderNavAvatar();
drawReports();
coreInit();
if (/^#(spiel|raetsel)$/.test(location.hash)) go("games");
