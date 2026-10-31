(function () {
  const E = window.Engine;
  const $ = id => document.getElementById(id);
  const KEY = "thalitalk_v1";
  const EXAMPLES = [
    "aaj lunch me 2 roti, dal aur thodi sabzi, ek katori dahi",
    "breakfast: 2 idli sambar aur chai",
    "ek bada samosa aur cutting chai",
    "ghar ka thali, chawal zyada tha",
    "pizza ke 3 slice aur coke",
  ];

  let state = load();
  let pending = null; // parsed meal awaiting confirmation
  let aiOnline = null;

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) { s.water = s.water || {}; s.favs = s.favs || []; return s; } } catch (e) {}
    return { profile: null, days: {}, water: {}, favs: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  const dkey = d => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmt = n => Math.round(n).toLocaleString("en-IN");
  const dayTotal = k => (state.days[k] || []).reduce((s, e) => s + E.totals(e.items).kcal, 0);

  // ---------- API with graceful fallback ----------
  async function analyze(mode, text) {
    const flag = E.redFlag(text);
    if (flag && !flag.soft) return { items: [], redFlag: flag.message, source: "rules" };
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 28000);
      const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, text }), signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 500));
      setMode(true);
      return await r.json();
    } catch (e) {
      console.warn("AI call failed, using offline mode:", e && e.message ? e.message : e);
      setMode(false);
      return mode === "profile" ? E.demoProfile(text) : E.demoParse(text);
    }
  }
  function setMode(ai) {
    aiOnline = ai; const b = $("mode");
    b.textContent = ai ? "AI on" : "Offline demo mode";
    b.className = "badge" + (ai ? " ai" : "");
  }

  // ---------- Budget ----------
  function budget() {
    const base = state.profile ? state.profile.target : 1800;
    const today = new Date();
    const past = [];
    for (let i = 3; i >= 1; i--) { const k = dkey(addDays(today, -i)); if ((state.days[k] || []).length) past.push({ date: k, eaten: dayTotal(k) }); }
    return Object.assign({ base }, E.planDay(base, past, state.profile ? state.profile.goal : "maintain"));
  }

  // ---------- Render ----------
  function render() {
    const hasProfile = !!state.profile;
    $("onboard").classList.toggle("hidden", hasProfile);
    $("home").classList.toggle("hidden", !hasProfile);
    if (!hasProfile) return;
    const b = budget(), k = dkey();
    const eaten = dayTotal(k);
    const entries = state.days[k] || [];
    const low = entries.reduce((s, e) => s + E.totals(e.items).low, 0), high = entries.reduce((s, e) => s + E.totals(e.items).high, 0);
    const goal = state.profile.goal || "maintain";
    $("eaten").textContent = fmt(eaten); $("budget").textContent = fmt(b.target);
    document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x.dataset.goal === goal));
    const prot = entries.reduce((s2, e) => s2 + E.totals(e.items).protein, 0);
    $("proteinLine").textContent = prot ? "Protein today: about " + fmt(prot) + " g" : "";
    const scale = Math.max(b.target, high) * 1.05;
    $("barFill").style.width = Math.min(100, (eaten / scale) * 100) + "%";
    const r = $("barRange"); r.style.left = (low / scale) * 100 + "%"; r.style.width = Math.max(0, (high - low) / scale * 100) + "%";
    let note = "";
    if (b.adjust < 0) note = "Budget trimmed by " + fmt(-b.adjust) + " kcal to absorb a heavier recent day. Spread over a few days, so no stress. " + (b.floorHit ? "I won't go below 1,200." : "");
    else if (entries.length) note = eaten > b.target ? "A little over today. Nothing to fix tonight; I'll spread it gently over the next days." : "Roughly " + fmt(Math.max(0, b.target - eaten)) + " kcal of room left. The range on the bar shows how unsure the estimates are.";
    else note = "Base budget " + fmt(b.base) + " kcal. Log whenever you remember.";
    if (goal === "gain") note = entries.length ? (eaten >= b.target ? "Target reached. Going over is fine while you're bulking; what matters is not falling short." : "About " + fmt(Math.max(0, b.target - eaten)) + " kcal still to go to reach your target. Protein is shown above.") : "Bulking: base target " + fmt(b.base) + " kcal. Log your meals and keep an eye on protein.";
    $("budgetNote").textContent = (state.profile.cond ? state.profile.cond + " " : "") + note;
    renderLog(entries); renderWeek(b); renderSummary(b); renderWater(); renderFavs(); renderRecent(); renderCheckin(b, entries, eaten);
  }

  let editing = null; // index of the log entry being edited today

  // Rescale an item to a new quantity; kcal and range scale proportionally.
  function rescale(item, qty) {
    const f = item.qty > 0 ? qty / item.qty : 1;
    item.kcal = Math.round(item.kcal * f); item.kcalLow = Math.round(item.kcalLow * f); item.kcalHigh = Math.round(item.kcalHigh * f);
    item.protein = Math.round((item.protein || 0) * f);
    item.qty = qty; item.confidence = "high"; item.assumption = "You set this amount";
  }

  function addEntry(items, text) {
    const k = dkey();
    (state.days[k] = state.days[k] || []).push({ t: Date.now(), text: text, items: JSON.parse(JSON.stringify(items)) });
    save(); render();
  }

  function renderLog(entries) {
    const ul = $("log"); ul.innerHTML = "";
    $("logEmpty").classList.toggle("hidden", entries.length > 0);
    entries.forEach((e, idx) => {
      const li = document.createElement("li");
      const t = new Date(e.t);
      const left = document.createElement("div");
      left.innerHTML = '<div class="t"></div><div class="d"></div>';
      left.firstChild.textContent = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      left.lastChild.textContent = e.items.map(i => i.name).join(", ");
      const right = document.createElement("div");
      const tot = E.totals(e.items);
      right.innerHTML = '<div></div><div class="actions"></div>';
      right.firstChild.textContent = fmt(tot.kcal) + " kcal";
      const mk = (label, aria, fn) => { const b = document.createElement("button"); b.className = "ghost small"; b.textContent = label; b.setAttribute("aria-label", aria); b.onclick = fn; right.lastChild.appendChild(b); };
      mk("Edit", "Edit amounts in this entry", () => { editing = editing === idx ? null : idx; render(); });
      mk("Again", "Log this same meal again", () => addEntry(e.items, e.text));
      mk("★ Save", "Save this meal as a favourite", () => saveFavourite(e));
      mk("Remove", "Remove this entry", () => { entries.splice(idx, 1); editing = null; save(); render(); });
      li.append(left, right);
      if (editing === idx) li.appendChild(buildEditor(e));
      ul.appendChild(li);
    });
  }

  function buildEditor(entry) {
    const box = document.createElement("div"); box.className = "editor";
    const inputs = [];
    entry.items.forEach(it => {
      const row = document.createElement("div"); row.className = "erow";
      const lab = document.createElement("label"); lab.textContent = it.name + " (" + it.unit + ")";
      const inp = document.createElement("input"); inp.type = "number"; inp.min = "0.25"; inp.max = "20"; inp.step = "0.25"; inp.value = it.qty;
      inp.setAttribute("aria-label", "Amount of " + it.name);
      row.append(lab, inp); box.appendChild(row); inputs.push(inp);
    });
    const row = document.createElement("div"); row.className = "row";
    const ok = document.createElement("button"); ok.className = "primary small"; ok.textContent = "Save amounts";
    ok.onclick = () => {
      entry.items.forEach((it, n) => { const v = parseFloat(inputs[n].value); if (v > 0 && v <= 20 && v !== it.qty) rescale(it, v); });
      editing = null; save(); render();
    };
    const no = document.createElement("button"); no.className = "ghost small"; no.textContent = "Cancel";
    no.onclick = () => { editing = null; render(); };
    row.append(ok, no); box.appendChild(row);
    return box;
  }

  // ---------- Water (a gentle counter, not a medical target) ----------
  const WATER_GOAL = 8;
  function renderWater() {
    const n = state.water[dkey()] || 0;
    $("waterText").textContent = n + " glass" + (n === 1 ? "" : "es") + " today";
    const d = $("waterDots"); d.innerHTML = "";
    for (let i = 0; i < Math.max(WATER_GOAL, n); i++) { const dot = document.createElement("i"); if (i < n) dot.className = "on"; d.appendChild(dot); }
  }
  function bumpWater(delta) {
    const k = dkey(); state.water[k] = Math.max(0, Math.min(30, (state.water[k] || 0) + delta)); save(); render();
  }

  // ---------- Weekly summary (plain words, no scoring) ----------
  function renderSummary(b) {
    const days = []; for (let i = 6; i >= 0; i--) days.push(dkey(addDays(new Date(), -i)));
    const logged = days.filter(k => (state.days[k] || []).length);
    const el = $("weekSummary");
    if (!logged.length) { el.textContent = "Nothing logged this week yet. Whenever you're ready."; return; }
    const kc = logged.map(dayTotal);
    const avg = kc.reduce((a, c) => a + c, 0) / kc.length;
    const gain = (state.profile.goal || "maintain") === "gain";
    const within = kc.filter(v => gain ? v >= b.base * 0.9 : v <= b.base + 150).length;
    const w = days.map(k => state.water[k] || 0);
    const wDays = w.filter(v => v > 0);
    let txt = "You logged " + logged.length + " of the last 7 days, averaging about " + fmt(avg) + " kcal on those days. " + within + (within === 1 ? " of them was" : " of them were") + (gain ? " at or near your target." : " within your budget.");
    if (wDays.length) txt += " Water: about " + (wDays.reduce((a, c) => a + c, 0) / wDays.length).toFixed(1) + " glasses on days you tracked it.";
    el.textContent = txt;
  }


  // ---------- Generic AI call (null when unavailable) ----------
  async function callApi(mode, text) {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 28000);
      const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, text }), signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) return null;
      setMode(true); return await r.json();
    } catch (e) { return null; }
  }
  const slim = i => ({ name: i.name, qty: i.qty, unit: i.unit, kcal: i.kcal, kcalLow: i.kcalLow, kcalHigh: i.kcalHigh, protein: i.protein || 0, confidence: i.confidence, assumption: i.assumption || "" });

  // "Why these numbers?" and "Fix something" live in the result card
  function addHelpers(box) {
    const wrap = document.createElement("div"); wrap.className = "helpers";
    const why = document.createElement("button"); why.className = "ghost small"; why.textContent = "Why these numbers?";
    const out = document.createElement("div"); out.className = "alert explain hidden";
    why.onclick = async () => {
      if (!pending) return;
      if (!out.classList.contains("hidden")) { out.classList.add("hidden"); return; }
      out.textContent = "Thinking…"; out.classList.remove("hidden");
      const r = await callApi("explain", JSON.stringify({ said: pending.text, items: pending.items.map(slim) }));
      out.textContent = r && r.explanation ? r.explanation : explainOffline(pending.items);
    };
    const fix = document.createElement("div"); fix.className = "fixrow";
    const inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 200;
    inp.placeholder = 'Fix something? e.g. "it was 3 rotis" or "no dahi"'; inp.setAttribute("aria-label", "Correct this meal in your own words");
    const go = document.createElement("button"); go.className = "small"; go.textContent = "Update";
    const run = () => correct(inp.value.trim(), go);
    go.onclick = run; inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); run(); } });
    fix.append(inp, go); wrap.append(why, out, fix); box.appendChild(wrap);
  }

  function explainOffline(items) {
    const lines = items.map(i => i.name + ": " + i.qty + " " + i.unit + " is about " + i.kcal + " kcal" + (i.assumption ? " (" + i.assumption + ")" : "")).join("; ");
    return "Each number is a typical home-cooked amount, not a measurement. " + lines + ". The range is wider where oil, ghee, sugar or portion size could vary. Telling me the real amount narrows it.";
  }

  // Offline fallback for corrections: change a quantity, remove an item, or add a forgotten one.
  function correctOffline(items, text) {
    const out = JSON.parse(JSON.stringify(items));
    const removing = /\b(no|not|without|nahi|nahin|nhi|skip|skipped|didn't|didnt)\b/i.test(text);
    let changed = false;
    (E.demoParse(text).items || []).forEach(p => {
      const idx = out.findIndex(o => o.name === p.name);
      if (removing && p.confidence === "low") { if (idx >= 0) { out.splice(idx, 1); changed = true; } }
      else if (!removing && p.confidence !== "low") {
        if (idx >= 0) rescale(out[idx], p.qty); else out.push(p);
        changed = true;
      }
    });
    return changed ? out : null;
  }

  async function correct(text, btn) {
    if (!pending || !text) return;
    btn.disabled = true; btn.textContent = "…";
    const keep = { text: pending.text, when: pending.when };
    const r = await callApi("correct", JSON.stringify({ items: pending.items.map(slim), correction: text }));
    if (r && r.redFlag) { showResult(r, keep.text); return; }
    if (r && r.items && r.items.length) { showResult({ items: r.items, clarify: null, note: r.note || "", when: keep.when }, keep.text); return; }
    const items = correctOffline(pending.items, text);
    if (items && items.length) { showResult({ items, clarify: null, note: "Updated using the offline helper.", when: keep.when }, keep.text); return; }
    btn.disabled = false; btn.textContent = "Update";
    const box = $("result"), n = document.createElement("div"); n.className = "alert";
    n.textContent = 'I couldn\'t apply that. Try "it was 3 rotis", "no dahi", or "also 1 banana", or use Edit after saving.';
    box.insertBefore(n, box.querySelector(".helpers"));
  }

  // ---------- Favourites (named meals) ----------
  function renderFavs() {
    const box = $("favs"); box.innerHTML = "";
    box.classList.toggle("hidden", !state.favs.length);
    state.favs.forEach((f, idx) => {
      const w = document.createElement("span"); w.className = "fav";
      const b = document.createElement("button"); b.textContent = "★ " + f.name; b.setAttribute("aria-label", "Log favourite: " + f.name);
      b.onclick = () => addEntry(f.items, f.text);
      const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", "Remove favourite " + f.name);
      x.onclick = () => { state.favs.splice(idx, 1); save(); render(); };
      w.append(b, x); box.appendChild(w);
    });
  }
  function saveFavourite(e) {
    const def = e.items.map(i => i.name).slice(0, 2).join(" + ");
    const name = (prompt("Name this meal (for example: my usual tiffin)", def) || "").trim().slice(0, 40);
    if (!name) return;
    state.favs.unshift({ name, text: e.text, items: JSON.parse(JSON.stringify(e.items)) });
    state.favs = state.favs.slice(0, 8); save(); render();
  }

  // ---------- Share ----------
  function shareWeek() {
    const msg = "My week on Thali Talk: " + $("weekSummary").textContent + " " + location.origin;
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
  }

  // ---------- Export ----------
  function exportCsv() {
    const q = v => '"' + String(v == null ? "" : v).split('"').join('""') + '"';
    const rows = [["date", "time", "what_you_said", "item", "quantity", "unit", "kcal", "kcal_low", "kcal_high", "protein_g"]];
    Object.keys(state.days).sort().forEach(k => state.days[k].forEach(e => {
      const tm = new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      e.items.forEach(i => rows.push([k, tm, e.text, i.name, i.qty, i.unit, i.kcal, i.kcalLow, i.kcalHigh, i.protein || 0]));
    }));
    Object.keys(state.water).sort().forEach(k => rows.push([k, "", "water", "glasses", state.water[k], "glass", "", "", "", ""]));
    const csv = rows.map(r => r.map(q).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "thali-talk-log.csv"; document.body.appendChild(a); a.click(); a.remove();
  }

  // Recent distinct meals become one-tap chips ("log again")
  function recentMeals() {
    const seen = {}, out = [];
    Object.keys(state.days).sort().reverse().forEach(k => state.days[k].slice().reverse().forEach(e => {
      const key = (e.text || "").trim().toLowerCase();
      if (e.text && e.text !== "sample" && !seen[key] && out.length < 4) { seen[key] = 1; out.push(e); }
    }));
    return out;
  }
  function renderRecent() {
    const box = $("recent"); box.innerHTML = "";
    const r = recentMeals(); box.classList.toggle("hidden", !r.length);
    r.forEach(e => {
      const b = document.createElement("button"); b.textContent = "↻ " + (e.text.length > 30 ? e.text.slice(0, 28) + "…" : e.text);
      b.setAttribute("aria-label", "Log again: " + e.text); b.onclick = () => addEntry(e.items, e.text); box.appendChild(b);
    });
  }

  function renderWeek(b) {
    const w = $("week"); w.innerHTML = "";
    const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(new Date(), -i));
    const vals = days.map(d => dayTotal(dkey(d)));
    const max = Math.max(b.base * 1.3, ...vals);
    days.forEach((d, i) => {
      const el = document.createElement("div"); el.className = "d";
      const bar = document.createElement("div"); bar.className = "b" + (vals[i] ? "" : " none");
      bar.style.height = (vals[i] ? (vals[i] / max) * 100 : 2) + "%";
      bar.title = vals[i] ? fmt(vals[i]) + " kcal" : "not logged";
      const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = d.toLocaleDateString([], { weekday: "short" }).slice(0, 2);
      el.append(bar, lbl); w.appendChild(el);
    });
    const base = document.createElement("div"); base.className = "base"; base.style.bottom = "calc(18px + " + (b.base / max) * (110 - 18) + "px)"; w.appendChild(base);
  }

  // After a gap of 3+ days: welcome the user back. There are no streaks to lose and nothing to catch up on.
  function welcomeBackMsg(entries) {
    if (entries.length) return null;
    const k = dkey();
    const past = Object.keys(state.days).filter(d => d < k && (state.days[d] || []).length).sort();
    if (!past.length) return null;
    const gap = Math.round((new Date(k + "T00:00:00") - new Date(past[past.length - 1] + "T00:00:00")) / 86400000);
    return gap >= 3 ? "Welcome back! It's been " + gap + " days, and that's completely fine. Nothing to catch up on: just log what you eat today." : null;
  }

  // Proactive check-in: rule-chosen, shown without being asked. (Web apps can't push when closed; see report.)
  function renderCheckin(b, entries, eaten) {
    const c = $("checkin"); const h = new Date().getHours();
    const inWin = (a, z) => entries.some(e => { const x = new Date(e.t).getHours(); return x >= a && x < z; });
    let msg = welcomeBackMsg(entries);
    if (msg) { /* gap message wins */ }
    else if (h >= 10 && h < 12 && !inWin(5, 12)) msg = "Subah ka kuch khaya? Just tell me in a few words. Skipping is fine, I'm only asking.";
    else if (h >= 14 && h < 18 && !inWin(12, 16)) msg = "Lunch kaisa raha? Tell me roughly what was on the plate.";
    else if (h >= 21 && eaten > 0 && eaten < b.target * 0.6) msg = "You've eaten quite lightly today. Is there some dinner or a snack still to log?";
    else if (h >= 21 && eaten > b.target + 150 && (state.profile.goal || "maintain") !== "gain") msg = "Heavier day today. That's okay. I've already spread it across the next few days, nothing to do.";
    else if (b.adjust < 0 && !entries.length) msg = "Yesterday ran a bit high, so today's budget is " + fmt(b.target) + ". Small tweak, not a punishment.";
    c.classList.toggle("hidden", !msg); c.textContent = msg || "";
  }

  // ---------- Meal flow ----------
  function showResult(res, text) {
    const box = $("result"); box.innerHTML = ""; box.classList.remove("hidden");
    if (res.redFlag) {
      const a = document.createElement("div"); a.className = "alert"; a.textContent = res.redFlag; box.appendChild(a);
      pending = null; return;
    }
    pending = { text, items: res.items, clarify: res.clarify, when: res.when === "yesterday" ? "yesterday" : "today" };
    if (!res.items.length) {
      const a = document.createElement("div"); a.className = "alert"; a.textContent = (res.clarify && res.clarify.question) || "I couldn't find a food in that. Try again?"; box.appendChild(a); return;
    }
    const h = document.createElement("div"); h.className = "label"; h.textContent = "Here's what I understood"; box.appendChild(h);
    res.items.forEach(i => {
      const d = document.createElement("div"); d.className = "item";
      const kc = document.createElement("span"); kc.className = "kc"; kc.textContent = fmt(i.kcal) + " kcal";
      const nm = document.createElement("span"); nm.className = "name"; nm.textContent = i.qty + " " + i.unit + " · " + i.name;
      const tg = document.createElement("span"); tg.className = "tag " + (i.confidence === "low" ? "low" : ""); tg.textContent = i.confidence + " confidence";
      const as = document.createElement("div"); as.className = "assume"; as.textContent = (i.protein ? i.protein + " g protein · " : "") + "range " + fmt(i.kcalLow) + "–" + fmt(i.kcalHigh) + (i.assumption ? " · " + i.assumption : "");
      d.append(kc, nm, tg, as); box.appendChild(d);
    });
    const tot = E.totals(res.items);
    const t = document.createElement("p"); t.innerHTML = "<strong></strong>"; t.firstChild.textContent = "Total ≈ " + fmt(tot.kcal) + " kcal (" + fmt(tot.low) + "–" + fmt(tot.high) + ")" + (tot.protein ? " · protein ≈ " + fmt(tot.protein) + " g" : ""); box.appendChild(t);
    if (pending.when === "yesterday") { const w = document.createElement("p"); w.className = "muted small-text"; w.textContent = "This will be saved under yesterday."; box.appendChild(w); }
    if (res.note) { const n = document.createElement("div"); n.className = "alert"; n.textContent = res.note; box.appendChild(n); }
    if (res.clarify) {
      const q = document.createElement("div"); q.className = "alert"; q.textContent = res.clarify.question; box.appendChild(q);
      const chips = document.createElement("div"); chips.className = "chips";
      (res.clarify.options || []).forEach(o => {
        const bt = document.createElement("button"); bt.textContent = o;
        bt.onclick = () => { const f = /small|chhot|thoda|kam/i.test(o) ? 0.7 : /big|bad|zyada|more|large/i.test(o) ? 1.4 : 1; applyScale(f); };
        chips.appendChild(bt);
      });
      box.appendChild(chips);
    }
    addHelpers(box);
    const row = document.createElement("div"); row.className = "row";
    const ok = document.createElement("button"); ok.className = "primary grow"; ok.textContent = "Looks right, save";
    ok.onclick = confirmMeal;
    const no = document.createElement("button"); no.className = "ghost"; no.textContent = "Discard";
    no.onclick = () => { pending = null; box.classList.add("hidden"); };
    row.append(ok, no); box.appendChild(row);
  }
  function applyScale(f) {
    if (!pending) return;
    const targets = pending.items.filter(i => i.confidence === "low");
    (targets.length ? targets : pending.items).forEach(i => { i.kcal = Math.round(i.kcal * f); i.kcalLow = Math.round(i.kcalLow * f); i.kcalHigh = Math.round(i.kcalHigh * f); i.protein = Math.round((i.protein || 0) * f); i.confidence = "medium"; i.assumption = "You told me the size"; });
    showResult({ items: pending.items, clarify: null, note: "", when: pending.when }, pending.text);
  }
  function confirmMeal() {
    if (!pending) return;
    const past = pending.when === "yesterday"; const k = dkey(past ? addDays(new Date(), -1) : new Date());
    (state.days[k] = state.days[k] || []).push({ t: Date.now() - (past ? 86400000 : 0), text: pending.text, items: pending.items });
    pending = null; $("result").classList.add("hidden"); $("mealText").value = ""; save(); render();
  }

  async function logMeal() {
    const text = $("mealText").value.trim(); if (!text) return;
    $("busy").classList.remove("hidden"); $("logGo").disabled = true;
    const res = await analyze("meal", text);
    $("busy").classList.add("hidden"); $("logGo").disabled = false;
    showResult(res, text);
  }

  // ---------- Onboarding ----------
  async function setProfile(text) {
    let p;
    if (text) {
      $("profileGo").disabled = true; p = await analyze("profile", text); $("profileGo").disabled = false;
      if (p.redFlag) { $("profileOut").textContent = p.redFlag; return; }
    } else p = { target: 1800 };
    state.profile = { target: p.target || 1800, veg: !!p.veg, goal: p.goal || "maintain" };
    const cond = text && E.redFlag(text);
    if (cond && cond.soft) { // health condition mentioned: keep the flat default and defer to a doctor
      state.profile.target = 1800; state.profile.cond = cond.message;
    }
    save(); render();
  }

  // ---------- Voice (Chrome/Edge/Safari; falls back to typing) ----------
  function setupMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $("mic").classList.add("hidden"); return; }
    const rec = new SR(); rec.lang = "en-IN"; rec.interimResults = false;
    let on = false;
    $("mic").onclick = () => { if (on) { rec.stop(); return; } try { rec.start(); } catch (e) {} };
    rec.onstart = () => { on = true; $("mic").textContent = "■ Listening…"; };
    rec.onend = () => { on = false; $("mic").textContent = "🎤 Speak"; };
    rec.onresult = ev => { $("mealText").value = ev.results[0][0].transcript; };
    rec.onerror = () => { on = false; $("mic").textContent = "🎤 Speak"; };
  }

  // ---------- Sample data (made-up) for reviewers ----------
  function loadSample() {
    const mk = (offset, hour, items) => ({ t: new Date(new Date(addDays(new Date(), -offset)).setHours(hour, 0, 0, 0)).getTime(), text: "sample", items: E.demoParse(items).items });
    state.profile = state.profile || { target: 1800, veg: true, goal: "lose" };
    [[1, 9, "2 idli sambar aur chai"], [1, 13, "pizza ke 3 slice aur coke"], [1, 16, "ek samosa aur chai"], [1, 20, "2 roti dal sabzi dahi"],
     [2, 9, "2 paratha aur chai"], [2, 13, "chawal 2 katori, dal, sabzi"], [2, 20, "2 roti paneer sabzi"],
     [3, 9, "poha aur chai"], [3, 13, "2 roti dal sabzi"], [3, 20, "khichdi dahi"]].forEach(([o, h, s]) => {
      const k = dkey(addDays(new Date(), -o)); (state.days[k] = state.days[k] || []).push(mk(o, h, s));
    });
    save(); render();
  }

  // ---------- Init ----------
  function init() {
    EXAMPLES.forEach(x => { const b = document.createElement("button"); b.textContent = x.length > 34 ? x.slice(0, 32) + "…" : x; b.onclick = () => { $("mealText").value = x; $("mealText").focus(); }; $("examples").appendChild(b); });
    $("logGo").onclick = logMeal;
    $("mealText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); logMeal(); } });
    $("profileGo").onclick = () => setProfile($("profileText").value.trim());
    $("profileSkip").onclick = () => setProfile("");
    $("editBudget").onclick = () => { const v = parseInt(prompt("Base daily budget in kcal (minimum 1,200). A doctor or dietitian should set this if you have a health condition.", state.profile.target), 10); if (v) { state.profile.target = Math.max(E.FLOOR_KCAL, Math.min(4000, v)); save(); render(); } };
    $("reset").onclick = () => { if (confirm("Delete all data stored in this browser?")) { state = { profile: null, days: {}, water: {}, favs: [] }; save(); $("result").classList.add("hidden"); render(); } };
    $("sample").onclick = loadSample;
    $("exportCsv").onclick = exportCsv;
    $("shareWeek").onclick = shareWeek;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    document.querySelectorAll(".seg button").forEach(btn => btn.onclick = () => {
      const old = state.profile.goal || "maintain", g = btn.dataset.goal; if (g === old) return;
      state.profile.target = E.retarget(state.profile.target, old, g); state.profile.goal = g; save(); render();
    });
    $("waterPlus").onclick = () => bumpWater(1);
    $("waterMinus").onclick = () => bumpWater(-1);
    setupMic();
    const q = new URLSearchParams(location.search); // ?sample=1&log=... : used for documentation screenshots
    if (q.get("sample")) loadSample();
    render();
    if (q.get("log") && state.profile) { $("mealText").value = q.get("log"); logMeal(); }
    // quick probe so the badge is right before the first log
    fetch("/api/analyze").then(r => r.json()).then(j => setMode(!!j.ai)).catch(() => setMode(false));
  }
  init();
})();
