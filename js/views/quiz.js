import { D, chapterTitle, specById, imageBySlug } from '../content.js';
import { S, sub, recordAnswer, toggleFlag } from '../store.js';
import { analyse, checkBadges, totals, goalMet } from '../stats.js';
import { esc, ico, LETTERS, shuffle, now, plural, cropImg, ring, dayKey, confetti } from '../util.js';

const QSET = { chapters: null, diff: 'all', status: 'all', count: 20, mode: 'tutor', sub: 'all' };
let QUIZ = null, LAST = null;
const rec = q => sub().mcq[q.key];

function filterQs(o) {
  const chs = o.chapters && o.chapters.length ? o.chapters : D.chapters.map(c => c.id);
  return D.mcqs.filter(q => chs.includes(q.chapter) && (o.diff === 'all' || q.diff === o.diff) && (o.sub === 'all' || q.sub === o.sub)
    && (o.status === 'all' || (o.status === 'unseen' && !(rec(q) && rec(q).n)) || (o.status === 'wrong' && rec(q) && rec(q).n && !rec(q).lastRight) || (o.status === 'flagged' && rec(q) && rec(q).flag)));
}
const band = q => { const r = rec(q); return !(r && r.n) ? 0 : !r.lastRight ? 1 : 2; };
const prioritised = pool => [0, 1, 2].flatMap(b => shuffle(pool.filter(q => band(q) === b)));

export function viewSetup(params) {
  if (params.get('chapter')) { QSET.chapters = [params.get('chapter')]; QSET.sub = 'all'; history.replaceState(null, '', '#/mcq'); }
  if (!QSET.chapters || !QSET.chapters.every(id => D.chapterById[id])) QSET.chapters = D.chapters.filter(c => c.kind === 'topic').map(c => c.id);
  const pool = filterQs(QSET);
  const chips = D.subject.sections.map(sec => `<div class="chip-group"><span class="chip-label">${esc(sec.title)}</span><div class="chips">${sec.chapters.filter(c => D.chapterById[c.id]).map(c => { const n = D.mcqs.filter(q => q.chapter === c.id).length; return `<button class="chip${QSET.chapters.includes(c.id) ? ' on' : ''}" data-act="q-ch" data-id="${c.id}">${esc(c.title)} <span class="n">${n}</span></button>`; }).join('')}</div></div>`).join('');
  const one = QSET.chapters.length === 1 ? D.chapterById[QSET.chapters[0]] : null;
  const subs = one && (one.data.subtopics || []).length > 1 ? `<div class="field"><span class="lbl">Competency heading</span><div class="chips"><button class="chip${QSET.sub === 'all' ? ' on' : ''}" data-act="q-sub" data-id="all">All headings</button>${one.data.subtopics.map(s => { const n = D.mcqs.filter(q => q.chapter === one.id && q.sub === s.id).length; return n ? `<button class="chip${QSET.sub === s.id ? ' on' : ''}" data-act="q-sub" data-id="${esc(s.id)}">${esc(s.title)} <span class="n">${n}</span></button>` : ''; }).join('')}</div></div>` : '';
  const dc = d => filterQs({ ...QSET, diff: d }).length;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="q-set" data-k="${key}" data-v="${v}" class="${String(QSET[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const t = totals(); const n = Math.min(pool.length, QSET.count);
  return `<div class="page narrow">
  <div class="head"><div><h1>MCQ practice</h1><p class="sub">${D.mcqs.length} single-best-answer questions graded easy, medium and hard — each with an explanation and what to read next.</p></div></div>
  <div class="card setup">
    <div class="field"><div class="lbl-row"><span class="lbl">Chapters</span><span><button class="link" data-act="q-all">All</button> · <button class="link" data-act="q-none">None</button></span></div>${chips}</div>
    ${subs}
    <div class="field"><span class="lbl">Difficulty</span>${seg('diff', [['all', 'All'], ['easy', `Easy · ${dc('easy')}`], ['medium', `Medium · ${dc('medium')}`], ['hard', `Hard · ${dc('hard')}`]])}</div>
    <div class="field"><span class="lbl">Which questions</span>${seg('status', [['all', 'All'], ['unseen', 'Unseen'], ['wrong', 'Got wrong'], ['flagged', 'Flagged']])}</div>
    <div class="grid g2">
      <div class="field"><span class="lbl">How many</span>${seg('count', [[10, '10'], [20, '20'], [40, '40'], [999, 'All']])}</div>
      <div class="field"><span class="lbl">Mode</span>${seg('mode', [['tutor', 'Tutor'], ['exam', 'Exam (timed)']])}</div>
    </div>
    <div class="setup-foot"><span class="muted"><b class="ink">${pool.length}</b> question${pool.length === 1 ? '' : 's'} match${t.mcq ? ` · your accuracy so far ${t.acc}%` : ''}</span>
      ${pool.length ? `<a class="btn primary lg" href="#/quiz?mode=set&r=${now()}">${ico('play')} Start ${n} question${n === 1 ? '' : 's'}</a>` : `<button class="btn primary lg" disabled>No questions match</button>`}</div>
  </div></div>`;
}

