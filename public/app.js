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
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) return s; } catch (e) {}
    return { profile: null, days: {} };
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
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, text }), signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error(r.status);
      setMode(true);
      return await r.json();
    } catch (e) {
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
    return Object.assign({ base }, E.planDay(base, past));
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
    $("eaten").textContent = fmt(eaten); $("budget").textContent = fmt(b.target);
    const scale = Math.max(b.target, high) * 1.05;
    $("barFill").style.width = Math.min(100, (eaten / scale) * 100) + "%";
    const r = $("barRange"); r.style.left = (low / scale) * 100 + "%"; r.style.width = Math.max(0, (high - low) / scale * 100) + "%";
    let note = "";
    if (b.adjust < 0) note = "Budget trimmed by " + fmt(-b.adjust) + " kcal to absorb a heavier recent day. Spread over a few days, so no stress. " + (b.floorHit ? "I won't go below 1,200." : "");
    else if (entries.length) note = eaten > b.target ? "A little over today. Nothing to fix tonight; I'll spread it gently over the next days." : "Roughly " + fmt(Math.max(0, b.target - eaten)) + " kcal of room left. The range on the bar shows how unsure the estimates are.";
    else note = "Base budget " + fmt(b.base) + " kcal. Log whenever you remember.";
    $("budgetNote").textContent = (state.profile.cond ? state.profile.cond + " " : "") + note;
    renderLog(entries); renderWeek(b); renderCheckin(b, entries, eaten);
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
      right.innerHTML = "<div></div>";
      right.firstChild.textContent = fmt(tot.kcal) + " kcal";
      const del = document.createElement("button"); del.className = "ghost small"; del.textContent = "Remove"; del.setAttribute("aria-label", "Remove this entry");
      del.onclick = () => { entries.splice(idx, 1); save(); render(); };
      right.appendChild(del);
      li.append(left, right); ul.appendChild(li);
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

  // Proactive check-in: rule-chosen, shown without being asked. (Web apps can't push when closed; see report.)
  function renderCheckin(b, entries, eaten) {
    const c = $("checkin"); const h = new Date().getHours();
    const inWin = (a, z) => entries.some(e => { const x = new Date(e.t).getHours(); return x >= a && x < z; });
    let msg = null;
    if (h >= 10 && h < 12 && !inWin(5, 12)) msg = "Subah ka kuch khaya? Just tell me in a few words. Skipping is fine, I'm only asking.";
    else if (h >= 14 && h < 18 && !inWin(12, 16)) msg = "Lunch kaisa raha? Tell me roughly what was on the plate.";
    else if (h >= 21 && eaten > 0 && eaten < b.target * 0.6) msg = "You've eaten quite lightly today. Is there some dinner or a snack still to log?";
    else if (h >= 21 && eaten > b.target + 150) msg = "Heavier day today. That's okay. I've already spread it across the next few days, nothing to do.";
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
    pending = { text, items: res.items, clarify: res.clarify };
    if (!res.items.length) {
      const a = document.createElement("div"); a.className = "alert"; a.textContent = (res.clarify && res.clarify.question) || "I couldn't find a food in that. Try again?"; box.appendChild(a); return;
    }
    const h = document.createElement("div"); h.className = "label"; h.textContent = "Here's what I understood"; box.appendChild(h);
    res.items.forEach(i => {
      const d = document.createElement("div"); d.className = "item";
      const kc = document.createElement("span"); kc.className = "kc"; kc.textContent = fmt(i.kcal) + " kcal";
      const nm = document.createElement("span"); nm.className = "name"; nm.textContent = i.qty + " " + i.unit + " · " + i.name;
      const tg = document.createElement("span"); tg.className = "tag " + (i.confidence === "low" ? "low" : ""); tg.textContent = i.confidence + " confidence";
      const as = document.createElement("div"); as.className = "assume"; as.textContent = "range " + fmt(i.kcalLow) + "–" + fmt(i.kcalHigh) + (i.assumption ? " · " + i.assumption : "");
      d.append(kc, nm, tg, as); box.appendChild(d);
    });
    const tot = E.totals(res.items);
    const t = document.createElement("p"); t.innerHTML = "<strong></strong>"; t.firstChild.textContent = "Total ≈ " + fmt(tot.kcal) + " kcal (" + fmt(tot.low) + "–" + fmt(tot.high) + ")"; box.appendChild(t);
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
    (targets.length ? targets : pending.items).forEach(i => { i.kcal = Math.round(i.kcal * f); i.kcalLow = Math.round(i.kcalLow * f); i.kcalHigh = Math.round(i.kcalHigh * f); i.confidence = "medium"; i.assumption = "You told me the size"; });
    showResult({ items: pending.items, clarify: null, note: "" }, pending.text);
  }
  function confirmMeal() {
    if (!pending) return;
    const k = dkey(); (state.days[k] = state.days[k] || []).push({ t: Date.now(), text: pending.text, items: pending.items });
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
    $("reset").onclick = () => { if (confirm("Delete all data stored in this browser?")) { state = { profile: null, days: {} }; save(); $("result").classList.add("hidden"); render(); } };
    $("sample").onclick = loadSample;
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
