# Report: Thali Talk

**[YOUR FULL NAME] · Roll No. [ROLL NUMBER]**

> **Before you submit, search this file for `[[` and `[YOUR`.** Those are the parts only you can supply: the three interviews, the user test, your name and signature, and the live-AI test run. I have left them blank on purpose rather than invent them. Delete this note when done.

## Q1. Why do health apps fail?

**Evidence base.** (a) 116 one- and two-star App Store reviews from India, pulled from Apple's public review feed: 35 for HealthifyMe and 81 for MyFitnessPal, the most recent ones available on 28 Oct 2026. I read every one and tagged each with the reasons it gave; the tagged file is [`docs/review-coding.csv`](docs/review-coding.csv). A review can carry more than one tag, and 6 fit none. (b) Published sources, listed in References. (c) Three people who tried a health app and stopped: **[[Interview 1, 2, 3: one line each, who they are, which app, how long they lasted, why they stopped. Use `docs/interview-and-test-guide.md`.]]**

| Reason found in the reviews | Reviews (of 116) |
|---|---|
| Paywall, surprise charges, hard-sell, ads | 37 |
| Crashes, freezes, sign-up or login failures | 39 |
| Logging is slow or awkward; numbers wrong or Indian food missing (union of two tags) | 24 |
| Sync with watch, scale or health app broken | 9 |
| Data lost, or privacy worry | 7 |
| Support does not answer | 5 |

**Caveat on the method.** Low-star reviews over-represent people who hit a bug or a bill. People who quietly drift away after three weeks rarely write a review at all. So raw counts are not the ranking; I weighed them against the research and the interviews.

**My three most important reasons, ranked:**

1. **Logging costs more effort than it gives back, especially for Indian home food.** Only 24 reviews say it outright, but it is what the research points at. Studies of digital self-monitoring link lower-burden tools to more consistent logging and a longer time before dropout, and logging adherence in nutrition apps falls steadily with time [2]. One 2021 comparison nuances this: a plain food-database app was easier to *remember* to use than photo or wearable logging, so burden is not the only factor and habit matters too [1]. The reviews say it in the users' words: "Lacks accurate data on Indian food", "only shows predefined options", the new recipe flow "only added through AI is a headache", "the update has made it impossible to quickly add your food". Even AI food tools struggle with mixed dishes (beef pho overestimated by 49% in one 2024 study) [4], and a thali is exactly a mixed dish. Retention data fits: about 3–8% of health and fitness app users are still active at day 30 [3].
2. **The app asks for money before it has earned trust.** The largest single complaint (37 reviews). Features that used to be free become paid ("Insights are now premium", "I'm not even able to add 1 meal without paying"), trials that bill immediately, refunds refused, and constant upsell. This kills the habit at the exact moment a beginner is deciding whether it is worth it. It confirms H2 and H3 from class, but with a twist: people do not object to paying, they object to paying *before* it works.
3. **One broken day breaks the whole system.** Not only crashes (39 reviews, plus 7 about lost data: "lost all data from last 2 years"), but all-or-nothing design: a rigid daily budget that does not adapt ("my calorie budget's still 1,500" after a workout) and a missed day that feels like failure. Research on weight tracking found people stop weighing in after their weight creeps up, i.e. when feedback turns unwelcome (Withings app data) [[confirm which reference this is: I believe it is the JMIR 2020 paper, ref 2]]. An app that scolds you for a bad day teaches you to stop opening it.

**Class hypotheses.** H1 (too complex) is supported (logging, new UIs). H2 and H3 supported as above. H4 (too wordy) I could not test from reviews: none mentions it, so I treat it as a design rule for my own app (short answers) rather than a finding.

## Q2. Who exactly is your customer?

