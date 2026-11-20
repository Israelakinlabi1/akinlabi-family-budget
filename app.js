/* Akinlabi Family Budget — app logic. Runs entirely on the phone; syncs to your own Google Sheet. */
(() => {
"use strict";
const PEOPLE = ["Israel", "Kehinde"];
const { parse, EXPENSE: EXP, INCOME: INC, SAVINGS: SAV } = window.BudgetParse;
const GOAL = "Savings goal";
/* "saved" entries also recognised by category, so they display right even before the sheet script is updated */
const typeOf = e => e.type === "income" ? "income" : (e.type === "saved" || SAV.includes(e.category)) ? "saved" : "expense";
const catsFor = t => t === "income" ? INC : t === "saved" ? SAV : EXP;

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => ymd(new Date());
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt = n => usd.format(n || 0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = parseFloat(String(v ?? "").replace(/[$,\s]/g, "")); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
const load = (k, d) => { try { const v = localStorage.getItem("afb." + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const store = (k, v) => { try { localStorage.setItem("afb." + k, JSON.stringify(v)); } catch (_) {} };
const stat = (el, t, err) => { el.textContent = t || ""; el.classList.toggle("err", !!err); };

let cfg = load("cfg", { me: "", url: "", code: "", lang: "en-US" });
let entries = load("entries", {});
let outbox = load("outbox", []);
let limits = load("limits", {});
let limitsDirty = load("limitsDirty", false);
let lastSync = load("lastSync", 0);
let month = today().slice(0, 7), filterWho = "", draft = [], editing = null, editLim = false, syncing = false, syncState = "";

const persist = () => { store("entries", entries); store("outbox", outbox); store("limits", limits); store("limitsDirty", limitsDirty); };
const live = () => Object.values(entries).filter(e => !e.deleted);
const mlabel = m => { const [y, mm] = m.split("-").map(Number); return new Date(y, mm - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" }); };

/* ---------- screens ---------- */
function show(id) { ["setup", "settings", "app"].forEach(s => $("#" + s).hidden = s !== id); window.scrollTo(0, 0); }
function peopleButtons(el, onPick) {
  el.innerHTML = PEOPLE.map(p => `<button class="person" aria-pressed="${cfg.me === p}" data-p="${esc(p)}">${esc(p)}</button>`).join("");
  el.onclick = e => { const p = e.target.closest("[data-p]"); if (!p) return; cfg.me = p.dataset.p; store("cfg", cfg); el.querySelectorAll(".person").forEach(b => b.setAttribute("aria-pressed", b.dataset.p === cfg.me)); onPick && onPick(); };
}
function startSetup() {
  show("setup");
  peopleButtons($("#people"), () => { if (cfg.url) { enterApp(); } else { $("#connectStep").hidden = false; $("#connectStep").scrollIntoView({ behavior: "smooth" }); } });
}
$("#setGo").onclick = async () => {
  const url = $("#setUrl").value.trim(), code = $("#setCode").value.trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { stat($("#setStat"), "Paste the Web app URL that starts with https://script.google.com/", true); return; }
  if (!code) { stat($("#setStat"), "Type the family code from your script.", true); return; }
  cfg.url = url; cfg.code = code; store("cfg", cfg);
  stat($("#setStat"), "Connecting…");
  const r = await sync();
  if (r === true) enterApp(); else stat($("#setStat"), r, true);
};
$("#setSkip").onclick = () => enterApp();
function openSettings() {
  show("settings");
  peopleButtons($("#people2"));
  $("#cfgUrl").value = cfg.url || ""; $("#cfgCode").value = cfg.code || ""; $("#cfgLang").value = cfg.lang || "en-US";
  stat($("#cfgStat"), lastSync ? "Last synced " + new Date(lastSync).toLocaleString() : "Not synced yet.");
}
$("#cfgSave").onclick = async () => {
  cfg.url = $("#cfgUrl").value.trim(); cfg.code = $("#cfgCode").value.trim(); cfg.lang = $("#cfgLang").value; store("cfg", cfg);
  if (!cfg.url) { stat($("#cfgStat"), "Saved. Entries stay on this phone until you add the sheet link."); return; }
  stat($("#cfgStat"), "Syncing…");
  const r = await sync();
  stat($("#cfgStat"), r === true ? "Connected and synced." : r, r !== true);
};
$("#closeSet").onclick = () => enterApp();
$("#meBtn").onclick = openSettings;
function enterApp() { show("app"); $("#meBtn").textContent = cfg.me || "Who?"; render(); sync(); }

/* ---------- sync with Google Sheet ---------- */
function setSync(state, text) {
  syncState = state; $("#dot").className = "dot " + state; $("#syncTxt").textContent = text;
}
function syncLabel() {
  const n = outbox.length;
  if (!cfg.url) return setSync("wait", n ? n + " on phone" : "Not connected");
  if (n) return setSync("wait", n + " to sync");
  setSync(lastSync ? "ok" : "", lastSync ? "Synced" : "Sync");
}
async function sync() {
  if (!cfg.url || !cfg.code) { syncLabel(); return "Add your sheet link and family code in Settings."; }
  if (syncing) return "Already syncing.";
  syncing = true; setSync("wait", "Syncing…");
  const changes = outbox.map(id => entries[id]).filter(Boolean);
  const sentLimits = limitsDirty ? JSON.stringify(limits) : null;
  let msg = true;
  try {
    const res = await fetch(cfg.url, { method: "POST", body: JSON.stringify({ code: cfg.code, changes, limits: sentLimits ? limits : null }) });
    let j;
    try { j = await res.json(); } catch (_) { throw { msg: "The sheet link didn't answer properly. Check the link, and that the deployment's access is set to Anyone." }; }
    if (!j.ok) throw { msg: j.error === "wrong_code" ? "The family code doesn't match the one in your script." : j.error === "code_not_set" ? "Set your FAMILY_CODE in the script, then deploy a new version." : j.error === "busy" ? "The sheet is busy. Trying again shortly." : "The sheet reported a problem: " + (j.detail || j.error) };
    const sent = new Map(changes.map(c => [c.id, c.updatedAt]));
    outbox = outbox.filter(id => entries[id] && entries[id].updatedAt !== sent.get(id));
    const map = {};
    for (const e of j.entries || []) map[e.id] = { ...e, type: typeOf(e) };
    for (const id of outbox) map[id] = entries[id];
    entries = map;
    if (sentLimits && sentLimits === JSON.stringify(limits)) limitsDirty = false;
    if (!limitsDirty) limits = j.limits || {};
    lastSync = Date.now(); store("lastSync", lastSync);
    persist();
  } catch (e) {
    msg = (e && e.msg) || (navigator.onLine ? "Couldn't reach your Google Sheet. Entries are safe on this phone and will sync later." : "You're offline. Entries are safe on this phone and will sync later.");
  }
  syncing = false;
  if (msg === true) syncLabel(); else setSync("err", outbox.length ? outbox.length + " to sync" : "Offline");
  if (!$("#app").hidden) { render(); stat($("#dstat"), msg === true ? "" : msg, msg !== true); }
  return msg;
}
$("#syncBtn").onclick = () => sync();
window.addEventListener("online", () => sync());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !$("#app").hidden) sync(); });
setInterval(() => { if (document.visibilityState === "visible" && !$("#app").hidden && (outbox.length || Date.now() - lastSync > 60000)) sync(); }, 30000);

/* ---------- rendering ---------- */
function render() {
  $("#mlabel").textContent = mlabel(month);
  const mine = live().filter(e => (e.date || "").slice(0, 7) === month);
  const sum = t => mine.filter(e => typeOf(e) === t).reduce((a, e) => a + (+e.amount || 0), 0);
  const inc = sum("income"), exp = sum("expense"), sav = sum("saved");
  const left = inc - exp - sav;
  $("#inc").textContent = fmt(inc); $("#exp").textContent = fmt(exp); $("#sav").textContent = fmt(sav);
  $("#left").textContent = inc ? fmt(left) : fmt(exp);
  $("#leftlbl").textContent = inc ? (left < 0 ? "over your income this month" : "left this month, after spending and savings") : "spent this month (add income to see what's left)";
  const m = $("#meter"), pe = inc ? Math.min(100, exp / inc * 100) : 0, ps = inc ? Math.min(100 - pe, sav / inc * 100) : 0;
  m.children[0].style.width = pe + "%"; m.children[1].style.width = ps + "%"; m.classList.toggle("over", inc > 0 && exp + sav > inc);
  const lim = Object.keys(limits).filter(k => k !== GOAL).reduce((a, k) => a + (+limits[k] || 0), 0);
  $("#budgeted").innerHTML = lim ? "Budgeted <b>" + fmt(lim) + "</b>" : "";
  const byWho = {};
  mine.filter(e => typeOf(e) === "expense").forEach(e => byWho[e.who] = (byWho[e.who] || 0) + (+e.amount || 0));
  $("#whoLine").textContent = Object.keys(byWho).length ? Object.keys(byWho).map(w => (w || "Someone") + " spent " + fmt(byWho[w])).join(" · ") : "";
  renderCats(mine, exp); renderSavings(mine, sav); renderFilter(); renderActs(mine); syncLabel();
}
function renderCats(mine, total) {
  const by = {};
  mine.filter(e => typeOf(e) === "expense").forEach(e => by[e.category] = (by[e.category] || 0) + (+e.amount || 0));
  const list = EXP.filter(c => by[c] || limits[c]).sort((a, b) => (by[b] || 0) - (by[a] || 0)).concat(Object.keys(by).filter(c => !EXP.includes(c)));
  $("#cats").innerHTML = list.length ? list.map(c => {
    const s = by[c] || 0, l = +limits[c] || 0, over = l && s > l, w = l ? Math.min(100, s / l * 100) : (total ? s / total * 100 : 0);
    return `<div class="cat"><div class="top"><span>${esc(c)}</span><span>${fmt(s)}${l ? ` <span class="sub">of ${fmt(l)}</span>` : ""}</span></div><div class="bar${over ? " over" : ""}"><i style="width:${w}%"></i></div>${over ? `<div class="sub" style="color:var(--red)">${fmt(s - l)} over</div>` : ""}</div>`;
  }).join("") : `<div class="empty">Nothing spent yet in ${esc(mlabel(month))}.</div>`;
  $("#cats").hidden = editLim; $("#limits").hidden = !editLim;
}
function renderSavings(mine, sav) {
  const goal = +limits[GOAL] || 0;
  const by = {};
  mine.filter(e => typeOf(e) === "saved").forEach(e => by[e.category] = (by[e.category] || 0) + (+e.amount || 0));
  $("#savSec").hidden = !sav && !goal;
  $("#savGoal").innerHTML = goal
    ? `<div class="cat"><div class="top"><span>Saved this month</span><span>${fmt(sav)} <span class="sub">of ${fmt(goal)} goal</span></span></div><div class="bar sav"><i style="width:${Math.min(100, sav / goal * 100)}%"></i></div><div class="sub">${sav >= goal ? "Goal reached." : fmt(goal - sav) + " to go."}</div></div>`
    : `<div class="sub">Saved ${fmt(sav)} this month. Set a monthly savings goal under "Set monthly limits".</div>`;
  $("#savCats").innerHTML = SAV.filter(c => by[c]).map(c => `<div class="top" style="display:flex;justify-content:space-between;font-size:15px"><span>${esc(c)}</span><span style="white-space:nowrap">${fmt(by[c])}</span></div>`).join("");
}
function renderFilter() {
  const opts = [["", "Everyone"], ...PEOPLE.map(p => [p, p])];
  $("#filter").innerHTML = opts.map(([v, l]) => `<button class="chipbtn" data-w="${esc(v)}" aria-pressed="${filterWho === v}">${esc(l)}</button>`).join("");
}
$("#filter").onclick = e => { const b = e.target.closest("[data-w]"); if (!b) return; filterWho = b.dataset.w; render(); };
const itemsText = it => (it || []).map(i => i.name + (i.amount != null ? " " + Number(i.amount).toFixed(2) : "")).join(", ");
function renderActs(mine) {
  const s = mine.filter(e => !filterWho || e.who === filterWho).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
  const pending = new Set(outbox);
  let last = "", h = "";
  for (const e of s) {
    if (e.date !== last) { last = e.date; const d = new Date(e.date + "T12:00"); h += `<li class="day">${esc(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }))}</li>`; }
    const items = itemsText(e.items);
    const ty = typeOf(e), verb = ty === "income" ? "received" : ty === "saved" ? "saved" : "spent";
    h += `<li class="row" data-id="${esc(e.id)}"><div><b>${esc(e.who || "Someone")}</b> ${verb}${e.store ? " · " + esc(e.store) : ""}<div class="sub"><span class="chip">${esc(e.category)}</span>${esc(items || e.note || "")}</div>${pending.has(e.id) ? `<div class="pend">Saved on this phone, not synced yet</div>` : ""}</div><div class="amt${ty === "income" ? " inc" : ty === "saved" ? " savc" : ""}">${ty === "income" ? "+" : ty === "saved" ? "" : "−"}${fmt(e.amount)}</div><div class="ract"><button class="lnk" data-a="edit">Edit</button><button class="lnk red" data-a="del">Delete</button></div></li>`;
  }
  $("#acts").innerHTML = h || `<li class="empty">No entries${filterWho ? " from " + esc(filterWho) : ""} for ${esc(mlabel(month))} yet.</li>`;
}
$("#prev").onclick = () => shiftMonth(-1); $("#next").onclick = () => shiftMonth(1);
function shiftMonth(k) { const [y, mm] = month.split("-").map(Number); const d = new Date(y, mm - 1 + k, 1); month = d.getFullYear() + "-" + pad(d.getMonth() + 1); render(); }

/* ---------- capture ---------- */
function runParse() {
  const t = $("#ta").value.trim();
  if (!t) { stat($("#pstat"), "Type or say what you bought first."); return; }
  const rows = parse(t, new Date());
  stat($("#pstat"), rows.some(r => r.amount == null) ? "I couldn't find an amount. Please type it in below." : "");
  openReview(rows.length ? rows : [blank()], null);
}
$("#go").onclick = () => { if (listening && rec) { try { rec.stop(); } catch (_) {} } runParse(); };
$("#manual").onclick = () => openReview([blank()], null);
const blank = () => ({ type: "expense", date: today(), store: "", category: "Groceries", amount: null, items: [], note: "" });

/* ---------- review ---------- */
const parseItems = s => s.split(",").map(p => p.trim()).filter(Boolean).map(p => { const m = p.match(/^(.*?)\s*\$?(\d+(?:\.\d{1,2})?)$/); return m && m[1] ? { name: m[1], amount: num(m[2]) } : { name: p, amount: null }; });
function openReview(rows, id) {
  draft = rows.map(r => ({ ...r, who: r.who || cfg.me || PEOPLE[0] })); editing = id;
  $("#rvtitle").textContent = id ? "Edit entry" : "Check before saving"; $("#addrow").hidden = !!id;
  drawReview(); $("#review").hidden = false; $("#review").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function drawReview() {
  $("#rvlist").innerHTML = draft.map((r, i) => {
    const ty = r.type === "income" || r.type === "saved" ? r.type : "expense", cats = catsFor(ty);
    return `<div class="rv" data-i="${i}">
    <div class="g3"><select data-f="type" aria-label="Type"><option value="expense"${ty === "expense" ? " selected" : ""}>Spent</option><option value="income"${ty === "income" ? " selected" : ""}>Income</option><option value="saved"${ty === "saved" ? " selected" : ""}>Saved</option></select>
    <input class="store" data-f="store" placeholder="${ty === "income" ? "Source" : ty === "saved" ? "Bank or account (optional)" : "Store or biller"}" value="${esc(r.store)}" aria-label="Store">
    <input data-f="date" type="date" value="${esc(r.date)}" aria-label="Date"></div>
    <div class="g2"><select data-f="category" aria-label="Category">${cats.map(c => `<option${c === r.category ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <input data-f="amount" inputmode="decimal" placeholder="Amount $" value="${r.amount != null ? Number(r.amount).toFixed(2) : ""}" aria-label="Amount"></div>
    <input data-f="items" placeholder="${ty === "expense" ? "Items, comma separated (optional)" : "Note (optional)"}" value="${esc(itemsText(r.items) || r.note || "")}" aria-label="Items">
    <div class="g2"><select data-f="who" aria-label="Who">${PEOPLE.map(p => `<option${p === r.who ? " selected" : ""}>${esc(p)}</option>`).join("")}</select>
    ${draft.length > 1 ? `<button class="lnk red" data-rm="${i}" style="justify-self:end">Remove line</button>` : "<span></span>"}</div></div>`;
  }).join("");
}
function readReview() {
  return [...document.querySelectorAll(".rv")].map(el => {
    const g = f => el.querySelector(`[data-f="${f}"]`).value;
    const inc = g("type") !== "expense";
    return { type: g("type"), store: g("store").trim(), date: g("date") || today(), category: g("category"), amount: num(g("amount")), items: inc ? [] : parseItems(g("items")), note: inc ? g("items").trim().slice(0, 200) : "", who: g("who") };
  });
}
$("#rvlist").addEventListener("change", e => { if (e.target.dataset.f === "type") { draft = readReview(); const r = draft[+e.target.closest(".rv").dataset.i]; r.category = catsFor(r.type)[0]; drawReview(); } });
$("#rvlist").addEventListener("click", e => { const i = e.target.dataset.rm; if (i != null) { draft = readReview(); draft.splice(+i, 1); drawReview(); } });
$("#addrow").onclick = () => { draft = readReview(); draft.push({ ...blank(), store: draft[0] ? draft[0].store : "", who: cfg.me }); drawReview(); };
$("#cancel").onclick = () => { $("#review").hidden = true; draft = []; editing = null; stat($("#pstat"), ""); };
$("#save").onclick = () => {
  const rows = readReview();
  if (rows.some(r => !(r.amount > 0))) { stat($("#pstat"), "Every line needs an amount.", true); return; }
  const now = Date.now();
  rows.forEach(r => {
    const old = editing && entries[editing];
    const id = editing || uid();
    entries[id] = { ...r, id, createdAt: old ? old.createdAt : now, updatedAt: now };
    if (!outbox.includes(id)) outbox.push(id);
  });
  persist();
  const other = rows.find(r => r.date.slice(0, 7) !== month);
  stat($("#pstat"), other ? `Saved. One entry is dated ${mlabel(other.date.slice(0, 7))}.` : "Saved.");
  $("#ta").value = ""; $("#review").hidden = true; draft = []; editing = null;
  render(); sync();
};

/* ---------- activity actions ---------- */
$("#acts").addEventListener("click", e => {
  const a = e.target.dataset.a; if (!a) return;
  const id = e.target.closest(".row").dataset.id; const en = entries[id]; if (!en) return;
  if (a === "edit") { openReview([{ ...en }], id); return; }
  if (e.target.dataset.sure !== "1") { e.target.dataset.sure = "1"; e.target.textContent = "Tap again to delete"; setTimeout(() => { if (e.target.isConnected) { e.target.dataset.sure = ""; e.target.textContent = "Delete"; } }, 3500); return; }
  entries[id] = { ...en, deleted: true, updatedAt: Date.now() };
  if (!outbox.includes(id)) outbox.push(id);
  persist(); render(); sync();
});
$("#csv").onclick = async () => {
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const mine = live().filter(e => (e.date || "").slice(0, 7) === month);
  const rows = [["Date", "Who", "Type", "Store", "Category", "Amount", "Items"], ...mine.map(e => [e.date, e.who, typeOf(e), e.store, e.category, (+e.amount || 0).toFixed(2), itemsText(e.items)])];
  try { await navigator.clipboard.writeText(rows.map(r => r.map(q).join(",")).join("\n")); stat($("#dstat"), "Copied. Paste it into Excel or Google Sheets."); }
  catch (_) { stat($("#dstat"), "Copy isn't available here. Your Google Sheet has every entry too.", true); }
};

/* ---------- limits ---------- */
$("#limbtn").onclick = () => { editLim = !editLim; $("#limlist").innerHTML = `<label class="limrow"><span><b>Monthly savings goal</b></span><input inputmode="decimal" data-c="${GOAL}" placeholder="No goal" value="${limits[GOAL] ? (+limits[GOAL]).toFixed(0) : ""}"></label>` + EXP.map(c => `<label class="limrow"><span>${esc(c)}</span><input inputmode="decimal" data-c="${esc(c)}" placeholder="No limit" value="${limits[c] ? (+limits[c]).toFixed(0) : ""}"></label>`).join(""); render(); };
$("#limcancel").onclick = () => { editLim = false; render(); };
$("#limsave").onclick = () => {
  const l = {}; document.querySelectorAll("#limlist input").forEach(i => { const n = num(i.value); if (n > 0) l[i.dataset.c] = n; });
  limits = l; limitsDirty = true; editLim = false; persist(); render(); sync();
};

/* ---------- voice (built into the phone's browser, no account needed) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
function micUI() { $("#mic").classList.toggle("on", listening); $("#mic span").textContent = listening ? "Stop" : "Speak"; }
if (SR) {
  $("#mic").hidden = false;
  $("#mhint").textContent = "Tap Speak and say what you bought and the total. If Speak doesn't work on your phone, use the microphone key on the keyboard.";
  $("#mic").onclick = () => {
    if (listening && rec) { try { rec.stop(); } catch (_) {} return; }
    const base = $("#ta").value.trim();
    let heard = "";
    rec = new SR(); rec.lang = cfg.lang || "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let fin = "", interim = "";
      for (const r of e.results) { if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; }
      heard = (fin + " " + interim).trim();
      $("#ta").value = (base ? base + " " : "") + fin.trim();
      $("#partial").textContent = interim;
    };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") stat($("#pstat"), "The microphone is blocked for this page. Allow it in your browser settings, or use the microphone key on your keyboard.", true);
      else if (e.error === "no-speech") stat($("#pstat"), "I didn't hear anything. Tap Speak and try again.");
      else if (e.error !== "aborted") stat($("#pstat"), "Voice stopped (" + e.error + "). You can use the keyboard microphone instead.", true);
    };
    rec.onend = () => {
      listening = false; micUI();
      if (!$("#ta").value.trim() && heard) $("#ta").value = (base ? base + " " : "") + heard;
      $("#partial").textContent = "";
      if ($("#ta").value.trim() !== base && $("#ta").value.trim()) runParse();
    };
    try { rec.start(); listening = true; micUI(); stat($("#pstat"), "Listening…"); }
    catch (_) { stat($("#pstat"), "Voice isn't available right now. Use the microphone key on your keyboard.", true); }
  };
}

/* ---------- start ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
if (!cfg.me) startSetup(); else enterApp();
})();
