// Vercel serverless function. The API key lives only in the host's environment variables.
// POST { mode: "meal" | "profile", text, hour? }  ->  JSON (see SYSTEM_MEAL for the shape)
const Engine = require("../public/engine.js");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_CHARS = 600;

const SYSTEM_MEAL = `You are the food-logging brain of "Thali Talk", an app for Indian adults who eat mostly home-cooked food.
The user types or dictates, in English, Hindi or Hinglish, what they ate. Turn it into a structured log.

You DECIDE: which dishes were eaten, a realistic portion, and a kcal estimate WITH a range for home-cooked Indian food (assume typical home cooking, 1 katori = ~150 g cooked, 1 roti = ~30 g).
You do on your own: translate messy speech into items, fill missing portions with a stated assumption, and flag low confidence.
You ask ONE clarifying question only if the answer would change the total by more than ~150 kcal; otherwise you assume and say so. Never ask more than one question.
You NEVER: diagnose, prescribe, give medical advice, tell anyone to eat less than they want, shame or scold, claim precision (always give ranges), or invent a dish that wasn't mentioned.
If the text describes a red-flag symptom (chest pain, fainting, blood, breathlessness), self-harm, or not eating for days / purging, return items=[] and set red_flag to a short kind message telling them to see a doctor or someone they trust.
If it mentions diabetes, pregnancy, kidney disease or medication, still log the food but set note to: "Please follow your doctor's advice for your condition."
"note" is optional, max 18 words, plain and warm, no lecture. Respond ONLY with JSON, no markdown:
{"items":[{"name":str,"qty":number,"unit":str,"kcal":int,"kcalLow":int,"kcalHigh":int,"confidence":"high"|"medium"|"low","assumption":str}],
 "clarify":null|{"question":str,"options":[str,str,str]},
 "red_flag":null|str,
 "note":str}`;

const SYSTEM_PROFILE = `Read a short self-description from an Indian adult setting a gentle health goal. Extract only what is stated.
Respond ONLY with JSON: {"age":int|null,"kg":number|null,"cm":number|null,"sex":"m"|"f"|null,"goal":"lose"|"maintain"|"gain","veg":boolean}.
Never infer a medical condition. Never invent values.`;

async function callClaude(system, text) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: "user", content: text }] }),
  });
  if (!r.ok) throw new Error("upstream " + r.status);
  const j = await r.json();
  const raw = (j.content || []).map(c => c.text || "").join("");
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no json");
  return JSON.parse(m[0]);
}

function cleanMeal(o) {
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 15).map(i => {
    const kcal = Math.max(0, Math.round(+i.kcal || 0));
    return {
      name: String(i.name || "food").slice(0, 60), qty: +i.qty || 1, unit: String(i.unit || "serving").slice(0, 30), kcal,
      kcalLow: Math.max(0, Math.round(+i.kcalLow || kcal * 0.8)), kcalHigh: Math.round(+i.kcalHigh || kcal * 1.2),
      confidence: ["high", "medium", "low"].includes(i.confidence) ? i.confidence : "medium",
      assumption: String(i.assumption || "").slice(0, 120),
    };
  });
  const c = o.clarify && o.clarify.question ? { question: String(o.clarify.question).slice(0, 120), options: (o.clarify.options || []).slice(0, 3).map(String) } : null;
  return { items, clarify: c, redFlag: o.red_flag ? String(o.red_flag).slice(0, 300) : null, note: String(o.note || "").slice(0, 160), source: "ai" };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ ai: !!process.env.ANTHROPIC_API_KEY }); // free health check
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const text = String(body.text || "").slice(0, MAX_CHARS).trim();
  if (!text) return res.status(400).json({ error: "empty" });
  // Safety check runs before and independent of the model.
  const flag = Engine.redFlag(text);
  if (flag && !flag.soft) return res.status(200).json({ items: [], clarify: null, redFlag: flag.message, note: "", source: "rules" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "ai_unavailable" });
  try {
    if (body.mode === "profile") {
      const p = await callClaude(SYSTEM_PROFILE, text);
      p.target = Engine.estimateTarget(p); p.source = "ai";
      return res.status(200).json(p);
    }
    const out = cleanMeal(await callClaude(SYSTEM_MEAL, text));
    if (flag && flag.soft && !out.note) out.note = flag.message;
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: "ai_failed" });
  }
};