**Neha, 34**, a business analyst at an IT firm in Pune. She eats home-cooked food: roti, dal, sabzi, rice, curd, packed in a tiffin or served by her mother-in-law, with chai and a samosa at 4 pm. She wants to lose about 6 kg slowly and keep it off, and she is tired of feeling that the diet is "always starting Monday". She has tried a popular calorie app twice. It wanted her to search "dal", choose between 30 entries, and guess grams for a katori; by day 10 she was logging dinner from memory at midnight; after one heavy weekend (a wedding) her budget showed red, she felt it was pointless, and she stopped. The next time the paywall arrived before the useful feature. She is not looking for coaching or a community; she wants to *say* what she ate and be left in peace.

> *Neha is a composite built from the reviews and my interviews: [[after your interviews, say which details come from which person, and edit Neha to match the real people. Do not leave invented details you cannot back up.]]*

**Customers I considered and rejected:**

- **Students and under-25s (class group 1).** Churn is high and willingness to pay is low, so they will not keep a product alive. More importantly, I found no review-level reason for the product to be different for them, so I would be building a generic app.
- **Adults over 60 (class group 2).** The need is real, but it collides with the safety line the brief draws: they are more likely to have a condition or medication, and the right answer is often "ask your doctor", which a no-advice app can only say, not solve. They also need caregiver consent flows (F17) that a one-person project cannot build safely. A strong future version for a second release.
- **Gym-goers who want macros.** Well served by existing apps; "show macros free" was a complaint, but this person tolerates logging effort and a thali-first product would not win them.

**How this follows from Q1.** Neha is the person Q1's reasons #1 and #3 describe: Indian home food (reason 1), where the effort of logging beats the payoff; and a person who stops at the first bad day (reason 3). Reason 2 shapes the business choice: it is free, and nothing is paywalled.

## Q3. What does AI do in my app that ordinary software could not?

**The core idea.** The form is gone. Neha types or speaks, in English, Hindi or Hinglish, exactly as she would tell a friend: *"aaj lunch me 2 roti, dal aur thodi sabzi, ek katori dahi"*. The AI reads it, works out the dishes and portions, gives a calorie *range* with a confidence level, states every assumption, and asks at most one question, and only when the answer would change the total by more than ~150 kcal. The same applies to the onboarding: one sentence replaces a profile form.

**What the AI decides, does on its own, and must never do:**

| | |
|---|---|
| **Decides** | Which dishes were eaten; a realistic portion; a kcal estimate with a low–high range; whether one question is worth asking. |
| **Does on its own** | Translates Hinglish and vague words (*thodi*, *bada*, *zyada*) into quantities; fills gaps with a stated assumption; flags low confidence; adds a warm one-line note; stops and points to a doctor on red-flag text. |
| **Must never** | Diagnose or prescribe; set a budget below 1,200 kcal; tell the user to eat less; scold; claim precision; invent a dish not mentioned; handle a stated health condition beyond logging the food. |

**Where AI does not do the work, on purpose.** All budget arithmetic (the "catch-up" in F09) is plain code in `engine.js`: going over trims the next three days by at most a third of the overage, at most 150 kcal a day, at most 250 in total, never below 1,200, and eating less never earns extra. A language model should interpret messy input, not be trusted with numbers the user relies on. A rule-based **red-flag check runs before the AI** and cannot be skipped, so safety does not depend on the model behaving.

**Proactive behaviour.** The app opens with a check-in chosen by the time of day and the day's log ("Lunch kaisa raha?" after 2 pm with nothing logged; a reassuring note after a heavy day). A web app cannot push a notification when closed, so this is *in-app* proactivity only. This is a limit I accept (see hardest calls).

**Test results.** Ten realistic inputs, including ones I expected to fail. The table below is from the **offline fallback parser** (the version the live app uses if the AI is unreachable), which I could run myself. I then ran four of the same inputs through the **live AI** (Gemini, via the deployed app, 30 Oct 2026), shown in the next table. **[[Run the other six inputs through the live AI (`GEMINI_API_KEY=... node tests/run-tests.js ai`), add them to the live table, and check my "Good enough?" judgements against a food-composition table such as IFCT 2017 [5]. They are my own judgement, not a measurement.]]**

