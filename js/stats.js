// Derived numbers: queues and counts, mastery, weak areas, trends, badges.
import { D, chapterOrder } from './content.js';
import { S, sub, isExcluded, todayLog, goalMet, bestStreak, openMistakes, save } from './store.js';
import { isLearning, LEARN_AHEAD } from './srs.js';
import { now, dayStart, DAY, dayKey, addDays, toast } from './util.js';

// ---------------------------------------------------------------- flashcard queues
const inScope = (c, chapter) => chapter ? c.chapter === chapter : (c.chapter === 'mine' || !isExcluded(c.chapter));
export function newQueue(chapter) {
  const P = sub();
  const pool = D.cards.filter(c => inScope(c, chapter) && (!P.srs[c.key] || P.srs[c.key].type === 'new'));
  const mine = pool.filter(c => c.chapter === 'mine');
  let rest = pool.filter(c => c.chapter !== 'mine');
  const order = chapterOrder();
  if (S.settings.order === 'mixed') {
    const by = {}; rest.forEach(c => (by[c.chapter] ||= []).push(c));
    Object.values(by).forEach(a => a.sort((x, y) => x.order - y.order));
    const out = []; let added = true;
    while (added) { added = false; for (const d of order) { const a = by[d]; if (a && a.length) { out.push(a.shift()); added = true; } } }
    rest = out;
  } else rest.sort((a, b) => a.order - b.order);
  return mine.concat(rest);
}
export const newLeftToday = () => Math.max(0, S.settings.newPerDay - (todayLog().newCards || 0));
export function counts(chapter) {
  const t = now(), P = sub(); let learn = 0, due = 0;
  for (const c of D.cards) {
    if (!inScope(c, chapter)) continue;
    const s = P.srs[c.key]; if (!s || s.type === 'new') continue;
    if (isLearning(s)) { if (s.due <= t + LEARN_AHEAD) learn++; } else if (s.due < dayStart() + DAY) due++;
  }
  const newAvail = newQueue(chapter).length;
  return { new: Math.min(newAvail, newLeftToday()), newAvail, learn, due };
}
export function forecast(n) {
  const base = dayStart(), P = sub(), out = [];
  const states = Object.values(P.srs).filter(s => s.type !== 'new');
  for (let i = 0; i < n; i++) {
    const a = base + i * DAY, b = a + DAY;
    out.push({ label: i === 0 ? 'Today' : new Date(a + 12 * 36e5).toLocaleDateString(undefined, { weekday: 'short' }), n: states.filter(s => (i === 0 ? s.due < b : s.due >= a && s.due < b)).length });
  }
  return out;
}
export function refreshGoal() {
  const l = todayLog();
  if (!l.cleared && l.cards > 0) { const c = counts(); if (c.due === 0 && c.learn === 0 && c.new === 0) l.cleared = true; }
}

