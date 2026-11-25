# PathDeck

Study app for MBBS general pathology (Robbins): spaced-repetition flashcards, graded MCQs with explanations, a mistakes log, a daily streak scoreboard and a gross-specimen museum.

- Topics: cell injury & cell death, adaptations, aging, inflammation, repair, neoplasia (NMC CBME PA2–PA7), plus 42 museum specimens and 18 histology images.
- Static site, no build step. Content lives in `content/*.json`; progress is saved in the browser (export/import on the Scoreboard page).
- Images: class specimen photos and openly licensed micrographs from Wikimedia Commons (credited in the app). No textbook figures are reproduced.

Run locally: `python3 -m http.server` and open http://localhost:8000.
