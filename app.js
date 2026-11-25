/* PathDeck — spaced-repetition flashcards, graded MCQs, mistakes log, specimen museum.
   No build step. All progress lives in localStorage (export/import from Progress). */
(() => {
'use strict';

// ---------------------------------------------------------------- constants
const TOPICS = ['cell-injury', 'adaptations', 'aging', 'inflammation', 'repair', 'neoplasia'];
const SPECIMEN_DECK = 'specimens';
const MICRO_DECK = 'histology';
const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
const ROLLOVER_H = 4;                 // a study day starts at 4 am (like Anki)
const LEARN_STEPS = [1, 10];          // minutes
const RELEARN_STEPS = [10];           // minutes
const GRAD_IVL = 1, EASY_IVL = 4;     // days
const LEARN_AHEAD = 20 * MIN;
const STORE_KEY = 'pathdeck:v1';
const DIFFS = ['easy', 'medium', 'hard'];
const LETTERS = ['A', 'B', 'C', 'D'];

// ---------------------------------------------------------------- tiny helpers
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => Date.now();
function dayKey(ts = now()) { const d = new Date(ts - ROLLOVER_H * HOUR); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayStart(ts = now()) { const d = new Date(ts - ROLLOVER_H * HOUR); d.setHours(0, 0, 0, 0); return d.getTime() + ROLLOVER_H * HOUR; }
function addDays(key, n) { const [y, m, d] = key.split('-').map(Number); const dt = new Date(y, m - 1, d + n, 12); return dayKey(dt.getTime() + ROLLOVER_H * HOUR); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { let s = seed || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
function shuffle(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtIvl(ms) {
  if (ms < MIN) return '<1m';
  if (ms < HOUR) return Math.round(ms / MIN) + 'm';
  if (ms < DAY) return Math.round(ms / HOUR) + 'h';
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + 'd';
  if (d < 365) return (d / 30).toFixed(1).replace(/\.0$/, '') + 'mo';
  return (d / 365).toFixed(1).replace(/\.0$/, '') + 'y';
}
function plural(n, w) { return `${n} ${w}${n === 1 ? '' : 's'}`; }

// ---------------------------------------------------------------- icons
const I = {
  today: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/>',
  mcq: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4.2"/><path d="M12 17.5h.01"/>',
  mistakes: '<path d="M4 4v16"/><path d="M4 4h12l-2 4 2 4H4"/>',
  museum: '<path d="M3 21h18"/><path d="M4 10h16"/><path d="M12 3 3.5 8h17Z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  flame: '<path d="M12 2s5 5.2 5 10.2A5 5 0 0 1 7 12.5C7 9 9.5 7.6 9.5 7.6S9 10.5 11 11.5C11 7.5 12 2 12 2Z"/>',
  play: '<path d="M7 4.5v15l12-7.5Z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  retry: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/>'
};
const ico = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const FLAME_SVG = (cold) => `<svg class="flame${cold ? ' cold' : ''}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="fg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e2558a"/><stop offset=".55" stop-color="#f07a2a"/><stop offset="1" stop-color="#ffc14d"/></linearGradient></defs><path fill="url(#fg)" d="M32 4s16 14 16 30a16 16 0 0 1-32 0c0-10 7-15 7-15s-1 9 6 12c-1-13 3-27 3-27Z"/><path fill="#fff" fill-opacity=".55" d="M32 34s7 5 7 11a7 7 0 0 1-14 0c0-5 4-7 4-7s0 4 3 5c0-4 0-9 0-9Z"/></svg>`;

// ---------------------------------------------------------------- state
const defaultState = () => ({
  v: 1, created: now(), xp: 0,
  srs: {},          // cardId -> {type, step, due, ivl, ease, reps, lapses, last}
  mcq: {},          // qid -> {n, right, last, lastRight, flag}
  mistakes: {},     // qid -> {added, chosen, run, at}
  cleared: 0,
  custom: [],       // user-made flashcards (from mistakes)
  log: {},          // day -> {cards, newCards, mcq, right, xp}
  settings: { newPerDay: 20, goal: 20, order: 'syllabus', decks: null, theme: 'auto' },
  badges: {}
});
let S;
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); S = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState(); }
  catch (e) { S = defaultState(); }
  S.settings = Object.assign(defaultState().settings, S.settings || {});
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep in memory */ } }
function todayLog() { const k = dayKey(); return (S.log[k] ||= { cards: 0, newCards: 0, mcq: 0, right: 0, xp: 0 }); }
function addXP(n) { S.xp += n; todayLog().xp += n; }

// ---------------------------------------------------------------- data
const D = { topics: {}, cards: [], cardById: {}, mcqs: [], mcqById: {}, specimens: null, micro: [], decks: [] };
async function getJSON(path) { const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error(path); return r.json(); }

async function loadData() {
  const files = [...TOPICS.map(t => `content/${t}.json`), 'content/specimens.json', 'content/micro.json'];
  const res = await Promise.allSettled(files.map(getJSON));
  TOPICS.forEach((t, i) => { if (res[i].status === 'fulfilled') D.topics[t] = res[i].value; });
  const spec = res[TOPICS.length], micro = res[TOPICS.length + 1];
  if (spec.status === 'fulfilled') D.specimens = spec.value;
  if (micro.status === 'fulfilled') D.micro = micro.value;
  buildDecks();
}

function buildDecks() {
  D.cards = []; D.mcqs = []; D.decks = [];
  for (const t of TOPICS) {
    const T = D.topics[t]; if (!T) continue;
    const subTitle = Object.fromEntries(T.subtopics.map(s => [s.id, s.title]));
    D.decks.push({ id: t, title: T.title, competency: T.competency, ref: T.ref, subtopics: T.subtopics });
    T.cards.forEach((c, i) => D.cards.push({ ...c, deck: t, subTitle: subTitle[c.sub] || '', order: i }));
    T.mcqs.forEach(m => D.mcqs.push({ ...m, deck: t, subTitle: subTitle[m.sub] || '', ref: T.ref }));
  }
  if (D.specimens) {
    const items = D.specimens.items;
    D.decks.push({ id: SPECIMEN_DECK, title: 'Gross specimens', competency: 'Spotters & viva', ref: D.specimens.ref, subtopics: D.specimens.groups.map(g => ({ id: g, title: g })) });
    items.forEach((s, i) => {
      if (s.images.length && s.quizCrop) {
        D.cards.push({ id: `sp-c-${s.id}`, deck: SPECIMEN_DECK, sub: s.group, subTitle: s.group, order: i, kind: 'spotter', spec: s.id,
          front: 'Identify this specimen and give two gross features.', back: '' });
      } else {
        D.cards.push({ id: `sp-g-${s.id}`, deck: SPECIMEN_DECK, sub: s.group, subTitle: s.group, order: i, kind: 'describe', spec: s.id,
          front: `Describe the gross appearance of ${s.name.charAt(0).toLowerCase() + s.name.slice(1)}.`, back: '' });
      }
    });
    // spotter MCQs (photo, label cropped away) + association MCQs from viva
    const withPhoto = items.filter(s => s.images.length && s.quizCrop);
    withPhoto.forEach((s, i) => {
      const rnd = seeded(hash(s.id));
      const same = items.filter(o => o.id !== s.id && (o.organ === s.organ || o.group === s.group));
      const pool = shuffle(same, rnd).concat(shuffle(items.filter(o => o.id !== s.id && !same.includes(o)), rnd));
      const distract = [];
      for (const o of pool) { if (distract.length === 3) break; if (!distract.some(d => d.name === o.name)) distract.push(o); }
      const ans = hash(s.id + 'k') % 4;
      const opts = distract.map(d => d.name); opts.splice(ans, 0, s.name);
      D.mcqs.push({ id: `sp-q-${s.id}`, deck: SPECIMEN_DECK, sub: s.group, subTitle: s.group, diff: i % 3 === 0 ? 'easy' : 'medium',
        q: 'Identify this museum specimen.', img: s.images[0], crop: s.quizCrop, opts, ans,
        exp: `${s.name}: ${s.gross.slice(0, 2).join(' ')}`, related: [s.organ, s.group], ref: 'Gross specimen', spec: s.id });
    });
  }
  if (D.micro.length) {
    D.decks.push({ id: MICRO_DECK, title: 'Histology images', competency: 'Microscopy spotters', ref: 'Wikimedia Commons (open licences)', subtopics: [] });
    D.micro.forEach((m, i) => {
      D.cards.push({ id: `mi-c-${m.slug}`, deck: MICRO_DECK, sub: m.topic, subTitle: (D.topics[m.topic] || {}).title || '', order: i, kind: 'micro', micro: m.slug,
        front: 'Name the lesion in this micrograph and the feature that gives it away.', back: '' });
      const rnd = seeded(hash(m.slug));
      const others = shuffle(D.micro.filter(o => o.slug !== m.slug), rnd).slice(0, 3).map(o => o.title);
      const ans = hash(m.slug + 'k') % 4; const opts = others.slice(); opts.splice(ans, 0, m.title);
      D.mcqs.push({ id: `mi-q-${m.slug}`, deck: MICRO_DECK, sub: m.topic, subTitle: (D.topics[m.topic] || {}).title || '', diff: 'medium',
        q: 'What does this micrograph show?', img: m.file, opts, ans, exp: m.caption, related: [(D.topics[m.topic] || {}).title || m.topic],
        ref: `Image: ${m.author}, ${m.license}`, micro: m.slug });
    });
  }
  S.custom.forEach((c, i) => D.cards.push({ ...c, order: -1000 + i }));
  D.cardById = Object.fromEntries(D.cards.map(c => [c.id, c]));
  D.mcqById = Object.fromEntries(D.mcqs.map(m => [m.id, m]));
}
const deckTitle = id => (D.decks.find(d => d.id === id) || {}).title || (id === 'mine' ? 'My cards' : id);
const specById = id => D.specimens && D.specimens.items.find(s => s.id === id);
const microBySlug = slug => D.micro.find(m => m.slug === slug);

// ---------------------------------------------------------------- scheduler (Anki SM-2 family)
function newState() { return { type: 'new', step: 0, due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, last: 0 }; }
function st(id) { return S.srs[id] || newState(); }
function reviewDue(days) { return dayStart() + Math.max(1, Math.round(days)) * DAY; }
function fuzz(ivl, id) { if (ivl < 3) return ivl; const f = Math.max(1, Math.round(ivl * 0.05)); return ivl + ((hash(id + ivl) % (2 * f + 1)) - f); }

/** Returns the next state for each grade (1 again, 2 hard, 3 good, 4 easy). Pure. */
function schedule(c, grade, id, t = now()) {
  const s = { ...c, reps: c.reps + 1, last: t };
  const learning = s.type === 'new' || s.type === 'learning';
  if (learning || s.type === 'relearning') {
    const relearn = s.type === 'relearning';
    const steps = relearn ? RELEARN_STEPS : LEARN_STEPS;
    const graduateIvl = relearn ? Math.max(1, s.ivl) : GRAD_IVL;
    const lt = relearn ? 'relearning' : 'learning';
    if (grade === 1) { s.type = lt; s.step = 0; s.due = t + steps[0] * MIN; return s; }
    if (grade === 2) {
      s.type = lt;
      const cur = steps[s.step] || steps[steps.length - 1];
      const delay = s.step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : cur * (steps.length === 1 ? 1.5 : 1);
      s.due = t + delay * MIN; return s;
    }
    if (grade === 3) {
      if (s.step + 1 < steps.length) { s.type = lt; s.step += 1; s.due = t + steps[s.step] * MIN; return s; }
      s.type = 'review'; s.step = 0; s.ivl = graduateIvl; s.due = reviewDue(s.ivl); return s;
    }
    s.type = 'review'; s.step = 0; s.ivl = relearn ? graduateIvl + 1 : Math.max(EASY_IVL, graduateIvl + 1); s.due = reviewDue(s.ivl); return s;
  }
  // review card
  const elapsed = Math.max(s.ivl, (t - (c.due - s.ivl * DAY)) / DAY);
  if (grade === 1) { s.lapses += 1; s.ease = Math.max(1.3, s.ease - 0.2); s.type = 'relearning'; s.step = 0; s.ivl = 1; s.due = t + RELEARN_STEPS[0] * MIN; return s; }
  const hardIvl = Math.max(s.ivl + 1, Math.round(s.ivl * 1.2));
  const goodIvl = Math.max(hardIvl + 1, Math.round(elapsed * s.ease));
  const easyIvl = Math.max(goodIvl + 1, Math.round(elapsed * s.ease * 1.3));
  if (grade === 2) { s.ease = Math.max(1.3, s.ease - 0.15); s.ivl = hardIvl; }
  if (grade === 3) { s.ivl = goodIvl; }
  if (grade === 4) { s.ease += 0.15; s.ivl = easyIvl; }
  s.ivl = Math.min(36500, fuzz(s.ivl, id)); s.due = reviewDue(s.ivl); return s;
}
function previewLabels(id) {
  const c = st(id), t = now();
  return [1, 2, 3, 4].map(g => { const n = schedule(c, g, id, t); return n.type === 'review' ? fmtIvl(n.ivl * DAY) : fmtIvl(n.due - t); });
}
function isLearning(s) { return s.type === 'learning' || s.type === 'relearning'; }
function isDue(s, t = now()) {
  if (s.type === 'new') return false;
  if (isLearning(s)) return s.due <= t;
  return s.due < dayStart() + DAY;
}
function activeDecks() { return S.settings.decks || D.decks.map(d => d.id).concat('mine'); }
function newQueue(deckFilter) {
  const decks = deckFilter ? [deckFilter] : activeDecks();
  const pool = D.cards.filter(c => (decks.includes(c.deck) || (c.deck === 'mine' && (!deckFilter || deckFilter === 'mine'))) && st(c.id).type === 'new');
  const custom = pool.filter(c => c.deck === 'mine');
  let rest = pool.filter(c => c.deck !== 'mine');
  const deckOrder = D.decks.map(d => d.id);
  if (S.settings.order === 'mixed') {
    const by = {}; rest.forEach(c => (by[c.deck] ||= []).push(c));
    Object.values(by).forEach(a => a.sort((x, y) => x.order - y.order));
    const out = []; let added = true;
    while (added) { added = false; for (const d of deckOrder) { const a = by[d]; if (a && a.length) { out.push(a.shift()); added = true; } } }
    rest = out;
  } else {
    rest.sort((a, b) => deckOrder.indexOf(a.deck) - deckOrder.indexOf(b.deck) || a.order - b.order);
  }
  return custom.concat(rest);
}
function newLeftToday() { return Math.max(0, S.settings.newPerDay - todayLog().newCards); }
function counts(deckFilter) {
  const t = now(); let learn = 0, due = 0;
  for (const c of D.cards) {
    if (deckFilter && c.deck !== deckFilter) continue;
    if (!deckFilter && !activeDecks().includes(c.deck) && c.deck !== 'mine') continue;
    const s = S.srs[c.id]; if (!s || s.type === 'new') continue;
    if (isLearning(s)) { if (s.due <= t + LEARN_AHEAD) learn++; }
    else if (s.due < dayStart() + DAY) due++;
  }
  const newAvail = newQueue(deckFilter).length;
  return { new: Math.min(newAvail, newLeftToday()), newAvail, learn, due };
}

// ---------------------------------------------------------------- streak & badges
function goalMet(k) {
  const l = S.log[k]; if (!l) return false;
  return (l.cards + l.mcq) >= S.settings.goal || !!l.cleared;
}
function refreshGoal() {
  const l = todayLog();
  if (!l.cleared && l.cards > 0) { const c = counts(); if (c.due === 0 && c.learn === 0 && c.new === 0) l.cleared = true; }
}
function streak() {
  const today = dayKey(); let k = goalMet(today) ? today : addDays(today, -1); let n = 0;
  while (goalMet(k)) { n++; k = addDays(k, -1); }
  return n;
}
function bestStreak() {
  const days = Object.keys(S.log).filter(goalMet).sort(); let best = 0, run = 0, prev = null;
  for (const k of days) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return best;
}
function totals() {
  let cards = 0, mcq = 0, right = 0, days = 0;
  for (const l of Object.values(S.log)) { cards += l.cards; mcq += l.mcq; right += l.right; if (l.cards + l.mcq) days++; }
  const mature = Object.values(S.srs).filter(s => s.type === 'review' && s.ivl >= 21).length;
  return { cards, mcq, right, days, mature, acc: mcq ? Math.round(100 * right / mcq) : 0 };
}
const BADGES = [
  { id: 's3', icon: '🔥', name: '3-day streak', desc: 'Hit your goal 3 days running', test: () => bestStreak() >= 3 },
  { id: 's7', icon: '🔥', name: 'Week warrior', desc: '7-day streak', test: () => bestStreak() >= 7 },
  { id: 's30', icon: '🏅', name: 'Month of glances', desc: '30-day streak', test: () => bestStreak() >= 30 },
  { id: 's100', icon: '👑', name: 'Centurion', desc: '100-day streak', test: () => bestStreak() >= 100 },
  { id: 'c100', icon: '🃏', name: '100 reviews', desc: 'Review 100 flashcards', test: () => totals().cards >= 100 },
  { id: 'c1000', icon: '📚', name: '1,000 reviews', desc: 'Review 1,000 flashcards', test: () => totals().cards >= 1000 },
  { id: 'q50', icon: '🎯', name: '50 MCQs', desc: 'Answer 50 questions', test: () => totals().mcq >= 50 },
  { id: 'q300', icon: '🧠', name: 'Question bank', desc: 'Answer 300 questions', test: () => totals().mcq >= 300 },
  { id: 'm1', icon: '🩹', name: 'Fixed it', desc: 'Clear your first mistake', test: () => S.cleared >= 1 },
  { id: 'm25', icon: '🧹', name: 'Clean slate', desc: 'Clear 25 mistakes', test: () => S.cleared >= 25 },
  { id: 'mat50', icon: '🌳', name: 'Long-term memory', desc: '50 cards with intervals over 21 days', test: () => totals().mature >= 50 },
  { id: 'spec', icon: '🫙', name: 'Museum regular', desc: 'Get 20 specimen spotters right', test: () => Object.entries(S.mcq).filter(([k, v]) => k.startsWith('sp-q-') && v.right > 0).length >= 20 }
];
function checkBadges() {
  for (const b of BADGES) if (!S.badges[b.id] && b.test()) { S.badges[b.id] = now(); toast(`${b.icon} Badge unlocked: ${b.name}`); }
}
function level(xp = S.xp) { return Math.floor(Math.sqrt(xp / 25)) + 1; }
function levelProgress(xp = S.xp) { const L = level(xp); const a = 25 * (L - 1) ** 2, b = 25 * L ** 2; return { L, pct: Math.round(100 * (xp - a) / (b - a)), toNext: b - xp }; }

// ---------------------------------------------------------------- MCQ records & mistakes
function recordAnswer(q, chosen) {
  const ok = chosen === q.ans;
  const r = (S.mcq[q.id] ||= { n: 0, right: 0, last: 0, lastRight: false, flag: false });
  r.n++; if (ok) r.right++; r.last = now(); r.lastRight = ok; r.lastChosen = chosen;
  const l = todayLog(); l.mcq++; if (ok) l.right++;
  addXP(ok ? 3 : 1);
  let clearedNow = false;
  if (!ok) { S.mistakes[q.id] = { added: (S.mistakes[q.id] || {}).added || now(), chosen, run: 0, at: now() }; }
  else if (S.mistakes[q.id]) {
    const m = S.mistakes[q.id]; m.run = (m.run || 0) + 1; m.at = now();
    if (m.run >= 2) { delete S.mistakes[q.id]; S.cleared++; addXP(5); clearedNow = true; }
  }
  save(); checkBadges(); renderChrome();
  return { ok, clearedNow };
}
function mistakeToCard(qid) {
  const q = D.mcqById[qid]; if (!q) return;
  const id = 'mine-' + qid; if (D.cardById[id]) { toast('Already in your flashcards'); return; }
  const card = { id, deck: 'mine', sub: q.deck, subTitle: deckTitle(q.deck), front: q.q, back: `${q.opts[q.ans]} — ${q.exp}`, img: q.img || null, crop: q.crop || null, spec: q.spec || null };
  S.custom.push(card); save(); buildDecks(); toast('Added to your flashcards — it comes up first in your next session');
}

// ---------------------------------------------------------------- rendering helpers
const app = () => $('#app');
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
function imgTag(src, crop, alt, dims) {
  if (crop && dims) {
    const [top, bottom] = crop; const vis = Math.max(10, bottom - top); const [w, h] = dims;
    return `<div class="crop" style="aspect-ratio:${w} / ${(h * vis / 100).toFixed(1)}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" style="position:absolute;left:0;width:100%;height:${(10000 / vis).toFixed(2)}%;top:-${(100 * top / vis).toFixed(2)}%"></div>`;
  }
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
}
const specDims = (sp, k = 0) => sp && sp.dims ? sp.dims[k] : null;
function openLightbox(src, cap) {
  const lb = $('#lightbox'); lb.innerHTML = `<div><img src="${esc(src)}" alt=""><div class="cap">${cap || ''}</div></div>`; lb.hidden = false;
}
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zoom]'); if (z) { openLightbox(z.dataset.zoom, z.dataset.cap ? esc(z.dataset.cap) : ''); return; }
  if (e.target.closest('#lightbox')) $('#lightbox').hidden = true;
});

