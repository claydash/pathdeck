# PathDeck v2 — build prompt

Turn PathDeck from a single-topic study page into a multi-subject study platform that a whole MBBS batch can use, with accounts, synced progress, "practise again", and analytics that tell each student where to focus. Quality bar: Anki's scheduler, AMBOSS's question flow, Duolingo's habit loop, Linear/Notion-level polish.

## 1. Content system that scales
- One manifest (`content/manifest.json`) lists subjects → sections → chapters. Adding a chapter = drop one JSON file in `content/<subject>/` and add its id to the manifest. No code changes.
- One chapter schema for everything: `title, competency, ref, subtopics[], mcqs[], cards[]`, plus optional `specimens[]` (museum jars with photos, gross features, viva) and `images[]` (micrographs with captions and licences). Spotter and histology questions are generated from those automatically.
- `node scripts/build.mjs` validates every file (unique ids, 4 options, key in range, every sub exists, counts) and writes `content/index.json` with counts so the app can show the library without loading every file.
- Ids are namespaced internally as `subject/chapter:id`, so two chapters can reuse "q-001" safely. Old v1 progress migrates automatically.
- The app loads only the active subject's chapters. A subject switcher sits in the sidebar.
- `CONTENT.md` explains the format with a copy-paste template.

## 2. Accounts and sync (Firebase)
- Sign in with Google, or with email + password (create account, sign in, reset password). Guest mode keeps working with no account.
- Local-first: everything saves to the device instantly and syncs to Firestore when signed in (debounced). On sign-in, local and cloud progress are merged item by item (newest wins), so nothing is lost when a guest creates an account or a student switches between phone and laptop.
- Firestore layout: `users/{uid}` (profile, XP, streak log, settings, badges) and `users/{uid}/subjects/{subjectId}` (cards, MCQ history, mistakes, custom cards). Security rules: each user reads and writes only their own documents.

## 3. Practise again
- Every chapter has a page with: study its cards, practise its MCQs, **redo all questions** (ignores history), **practise cards without changing the schedule** (cram mode), **reset flashcards** (back to new), **reset MCQ history**.
- Quiz results offer: redo this block, redo only the wrong ones, practise the weakest heading.

## 4. Analytics ("Insights")
- Per chapter and per competency heading: questions attempted, accuracy (recent attempts weighted more), card retention (how often reviews are forgotten), coverage (cards seen, questions tried), open mistakes.
- A mastery score per chapter (0–100) and a ranked **Focus next** list with the reason ("41% on 12 questions", "you forget 1 in 3 cards") and a one-tap action.
- Accuracy by difficulty, a 14-day accuracy and volume trend, study time.
- Every quiz ends with its own mini-analysis: by heading, by difficulty, and what to practise next.

## 5. Look and feel
- Keep the H&E identity (hematoxylin purple + eosin pink) and the existing layout; raise the polish: a welcome/onboarding screen, account menu, a Library of chapter cards with progress rings, ⌘K search across chapters, specimens and cards, smooth transitions, a small celebration when the daily goal is hit, skeleton loading, clean empty states, phone-first layouts, light and dark themes.

## 6. Ship
Static ES modules (no build step for the app), Firebase JS SDK from the official CDN, Vercel hosting on the same URL, public repo `claydash/pathdeck`. Test every flow (guest, sign-up, sync across reloads, reset, analytics) before deploying.