| # | Input | What the offline parser did | Good enough? |
|---|---|---|---|
| 1 | aaj lunch me 2 roti, dal aur thodi sabzi, ek katori dahi | 2 roti, 0.5 katori sabzi, 1 katori dahi, assumed 1 katori dal → 445 kcal (323–567) | Yes. It said the dal was an assumption. |
| 2 | subah 2 idli sambar aur ek cutting chai | 2 idli, 1 katori sambar (as dal), 1 cup chai → 330 kcal | Mostly. Sambar approximated by dal. **Fixed a bug:** it first gave the "2" to sambar. |
| 3 | ghar ka thali tha, chawal zyada khaya | Thali 700 + a separate rice 195 → 895 kcal, asked one question | **No.** Counts rice twice; "zyada" not understood. A real failure of the rule-based parser. |
| 4 | ek bada samosa aur chai | 1 samosa sized ×1.4 → 364; chai 80 → 444 kcal | Yes. **Fixed:** it first showed "1.4 pieces". |
| 5 | pav bhaji khayi office ke bahar, butter wali | 520 kcal (364–676); asked about portion | Partly. It ignores "butter wali", which adds calories; range is wide but honest. |
| 6 | kal raat kuch halka khaya, khichdi jaisa | 1 katori khichdi, 180 kcal; asked about portion | Partly. "Kal raat" (yesterday) is not understood, so it logs to today. |
| 7 | had maggi and a coke around 4pm | 350 + 140 = 490 kcal; asked about portion | Yes. |
| 8 | mummy ne aloo paratha banaya tha, 2 khaye with curd | 2 paratha 440 + curd 90 → 530 kcal | Yes after fixing "quantity after the food". "Aloo" stuffing is treated as the generic paratha. |
| 9 | I fainted after lunch and have chest pain | Stopped: tells user to see a doctor. No logging. | Yes. This is the intended behaviour. |
| 10 | 3 din se kuch nahi khaya, bas pani piya | Stopped, kind message to talk to a doctor or someone they trust | Yes. |

**Live AI, same inputs (four of ten so far).** Screenshots from the live app; kcal and ranges as returned.

| # | Input | What the live AI did | Good enough? |
|---|---|---|---|
| 1 | aaj lunch me 2 roti, dal aur thodi sabzi, ek katori dahi | 2 roti 210, 1 katori dal 130, 1 katori sabzi 130 (low confidence, "assumed 1 katori"), 1 katori dahi 100, each with a range and assumption | Mostly. **Miss:** "thodi" (a little) sabzi became a full katori; the offline parser had 0.5. It did flag low confidence. |
| 3 | ghar ka thali tha, chawal zyada khaya | Rice 2 katori (extra, as asked) 300 + dal 130 + sabzi 120 → **550 kcal (430–670)** | Better than offline (which counted rice twice, 895). **But** it invented dal and sabzi the user never named and added no roti. |
| 5 | pav bhaji khayi office ke bahar, butter wali | "Pav bhaji with extra butter", 550 kcal (450–650) | Partly. It noticed the butter, which offline missed, but only about 30 kcal above the plain version; street pav bhaji with extra butter is probably higher. Its note claimed it "counted the extra calories", which overstates. |
| 6 | kal raat kuch halka khaya, khichdi jaisa | 1.5 katori khichdi, 220 kcal (180–260) | **No on timing.** It did not understand "kal raat" (last night), so the meal would be saved under today. Portion plausible. |

**What this shows.** The live AI beat the rule-based parser on the double-counted thali (3) and the butter (5), which is the case for using AI here. It also failed in ways the user could be misled by: it quietly guessed portions and dishes (1, 3), probably under-counted (5), and missed the date (6). Its notes also drifted into judging food ("Good home meal!"), which cuts against the no-scolding design.

**What I changed because of this.** (a) The AI now returns a `when` field, so "kal raat" saves under yesterday, with a visible "This will be saved under yesterday" line. (b) The prompt now forbids judging or praising food and asks for neutral, short notes. **[[Re-run inputs 1, 3, 5 and 6 on the live app after these changes and say whether they improved. Add a screenshot if you can.]]**

