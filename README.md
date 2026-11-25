# PathDeck

Study platform for MBBS subjects, starting with pathology (Robbins): spaced-repetition flashcards, graded MCQs with explanations, a mistakes log, "practise again" (redo questions, cram cards, reset chapters), a specimen museum, streaks, and Insights that rank what to revise next. Optional Google / email accounts sync progress across devices (Firebase).

- **Content** lives in `content/` — one JSON file per chapter, listed in `content/manifest.json`. See [CONTENT.md](CONTENT.md) to add chapters or whole subjects without touching code; `node scripts/build.mjs` validates everything.
- **App** is static ES modules in `js/` (no build step): `srs.js` scheduler, `store.js` local-first state and merging, `cloud.js` Firebase auth + Firestore sync, `stats.js` analytics, `views/` screens.
- **Backend**: Firebase Auth + Firestore (`firestore.rules` — each user can only read/write their own data).
- Build prompts: [PROMPT.md](PROMPT.md) (v1), [PROMPT-v2.md](PROMPT-v2.md) (v2).

Run locally: `python3 -m http.server` and open http://localhost:8000.

## License

Code is MIT (see `LICENSE`). Images keep their own terms: micrographs in `img/micro/` are from Wikimedia Commons under the licences listed in `content/micro.json`; specimen photos in `img/specimens/` come from a class museum set and are not covered by the MIT licence.

Live: https://pathdeck-lake.vercel.app