const NAV = [
  { r: 'today', label: 'Today', icon: 'today' },
  { r: 'cards', label: 'Flashcards', icon: 'cards' },
  { r: 'mcq', label: 'MCQs', icon: 'mcq' },
  { r: 'mistakes', label: 'Mistakes', icon: 'mistakes' },
  { r: 'museum', label: 'Specimens', icon: 'museum' },
  { r: 'progress', label: 'Scoreboard', icon: 'progress' }
];
function renderChrome() {
  const route = (location.hash.slice(2).split('/')[0] || 'today').split('?')[0];
  const c = D.cards.length ? counts() : { due: 0, learn: 0, new: 0 };
  const dueN = c.due + c.learn, mist = Object.keys(S.mistakes).length;
  const badge = r => r === 'cards' && dueN ? `<span class="count due">${dueN}</span>` : r === 'mistakes' && mist ? `<span class="count bad">${mist}</span>` : '';
  const on = r => (route === r || (r === 'cards' && route === 'study') || (r === 'mcq' && route === 'quiz')) ? ' on' : '';
  $('#nav').innerHTML = NAV.map(n => `<a href="#/${n.r}" class="${on(n.r)}">${ico(n.icon)}${n.label}${badge(n.r)}</a>`).join('');
  $('#tabbar').innerHTML = NAV.filter(n => n.r !== 'progress').map(n => `<a href="#/${n.r}" class="${on(n.r)}">${ico(n.icon)}<span>${n.label === 'Flashcards' ? 'Cards' : n.label === 'Specimens' ? 'Museum' : n.label}</span>${(n.r === 'cards' && dueN) ? `<span class="count">${dueN}</span>` : (n.r === 'mistakes' && mist) ? `<span class="count">${mist}</span>` : ''}</a>`).join('');
  const s = streak();
  $('#sidebar-streak').innerHTML = `<a class="mini-streak" href="#/progress" style="color:inherit">${FLAME_SVG(!goalMet(dayKey())).replace('class="flame', 'style="width:34px;height:34px" class="flame')}<div><b>${s}</b><small>day streak · Lv ${level()}</small></div></a>`;
}

