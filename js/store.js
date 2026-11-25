// Local-first state. Saved to localStorage instantly; cloud.js mirrors it to Firestore when signed in.
import { now, dayKey, addDays } from './util.js';
import { newState, schedule, isLearning } from './srs.js';

const KEY_V2 = 'pathdeck:v2', KEY_V1 = 'pathdeck:v1';

export const defaultSettings = () => ({ newPerDay: 20, goal: 20, order: 'syllabus', theme: 'auto', excluded: {} });
export const blankSubject = () => ({ srs: {}, mcq: {}, mistakes: {}, custom: [], updatedAt: 0 });
export const defaultState = () => ({
  v: 2, created: now(), xp: 0, cleared: 0, log: {}, badges: {}, settings: defaultSettings(), settingsAt: 0,
  subject: 'pathology', onboarded: false, updatedAt: 0, subjects: {}
});

export let S = defaultState();
const listeners = new Set();
const dirty = new Set();
export const onChange = fn => listeners.add(fn);
export const takeDirty = () => { const d = [...dirty]; dirty.clear(); return d; };

export function load() {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) S = normalize(JSON.parse(raw));
    else {
      const v1 = localStorage.getItem(KEY_V1);
      S = defaultState();
      if (v1) { const o = JSON.parse(v1); S.legacy = { srs: o.srs || {}, mcq: o.mcq || {}, mistakes: o.mistakes || {}, custom: o.custom || [] };
        Object.assign(S, { xp: o.xp || 0, cleared: o.cleared || 0, log: o.log || {}, badges: o.badges || {}, created: o.created || now(), onboarded: true });
        S.settings = { ...defaultSettings(), newPerDay: o.settings?.newPerDay || 20, goal: o.settings?.goal || 20, order: o.settings?.order || 'syllabus', theme: o.settings?.theme || 'auto' }; }
    }
  } catch (e) { S = defaultState(); }
  return S;
}
function normalize(o) {
  const s = Object.assign(defaultState(), o);
  s.settings = Object.assign(defaultSettings(), s.settings || {});
  s.subjects = s.subjects || {};
  return s;
}
export function save(scope) {
  S.updatedAt = now();
  dirty.add('meta'); if (scope) dirty.add(scope);
  try { localStorage.setItem(KEY_V2, JSON.stringify(S)); } catch (e) { /* storage full or blocked: keep in memory */ }
  listeners.forEach(fn => fn(scope));
}
export function replaceState(next, silent) {
  S = normalize(next);
  try { localStorage.setItem(KEY_V2, JSON.stringify(S)); } catch (e) {}
  if (!silent) listeners.forEach(fn => fn('all'));
}

export const sub = (id = S.subject) => (S.subjects[id] ||= blankSubject());
export const todayLog = () => (S.log[dayKey()] ||= { cards: 0, newCards: 0, mcq: 0, right: 0, xp: 0, secs: 0 });
export function addXP(n) { S.xp += n; todayLog().xp += n; }
export function addSecs(s) { todayLog().secs = (todayLog().secs || 0) + Math.min(90, Math.max(0, s)); }

/** v1 progress used raw ids; map them onto "chapter:id" keys once content is loaded. */
export function migrateLegacy(D) {
  if (!S.legacy) return false;
  const L = S.legacy, P = sub('pathology');
  const byRaw = {}; D.cards.forEach(c => { byRaw['c:' + c.id] = c.key; }); D.mcqs.forEach(m => { byRaw['q:' + m.id] = m.key; });
  for (const [id, st] of Object.entries(L.srs)) { const k = byRaw['c:' + id]; if (k) P.srs[k] = st; }
  for (const [id, r] of Object.entries(L.mcq)) { const k = byRaw['q:' + id]; if (k) P.mcq[k] = { ...r, h: r.lastRight ? '1' : '0' }; }
  for (const [id, m] of Object.entries(L.mistakes)) { const k = byRaw['q:' + id]; if (k) P.mistakes[k] = m; }
  for (const c of L.custom) {
    const qid = String(c.id).replace(/^mine-/, ''); const qk = byRaw['q:' + qid]; if (!qk) continue;
    const key = 'mine:' + qk; P.custom.push({ ...c, id: key, key, sub: qk.split(':')[0] });
    if (L.srs[c.id]) P.srs[key] = L.srs[c.id];
  }
  delete S.legacy; save('pathology'); return true;
}