// ---------------------------------------------------------------- performance model
/** Score for one question in 0..1: recent attempts weigh more than old ones. */
export function qScore(r) {
  if (!r || !r.n) return null;
  const h = r.h || (r.lastRight ? '1' : '0');
  let w = 0, s = 0; for (let i = 0; i < h.length; i++) { const wt = 1 + i; w += wt; s += wt * (h[i] === '1' ? 1 : 0); }
  return s / w;
}
function bucket() { return { qTotal: 0, qTried: 0, qScore: 0, cTotal: 0, cSeen: 0, reps: 0, lapses: 0, mistakes: 0, byDiff: { easy: [0, 0], medium: [0, 0], hard: [0, 0] } }; }
function finish(b) {
  const acc = b.qTried ? b.qScore / b.qTried : null;
  const accShrunk = b.qTried ? (b.qScore + 0.5 * 2) / (b.qTried + 2) : 0;          // confidence-adjusted
  const retention = b.reps >= 3 ? 1 - b.lapses / b.reps : null;
  const coverage = ((b.qTotal ? b.qTried / b.qTotal : 0) + (b.cTotal ? b.cSeen / b.cTotal : 0)) / ((b.qTotal ? 1 : 0) + (b.cTotal ? 1 : 0) || 1);
  const started = b.qTried + b.cSeen > 0;
  const mastery = started ? Math.round(100 * (0.5 * accShrunk * Math.min(1, 0.4 + coverage) + 0.2 * (retention ?? accShrunk) + 0.3 * coverage)) : 0;
  return { ...b, acc, retention, coverage, mastery, started };
}
export function analyse() {
  const P = sub();
  const ch = {}, hd = {};
  const H = (c, s, title) => (hd[c + '|' + s] ||= { ...bucket(), chapter: c, sub: s, title });
  for (const c of D.chapters) ch[c.id] = bucket();
  for (const q of D.mcqs) {
    const b = ch[q.chapter]; if (!b) continue; const h = H(q.chapter, q.sub || '_', q.subTitle || 'General');
    const r = P.mcq[q.key]; const sc = qScore(r);
    for (const x of [b, h]) { x.qTotal++; if (sc != null) { x.qTried++; x.qScore += sc; x.byDiff[q.diff][0]++; if (r.lastRight) x.byDiff[q.diff][1]++; } }
    const m = P.mistakes[q.key]; if (m && !m.cleared) { b.mistakes++; h.mistakes++; }
  }
  for (const c of D.cards) {
    const b = ch[c.chapter]; if (!b) continue; const h = H(c.chapter, c.sub || '_', c.subTitle || 'General');
    const s = P.srs[c.key];
    for (const x of [b, h]) { x.cTotal++; if (s && s.type !== 'new') { x.cSeen++; x.reps += s.reps || 0; x.lapses += s.lapses || 0; } }
  }
  const chapters = D.chapters.map(c => ({ id: c.id, title: c.title, section: c.sectionTitle, ...finish(ch[c.id]) }));
  const headings = Object.values(hd).map(finish);
  const overall = finish(Object.values(ch).reduce((a, b) => {
    for (const k of ['qTotal', 'qTried', 'qScore', 'cTotal', 'cSeen', 'reps', 'lapses', 'mistakes']) a[k] += b[k];
    for (const d of ['easy', 'medium', 'hard']) { a.byDiff[d][0] += b.byDiff[d][0]; a.byDiff[d][1] += b.byDiff[d][1]; }
    return a;
  }, bucket()));
  return { chapters, headings, overall, focus: focusList(chapters, headings) };
}
function focusList(chapters, headings) {
  const out = [];
  headings.filter(h => h.qTried >= 2 && h.acc < 0.7).forEach(h => out.push({
    kind: 'weak', score: (1 - h.acc) * Math.log2(2 + h.qTried) + 0.15 * h.mistakes, chapter: h.chapter, sub: h.sub, title: h.title,
    reason: `${Math.round(h.acc * 100)}% on ${h.qTried} question${h.qTried === 1 ? '' : 's'}${h.mistakes ? ` · ${h.mistakes} open mistake${h.mistakes === 1 ? '' : 's'}` : ''}`,
    action: { label: 'Practise this heading', href: `#/quiz?mode=heading&chapter=${h.chapter}&sub=${encodeURIComponent(h.sub)}` }
  }));
  headings.filter(h => h.retention != null && h.retention < 0.8 && h.reps >= 6).forEach(h => out.push({
    kind: 'forget', score: (1 - h.retention) * 1.6, chapter: h.chapter, sub: h.sub, title: h.title,
    reason: `you forget about 1 in ${Math.max(2, Math.round(1 / Math.max(0.05, 1 - h.retention)))} of these cards`,
    action: { label: 'Cram these cards', href: `#/cram?chapter=${h.chapter}&sub=${encodeURIComponent(h.sub)}` }
  }));
  const started = chapters.filter(c => c.started);
  chapters.filter(c => !c.started && c.qTotal + c.cTotal > 0).slice(0, 2).forEach((c, i) => out.push({
    kind: 'start', score: 0.35 - i * 0.05 - (started.length ? 0 : 0.2), chapter: c.id, title: c.title, reason: 'not started yet',
    action: { label: 'Open chapter', href: `#/chapter/${c.id}` }
  }));
  chapters.filter(c => c.started && c.coverage < 0.5 && c.qTotal).forEach(c => out.push({
    kind: 'cover', score: 0.3 * (1 - c.coverage), chapter: c.id, title: c.title, reason: `only ${Math.round(c.coverage * 100)}% covered`,
    action: { label: 'Practise unseen questions', href: `#/quiz?mode=chapter&chapter=${c.id}&unseen=1` }
  }));
  const seen = new Set();
  return out.sort((a, b) => b.score - a.score).filter(f => { const k = f.chapter + '|' + (f.sub || ''); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
}
export function trend(days = 14) {
  const t = dayKey(); const out = [];
  for (let i = days - 1; i >= 0; i--) { const k = addDays(t, -i); const l = S.log[k] || {}; out.push({ k, mcq: l.mcq || 0, right: l.right || 0, cards: l.cards || 0, secs: l.secs || 0 }); }
  return out;
}
export function totals() {
  let cards = 0, mcq = 0, right = 0, days = 0, secs = 0;
  for (const l of Object.values(S.log)) { cards += l.cards || 0; mcq += l.mcq || 0; right += l.right || 0; secs += l.secs || 0; if ((l.cards || 0) + (l.mcq || 0)) days++; }
  const mature = Object.values(sub().srs).filter(s => s.type === 'review' && s.ivl >= 21).length;
  return { cards, mcq, right, days, secs, mature, acc: mcq ? Math.round((100 * right) / mcq) : 0 };
}

// ---------------------------------------------------------------- badges
export const BADGES = [
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
  { id: 'm80', icon: '🏆', name: 'Chapter master', desc: 'Reach 80 mastery in any chapter', test: () => analyse().chapters.some(c => c.mastery >= 80) }
];
export function checkBadges() {
  let got = false;
  for (const b of BADGES) if (!S.badges[b.id] && b.test()) { S.badges[b.id] = now(); toast(`${b.icon} Badge unlocked: ${b.name}`); got = true; }
  if (got) save();
  return got;
}
export const mistakeCount = () => openMistakes().filter(([k]) => D.mcqByKey[k]).length;
export { goalMet };