## Q4. What I will build, and what I will leave out

| ID | Feature | Decision | Reason |
|---|---|---|---|
| F01 | Food photo to calories | **Later** | Photos of mixed dishes are where AI calorie tools fail most [4]; text/voice is cheaper, and a user can describe a plate better than a model can see it. Photo comes after text is proven. |
| F02 | Profile and goals | **Build now** (one sentence) | Replaces the form. The "reference image of how I want to look" part is **Never**: likeness and copyright (D09) and body-image risk. |
| F03 | Activity tracking | **Later** | A browser cannot read steps; needs F11. Not what made Neha quit. |
| F04 | Diet plan | **Build now, budget only** | A daily kcal budget, not a prescribed meal plan: the app must not prescribe. A full plan is Later. |
| F05 | Progress tracker | **Build now** | The bar plus 7 days, drawn as a range. Supplement sales and reward points are **Never**: a conflict of interest and a health-claims risk. |
| F06 | Sleep tracking | **Never** | Not part of Neha's problem; adds data and cost. |
| F07 | Challenges and motivation | **Never** | Streaks and challenges make a missed day feel like failure (Q1 reason 3). |
| F08 | AI health coach | **Build now, reframed** | Not an open chatbot: the one-box logger plus check-ins. Free chat is Later. |
| F09 | Catch-up planning | **Build now** | The heart of reason 3: the plan bends after a heavy day. Done in code, not by the model. |
| F10 | Reports | **Later** | Nobody quit because of missing reports. |
| F11 | Wearables | **Later** | D05; the review data shows sync is a source of failure (9 reviews). |
| F12 | Subscription tiers | **Never (for now)** | Reason 2. Free; revenue is out of scope for this prototype. |
| F13 | Free consultation | **Never** | A medical-liability promise a prototype cannot keep. |
| F14 | Community activities | **Never** | Wrong problem; needs partnerships. |
| F15 | Emergency: hospital | **Never** | The app must not pretend to handle emergencies; it only tells the user to seek care. |
| F16 | Emergency: caretaker or nurse | **Never** | As F15. |
| F17 | Guardian access | **Later** | Fits the over-60 customer I deferred; privacy-heavy. |
| F18 | Friends groups | **Never** | Public comparison and rating invite shame; Neha wants to be left alone. |
| N01 | Rule-based red-flag guard | **Build now** | Safety must not depend on the model. |
| N02 | Ranges and stated assumptions | **Build now** | Answers D06 (accuracy) honestly. |
| N03 | Offline fallback mode | **Build now** | Answers D08 (connectivity) and the brief's demo-mode rule. |
| N04 | No-scolding tone, no red | **Build now** | Reason 3. |
| N05 | Edit a logged meal | **Build now** | My live tests showed the AI quietly guessing portions ("thodi sabzi" became a full katori); the user must be able to correct it in two taps. |
| N06 | "Again" and recent-meal chips | **Build now** | People eat the same few meals; one tap removes most of the logging effort (Q1 reason 1). |
| N07 | Water counter | **Build now** | Part of F04. A plain tap counter with no medical target, so no health claim. |
| N08 | Weekly summary in words, and CSV export | **Build now** | A light version of F10: no scores or streaks. Export keeps the data in the user's hands (D07). |

Of the class's concerns, D02, D03, D04, D05 and D10 mostly disappear by choosing one customer and a small feature set.

**The core experience.** *First two minutes:* open the link, see the safety notice, type one sentence about yourself (or skip), land on "Today". Say what you ate. See what was understood, with ranges and assumptions, tap one size if asked, save. *A normal day:* open the app, answer the day's check-in if you like, speak or type each meal in a few words, and glance at the bar. After a heavy day the budget quietly adjusts. Screenshots: ![Start](docs/screenshots/01-onboarding.png) ![Today and the week](docs/screenshots/02-today-week.png) ![Meal understood](docs/screenshots/03-result.png) ![Red flag](docs/screenshots/04-redflag.png)

**My three hardest calls:**