// ---------------------------------------------------------------- views
function viewToday() {
  refreshGoal();
  const c = counts(), l = todayLog(), s = streak(), met = goalMet(dayKey());
  const prog = clamp(Math.round(100 * (l.cards + l.mcq) / S.settings.goal), 0, 100);
  const mist = Object.entries(S.mistakes).sort((a, b) => b[1].at - a[1].at);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const startDay = dayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startDay, i - 6)).map(k => {
    const d = new Date(k + 'T12:00'); return `<div class="d${goalMet(k) ? ' met' : ''}${k === startDay ? ' today' : ''}">${'SMTWTFS'[d.getDay()]}<i>${goalMet(k) ? ico('check') : ''}</i></div>`;
  }).join('');
  // due-for-review column: group due cards by deck
  const dueBy = {}; const t = now();
  D.cards.forEach(cd => { const x = S.srs[cd.id]; if (x && x.type !== 'new' && isDue(x, t + LEARN_AHEAD)) dueBy[cd.deck] = (dueBy[cd.deck] || 0) + 1; });
  const dueRows = Object.entries(dueBy).sort((a, b) => b[1] - a[1]);
  const nq = newQueue().slice(0, c.new);
  const newBy = {}; nq.forEach(cd => newBy[cd.deck] = (newBy[cd.deck] || 0) + 1);
  const studyN = c.new + c.learn + c.due;
  const tomorrow = Object.values(S.srs).filter(x => x.type !== 'new' && x.due >= dayStart() + DAY && x.due < dayStart() + 2 * DAY).length;

  return `<div class="page">
  <div class="head"><div><div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>${greet}.</h1>
  <p class="sub">${studyN ? `You have <b>${studyN}</b> card${studyN === 1 ? '' : 's'} for today${mist.length ? ` and <b>${mist.length}</b> mistake${mist.length === 1 ? '' : 's'} to fix` : ''}.` : met ? 'Today’s cards are done. Practise MCQs or fix a mistake to keep going.' : 'No cards waiting right now.'}</p></div></div>

  <div class="hero">
    <div class="card hero-main">
      <div class="counts">
        <div class="count-block"><b class="c-new">${c.new}</b><span>New today</span></div>
        <div class="count-block"><b class="c-learn">${c.learn}</b><span>Learning</span></div>
        <div class="count-block"><b class="c-due">${c.due}</b><span>Due for review</span></div>
        <div class="count-block"><b class="c-bad">${mist.length}</b><span>Mistakes</span></div>
      </div>
      <div class="hero-actions">
        <a class="btn primary lg" href="#/study">${ico('play')} ${studyN ? 'Study cards' : 'Study ahead'} <span class="kbd">S</span></a>
        <a class="btn lg" href="#/mcq">${ico('mcq')} Practise MCQs</a>
        ${mist.length ? `<a class="btn lg" href="#/quiz?mode=mistakes">${ico('retry')} Retry mistakes</a>` : ''}
      </div>
    </div>
    <div class="card streak-card">
      <div class="streak-top">${FLAME_SVG(!met)}<div><div class="streak-num">${s}</div><div class="streak-lbl">day streak${met ? ' · today done ✓' : ' · keep it alive today'}</div></div></div>
      <div><div class="goal-row"><span>Daily goal</span><span>${Math.min(l.cards + l.mcq, S.settings.goal)} / ${S.settings.goal}</span></div><div class="goal-bar"><i style="width:${met ? 100 : prog}%"></i></div></div>
      <div class="week">${week}</div>
    </div>
  </div>

  <div class="cols">
    <div class="card col">
      <div class="col-head"><span class="dot" style="background:var(--new)"></span><h3>Today’s new cards</h3><span class="col-badge" style="background:var(--hema-soft);color:var(--new)">${c.new}</span></div>
      <div class="list">${Object.keys(newBy).length ? Object.entries(newBy).map(([d, n]) => `<a class="row" href="#/study?deck=${d}"><span class="grow">${esc(deckTitle(d))}</span><span class="num c-new">${n}</span></a>`).join('') : `<div class="empty">${c.newAvail ? `Today’s ${S.settings.newPerDay} new cards are done. More unlock tomorrow.` : 'Every card has been introduced.'}</div>`}</div>
      <p class="muted" style="font-size:13px;margin:0">${S.settings.newPerDay} new cards are released each day, in syllabus order.</p>
    </div>
    <div class="card col">
      <div class="col-head"><span class="dot" style="background:var(--due)"></span><h3>Due for review</h3><span class="col-badge" style="background:var(--good-soft);color:var(--due)">${c.due + c.learn}</span></div>
      <div class="list">${dueRows.length ? dueRows.map(([d, n]) => `<a class="row" href="#/study?deck=${d}"><span class="grow">${esc(deckTitle(d))}</span><span class="num c-due">${n}</span></a>`).join('') : `<div class="empty">Nothing due. ${tomorrow ? `${tomorrow} card${tomorrow === 1 ? '' : 's'} come back tomorrow.` : 'Cards you study come back here on a spaced schedule.'}</div>`}</div>
      ${c.due + c.learn ? `<a class="btn" href="#/study?only=due">${ico('retry')} Review due only</a>` : ''}
    </div>
    <div class="card col">
      <div class="col-head"><span class="dot" style="background:var(--bad)"></span><h3>Revisit mistakes</h3><span class="col-badge" style="background:var(--bad-soft);color:var(--bad)">${mist.length}</span></div>
      <div class="list">${mist.length ? mist.slice(0, 4).map(([id]) => { const q = D.mcqById[id]; return q ? `<a class="row" href="#/quiz?mode=one&id=${encodeURIComponent(id)}"><span class="grow"><span class="clip">${esc(q.q)}</span><span class="meta">${esc(deckTitle(q.deck))}</span></span></a>` : ''; }).join('') : '<div class="empty">No mistakes waiting. Wrong MCQ answers land here until you get them right twice in a row.</div>'}</div>
      ${mist.length ? `<a class="btn" href="#/mistakes">See all ${mist.length}</a>` : ''}
    </div>
  </div>

  <div class="section-title"><h2>Topics</h2><a href="#/cards">Open flashcard decks →</a></div>
  <div class="card" style="padding:12px 14px">${topicTable()}</div>

  <div class="section-title"><h2>Activity</h2><a href="#/progress">Scoreboard →</a></div>
  <div class="card">${heatmap(18)}</div>
  </div>`;
}