// ---------------------------------------------------------------- merging (sign-in / multi-device)
const newer = (a, b, f) => ((b && (b[f] || 0) > ((a && a[f]) || 0)) ? b : a || b);
function mergeMap(a = {}, b = {}, f) { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = newer(out[k], v, f); return out; }
export function mergeSubject(a = blankSubject(), b = blankSubject()) {
  const custom = [...(a.custom || [])]; (b.custom || []).forEach(c => { if (!custom.some(x => x.key === c.key)) custom.push(c); });
  return { srs: mergeMap(a.srs, b.srs, 'last'), mcq: mergeMap(a.mcq, b.mcq, 'last'), mistakes: mergeMap(a.mistakes, b.mistakes, 'at'), custom, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
}
export function mergeMeta(a, b) {
  const log = { ...(a.log || {}) };
  for (const [k, v] of Object.entries(b.log || {})) { const x = log[k] || {}; log[k] = {}; for (const f of new Set([...Object.keys(x), ...Object.keys(v)])) log[k][f] = typeof (x[f] ?? v[f]) === 'boolean' ? !!(x[f] || v[f]) : Math.max(x[f] || 0, v[f] || 0); }
  const badges = { ...(b.badges || {}), ...(a.badges || {}) };
  const settingsFromB = (b.settingsAt || 0) > (a.settingsAt || 0);
  return {
    xp: Math.max(a.xp || 0, b.xp || 0), cleared: Math.max(a.cleared || 0, b.cleared || 0), log, badges,
    created: Math.min(a.created || now(), b.created || now()), onboarded: !!(a.onboarded || b.onboarded),
    settings: settingsFromB ? { ...defaultSettings(), ...b.settings } : a.settings, settingsAt: Math.max(a.settingsAt || 0, b.settingsAt || 0),
    subject: settingsFromB ? b.subject || a.subject : a.subject
  };
}

// ---------------------------------------------------------------- records
export const cardState = key => sub().srs[key] || newState();
export function gradeCard(key, grade, secs) {
  const P = sub(); const before = P.srs[key] || newState();
  P.srs[key] = schedule(before, grade, key);
  const l = todayLog(); l.cards++; if (before.type === 'new' || before.reset) l.newCards++;
  addXP(1); addSecs(secs); save(S.subject);
  return { before, after: P.srs[key] };
}
export function practiceCard(secs) { const l = todayLog(); l.cards++; addXP(1); addSecs(secs); save(); }
export function recordAnswer(q, chosen, secs) {
  const P = sub(); const ok = chosen === q.ans;
  const r = (P.mcq[q.key] ||= { n: 0, right: 0, last: 0, lastRight: false, flag: false, h: '' });
  r.n++; if (ok) r.right++; r.last = now(); r.lastRight = ok; r.lastChosen = chosen; r.h = ((r.h || '') + (ok ? '1' : '0')).slice(-8); delete r.reset;
  const l = todayLog(); l.mcq++; if (ok) l.right++; addXP(ok ? 3 : 1); addSecs(secs);
  let clearedNow = false; const m = P.mistakes[q.key];
  if (!ok) P.mistakes[q.key] = { added: m && !m.cleared ? m.added : now(), chosen, run: 0, at: now() };
  else if (m && !m.cleared) { m.run = (m.run || 0) + 1; m.at = now(); if (m.run >= 2) { P.mistakes[q.key] = { cleared: now(), at: now() }; S.cleared++; addXP(5); clearedNow = true; } }
  save(S.subject);
  return { ok, clearedNow };
}
export function toggleFlag(q) { const P = sub(); const r = (P.mcq[q.key] ||= { n: 0, right: 0, last: 0, lastRight: false, flag: false, h: '' }); r.flag = !r.flag; r.last = Math.max(r.last || 0, now()); save(S.subject); return r.flag; }
export const openMistakes = () => Object.entries(sub().mistakes).filter(([, m]) => !m.cleared);
export function removeMistake(key) { sub().mistakes[key] = { cleared: now(), at: now(), dismissed: true }; save(S.subject); }
export function resetCards(chapterId, D) {
  const P = sub(); let n = 0;
  D.cards.filter(c => c.chapter === chapterId).forEach(c => { if (P.srs[c.key] && P.srs[c.key].type !== 'new') n++; P.srs[c.key] = { ...newState(), last: now(), reset: true }; });
  save(S.subject); return n;
}
export function resetMcqs(chapterId, D) {
  const P = sub(); let n = 0;
  D.mcqs.filter(q => q.chapter === chapterId).forEach(q => {
    if (P.mcq[q.key] && P.mcq[q.key].n) n++;
    P.mcq[q.key] = { n: 0, right: 0, last: now(), lastRight: false, flag: false, h: '', reset: true };
    if (P.mistakes[q.key] && !P.mistakes[q.key].cleared) P.mistakes[q.key] = { cleared: now(), at: now(), dismissed: true };
  });
  save(S.subject); return n;
}
export function setSetting(k, v) { S.settings[k] = v; S.settingsAt = now(); save(); }
export const isExcluded = ch => (S.settings.excluded[S.subject] || []).includes(ch);
export function toggleExcluded(ch) { const a = new Set(S.settings.excluded[S.subject] || []); a.has(ch) ? a.delete(ch) : a.add(ch); S.settings.excluded = { ...S.settings.excluded, [S.subject]: [...a] }; S.settingsAt = now(); save(); }

// ---------------------------------------------------------------- streak
export function goalMet(k) { const l = S.log[k]; return !!l && ((l.cards || 0) + (l.mcq || 0) >= S.settings.goal || !!l.cleared); }
export function streak() { const t = dayKey(); let k = goalMet(t) ? t : addDays(t, -1), n = 0; while (goalMet(k)) { n++; k = addDays(k, -1); } return n; }
export function bestStreak() { let best = 0, run = 0, prev = null; for (const k of Object.keys(S.log).filter(goalMet).sort()) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; } return best; }
export function level(xp = S.xp) { return Math.floor(Math.sqrt(xp / 25)) + 1; }
export function levelProgress(xp = S.xp) { const L = level(xp); const a = 25 * (L - 1) ** 2, b = 25 * L ** 2; return { L, pct: Math.round((100 * (xp - a)) / (b - a)), toNext: b - xp }; }
export { isLearning };