1. **Cut photo logging, the class's headline feature.** *Weighed:* it is the demo that wins a room; it is also where mixed-dish accuracy is worst [4]. *Chose:* text and voice first. *Would change my mind:* if my user test shows people will not type or speak a meal but will tap a camera, or if a published test shows a model doing well on Indian thalis.
2. **Keep the AI away from the budget numbers.** *Weighed:* letting the model "coach" is more impressive and more flexible. *Chose:* a transparent rule in code, because a wrong number the user trusts is worse than a rigid but explainable one. *Would change my mind:* if users find the fixed catch-up rule unfair or unclear.
3. **Proactive, but only inside the app.** *Weighed:* real push notifications make the product "reach out", but need a native app or a push service, accounts and consent. *Chose:* time-aware check-ins when the app is open, and say so plainly. *Would change my mind:* if testers never open the app unprompted, then the proactivity is not real and push becomes the first thing to build.

## Q5. User test

**Build.** Static front end plus one serverless function (`api/analyze.js`) on Vercel; the API key is a host environment variable and is never in the repository. If the AI is down or no key is set, the app falls back to the offline parser and says "Offline demo mode". Data lives only in the user's browser. Live app: see README.

**[[Who tested it (not you, someone like Neha), what they did, what confused them, and what you changed. At least one person. Use the script in `docs/interview-and-test-guide.md`. Describe real observations. If a change came from the test, link the commit.]]**

## References

1. [[Confirm and complete before submitting]] 2021 review and case study comparing a standard food-database app with lower-burden wearable and photo-based logging, *Journal of Technology in Behavioral Science*. https://ifp.nyu.edu/2021/journal-article-abstracts/s41347-021-00203-9/ (accessed 28 Oct 2026)
2. [[Confirm authors/title]] Study of declining motivation and negative weight feedback before users stop self-weighing (Withings data), *Journal of Medical Internet Research* 22(3):e15790, 2020. https://www.jmir.org/2020/3/e15790
3. Business of Apps, "Health & Fitness App Benchmarks", citing AppsFlyer and Adjust 30-day retention (about 3% and 8%). https://businessofapps.com/data/health-fitness-app-benchmarks (accessed 28 Oct 2026). Cross-check: Apptopia, https://apptopia.com/blog/we-know-you-didnt-keep-your-new-years-resolutions/
4. [[Find the primary paper]] Charles Perkins Centre (University of Sydney) study on AI food-tracking apps and mixed Asian dishes, reported 2024: https://globalneurologyacademy.org/news/ai-food-tracking-apps-need-improvement-to-address-accuracy-cultural-diversity/2468077/
5. Longvah T. et al., *Indian Food Composition Tables 2017*, National Institute of Nutrition, Hyderabad (for checking estimates).
6. Apple customer-review RSS feed for HealthifyMe (id 943712366) and MyFitnessPal (id 341232718), India store, accessed 28 Oct 2026.

---

## Student declaration

1. This submission is my own work, except where I have cited the work of others.
2. I have not submitted this work, in whole or in part, for assessment in any other course.
3. I have used generative AI tools only as permitted by the project brief, and I have disclosed that use below.

**Name:** [YOUR NAME] · **Roll No.:** [ROLL NO] · **Date:** [DATE]

**AI-use disclosure**

| Tool used | What it was used for | How I checked its output |
|---|---|---|
| Claude (Claude Code) | Proposed the customer, feature decisions and app design; wrote the app code and the first draft of this report; searched for and summarised published sources. | [[Edit to match what you really did. Examples: read the code and ran it; ran the 10-input test and found and fixed 3 bugs; opened the cited links; read all 116 reviews myself; compared my interviews with the draft.]] |
| Google Gemini API | Runs inside the app: turns a typed or spoken meal into structured items and kcal ranges. | Ran the 10-input test through it and judged each result by hand; output is validated and clamped in `api/analyze.js`; the red-flag rules run before it. |
| Apple review feed (not AI) | Source of the 116 reviews. | Spot-checked tags against the originals in `docs/review-coding.csv`. |
