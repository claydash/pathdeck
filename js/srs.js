// Anki-style SM-2 scheduler. Pure functions: state in → next state out.
import { MIN, DAY, dayStart, hash, fmtIvl, now } from './util.js';

export const LEARN_STEPS = [1, 10];   // minutes
export const RELEARN_STEPS = [10];    // minutes
export const GRAD_IVL = 1, EASY_IVL = 4;
export const LEARN_AHEAD = 20 * MIN;

export const newState = () => ({ type: 'new', step: 0, due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, last: 0 });
export const isLearning = s => s.type === 'learning' || s.type === 'relearning';
const reviewDue = days => dayStart() + Math.max(1, Math.round(days)) * DAY;
function fuzz(ivl, id) { if (ivl < 3) return ivl; const f = Math.max(1, Math.round(ivl * 0.05)); return ivl + ((hash(id + ivl) % (2 * f + 1)) - f); }

/** grade: 1 again · 2 hard · 3 good · 4 easy */
export function schedule(c, grade, id, t = now()) {
  const s = { ...c, reps: (c.reps || 0) + 1, last: t };
  if (s.type === 'new' || isLearning(s)) {
    const relearn = s.type === 'relearning';
    const steps = relearn ? RELEARN_STEPS : LEARN_STEPS;
    const lt = relearn ? 'relearning' : 'learning';
    const graduateIvl = relearn ? Math.max(1, s.ivl) : GRAD_IVL;
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
  const elapsed = Math.max(s.ivl, (t - (c.due - s.ivl * DAY)) / DAY);
  if (grade === 1) { s.lapses = (s.lapses || 0) + 1; s.ease = Math.max(1.3, s.ease - 0.2); s.type = 'relearning'; s.step = 0; s.ivl = 1; s.due = t + RELEARN_STEPS[0] * MIN; return s; }
  const hardIvl = Math.max(s.ivl + 1, Math.round(s.ivl * 1.2));
  const goodIvl = Math.max(hardIvl + 1, Math.round(elapsed * s.ease));
  const easyIvl = Math.max(goodIvl + 1, Math.round(elapsed * s.ease * 1.3));
  if (grade === 2) { s.ease = Math.max(1.3, s.ease - 0.15); s.ivl = hardIvl; }
  if (grade === 3) s.ivl = goodIvl;
  if (grade === 4) { s.ease += 0.15; s.ivl = easyIvl; }
  s.ivl = Math.min(36500, fuzz(s.ivl, id)); s.due = reviewDue(s.ivl); return s;
}
export function previewLabels(state, id) {
  const t = now();
  return [1, 2, 3, 4].map(g => { const n = schedule(state, g, id, t); return n.type === 'review' ? fmtIvl(n.ivl * DAY) : fmtIvl(n.due - t); });
}
export function isDue(s, t = now()) {
  if (!s || s.type === 'new') return false;
  if (isLearning(s)) return s.due <= t;
  return s.due < dayStart() + DAY;
}
