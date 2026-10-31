# Thali Talk

**Prathmesh Pratap Pawar** · Roll No. **PGDMAI-25-06** · MAI-594 Introduction to Vibe Coding · AY 2026–27

> **For urban Indian adults who eat mostly home-cooked food and keep quitting calorie apps: say what you ate, in Hinglish or English, and Thali Talk does the logging and the maths, with honest ranges, no paywall and no scolding.**

- **Live app:** https://thali-talk.vercel.app
- **Report:** [REPORT.md](REPORT.md)

**Not medical advice.** Made-up data only. It does not diagnose or prescribe and points to a doctor on red-flag symptoms.

## What it does

- **Type or speak a meal** ("aaj lunch me 2 roti, dal aur thodi sabzi") and get items, portions, a kcal *range*, a confidence level and every assumption stated. At most one clarifying question.
- **One sentence replaces the profile form.**
- **Catch-up budget:** a heavy day gently trims the next three days (a third of the overage, ≤150 kcal/day, never below 1,200). Plain code, not the AI.
- **Safety:** a rule-based red-flag check runs before any AI call.
- **Offline fallback:** if the AI is down or no key is set, a built-in parser answers and the badge says "Offline demo mode".

## Run it

```bash
cd public && python -m http.server 8000   # offline demo mode, no key needed
node tests/run-tests.js                   # the 10-input test, offline parser
node tests/run-tests.js live             # same inputs through the deployed app (no key needed on your computer)
```

## Deploy (Vercel, free)

1. Push this repo to a **public** GitHub repository.
2. On vercel.com choose **Add New → Project**, import the repo, keep defaults (`vercel.json` sets the output folder to `public`).
3. Add environment variable `GEMINI_API_KEY` (from Google AI Studio; set a low quota or spend cap). Optionally `GEMINI_MODEL`.
4. Redeploy, open the link in a private window, and confirm the badge says **AI on**.

No key is ever committed (`.gitignore` blocks `.env*`).

## Layout

| Path | What |
|---|---|
| `public/` | The app (HTML/CSS/JS). `engine.js` holds safety rules, the offline parser and the budget maths |
| `api/analyze.js` | Serverless function that calls the AI; key stays on the server |
| `tests/run-tests.js` | The 10 realistic inputs for the report |
| `docs/` | Class notes, tagged review data (`review-coding.csv`), screenshots, interview guide |

## Credits

- No third-party libraries or images. Plain HTML, CSS and JavaScript.
- AI: Google Gemini API for meal understanding; Claude Code was used to help write this code (disclosed in the report).
- Review data: Apple's public customer-review feed for HealthifyMe and MyFitnessPal (India), used for research only.
- Calorie values in the offline parser are rough home-cooking estimates for a demo, not clinical data.
