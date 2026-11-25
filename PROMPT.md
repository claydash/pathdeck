# PathDeck — build prompt

Build a live, top-tier study web app for 2nd-year MBBS general pathology (Robbins & Cotran / Robbins Basic Pathology, cross-checked with Harsh Mohan), plus the student's own gross-specimen museum set. Quality bar: Anki's scheduler + AMBOSS/UWorld-style question bank + Duolingo-style streak, in one clean app that works on a phone.

## Who it is for
An Indian MBBS student preparing for university theory, viva and practical (spotters) exams. They want to open it every day, finish today's cards in 10 minutes, do a block of MCQs, and fix their mistakes.

## Topics (NMC CBME competency headings)
1. Cell injury and cell death (PA2.1–2.5, PA2.8): causes, mechanisms (ATP depletion, mitochondrial damage, Ca2+, ROS, membrane damage, DNA/protein damage), reversible vs irreversible injury, necrosis patterns (coagulative, liquefactive, caseous, fat, fibrinoid, gangrenous), apoptosis (intrinsic/extrinsic pathways), necroptosis, pyroptosis, ferroptosis, autophagy, ischemia-reperfusion, intracellular accumulations (steatosis, cholesterol, hyaline, glycogen, pigments: lipofuscin, hemosiderin, melanin, bilirubin), pathologic calcification (dystrophic vs metastatic).
2. Cellular adaptations (PA2.6): hypertrophy, hyperplasia, atrophy, metaplasia; dysplasia as the bridge to neoplasia.
3. Cellular aging (PA2.7): DNA damage, telomere shortening, senescence, defective protein homeostasis, nutrient sensing (IGF-1, sirtuins, caloric restriction), progeria/Werner syndrome.
4. Inflammation (PA4.1–4.4): acute inflammation (vascular changes, leukocyte recruitment, phagocytosis, NETs), mediators (vasoactive amines, arachidonic acid metabolites, cytokines, complement, kinins), morphologic patterns (serous, fibrinous, purulent, ulcer), outcomes, chronic inflammation (macrophages, lymphocytes), granulomatous inflammation, systemic effects (acute-phase response, fever, leukocytosis, sepsis).
5. Tissue repair (PA5.1): regeneration, stem cells, cell cycle, growth factors, ECM, scar formation, angiogenesis, healing by first and second intention, factors affecting healing, abnormal repair (keloid, hypertrophic scar, exuberant granulation, contracture), fibrosis.
6. Neoplasia (PA7.1–7.5): nomenclature, benign vs malignant, differentiation and anaplasia, metastasis routes, epidemiology, hallmarks of cancer, oncogenes, tumor suppressors (RB, TP53, APC), evasion of apoptosis, limitless replication, angiogenesis, invasion/metastasis, immune evasion, Warburg effect, genomic instability, carcinogenic agents (chemical, radiation, viral — HPV, EBV, HBV/HCV, HTLV-1, H. pylori), host effects (cachexia, paraneoplastic syndromes), grading and staging, laboratory diagnosis, tumor markers.
7. Gross specimens (spotters): the 35 museum jars from the student's own PDF, with corrected, exam-ready descriptions.

## Content rules (accuracy is the product)
- Every fact must match Robbins Basic Pathology (current edition) or Robbins & Cotran; where Harsh Mohan differs in emphasis, Robbins wins.
- No fabricated page numbers. Cite as "Robbins Basic Pathology, ch. N (Topic)".
- MCQs: single best answer, 4 options, one unambiguous key, plausible distractors from the same family, no "all of the above". Each topic ≥ 20 questions split easy / medium / hard (hard = two-step reasoning or clinical vignette). After answering: 2–4 sentence explanation that says why the key is right and why the strongest distractor is wrong, plus "Read next" related topics.
- Flashcards: one fact per card, front is a question (not a title), back ≤ 40 words. Image cards use the specimen photos.
- Images: only the student's own specimen photos and openly licensed micrographs (Wikimedia Commons, CC BY / CC BY-SA / public domain) with attribution. Never copy figures from Robbins or Harsh Mohan (copyright).

## Features
- **Today** dashboard: streak flame, XP, cards due, new cards for today, MCQ accuracy, 16-week activity heatmap, next actions.
- **Flashcards (spaced repetition)**: Anki-style scheduler (SM-2 family with learning steps 1m/10m, graduating 1d, easy 4d, ease factors, lapses → relearning). New cards are released daily (default 20/day, adjustable). Buttons show the next interval (Again <1m · Hard 6m · Good 10m · Easy 4d). Keyboard: space to flip, 1–4 to grade. Separate **Review** column = cards due again.
- **MCQ bank**: filter by topic, sub-heading and difficulty; tutor mode (instant explanation) and test mode (timed block, review at end). Shows explanation + "Read next" after each answer.
- **Mistakes**: every wrong MCQ lands here with your answer vs the key; re-attempt; removed after 2 correct re-attempts in a row; can also be sent to flashcards.
- **Specimens (museum)**: gallery of jars, tap for gross features + key associations + viva questions; spotter quiz mode ("identify this jar").
- **Scoreboard/streak**: daily goal (finish due cards), streak counter with freeze-free honesty, best streak, XP, badges at 3/7/30/100 days.
- Progress saved in the browser (localStorage) with export/import backup. No login needed.
- Works offline-friendly, mobile-first, light + dark theme, keyboard shortcuts on desktop.

## Ship
Static site (no build step), GitHub repo `claydash/pathdeck`, deployed on Vercel.