export function startQuiz(params) {
  const mode = params.get('mode'); const ch = params.get('chapter'); let qs = [], exam = false, title = 'Practice';
  if (mode === 'mistakes') { const f = params.get('chapter'); qs = shuffle(Object.entries(sub().mistakes).filter(([, m]) => !m.cleared).map(([k]) => D.mcqByKey[k]).filter(q => q && (!f || q.chapter === f))); title = 'Mistakes'; }
  else if (mode === 'one') { const q = D.mcqByKey[params.get('key')]; qs = q ? [q] : []; title = 'Retry'; }
  else if (mode === 'spotter') { qs = shuffle(D.mcqs.filter(q => q.spec)).slice(0, 15); title = 'Spotter quiz'; }
  else if (mode === 'histo') { qs = shuffle(D.mcqs.filter(q => q.micro)); title = 'Histology quiz'; }
  else if (mode === 'chapter') { const pool = D.mcqs.filter(q => q.chapter === ch); qs = params.get('all') ? shuffle(pool) : prioritised(pool).slice(0, params.get('unseen') ? 20 : 999); title = chapterTitle(ch); }
  else if (mode === 'heading') { const s = params.get('sub'); qs = prioritised(D.mcqs.filter(q => q.chapter === ch && q.sub === s)); const st = (D.chapterById[ch]?.data.subtopics || []).find(x => x.id === s); title = st ? st.title : 'Heading'; }
  else if (mode === 'redo' && LAST) { qs = shuffle(LAST.keys.map(k => D.mcqByKey[k]).filter(Boolean)); exam = LAST.exam; title = 'Redo: ' + LAST.title; }
  else if (mode === 'wrong' && LAST) { qs = shuffle(LAST.wrong.map(k => D.mcqByKey[k]).filter(Boolean)); title = 'Wrong ones again'; }
  else { qs = prioritised(filterQs(QSET)).slice(0, QSET.count); exam = QSET.mode === 'exam'; title = exam ? 'Exam block' : 'Tutor mode'; }
  QUIZ = { qs, i: 0, answers: {}, revealed: {}, exam, title, mode, chapter: ch, start: now(), qStart: now(), finished: false, goalBefore: goalMet(dayKey()) };
}
const timer = () => { if (!QUIZ || !QUIZ.exam || QUIZ.finished) return ''; const s = Math.floor((now() - QUIZ.start) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const tick = () => { const el = document.getElementById('timer'); if (el) el.textContent = timer(); };

export function qImg(q) {
  if (!q.img) return '';
  const m = q.micro ? imageBySlug(q.micro) : null; const sp = q.spec ? specById(q.spec) : null;
  return `<div class="qimg"${q.crop ? '' : ` data-zoom="${esc(q.img)}"`}>${cropImg(q.img, q.crop, 'Question image', q.dims || (sp && sp.dims ? sp.dims[0] : null))}</div>${m ? `<div class="credit" style="margin:-10px 0 14px">Image: ${esc(m.author)}, ${esc(m.license)}</div>` : ''}`;
}
function exitHref(Z) {
  if (Z.mode === 'set') return '#/mcq';
  if (['spotter', 'histo'].includes(Z.mode)) return '#/museum';
  if (['chapter', 'heading'].includes(Z.mode)) return '#/chapter/' + Z.chapter;
  if (['mistakes', 'one'].includes(Z.mode)) return '#/mistakes';
  return '#/mcq';
}
export function viewQuiz() {
  const Z = QUIZ; if (!Z) return '';
  if (!Z.qs.length) return `<div class="page narrow"><div class="card done"><div class="big">🗂️</div><h1>No questions here</h1><p class="sub">Change the filters and try again.</p><a class="btn primary" href="#/mcq">Back to setup</a></div></div>`;
  if (Z.finished) return viewResults();
  const q = Z.qs[Z.i]; const chosen = Z.answers[q.key]; const shown = !Z.exam && Z.revealed[q.key]; const r = rec(q) || {};
  const opts = q.opts.map((o, k) => {
    let cls = 'opt', mark = '';
    if (shown) { cls += ' locked'; if (k === q.ans) { cls += ' right'; mark = ico('check'); } else if (k === chosen) { cls += ' wrong'; mark = ico('x'); } else cls += ' dim'; }
    else if (chosen === k) cls += ' sel';
    return `<button class="${cls}" data-act="answer" data-k="${k}"><span class="L">${LETTERS[k]}</span><span class="t">${esc(o)}</span><span class="mark">${mark}</span></button>`;
  }).join('');
  const ok = chosen === q.ans; const spec = q.spec ? specById(q.spec) : null;
  const explain = shown ? `<div class="explain ${ok ? 'is-ok' : 'is-no'}">
      <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? ico('check') + ' Correct' : ico('x') + ` Incorrect — the answer is ${LETTERS[q.ans]}`}${Z.lastCleared ? ' <span class="pill easy">Mistake cleared</span>' : ''}</div>
      <p>${esc(q.exp)}</p>
      ${q.related && q.related.length ? `<div class="readnext"><span class="lbl">Read next</span>${q.related.map(x => `<span class="pill hema">${esc(x)}</span>`).join('')}</div>` : ''}
      ${spec ? `<a class="small strong" href="#/museum/${spec.id}">Open ${esc(spec.name)} in the museum →</a>` : ''}
      <div class="ref">${ico('book')} ${esc(q.ref || '')}</div></div>` : '';
  const last = Z.i === Z.qs.length - 1;
  const foot = Z.exam
    ? `<div class="row-gap"><button class="btn" data-act="prev" ${Z.i ? '' : 'disabled'}>${ico('back')} Previous</button>${last ? `<button class="btn primary" data-act="submit">Submit block</button>` : `<button class="btn primary" data-act="next">Next <span class="kbd">↵</span></button>`}</div>`
    : shown ? `<button class="btn primary" data-act="next">${last ? 'See results' : 'Next question'} <span class="kbd">↵</span></button>` : `<span class="muted small">Pick an answer · keys <span class="kbd">A</span>–<span class="kbd">D</span></span>`;
  return `<div class="qwrap">
    <div class="qtop"><a class="btn ghost sm" href="${exitHref(Z)}">${ico('back')} Exit</a><b>${esc(Z.title)}</b><span class="muted">Question ${Z.i + 1} of ${Z.qs.length}</span><span class="spacer"></span>
      ${Z.exam ? `<span class="qtimer">${ico('timer')} <span id="timer">${timer()}</span></span>` : ''}
      <button class="btn ghost sm flagbtn${r.flag ? ' on' : ''}" data-act="flag" title="Flag for later">${ico('flag')} ${r.flag ? 'Flagged' : 'Flag'}</button></div>
    <div class="progress"><i style="width:${Math.round((100 * (Z.i + (shown ? 1 : 0))) / Z.qs.length)}%"></i></div>
    <div class="card qcard">
      <div class="flash-meta"><span class="pill ${q.diff}">${q.diff[0].toUpperCase() + q.diff.slice(1)}</span><span class="pill">${esc(chapterTitle(q.chapter))}</span>${q.subTitle && q.subTitle !== chapterTitle(q.chapter) ? `<span class="pill">${esc(q.subTitle)}</span>` : ''}${sub().mistakes[q.key] && !sub().mistakes[q.key].cleared ? '<span class="pill hard">In mistakes</span>' : ''}${r.n ? `<span class="pill">Seen ${r.n}×</span>` : ''}</div>
      <div class="qstem">${esc(q.q)}</div>${qImg(q)}<div class="opts">${opts}</div>${explain}
    </div>
    ${Z.exam ? `<div class="navgrid">${Z.qs.map((x, k) => `<button data-act="jump" data-k="${k}" class="${Z.answers[x.key] != null ? 'ans' : ''}${k === Z.i ? ' cur' : ''}">${k + 1}</button>`).join('')}</div>` : ''}
    <div class="qfoot"><span></span>${foot}</div>
  </div>`;
}
function answer(k, rr) {
  const Z = QUIZ; const q = Z.qs[Z.i];
  if (Z.exam) { Z.answers[q.key] = k; rr(); return; }
  if (Z.revealed[q.key]) return;
  Z.answers[q.key] = k; Z.revealed[q.key] = true;
  const r = recordAnswer(q, k, (now() - Z.qStart) / 1000); Z.lastCleared = r.clearedNow; checkBadges();
  if (!Z.goalBefore && goalMet(dayKey())) { Z.goalBefore = true; confetti(); }
  rr();
}
function next(rr) { const Z = QUIZ; if (Z.i < Z.qs.length - 1) { Z.i++; Z.lastCleared = false; Z.qStart = now(); rr(); window.scrollTo({ top: 0 }); } else finish(rr); }
function finish(rr) {
  const Z = QUIZ;
  if (Z.exam) { const per = (now() - Z.start) / 1000 / Math.max(1, Z.qs.length); Z.qs.forEach(q => { if (Z.answers[q.key] != null) recordAnswer(q, Z.answers[q.key], per); }); checkBadges(); }
  Z.finished = true; Z.secs = Math.round((now() - Z.start) / 1000);
  LAST = { keys: Z.qs.map(q => q.key), wrong: Z.qs.filter(q => Z.answers[q.key] !== q.ans).map(q => q.key), title: Z.title, exam: Z.exam };
  if (!Z.goalBefore && goalMet(dayKey())) confetti();
  rr(); window.scrollTo({ top: 0 });
}
function viewResults() {
  const Z = QUIZ; const n = Z.qs.length; const right = Z.qs.filter(q => Z.answers[q.key] === q.ans).length; const p = Math.round((100 * right) / n);
  const byHead = {}; Z.qs.forEach(q => { const k = q.chapter + '|' + q.sub; const b = (byHead[k] ||= { title: q.subTitle || chapterTitle(q.chapter), chapter: q.chapter, sub: q.sub, n: 0, r: 0 }); b.n++; if (Z.answers[q.key] === q.ans) b.r++; });
  const heads = Object.values(byHead).sort((a, b) => a.r / a.n - b.r / b.n);
  const byDiff = ['easy', 'medium', 'hard'].map(d => { const qs = Z.qs.filter(q => q.diff === d); return { d, n: qs.length, r: qs.filter(q => Z.answers[q.key] === q.ans).length }; }).filter(x => x.n);
  const weakest = heads.find(h => h.r / h.n < 0.7 && h.n >= 1);
  const wrong = Z.qs.filter(q => Z.answers[q.key] !== q.ans);
  const verdict = p >= 85 ? 'Excellent — this is exam-ready.' : p >= 70 ? 'Good. Tidy up the misses below.' : p >= 50 ? 'Getting there. Focus on the weak headings below.' : 'This area needs work — revise, then redo it.';
  const col = v => (v >= 0.75 ? 'var(--good)' : v >= 0.5 ? 'var(--warn)' : 'var(--bad)');
  return `<div class="page narrow">
    <div class="card"><div class="result-head">${ring(p, 132, 12, col(p / 100), p + '%')}<div class="grow"><div class="eyebrow">${esc(Z.title)}</div><h1>${right} of ${n} correct</h1>
      <p class="sub">${verdict}${Z.exam ? ` · ${Math.floor(Z.secs / 60)}m ${Z.secs % 60}s` : ''}</p>
      <div class="hero-actions" style="margin-top:12px">${wrong.length ? `<a class="btn primary" href="#/quiz?mode=wrong&r=${now()}">${ico('retry')} Redo the ${wrong.length} wrong</a>` : ''}<a class="btn" href="#/quiz?mode=redo&r=${now()}">${ico('retry')} Redo this block</a>${weakest ? `<a class="btn" href="#/quiz?mode=heading&chapter=${weakest.chapter}&sub=${encodeURIComponent(weakest.sub)}&r=${now()}">${ico('target')} Practise “${esc(weakest.title)}”</a>` : ''}</div></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>By heading</h3><div class="mini-bars">${heads.map(h => `<div class="mb"><span class="grow">${esc(h.title)}</span><span class="meter"><i style="width:${Math.round((100 * h.r) / h.n)}%;background:${col(h.r / h.n)}"></i></span><b>${h.r}/${h.n}</b></div>`).join('')}</div></div>
      <div class="card"><h3>By difficulty</h3><div class="mini-bars">${byDiff.map(x => `<div class="mb"><span class="grow"><span class="pill ${x.d}">${x.d}</span></span><span class="meter"><i style="width:${Math.round((100 * x.r) / x.n)}%;background:${col(x.r / x.n)}"></i></span><b>${x.r}/${x.n}</b></div>`).join('')}</div>
        <p class="muted small" style="margin:12px 0 0">${wrong.length ? `${plural(wrong.length, 'question')} went to your Mistakes list.` : 'Clean sheet — nothing added to Mistakes.'} <a href="#/insights">See full insights →</a></p></div>
    </div>
    <div class="section-title"><h2>Review answers</h2></div>
    <div class="stack">${Z.qs.map((q, k) => { const a = Z.answers[q.key]; const ok = a === q.ans; return `<div class="card mistake">
      <div class="flash-meta"><span class="pill ${ok ? 'easy' : 'hard'}">${ok ? 'Correct' : a == null ? 'Skipped' : 'Wrong'}</span><span class="pill ${q.diff}">${q.diff}</span><span class="pill">${esc(q.subTitle || chapterTitle(q.chapter))}</span></div>
      <div class="stem">${k + 1}. ${esc(q.q)}</div>${q.img ? qImg(q) : ''}
      <div class="ans">${!ok && a != null ? `<span class="k">You</span><span class="bad">${LETTERS[a]}. ${esc(q.opts[a])}</span>` : ''}<span class="k">Answer</span><span class="good">${LETTERS[q.ans]}. ${esc(q.opts[q.ans])}</span></div>
      <p class="exp">${esc(q.exp)}</p>${q.related ? `<div class="readnext"><span class="lbl">Read next</span>${q.related.map(x => `<span class="pill hema">${esc(x)}</span>`).join('')}</div>` : ''}</div>`; }).join('')}</div>
  </div>`;
}

export const actions = {
  'q-ch': (el, rr) => { const id = el.dataset.id; QSET.chapters = QSET.chapters.includes(id) ? QSET.chapters.filter(x => x !== id) : QSET.chapters.concat(id); QSET.sub = 'all'; rr(); },
  'q-all': (el, rr) => { QSET.chapters = D.chapters.map(c => c.id); QSET.sub = 'all'; rr(); },
  'q-none': (el, rr) => { QSET.chapters = []; QSET.sub = 'all'; rr(); },
  'q-sub': (el, rr) => { QSET.sub = el.dataset.id; rr(); },
  'q-set': (el, rr) => { const k = el.dataset.k, v = el.dataset.v; QSET[k] = k === 'count' ? +v : v; rr(); },
  answer: (el, rr) => answer(+el.dataset.k, rr),
  next: (el, rr) => next(rr),
  prev: (el, rr) => { QUIZ.i = Math.max(0, QUIZ.i - 1); rr(); },
  jump: (el, rr) => { QUIZ.i = +el.dataset.k; rr(); },
  submit: (el, rr) => { const left = QUIZ.qs.filter(q => QUIZ.answers[q.key] == null).length; if (!left || el.dataset.confirm) finish(rr); else { el.dataset.confirm = 1; el.textContent = `${left} unanswered — submit anyway?`; } },
  flag: (el, rr) => { toggleFlag(QUIZ.qs[QUIZ.i]); rr(); }
};
export function keys(e, route, rr) {
  if (route !== 'quiz' || !QUIZ || QUIZ.finished || !QUIZ.qs.length) return false;
  const k = e.key.toLowerCase(); const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
  if (k in map) { e.preventDefault(); answer(map[k], rr); return true; }
  if (e.key === 'Enter') { const q = QUIZ.qs[QUIZ.i]; if (QUIZ.exam || QUIZ.revealed[q.key]) { e.preventDefault(); next(rr); } return true; }
  if (QUIZ.exam && e.key === 'ArrowRight') { next(rr); return true; }
  if (QUIZ.exam && e.key === 'ArrowLeft') { QUIZ.i = Math.max(0, QUIZ.i - 1); rr(); return true; }
  return false;
}