function deckStats(id) {
  const cards = D.cards.filter(c => c.deck === id);
  const seen = cards.filter(c => S.srs[c.id]).length;
  const qs = D.mcqs.filter(q => q.deck === id);
  const done = qs.filter(q => S.mcq[q.id]);
  const right = done.filter(q => S.mcq[q.id].lastRight).length;
  return { cards: cards.length, seen, qs: qs.length, done: done.length, acc: done.length ? Math.round(100 * right / done.length) : null };
}
function topicTable() {
  return `<div class="topic-table"><div class="trow th"><span>Topic</span><span class="n">Cards</span><span class="n">MCQs</span><span class="n">Score</span><span>Cards seen</span></div>` +
    D.decks.map(d => { const s = deckStats(d.id); const pct = s.cards ? Math.round(100 * s.seen / s.cards) : 0;
      return `<a class="trow" href="#/mcq?deck=${d.id}"><span class="tname">${esc(d.title)}<small>${esc(d.competency || '')}</small></span><span class="n">${s.cards}</span><span class="n">${s.qs}</span><span class="n" style="color:${s.acc == null ? 'var(--ink-3)' : s.acc >= 75 ? 'var(--good)' : s.acc >= 50 ? 'var(--warn)' : 'var(--bad)'}">${s.acc == null ? '—' : s.acc + '%'}</span><span class="meter-cell"><span class="meter"><i style="width:${pct}%"></i></span>${pct}%</span></a>`; }).join('') + '</div>';
}

function heatmap(weeks = 18) {
  const today = dayKey(); const d0 = new Date(today + 'T12:00'); const dow = d0.getDay();
  const start = addDays(today, -(weeks * 7 - 1) - (6 - dow));
  let cells = ''; const total = weeks * 7 + (6 - dow) + 1;
  for (let i = 0; i < total + (6 - dow); i++) {
    const k = addDays(start, i); if (i >= total) { cells += '<i class="future"></i>'; continue; }
    const l = S.log[k]; const n = l ? l.cards + l.mcq : 0;
    const lv = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
    cells += `<i class="l${lv}" title="${k}: ${n} reviews/questions"></i>`;
  }
  return `<div class="heat">${cells}</div><div class="heat-legend">Less <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> More</div>`;
}

// ---- flashcard decks
function viewCards() {
  const all = counts();
  const rows = D.decks.concat(S.custom.length ? [{ id: 'mine', title: 'My cards (from mistakes)', competency: 'Made by you' }] : []).map(d => {
    const c = counts(d.id); const z = n => n ? '' : ' zero';
    return `<a class="trow" href="#/study?deck=${d.id}"><span class="tname">${esc(d.title)}<small>${esc(d.competency || '')}</small></span><span class="n c-new${z(c.new)}">${c.new}</span><span class="n c-learn${z(c.learn)}">${c.learn}</span><span class="n c-due${z(c.due)}">${c.due}</span><span class="meter-cell">${deckStats(d.id).cards} cards</span></a>`;
  }).join('');
  const upcoming = forecast(7);
  return `<div class="page">
  <div class="head"><div><h1>Flashcards</h1><p class="sub">Anki-style spaced repetition. Grade yourself honestly — the schedule adapts to how well you remember.</p></div>
  <a class="btn primary lg" href="#/study">${ico('play')} Study all (${all.new + all.learn + all.due})</a></div>
  <div class="card deck-table" style="padding:12px 14px"><div class="topic-table">
    <div class="trow th"><span>Deck</span><span class="n" style="color:var(--new)">New</span><span class="n" style="color:var(--learn)">Learn</span><span class="n" style="color:var(--due)">Due</span><span></span></div>${rows}</div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Coming up</h3><p class="muted" style="margin:4px 0 0;font-size:13.5px">Reviews scheduled for the next 7 days</p>${bars(upcoming)}</div>
    <div class="card"><h3>How the schedule works</h3><ul style="margin:10px 0 0;padding-left:18px;color:var(--ink-2);font-size:14px;display:flex;flex-direction:column;gap:6px">
      <li><b style="color:var(--new)">New</b> cards are released ${S.settings.newPerDay} a day.</li>
      <li><b style="color:var(--learn)">Learning</b> cards repeat at 1 and 10 minutes until you know them.</li>
      <li><b style="color:var(--due)">Due</b> cards return after 1 day, then roughly ×2.5 each time you get them right.</li>
      <li>Press <b>Again</b> when you forget — the card goes back to short steps and its interval shrinks.</li></ul></div>
  </div></div>`;
}
function forecast(n) {
  const base = dayStart(); const out = [];
  for (let i = 0; i < n; i++) {
    const a = base + i * DAY, b = a + DAY;
    const cnt = Object.values(S.srs).filter(s => s.type !== 'new' && (i === 0 ? s.due < b : s.due >= a && s.due < b)).length;
    const d = new Date(a + 12 * HOUR); out.push({ label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }), n: cnt });
  }
  return out;
}
function bars(data) {
  const max = Math.max(1, ...data.map(d => d.n));
  return `<div class="bars">${data.map(d => `<div class="b"><em>${d.n}</em><i style="height:${Math.round(80 * d.n / max)}%"></i>${esc(d.label)}</div>`).join('')}</div>`;
}

// ---- study session
let SESSION = null;
function startSession(params) {
  const deck = params.get('deck') || null;
  const onlyDue = params.get('only') === 'due';
  const t = now();
  const inDeck = c => deck ? c.deck === deck : (activeDecks().includes(c.deck) || c.deck === 'mine');
  const learning = [], review = [];
  for (const c of D.cards) {
    if (!inDeck(c)) continue; const s = S.srs[c.id]; if (!s || s.type === 'new') continue;
    if (isLearning(s) && s.due <= t + LEARN_AHEAD) learning.push(c.id);
    else if (!isLearning(s) && s.due < dayStart() + DAY) review.push(c.id);
  }
  const news = onlyDue ? [] : newQueue(deck).slice(0, newLeftToday()).map(c => c.id);
  let ahead = false;
  if (!learning.length && !review.length && !news.length) {
    // study ahead: tomorrow's reviews, else a handful of extra new cards
    const next = D.cards.filter(inDeck).map(c => [c, S.srs[c.id]]).filter(([, s]) => s && s.type !== 'new').sort((a, b) => a[1].due - b[1].due).slice(0, 15).map(([c]) => c.id);
    if (next.length) { review.push(...next); ahead = true; }
    else { news.push(...newQueue(deck).slice(0, 10).map(c => c.id)); ahead = true; }
  }
  SESSION = { deck, review: shuffle(review), news, learning, shown: false, current: null, done: 0, ahead, startedXP: S.xp, again: 0 };
  nextCard();
}
function nextCard() {
  const s = SESSION, t = now();
  s.learning.sort((a, b) => st(a).due - st(b).due);
  const lnow = s.learning.find(id => st(id).due <= t);
  let pick = null;
  if (lnow) pick = lnow;
  else if (s.review.length && (s.done % 4 !== 3 || !s.news.length)) pick = s.review[0];
  else if (s.news.length) pick = s.news[0];
  else if (s.review.length) pick = s.review[0];
  else if (s.learning.length) pick = s.learning[0];   // learn ahead to finish the session
  s.current = pick; s.shown = false;
}
function remaining() { const s = SESSION; return { n: s.news.length, l: s.learning.length, r: s.review.length }; }
function gradeCurrent(g) {
  const s = SESSION; const id = s.current; if (!id) return;
  const before = st(id); const after = schedule(before, g, id);
  S.srs[id] = after;
  const l = todayLog(); l.cards++; if (before.type === 'new') l.newCards++;
  addXP(1); if (g === 1) s.again++;
  s.news = s.news.filter(x => x !== id); s.review = s.review.filter(x => x !== id); s.learning = s.learning.filter(x => x !== id);
  if (isLearning(after)) s.learning.push(id);
  s.done++;
  save(); refreshGoal(); checkBadges(); nextCard(); renderChrome(); render();
}
function cardFace(c) {
  if (c.kind === 'spotter' || c.kind === 'describe') {
    const sp = specById(c.spec);
    const front = c.kind === 'spotter'
      ? `<div class="flash-img" style="width:min(100%,340px)">${imgTag(sp.images[0], sp.quizCrop, 'Museum specimen', specDims(sp))}</div><div class="flash-q">${esc(c.front)}</div>`
      : `<div class="flash-q">${esc(c.front)}</div>`;
    const back = `<div><b>${esc(sp.name)}</b> <span class="muted">· ${esc(sp.organ)}</span><ul>${sp.gross.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>`;
    return { front, back };
  }
  if (c.kind === 'micro') {
    const m = microBySlug(c.micro);
    return { front: `<div class="flash-img" data-zoom="${esc(m.file)}" data-cap="${esc(m.title + ' — ' + m.caption)}"><img src="${esc(m.file)}" alt="Micrograph"></div><div class="flash-q">${esc(c.front)}</div>`,
      back: `<div><b>${esc(m.title)}</b><p style="margin:6px 0 0">${esc(m.caption)}</p><div class="credit" style="margin-top:8px">Image: ${esc(m.author)} · ${esc(m.license)} · <a href="${esc(m.source)}" target="_blank" rel="noopener">source</a></div></div>` };
  }
  const img = c.img ? `<div class="flash-img" style="width:min(100%,340px)">${imgTag(c.img, c.crop, '', c.spec ? specDims(specById(c.spec)) : null)}</div>` : '';
  return { front: `${img}<div class="flash-q">${esc(c.front)}</div>`, back: `<div>${esc(c.back)}</div>` };
}
function viewStudy() {
  const s = SESSION;
  if (!s.current) {
    const gained = S.xp - s.startedXP; const c = counts(); const tom = forecast(2)[1].n;
    return `<div class="page narrow"><div class="card done"><div class="big">🎉</div><h1>${s.done ? 'Session complete' : 'Nothing to study'}</h1>
      <p class="sub">${s.done ? `${plural(s.done, 'card')} reviewed · +${gained} XP · streak ${streak()} day${streak() === 1 ? '' : 's'}` : 'You’re all caught up.'}</p>
      <p class="muted">${tom ? `${plural(tom, 'card')} will be due tomorrow.` : ''} ${c.newAvail && !c.new ? 'New cards unlock tomorrow.' : ''}</p>
      <div class="hero-actions" style="justify-content:center"><a class="btn primary" href="#/mcq">${ico('mcq')} Practise MCQs</a><a class="btn" href="#/today">Back to Today</a>${s.done ? '' : `<a class="btn" href="#/study?ahead=1&r=${Date.now()}">Study ahead</a>`}</div></div></div>`;
  }
  const c = D.cardById[s.current]; const state = st(c.id); const r = remaining();
  const face = cardFace(c); const labels = previewLabels(c.id);
  const kind = state.type === 'new' ? ['New', 'c-new'] : isLearning(state) ? ['Learning', 'c-learn'] : ['Review', 'c-due'];
  const total = s.done + r.n + r.l + r.r; const pct = total ? Math.round(100 * s.done / total) : 0;
  const curType = state.type === 'new' ? 'n' : isLearning(state) ? 'l' : 'r';
  return `<div class="study">
    <div class="study-top"><a class="btn ghost sm" href="#/cards">${ico('back')} Decks</a><span class="muted" style="font-weight:600;font-size:13.5px">${s.deck ? esc(deckTitle(s.deck)) : 'All decks'}${s.ahead ? ' · studying ahead' : ''}</span>
      <div class="tally" title="New · Learning · Due"><span class="c-new${curType === 'n' ? ' cur' : ''}">${r.n}</span><span class="c-learn${curType === 'l' ? ' cur' : ''}">${r.l}</span><span class="c-due${curType === 'r' ? ' cur' : ''}">${r.r}</span></div></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="flash">
      <div class="flash-meta"><span class="pill ${kind[1] === 'c-new' ? 'hema' : kind[1] === 'c-learn' ? 'eosin' : 'easy'}">${kind[0]}</span><span class="pill">${esc(deckTitle(c.deck))}</span>${c.subTitle ? `<span class="pill">${esc(c.subTitle)}</span>` : ''}</div>
      ${face.front}
      ${s.shown ? `<div class="flash-a">${face.back}</div>` : ''}
    </div>
    ${s.shown ? `<div class="answer-bar">
        <button class="grade again" data-g="1">Again<small>${labels[0]}</small></button>
        <button class="grade hard" data-g="2">Hard<small>${labels[1]}</small></button>
        <button class="grade good" data-g="3">Good<small>${labels[2]}</small></button>
        <button class="grade easy" data-g="4">Easy<small>${labels[3]}</small></button></div>
        <div class="hint">Keys <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span> <span class="kbd">4</span> · Space = Good</div>`
      : `<button class="btn primary lg reveal" id="reveal">Show answer <span class="kbd">Space</span></button>`}
  </div>`;
}

