/* Thali Talk engine: pure logic shared by the browser and the Node tests.
 * 1. redFlag()    : safety check that runs BEFORE any AI call (never skipped)
 * 2. demoParse()  : offline fallback parser (Hinglish + Indian foods), used when the AI is unavailable
 * 3. planDay()    : deterministic budget maths. The AI never does arithmetic on the user's budget.
 * All kcal values are rough home-cooked estimates for a demo, not clinical data.
 */
(function (root) {
  const FLOOR_KCAL = 1200; // the app never suggests a daily budget below this

  // ---------- 1. Safety ----------
  const RED_FLAGS = [
    { re: /chest pain|seene (me|mein) dard|saans (nahi|nahin)|breathless|can'?t breathe|fainted|behosh|blood in|khoon|vomiting blood|black stool|suicid|marna chahta|marna chahti|kill myself/i,
      msg: "This sounds like something a doctor should look at, not an app. Please contact a doctor or local emergency services now. I can't assess symptoms." },
    { re: /not eaten for (\d+|several|many) days|haven'?t eaten (in|for) (\d+|days)|starv(e|ing) myself|make myself (throw up|vomit)|purg(e|ing)|(\d+) din se (kuch )?nahi khaya/i,
      msg: "I'm concerned about this. Not eating for days, or making yourself sick, is something to talk to a doctor or a counsellor about. I won't plan meals around it. Please reach out to someone you trust today." },
    { re: /diabet|sugar (high|level)|insulin|pregnan|garbhvati|kidney|dialysis|on medication|dawai/i,
      msg: "Because this involves a health condition or medicine, please follow your doctor's or dietitian's advice. I'll still log what you ate, but I won't adjust anything for your condition.", soft: true },
  ];
  function redFlag(text) {
    for (const r of RED_FLAGS) if (r.re.test(text)) return { message: r.msg, soft: !!r.soft };
    return null;
  }

  // ---------- 2. Offline food model ----------
  // name, aliases, unit label, kcal per unit, spread (+/- fraction), default qty, ambiguity note
  const FOODS = [
    ["roti", ["roti", "rotis", "chapati", "chapatis", "phulka", "phulke", "chapathi"], "piece", 85, 0.2, 2],
    ["paratha", ["paratha", "parathas", "parantha", "paranthe"], "piece", 220, 0.35, 1, "oil/ghee used changes this a lot"],
    ["plain rice", ["rice", "chawal", "bhaat", "bhat", "steamed rice"], "katori (150 g cooked)", 195, 0.25, 1],
    ["jeera/veg pulao", ["pulao", "pulav", "biryani"], "katori", 250, 0.35, 1],
    ["dal", ["dal", "daal", "dhal", "sambar", "rasam"], "katori", 130, 0.3, 1],
    ["rajma/chole", ["rajma", "chole", "chhole", "chana masala"], "katori", 190, 0.3, 1],
    ["sabzi (dry/semi-dry)", ["sabzi", "sabji", "sabji", "bhaji", "aloo gobi", "bhindi", "gobi", "palak"], "katori", 110, 0.4, 1, "oil level is a guess"],
    ["paneer sabzi", ["paneer", "paneer butter masala", "palak paneer"], "katori", 280, 0.35, 1],
    ["chicken curry", ["chicken", "murgh", "chicken curry"], "katori", 250, 0.35, 1],
    ["egg", ["egg", "eggs", "anda", "ande", "omelette", "omelet"], "piece", 80, 0.15, 2],
    ["fish curry", ["fish", "machli", "machhi"], "katori", 200, 0.35, 1],
    ["curd/dahi", ["dahi", "curd", "yogurt", "raita"], "katori", 90, 0.3, 1],
    ["buttermilk (chaas)", ["chaas", "chhaas", "buttermilk", "lassi"], "glass", 70, 0.4, 1],
    ["idli", ["idli", "idlis", "idly"], "piece", 60, 0.2, 2],
    ["dosa (plain)", ["dosa", "dosas", "masala dosa"], "piece", 170, 0.35, 1],
    ["poha", ["poha"], "plate", 270, 0.3, 1],
    ["upma", ["upma"], "plate", 250, 0.3, 1],
    ["samosa", ["samosa", "samose"], "piece", 260, 0.25, 1],
    ["vada pav", ["vada pav", "vadapav", "wada pav"], "piece", 290, 0.25, 1],
    ["pav bhaji", ["pav bhaji", "pavbhaji"], "plate", 520, 0.3, 1],
    ["chai with sugar & milk", ["chai", "tea", "cutting chai"], "cup", 80, 0.3, 1],
    ["coffee with milk", ["coffee"], "cup", 70, 0.4, 1],
    ["banana", ["banana", "kela"], "piece", 105, 0.15, 1],
    ["apple", ["apple", "seb"], "piece", 80, 0.2, 1],
    ["biscuit", ["biscuit", "biscuits", "parle-g", "parle g"], "piece", 35, 0.2, 2],
    ["bread slice", ["bread", "toast"], "slice", 75, 0.2, 2],
    ["sandwich", ["sandwich", "sandwhich"], "piece", 300, 0.35, 1],
    ["noodles/maggi", ["maggi", "noodles"], "plate", 350, 0.25, 1],
    ["pizza slice", ["pizza"], "slice", 285, 0.25, 2],
    ["burger", ["burger"], "piece", 480, 0.3, 1],
    ["gulab jamun", ["gulab jamun", "jamun"], "piece", 150, 0.25, 1],
    ["sweet / mithai", ["mithai", "laddu", "ladoo", "barfi", "halwa", "jalebi", "kheer"], "piece/serving", 180, 0.4, 1],
    ["cold drink", ["coke", "pepsi", "cold drink", "soda", "thums up", "sprite"], "glass", 140, 0.15, 1],
    ["nuts", ["almonds", "badam", "nuts", "peanuts", "moongfali", "cashew", "kaju"], "handful", 160, 0.3, 1],
    ["thali (home, veg)", ["thali"], "plate", 700, 0.35, 1, "depends what is on it"],
    ["salad", ["salad", "kheera", "cucumber"], "bowl", 35, 0.4, 1],
    ["khichdi", ["khichdi", "khichri"], "katori", 180, 0.3, 1],
    ["ghee (extra)", ["ghee"], "teaspoon", 45, 0.2, 1],
    ["fruit chaat/fruit", ["fruit", "fruits", "papaya", "orange", "santra", "mango", "aam"], "serving", 90, 0.35, 1],
  ];

  const NUM_WORDS = { ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, paanch: 5, panch: 5, five: 5, chhe: 6, chhah: 6, six: 6, aadha: 0.5, half: 0.5, adha: 0.5, dedh: 1.5, dhai: 2.5, thoda: 0.5, thodi: 0.5, bahut: 2, zyada: 2 };
  const SIZE = { chhota: 0.7, chhoti: 0.7, small: 0.7, bada: 1.4, badi: 1.4, large: 1.4, big: 1.4, double: 2 };

  const UNIT_WORDS = new Set(["katori", "katoris", "plate", "plates", "glass", "cup", "cups", "piece", "pieces", "slice", "slices", "bowl", "of", "ka", "ke", "ki", "handful", "spoon", "teaspoon", "tsp", "bhar", "wala", "wali"]);

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function demoParse(text) {
    const flag = redFlag(text);
    if (flag && !flag.soft) return { redFlag: flag.message, items: [], clarify: null, note: "", source: "demo" };
    const lower = " " + text.toLowerCase().replace(/[,;.&+]|\band\b|\baur\b|\bwith\b|\bke saath\b/g, " | ") + " ";
    const items = [];
    const used = [];
    // longest alias first so "pav bhaji" beats "bhaji"
    const aliasList = [];
    FOODS.forEach((f, i) => f[1].forEach(a => aliasList.push([a, i])));
    aliasList.sort((a, b) => b[0].length - a[0].length);
    for (const [alias, idx] of aliasList) {
      const re = new RegExp("(^|[^a-z])" + esc(alias) + "(?![a-z])", "g");
      let m;
      while ((m = re.exec(lower))) {
        const start = m.index + m[1].length, end = start + alias.length;
        if (used.some(([s, e]) => start < e && end > s)) continue;
        used.push([start, end]);
        const f = FOODS[idx];
        // look back ~24 chars (within same segment) for a quantity or size
        const before = lower.slice(Math.max(0, start - 24), start).split("|").pop();
        let qty = null, size = 1;
        // walk backwards over quantity/size/unit words only; stop at the first other word
        // (so the "2" in "2 idli sambar" belongs to idli, not sambar)
        const toks = before.trim().split(/\s+/).filter(Boolean);
        for (let j = toks.length - 1; j >= 0 && j >= toks.length - 4; j--) {
          const t = toks[j];
          if (/^\d+(\.\d+)?$/.test(t)) { qty = parseFloat(t); break; }
          else if (NUM_WORDS[t] != null) { qty = NUM_WORDS[t]; break; }
          else if (SIZE[t] != null) size = SIZE[t];
          else if (!UNIT_WORDS.has(t)) break;
        }
        // "aloo paratha banaya tha, 2 khaye": quantity after the dish
        if (qty == null) {
          const after = lower.slice(end, end + 40).match(/^[^|]*\|?\s*(?:[a-z]+\s+){0,3}?(\d+|ek|do|teen|char|two|three|four)\s+(?:khaye|khayi|khaya|pieces?|slices?)/);
          if (after) qty = NUM_WORDS[after[1]] != null ? NUM_WORDS[after[1]] : parseFloat(after[1]);
        }
        const guessed = qty == null;
        if (qty == null) qty = f[5];
        const kcal = Math.round(qty * size * f[3]);
        const sizeNote = size !== 1 ? "sized x" + size + " as you said" : "";
        items.push({
          name: f[0], qty: +qty.toFixed(1), unit: f[2],
          kcal, kcalLow: Math.round(kcal * (1 - f[4])), kcalHigh: Math.round(kcal * (1 + f[4])),
          confidence: guessed ? "low" : f[4] > 0.3 ? "medium" : "high",
          assumption: guessed ? "You didn't say how much, so I assumed " + f[5] + " " + f[2] + (sizeNote ? ", " + sizeNote : "") : (sizeNote || f[6] || ""),
        });
      }
    }
    if (!items.length) {
      return { items: [], clarify: { question: "I couldn't spot any food in that. Can you say it like \"2 roti, dal, sabzi\"?", options: [] }, note: "", source: "demo" };
    }
    // one clarifying question only if a guess moves the total a lot
    const vague = items.filter(i => i.confidence === "low" && (i.kcalHigh - i.kcalLow) >= 100);
    const big = vague.sort((a, b) => (b.kcalHigh - b.kcalLow) - (a.kcalHigh - a.kcalLow))[0];
    const clarify = big ? { question: "How much " + big.name + " was it?", options: ["Small", "Normal", "Big"] } : null;
    const note = flag && flag.soft ? flag.message : "";
    const when = /kal\s+(raat|rat|shaam|dopahar|subah)|yesterday|last night/.test(lower) ? "yesterday" : "today";
    return { items, clarify, note, when, source: "demo" };
  }

  function totals(items) {
    return items.reduce((t, i) => ({ kcal: t.kcal + i.kcal, low: t.low + i.kcalLow, high: t.high + i.kcalHigh }), { kcal: 0, low: 0, high: 0 });
  }

  // ---------- 3. Budget maths (deterministic, so the AI cannot invent numbers) ----------
  // days: [{date, eaten}] oldest..today (eaten = estimated kcal logged, only for days the user logged)
  // Overage is absorbed gently: at most 1/3 of it over the next 3 days, never more than 150 kcal/day,
  // never below FLOOR_KCAL. Under-eating is never "rewarded" with extra budget.
  function planDay(baseTarget, pastDays) {
    let adjust = 0;
    const reasons = [];
    const recent = pastDays.slice(-3);
    for (const d of recent) {
      const over = d.eaten - baseTarget;
      if (over > 150) {
        const share = Math.min(150, Math.round(over / 3 / 10) * 10);
        adjust -= share;
        reasons.push({ date: d.date, over: Math.round(over), share });
      }
    }
    adjust = Math.max(adjust, -250); // hard cap on total adjustment
    const target = Math.max(FLOOR_KCAL, baseTarget + adjust);
    return { target, adjust: target - baseTarget, reasons, floorHit: baseTarget + adjust < FLOOR_KCAL };
  }

  // Default target from a stated profile; falls back to a flat number if anything is missing.
  function estimateTarget(p) {
    if (p && p.age && p.kg && p.cm && p.sex) {
      const bmr = 10 * p.kg + 6.25 * p.cm - 5 * p.age + (p.sex === "m" ? 5 : -161);
      let t = bmr * 1.35; // lightly active
      if (p.goal === "lose") t -= 300; else if (p.goal === "gain") t += 300;
      return Math.max(FLOOR_KCAL, Math.round(t / 10) * 10);
    }
    return p && p.goal === "gain" ? 2200 : 1800;
  }

  function demoProfile(text) {
    const t = text.toLowerCase();
    const num = re => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
    const p = {
      age: num(/(\d{2})\s*(?:years|yrs|yr|saal|sal|y\/o|yo)/) || num(/age\s*(\d{2})/),
      kg: num(/(\d{2,3}(?:\.\d)?)\s*kg/),
      cm: num(/(\d{3})\s*cm/),
      sex: /\b(female|woman|she|mahila|ladki|f)\b/.test(t) ? "f" : /\b(male|man|he|ladka|m)\b/.test(t) ? "m" : null,
      goal: /lose|loss|kam|reduce|slim|weight loss/.test(t) ? "lose" : /gain|badh/.test(t) ? "gain" : "maintain",
      veg: /\b(veg|vegetarian|shakahari)\b/.test(t) && !/non[- ]?veg/.test(t),
    };
    const feet = t.match(/(\d)\s*(?:ft|feet|'|foot)\s*(\d{1,2})?/);
    if (!p.cm && feet) p.cm = Math.round(parseInt(feet[1]) * 30.48 + (parseInt(feet[2] || 0)) * 2.54);
    p.target = estimateTarget(p);
    p.source = "demo";
    return p;
  }

  const api = { FLOOR_KCAL, FOODS, redFlag, demoParse, demoProfile, totals, planDay, estimateTarget };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Engine = api;
})(typeof self !== "undefined" ? self : this);
