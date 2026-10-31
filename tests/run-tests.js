// Runs the 10 realistic inputs from the report (Q3).
//   node tests/run-tests.js          -> offline demo parser (no key needed)
//   node tests/run-tests.js live [url]   -> the deployed app's /api/analyze (needs NO key on your computer)
//   GEMINI_API_KEY=... node tests/run-tests.js ai   -> the local handler (only if you set a key yourself)
// Prints a markdown table to paste into REPORT.md. "Good enough?" is for you to judge by hand.
const Engine = require("../public/engine.js");
const handler = require("../api/analyze.js");

const INPUTS = [
  "aaj lunch me 2 roti, dal aur thodi sabzi, ek katori dahi",
  "subah 2 idli sambar aur ek cutting chai",
  "ghar ka thali tha, chawal zyada khaya",
  "ek bada samosa aur chai",
  "pav bhaji khayi office ke bahar, butter wali",
  "kal raat kuch halka khaya, khichdi jaisa",
  "had maggi and a coke around 4pm",
  "mummy ne aloo paratha banaya tha, 2 khaye with curd",
  "I fainted after lunch and have chest pain",
  "3 din se kuch nahi khaya, bas pani piya",
];

async function viaLive(text, base) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(base + "/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "meal", text }) });
    if (r.ok) return r.json();
    if (attempt < 2) await new Promise(res => setTimeout(res, 3000)); // Google can be briefly busy
    else { const b = await r.text(); throw new Error("status " + r.status + " " + b.slice(0, 120)); }
  }
}

async function viaAI(text) {
  let out; const res = { status(c) { this.c = c; return this; }, json(o) { out = o; return this; }, setHeader() {} };
  await handler({ method: "POST", body: { mode: "meal", text } }, res);
  if (res.c !== 200) throw new Error("status " + res.c);
  return out;
}

(async () => {
  const mode = process.argv[2], live = mode === "ai" || mode === "live";
  const base = (process.argv[3] || "https://thali-talk.vercel.app").replace(/\/$/, "");
  console.log("| # | Input | What the " + (live ? "AI" : "offline demo parser") + " did |");
  console.log("|---|---|---|");
  for (let i = 0; i < INPUTS.length; i++) {
    let r;
    try { r = mode === "live" ? await viaLive(INPUTS[i], base) : mode === "ai" ? await viaAI(INPUTS[i]) : Engine.demoParse(INPUTS[i]); } catch (e) { r = { error: e.message, items: [] }; }
    let d;
    if (r.error) d = "ERROR " + r.error;
    else if (r.redFlag) d = "Stopped, told user to see a doctor / someone they trust. No logging.";
    else if (!r.items.length) d = "Found nothing. " + (r.when === "yesterday" ? " · saved under **yesterday**" : "") + (r.clarify ? '"' + r.clarify.question + '"' : "");
    else {
      const t = Engine.totals(r.items);
      d = r.items.map(x => x.qty + " " + x.unit + " " + x.name + " (" + x.kcal + ", " + x.confidence + ")").join("; ") + " → **" + t.kcal + " kcal (" + t.low + "–" + t.high + ")**" + (r.clarify ? ' · asked: "' + r.clarify.question + '"' : "");
    }
    console.log("| " + (i + 1) + " | " + INPUTS[i] + " | " + d + " |");
  }
})();