// ---- MCQ setup
const QSET = { decks: null, diff: 'all', status: 'all', count: 20, mode: 'tutor', sub: 'all' };
function filterQs(o) {
  const decks = o.decks && o.decks.length ? o.decks : D.decks.map(d => d.id);
  return D.mcqs.filter(q => decks.includes(q.deck)
    && (o.diff === 'all' || q.diff === o.diff)
    && (o.sub === 'all' || q.sub === o.sub)
    && (o.status === 'all' || (o.status === 'unseen' && !S.mcq[q.id]) || (o.status === 'wrong' && S.mcq[q.id] && !S.mcq[q.id].lastRight) || (o.status === 'flagged' && S.mcq[q.id] && S.mcq[q.id].flag)));
}
function viewMcqSetup(params) {
  if (params.get('deck')) { QSET.decks = [params.get('deck')]; QSET.sub = 'all'; history.replaceState(null, '', '#/mcq'); }
  if (!QSET.decks) QSET.decks = D.decks.filter(d => TOPICS.includes(d.id)).map(d => d.id);
  const pool = filterQs(QSET);
  const deckChips = D.decks.map(d => { const n = D.mcqs.filter(q => q.deck === d.id).length; return `<button class="chip${QSET.decks.includes(d.id) ? ' on' : ''}" data-deck="${d.id}">${esc(d.title)} <span class="n">${n}</span></button>`; }).join('');
  const one = QSET.decks.length === 1 ? D.decks.find(d => d.id === QSET.decks[0]) : null;
  const subs = one && one.subtopics.length ? `<div class="field"><span class="lbl">Competency heading</span><div class="chips"><button class="chip${QSET.sub === 'all' ? ' on' : ''}" data-sub="all">All headings</button>${one.subtopics.map(s => `<button class="chip${QSET.sub === s.id ? ' on' : ''}" data-sub="${esc(s.id)}">${esc(s.title)} <span class="n">${D.mcqs.filter(q => q.deck === one.id && q.sub === s.id).length}</span></button>`).join('')}</div></div>` : '';
  const diffCount = d => filterQs({ ...QSET, diff: d }).length;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(QSET[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tot = totals();
  return `<div class="page narrow">
  <div class="head"><div><h1>MCQ practice</h1><p class="sub">${D.mcqs.length} single-best-answer questions graded easy, medium and hard, each with an explanation and what to read next.</p></div></div>
  <div class="card setup">
    <div class="field"><span class="lbl">Topics</span><div class="chips">${deckChips}</div></div>
    ${subs}
    <div class="field"><span class="lbl">Difficulty</span>${seg('diff', [['all', `All`], ['easy', `Easy · ${diffCount('easy')}`], ['medium', `Medium · ${diffCount('medium')}`], ['hard', `Hard · ${diffCount('hard')}`]])}</div>
    <div class="field"><span class="lbl">Questions</span>${seg('status', [['all', 'All'], ['unseen', 'Unseen'], ['wrong', 'Got wrong'], ['flagged', 'Flagged']])}</div>
    <div class="grid g2">
      <div class="field"><span class="lbl">How many</span>${seg('count', [[10, '10'], [20, '20'], [40, '40'], [999, 'All']])}</div>
      <div class="field"><span class="lbl">Mode</span>${seg('mode', [['tutor', 'Tutor — explain as I go'], ['exam', 'Exam — timed']])}</div>
    </div>
    <div class="setup-foot"><span class="muted"><b style="color:var(--ink)">${pool.length}</b> question${pool.length === 1 ? '' : 's'} match${tot.mcq ? ` · your accuracy so far ${tot.acc}%` : ''}</span>
      <a class="btn primary lg${pool.length ? '' : ' disabled'}" ${pool.length ? 'href="#/quiz?mode=set"' : 'disabled'}>${ico('play')} Start ${Math.min(pool.length, QSET.count)} question${Math.min(pool.length, QSET.count) === 1 ? '' : 's'}</a></div>
  </div>
  <div class="section-title"><h2>By topic</h2></div>
  <div class="card" style="padding:12px 14px">${topicTable()}</div>
  </div>`;
}

// ---- quiz
let QUIZ = null;
function startQuiz(params) {
  const mode = params.get('mode');
  let qs = [], exam = false, title = 'Practice';
  if (mode === 'mistakes') { const t = params.get('deck'); qs = Object.keys(S.mistakes).map(id => D.mcqById[id]).filter(q => q && (!t || q.deck === t)); qs = shuffle(qs); title = 'Mistakes'; }
  else if (mode === 'one') { const q = D.mcqById[params.get('id')]; qs = q ? [q] : []; title = 'Mistake'; }
  else if (mode === 'spotter') { qs = shuffle(D.mcqs.filter(q => q.deck === SPECIMEN_DECK)).slice(0, 15); title = 'Spotter quiz'; }
  else if (mode === 'histo') { qs = shuffle(D.mcqs.filter(q => q.deck === MICRO_DECK)); title = 'Histology quiz'; }
  else {
    const pool = filterQs(QSET);
    // unseen first, then wrong, then the rest — mixed within each band
    const band = q => !S.mcq[q.id] ? 0 : !S.mcq[q.id].lastRight ? 1 : 2;
    qs = [0, 1, 2].flatMap(b => shuffle(pool.filter(q => band(q) === b))).slice(0, QSET.count);
    exam = QSET.mode === 'exam'; title = exam ? 'Exam block' : 'Tutor mode';
  }
  QUIZ = { qs, i: 0, answers: {}, revealed: {}, exam, title, mode, start: now(), finished: false, results: null };
}
function quizTimer() { if (!QUIZ || !QUIZ.exam || QUIZ.finished) return ''; const s = Math.floor((now() - QUIZ.start) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function qImg(q) {
  if (!q.img) return '';
  const cap = q.micro ? (() => { const m = microBySlug(q.micro); return m ? `${m.author}, ${m.license}` : ''; })() : '';
  return `<div class="qimg"${q.crop ? '' : ` data-zoom="${esc(q.img)}"`}>${imgTag(q.img, q.crop, 'Question image', q.spec ? specDims(specById(q.spec)) : null)}</div>${cap ? `<div class="credit" style="margin:-10px 0 14px">Image: ${esc(cap)}</div>` : ''}`;
}
function viewQuiz() {
  const Z = QUIZ;
  if (!Z.qs.length) return `<div class="page narrow"><div class="card done"><div class="big">🗂️</div><h1>No questions here</h1><p class="sub">Change the filters and try again.</p><a class="btn primary" href="#/mcq">Back to setup</a></div></div>`;
  if (Z.finished) return viewResults();
  const q = Z.qs[Z.i]; const chosen = Z.answers[q.id]; const shown = !Z.exam && Z.revealed[q.id];
  const rec = S.mcq[q.id] || {};
  const opts = q.opts.map((o, k) => {
    let cls = 'opt'; let mark = '';
    if (shown) { cls += ' locked'; if (k === q.ans) { cls += ' right'; mark = ico('check'); } else if (k === chosen) { cls += ' wrong'; mark = ico('x'); } else cls += ' dim'; }
    else if (chosen === k) cls += ' sel';
    return `<button class="${cls}" data-opt="${k}"><span class="L">${LETTERS[k]}</span><span class="t">${esc(o)}</span><span class="mark">${mark}</span></button>`;
  }).join('');
  const ok = chosen === q.ans;
  const spec = q.spec ? specById(q.spec) : null;
  const explain = shown ? `<div class="explain">
      <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? ico('check') + ' Correct' : ico('x') + ` Incorrect — the answer is ${LETTERS[q.ans]}`}${Z.lastCleared ? ' <span class="pill easy">Mistake cleared</span>' : ''}</div>
      <p>${esc(q.exp)}</p>
      ${q.related && q.related.length ? `<div class="readnext"><span class="lbl">Read next</span>${q.related.map(r => `<span class="pill hema">${esc(r)}</span>`).join('')}</div>` : ''}
      ${spec ? `<a href="#/museum/${spec.id}" style="font-weight:650;font-size:14px">Open ${esc(spec.name)} in the museum →</a>` : ''}
      <div class="ref">${ico('book')} ${esc(q.ref || '')}</div></div>` : '';
  const nav = Z.exam ? `<div class="navgrid">${Z.qs.map((x, k) => `<button data-jump="${k}" class="${Z.answers[x.id] != null ? 'ans' : ''}${k === Z.i ? ' cur' : ''}">${k + 1}</button>`).join('')}</div>` : '';
  const last = Z.i === Z.qs.length - 1;
  const footBtns = Z.exam
    ? `<div style="display:flex;gap:8px"><button class="btn" id="prev" ${Z.i ? '' : 'disabled'}>${ico('back')} Previous</button>${last ? `<button class="btn primary" id="submit">Submit block</button>` : `<button class="btn primary" id="next">Next <span class="kbd">↵</span></button>`}</div>`
    : shown ? `<button class="btn primary" id="next">${last ? 'See results' : 'Next question'} <span class="kbd">↵</span></button>` : `<span class="muted" style="font-size:13.5px">Pick an answer · keys <span class="kbd">A</span>–<span class="kbd">D</span></span>`;
  return `<div class="qwrap">
    <div class="qtop"><a class="btn ghost sm" href="#/${Z.mode === 'set' ? 'mcq' : Z.mode === 'spotter' || Z.mode === 'histo' ? 'museum' : 'mistakes'}">${ico('back')} Exit</a>
      <b>${esc(Z.title)}</b><span class="muted">Question ${Z.i + 1} of ${Z.qs.length}</span><span class="spacer"></span>
      ${Z.exam ? `<span class="qtimer">${ico('timer')} <span id="timer">${quizTimer()}</span></span>` : ''}
      <button class="btn ghost sm flagbtn${rec.flag ? ' on' : ''}" id="flag" title="Flag for later">${ico('flag')} ${rec.flag ? 'Flagged' : 'Flag'}</button></div>
    <div class="progress"><i style="width:${Math.round(100 * (Z.i + (shown ? 1 : 0)) / Z.qs.length)}%"></i></div>
    <div class="card qcard">
      <div class="flash-meta"><span class="pill ${q.diff}">${q.diff[0].toUpperCase() + q.diff.slice(1)}</span><span class="pill">${esc(deckTitle(q.deck))}</span>${q.subTitle && q.subTitle !== deckTitle(q.deck) ? `<span class="pill">${esc(q.subTitle)}</span>` : ''}${S.mistakes[q.id] ? '<span class="pill hard">In mistakes</span>' : ''}</div>
      <div class="qstem">${esc(q.q)}</div>
      ${qImg(q)}
      <div class="opts">${opts}</div>
      ${explain}
    </div>
    ${nav}
    <div class="qfoot"><span></span>${footBtns}</div>
  </div>`;
}
function answerQuiz(k) {
  const Z = QUIZ; const q = Z.qs[Z.i];
  if (Z.exam) { Z.answers[q.id] = k; render(); return; }
  if (Z.revealed[q.id]) return;
  Z.answers[q.id] = k; Z.revealed[q.id] = true;
  const r = recordAnswer(q, k); Z.lastCleared = r.clearedNow; render();
}
function nextQuiz() {
  const Z = QUIZ;
  if (Z.i < Z.qs.length - 1) { Z.i++; Z.lastCleared = false; render(); window.scrollTo({ top: 0 }); }
  else finishQuiz();
}
function finishQuiz() {
  const Z = QUIZ;
  if (Z.exam) Z.qs.forEach(q => { if (Z.answers[q.id] != null) recordAnswer(q, Z.answers[q.id]); });
  Z.finished = true; Z.secs = Math.round((now() - Z.start) / 1000); render(); window.scrollTo({ top: 0 });
}
function viewResults() {
  const Z = QUIZ; const right = Z.qs.filter(q => Z.answers[q.id] === q.ans).length; const n = Z.qs.length; const pct = Math.round(100 * right / n);
  const by = {}; Z.qs.forEach(q => { const b = (by[q.deck] ||= { n: 0, r: 0 }); b.n++; if (Z.answers[q.id] === q.ans) b.r++; });
  const R = 54, C = 2 * Math.PI * R;
  const ring = `<svg class="score-ring" viewBox="0 0 132 132"><circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="12"/><circle cx="66" cy="66" r="${R}" fill="none" stroke="${pct >= 75 ? 'var(--good)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * pct / 100} ${C}" transform="rotate(-90 66 66)"/><text x="66" y="72" text-anchor="middle" font-size="28" font-weight="800" fill="var(--ink)" font-family="Figtree, sans-serif">${pct}%</text></svg>`;
  const wrong = Z.qs.filter(q => Z.answers[q.id] !== q.ans);
  return `<div class="page narrow">
    <div class="card"><div class="result-head">${ring}<div><div class="eyebrow">${esc(Z.title)}</div><h1>${right} of ${n} correct</h1>
      <p class="sub">${Z.exam ? `Time ${Math.floor(Z.secs / 60)}m ${Z.secs % 60}s · ` : ''}${wrong.length ? `${plural(wrong.length, 'question')} added to Mistakes.` : 'Clean sheet.'}</p>
      <div class="hero-actions" style="margin-top:12px">${wrong.length ? `<a class="btn primary" href="#/quiz?mode=mistakes&r=${Date.now()}">${ico('retry')} Retry mistakes</a>` : ''}<a class="btn" href="#/mcq">New block</a><a class="btn ghost" href="#/today">Today</a></div></div></div>
      <div class="section-title" style="margin-top:22px"><h3>By topic</h3></div>
      <div class="list">${Object.entries(by).map(([d, b]) => `<div class="row"><span class="grow">${esc(deckTitle(d))}</span><span class="num">${b.r}/${b.n}</span></div>`).join('')}</div>
    </div>
    <div class="section-title"><h2>Review answers</h2></div>
    <div style="display:flex;flex-direction:column;gap:12px">${Z.qs.map((q, k) => { const a = Z.answers[q.id]; const ok = a === q.ans; return `<div class="card mistake">
      <div class="flash-meta"><span class="pill ${ok ? 'easy' : 'hard'}">${ok ? 'Correct' : a == null ? 'Skipped' : 'Wrong'}</span><span class="pill ${q.diff}">${q.diff}</span><span class="pill">${esc(deckTitle(q.deck))}</span></div>
      <div class="stem">${k + 1}. ${esc(q.q)}</div>${q.img ? qImg(q) : ''}
      <div class="ans">${!ok && a != null ? `<span class="k">You</span><span class="bad">${LETTERS[a]}. ${esc(q.opts[a])}</span>` : ''}<span class="k">Answer</span><span class="good">${LETTERS[q.ans]}. ${esc(q.opts[q.ans])}</span></div>
      <p style="margin:0;color:var(--ink-2);font-size:14.5px">${esc(q.exp)}</p>
      ${q.related ? `<div class="readnext"><span class="lbl">Read next</span>${q.related.map(r => `<span class="pill hema">${esc(r)}</span>`).join('')}</div>` : ''}</div>`; }).join('')}</div>
  </div>`;
}

// ---- mistakes
let MFILTER = 'all';
function viewMistakes() {
  const ids = Object.entries(S.mistakes).sort((a, b) => b[1].at - a[1].at).map(([id]) => id).filter(id => D.mcqById[id]);
  const decks = [...new Set(ids.map(id => D.mcqById[id].deck))];
  const shown = ids.filter(id => MFILTER === 'all' || D.mcqById[id].deck === MFILTER);
  return `<div class="page narrow">
  <div class="head"><div><h1>Mistakes</h1><p class="sub">Every MCQ you get wrong waits here. Answer it correctly twice in a row to clear it. Cleared so far: <b>${S.cleared}</b>.</p></div>
  ${ids.length ? `<a class="btn primary lg" href="#/quiz?mode=mistakes${MFILTER !== 'all' ? '&deck=' + MFILTER : ''}&r=${Date.now()}">${ico('retry')} Retry ${shown.length}</a>` : ''}</div>
  ${ids.length ? `<div class="chips" style="margin-bottom:16px"><button class="chip${MFILTER === 'all' ? ' on' : ''}" data-mf="all">All <span class="n">${ids.length}</span></button>${decks.map(d => `<button class="chip${MFILTER === d ? ' on' : ''}" data-mf="${d}">${esc(deckTitle(d))} <span class="n">${ids.filter(i => D.mcqById[i].deck === d).length}</span></button>`).join('')}</div>` : ''}
  ${shown.length ? `<div style="display:flex;flex-direction:column;gap:12px">${shown.map(id => { const q = D.mcqById[id], m = S.mistakes[id];
    return `<div class="card mistake">
      <div class="flash-meta"><span class="pill ${q.diff}">${q.diff}</span><span class="pill">${esc(deckTitle(q.deck))}</span>${q.subTitle && q.subTitle !== deckTitle(q.deck) ? `<span class="pill">${esc(q.subTitle)}</span>` : ''}<span class="pips" style="margin-left:auto"><i class="${m.run >= 1 ? 'on' : ''}"></i><i class="${m.run >= 2 ? 'on' : ''}"></i> ${m.run || 0}/2 to clear</span></div>
      <div class="stem">${esc(q.q)}</div>
      ${q.img ? qImg(q) : ''}
      <div class="ans"><span class="k">You chose</span><span class="bad">${m.chosen != null ? LETTERS[m.chosen] + '. ' + esc(q.opts[m.chosen]) : '—'}</span><span class="k">Answer</span><span class="good">${LETTERS[q.ans]}. ${esc(q.opts[q.ans])}</span></div>
      <details><summary style="cursor:pointer;font-weight:650;font-size:14px;color:var(--hema)">Why</summary><p style="margin:8px 0 0;color:var(--ink-2);font-size:14.5px">${esc(q.exp)}</p>${q.related ? `<div class="readnext" style="margin-top:8px"><span class="lbl">Read next</span>${q.related.map(r => `<span class="pill hema">${esc(r)}</span>`).join('')}</div>` : ''}</details>
      <div class="actions"><a class="btn sm" href="#/quiz?mode=one&id=${encodeURIComponent(id)}">${ico('retry')} Retry</a><button class="btn sm" data-mkcard="${esc(id)}">${ico('plus')} Make flashcard</button><button class="btn sm ghost" data-rm="${esc(id)}">${ico('trash')} Remove</button></div>
    </div>`; }).join('')}</div>`
    : `<div class="card done"><div class="big">✅</div><h2>No mistakes waiting</h2><p class="sub">Wrong answers from MCQ practice will appear here.</p><a class="btn primary" href="#/mcq">Practise MCQs</a></div>`}
  </div>`;
}

// ---- museum
let MUSEUM = { group: 'all', tab: 'gross' };
function viewMuseum() {
  if (!D.specimens) return `<div class="page"><p>Specimens could not be loaded.</p></div>`;
  const items = D.specimens.items.filter(s => MUSEUM.group === 'all' || s.group === MUSEUM.group);
  const tabs = `<div class="seg" data-museumtab><button data-v="gross" class="${MUSEUM.tab === 'gross' ? 'on' : ''}">Gross specimens · ${D.specimens.items.length}</button><button data-v="micro" class="${MUSEUM.tab === 'micro' ? 'on' : ''}">Histology · ${D.micro.length}</button></div>`;
  const nCorr = D.specimens.items.filter(s => s.correction).length;
  let body;
  if (MUSEUM.tab === 'micro') {
    body = `<div class="micro-grid">${D.micro.map(m => `<div class="card micro"><img src="${esc(m.file)}" alt="${esc(m.title)}" loading="lazy" data-zoom="${esc(m.file)}" data-cap="${esc(m.title + ' — ' + m.caption)}"><div class="body"><b>${esc(m.title)}</b><span style="color:var(--ink-2)">${esc(m.caption)}</span><span class="pill" style="align-self:flex-start">${esc((D.topics[m.topic] || {}).title || m.topic)}</span><span class="credit">${esc(m.author)} · ${esc(m.license)} · <a href="${esc(m.source)}" target="_blank" rel="noopener">source</a></span></div></div>`).join('')}</div>`;
  } else {
    body = `<div class="chips" style="margin-bottom:16px"><button class="chip${MUSEUM.group === 'all' ? ' on' : ''}" data-grp="all">All <span class="n">${D.specimens.items.length}</span></button>${D.specimens.groups.map(g => `<button class="chip${MUSEUM.group === g ? ' on' : ''}" data-grp="${esc(g)}">${esc(g)} <span class="n">${D.specimens.items.filter(s => s.group === g).length}</span></button>`).join('')}</div>
    <div class="gallery">${items.map(s => `<a class="spec" href="#/museum/${s.id}"><div class="ph">${s.images.length ? `<img src="${esc(s.images[0])}" alt="${esc(s.name)}" loading="lazy">` : `<div class="noimg">${esc(s.organ)}<br>description only</div>`}${s.correction ? '<span class="badge pill medium">Corrected</span>' : ''}</div><div class="body"><b>${esc(s.name)}</b><small>${esc(s.organ)} · ${esc(s.group)}</small></div></a>`).join('')}</div>`;
  }
  return `<div class="page">
  <div class="head"><div><h1>Specimen museum</h1><p class="sub">Your class jars with exam-ready descriptions, checked against Robbins. ${nCorr} descriptions were corrected or completed from the original notes.</p></div>
  <div class="hero-actions"><a class="btn primary" href="#/quiz?mode=spotter&r=${Date.now()}">${ico('image')} Spotter quiz</a>${D.micro.length ? `<a class="btn" href="#/quiz?mode=histo&r=${Date.now()}">Histology quiz</a>` : ''}</div></div>
  <div style="margin-bottom:16px">${tabs}</div>${body}</div>`;
}
function viewSpecimen(id) {
  const s = specById(id); if (!s) return viewMuseum();
  const i = MUSEUM.img && MUSEUM.img[0] === id ? MUSEUM.img[1] : 0;
  const idx = D.specimens.items.findIndex(x => x.id === id); const prev = D.specimens.items[idx - 1], next = D.specimens.items[idx + 1];
  return `<div class="page">
  <div class="qtop" style="margin-bottom:18px"><a class="btn ghost sm" href="#/museum">${ico('back')} Museum</a><span class="spacer"></span>${prev ? `<a class="btn sm" href="#/museum/${prev.id}">← ${esc(prev.name)}</a>` : ''}${next ? `<a class="btn sm" href="#/museum/${next.id}">${esc(next.name)} →</a>` : ''}</div>
  <div class="detail">
    <div class="photos">${s.images.length ? `<img src="${esc(s.images[i])}" alt="${esc(s.name)}" data-zoom="${esc(s.images[i])}" data-cap="${esc(s.name)}">${s.images.length > 1 ? `<div class="thumbs">${s.images.map((im, k) => `<button data-thumb="${k}" class="${k === i ? 'on' : ''}"><img src="${esc(im)}" alt=""></button>`).join('')}</div>` : ''}<div class="credit">Photo from your class specimen set.</div>` : `<div class="card" style="text-align:center;padding:40px 20px"><div class="muted">No photo of this jar in your notes — learn it from the description.</div></div>`}</div>
    <div class="facts">
      <div><div class="eyebrow">${esc(s.organ)} · ${esc(s.group)}</div><h1 style="margin-top:4px">${esc(s.name)}</h1></div>
      <div><h3>Gross features</h3><ul>${s.gross.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
      <div><h3>Key points</h3><ul>${s.keyPoints.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
      ${s.correction ? `<div class="callout"><b>Corrected from your notes.</b> ${esc(s.correction)}</div>` : ''}
      <div><h3 style="margin-bottom:8px">Viva questions</h3><div style="display:flex;flex-direction:column;gap:8px">${s.viva.map(v => `<details class="viva"><summary>${esc(v.q)}</summary><div>${esc(v.a)}</div></details>`).join('')}</div></div>
      <div class="hero-actions"><a class="btn" href="#/mcq?deck=${s.topic}">${ico('mcq')} ${esc(deckTitle(s.topic))} MCQs</a></div>
    </div>
  </div></div>`;
}

// ---- progress / scoreboard
function viewProgress() {
  const t = totals(), lp = levelProgress(), s = streak(), best = bestStreak();
  const got = BADGES.filter(b => S.badges[b.id]).length;
  return `<div class="page">
  <div class="head"><div><h1>Scoreboard</h1><p class="sub">Hit your daily goal — ${S.settings.goal} cards or questions, or clear everything due — to keep the streak alive.</p></div></div>
  <div class="hero">
    <div class="card streak-card"><div class="streak-top">${FLAME_SVG(!goalMet(dayKey()))}<div><div class="streak-num">${s}</div><div class="streak-lbl">current streak · best ${best}</div></div></div>
      <div><div class="goal-row"><span>Level ${lp.L}</span><span>${S.xp} XP · ${lp.toNext} to level ${lp.L + 1}</span></div><div class="goal-bar"><i style="width:${lp.pct}%"></i></div></div>
      <p class="muted" style="margin:0;font-size:13px">XP: +1 per card, +3 per correct MCQ, +1 per attempt, +5 per mistake cleared.</p></div>
    <div class="grid g2" style="gap:12px">
      <div class="card stat"><b>${t.cards}</b><span>cards reviewed</span></div>
      <div class="card stat"><b>${t.mcq}</b><span>MCQs answered</span></div>
      <div class="card stat"><b>${t.mcq ? t.acc + '%' : '—'}</b><span>MCQ accuracy</span></div>
      <div class="card stat"><b>${t.mature}</b><span>cards in long-term memory</span></div>
    </div>
  </div>
  <div class="section-title"><h2>Activity</h2><span class="muted">${t.days} study day${t.days === 1 ? '' : 's'}</span></div>
  <div class="card">${heatmap(26)}</div>
  <div class="section-title"><h2>Badges</h2><span class="muted">${got} of ${BADGES.length}</span></div>
  <div class="badges">${BADGES.map(b => `<div class="badge-item${S.badges[b.id] ? ' got' : ''}"><div class="medal">${b.icon}</div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join('')}</div>
  <div class="section-title"><h2>Settings</h2></div>
  <div class="card settings">
    <div class="setting"><div><b>New cards per day</b><small>How many fresh flashcards are released each day.</small></div><div class="seg" data-setting="newPerDay">${[10, 20, 30, 50].map(v => `<button data-v="${v}" class="${S.settings.newPerDay === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
    <div class="setting"><div><b>Daily goal</b><small>Cards + questions needed to count the day for your streak.</small></div><div class="seg" data-setting="goal">${[10, 20, 40, 60].map(v => `<button data-v="${v}" class="${S.settings.goal === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
    <div class="setting"><div><b>New card order</b><small>Syllabus order finishes one topic before the next; mixed rotates topics daily.</small></div><div class="seg" data-setting="order"><button data-v="syllabus" class="${S.settings.order === 'syllabus' ? 'on' : ''}">Syllabus</button><button data-v="mixed" class="${S.settings.order === 'mixed' ? 'on' : ''}">Mixed</button></div></div>
    <div class="setting"><div><b>Decks in daily study</b><small>Untick a deck to keep it out of “Study all”.</small></div><div class="chips">${D.decks.map(d => `<button class="chip${activeDecks().includes(d.id) ? ' on' : ''}" data-activedeck="${d.id}">${esc(d.title)}</button>`).join('')}</div></div>
    <div class="setting"><div><b>Theme</b></div><div class="seg" data-theme-set><button data-v="auto" class="${S.settings.theme === 'auto' ? 'on' : ''}">Auto</button><button data-v="light" class="${S.settings.theme === 'light' ? 'on' : ''}">Light</button><button data-v="dark" class="${S.settings.theme === 'dark' ? 'on' : ''}">Dark</button></div></div>
    <div class="setting"><div><b>Backup</b><small>Progress is saved in this browser only. Export it to move to another device.</small></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="export">${ico('download')} Export</button><label class="btn sm">${ico('upload')} Import<input type="file" id="import" accept="application/json" hidden></label><button class="btn sm ghost" id="reset">Reset all</button></div></div>
  </div>
  <p class="muted" style="font-size:12.5px;margin-top:22px">Content is written to match Robbins Basic Pathology and checked by a second reviewer; Harsh Mohan was used for emphasis. Textbook figures are copyrighted, so pictures are your own specimen photos and openly licensed micrographs from Wikimedia Commons (credited on each image).</p>
  </div>`;
}

// ---------------------------------------------------------------- router
function render() {
  const [path, qs] = location.hash.slice(2).split('?');
  const parts = (path || 'today').split('/'); const params = new URLSearchParams(qs || '');
  let html;
  switch (parts[0]) {
    case 'cards': html = viewCards(); break;
    case 'study': html = viewStudy(); break;
    case 'mcq': html = viewMcqSetup(params); break;
    case 'quiz': html = viewQuiz(); break;
    case 'mistakes': html = viewMistakes(); break;
    case 'museum': html = parts[1] ? viewSpecimen(parts[1]) : viewMuseum(); break;
    case 'progress': html = viewProgress(); break;
    default: html = viewToday();
  }
  app().innerHTML = html; renderChrome();
}
function onRoute() {
  const [path, qs] = location.hash.slice(2).split('?'); const params = new URLSearchParams(qs || '');
  const r = (path || 'today').split('/')[0];
  if (r === 'study') startSession(params);
  if (r === 'quiz') startQuiz(params);
  render(); window.scrollTo({ top: 0 }); app().focus({ preventScroll: true });
}

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  const t = e.target;
  const el = s => t.closest(s);
  if (el('#reveal')) { SESSION.shown = true; render(); return; }
  if (el('[data-g]')) { gradeCurrent(+el('[data-g]').dataset.g); return; }
  if (el('[data-opt]')) { answerQuiz(+el('[data-opt]').dataset.opt); return; }
  if (el('#next')) { nextQuiz(); return; }
  if (el('#prev')) { QUIZ.i = Math.max(0, QUIZ.i - 1); render(); return; }
  if (el('#submit')) { const left = QUIZ.qs.filter(q => QUIZ.answers[q.id] == null).length; if (!left || el('#submit').dataset.confirm) finishQuiz(); else { el('#submit').dataset.confirm = '1'; el('#submit').textContent = `${left} unanswered — submit anyway?`; } return; }
  if (el('[data-jump]')) { QUIZ.i = +el('[data-jump]').dataset.jump; render(); return; }
  if (el('#flag')) { const q = QUIZ.qs[QUIZ.i]; const r = (S.mcq[q.id] ||= { n: 0, right: 0, last: 0, lastRight: false, flag: false }); r.flag = !r.flag; save(); render(); return; }
  if (el('[data-deck]')) { const d = el('[data-deck]').dataset.deck; const on = QSET.decks.includes(d); QSET.decks = on ? QSET.decks.filter(x => x !== d) : QSET.decks.concat(d); QSET.sub = 'all'; render(); return; }
  if (el('[data-sub]')) { QSET.sub = el('[data-sub]').dataset.sub; render(); return; }
  const segBtn = el('.seg[data-key] button'); if (segBtn) { const key = segBtn.parentNode.dataset.key; const v = segBtn.dataset.v; QSET[key] = key === 'count' ? +v : v; render(); return; }
  const setBtn = el('.seg[data-setting] button'); if (setBtn) { const k = setBtn.parentNode.dataset.setting; const v = setBtn.dataset.v; S.settings[k] = isNaN(+v) ? v : +v; save(); render(); return; }
  const thBtn = el('[data-theme-set] button'); if (thBtn) { setTheme(thBtn.dataset.v); render(); return; }
  if (el('[data-activedeck]')) { const d = el('[data-activedeck]').dataset.activedeck; let a = activeDecks().filter(x => x !== 'mine'); a = a.includes(d) ? a.filter(x => x !== d) : a.concat(d); if (!a.length) { toast('Keep at least one deck'); return; } S.settings.decks = a.concat('mine'); save(); render(); return; }
  if (el('[data-mf]')) { MFILTER = el('[data-mf]').dataset.mf; render(); return; }
  if (el('[data-rm]')) { delete S.mistakes[el('[data-rm]').dataset.rm]; save(); render(); toast('Removed from mistakes'); return; }
  if (el('[data-mkcard]')) { mistakeToCard(el('[data-mkcard]').dataset.mkcard); render(); return; }
  if (el('[data-grp]')) { MUSEUM.group = el('[data-grp]').dataset.grp; render(); return; }
  const mt = el('[data-museumtab] button'); if (mt) { MUSEUM.tab = mt.dataset.v; render(); return; }
  if (el('[data-thumb]')) { const id = location.hash.split('/')[2]; MUSEUM.img = [id, +el('[data-thumb]').dataset.thumb]; render(); return; }
  if (el('#export')) { const blob = new Blob([JSON.stringify(S)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pathdeck-backup-${dayKey()}.json`; a.click(); return; }
  if (el('#reset')) { const b = el('#reset'); if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Tap again to erase everything'; return; } S = defaultState(); save(); buildDecks(); render(); toast('Progress reset'); return; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'import') {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => { const j = JSON.parse(txt); if (!j || !j.srs || !j.log) throw new Error('bad'); S = Object.assign(defaultState(), j); save(); buildDecks(); render(); toast('Backup restored'); }).catch(() => toast('That file is not a PathDeck backup'));
  }
});
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!$('#lightbox').hidden) { if (e.key === 'Escape') $('#lightbox').hidden = true; return; }
  const r = location.hash.slice(2).split(/[/?]/)[0];
  if (r === 'study' && SESSION && SESSION.current) {
    if (!SESSION.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); SESSION.shown = true; render(); return; }
    if (SESSION.shown && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); gradeCurrent(+e.key); return; }
    if (SESSION.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); gradeCurrent(3); return; }
  }
  if (r === 'quiz' && QUIZ && !QUIZ.finished && QUIZ.qs.length) {
    const k = e.key.toLowerCase(); const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
    if (k in map) { e.preventDefault(); answerQuiz(map[k]); return; }
    if (e.key === 'Enter') { const q = QUIZ.qs[QUIZ.i]; if (QUIZ.exam || QUIZ.revealed[q.id]) { e.preventDefault(); nextQuiz(); } return; }
    if (e.key === 'ArrowRight' && QUIZ.exam) { nextQuiz(); return; }
    if (e.key === 'ArrowLeft' && QUIZ.exam) { QUIZ.i = Math.max(0, QUIZ.i - 1); render(); return; }
  }
  if (r === 'today' || r === '' ) { if (e.key === 's') location.hash = '#/study'; }
});
function setTheme(v) {
  S.settings.theme = v; save();
  try { localStorage.setItem('pathdeck:theme', v); } catch (e) {}
  if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
}
setInterval(() => { const el = $('#timer'); if (el) el.textContent = quizTimer(); }, 1000);
window.addEventListener('hashchange', onRoute);

// ---------------------------------------------------------------- boot
load();
loadData().then(() => { if (!location.hash) location.hash = '#/today'; onRoute(); checkBadges(); })
  .catch(err => { app().innerHTML = `<div class="page"><div class="card"><h2>Couldn’t load the decks</h2><p class="muted">${esc(err.message)}</p></div></div>`; });
window.__pathdeck = { schedule, newState, S: () => S, D };
})();
