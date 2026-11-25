import { D, chapterTitle, specById, imageBySlug } from '../content.js';
import { S, sub, cardState, gradeCard, practiceCard, streak, isExcluded } from '../store.js';
import { counts, newQueue, newLeftToday, forecast, refreshGoal, checkBadges, goalMet } from '../stats.js';
import { previewLabels, isLearning, LEARN_AHEAD } from '../srs.js';
import { esc, ico, plural, shuffle, now, dayStart, DAY, dayKey, cropImg, confetti } from '../util.js';

function bars(data) {
  const max = Math.max(1, ...data.map(d => d.n));
  return `<div class="bars">${data.map(d => `<div class="b"><em>${d.n}</em><i style="height:${Math.round((80 * d.n) / max)}%"></i>${esc(d.label)}</div>`).join('')}</div>`;
}
export function viewDecks() {
  const all = counts();
  const P = sub();
  const row = (id, title, comp) => { const c = counts(id); const z = n => (n ? '' : ' zero'); const total = D.cards.filter(x => x.chapter === id).length;
    return `<a class="trow" href="#/study?chapter=${id}"><span class="tname">${esc(title)}<small>${esc(comp || '')}${isExcluded(id) ? ' · not in daily study' : ''}</small></span><span class="n c-new${z(c.new)}">${c.new}</span><span class="n c-learn${z(c.learn)}">${c.learn}</span><span class="n c-due${z(c.due)}">${c.due}</span><span class="meter-cell">${total} cards</span></a>`; };
  const sections = D.subject.sections.map(sec => `<div class="trow group"><span>${esc(sec.title)}</span></div>${sec.chapters.filter(ch => D.chapterById[ch.id]).map(ch => row(ch.id, ch.title, ch.competency)).join('')}`).join('');
  const mine = P.custom.length ? row('mine', 'My cards (from mistakes)', 'Made by you') : '';
  return `<div class="page">
  <div class="head"><div><h1>Flashcards</h1><p class="sub">Anki-style spaced repetition. Grade yourself honestly — the schedule adapts to how well you remember.</p></div>
  <a class="btn primary lg" href="#/study">${ico('play')} Study all (${all.new + all.learn + all.due})</a></div>
  <div class="card deck-table" style="padding:12px 14px"><div class="topic-table">
    <div class="trow th"><span>Deck</span><span class="n" style="color:var(--new)">New</span><span class="n" style="color:var(--learn)">Learn</span><span class="n" style="color:var(--due)">Due</span><span></span></div>${sections}${mine}</div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Coming up</h3><p class="muted small" style="margin:4px 0 0">Reviews scheduled for the next 7 days</p>${bars(forecast(7))}</div>
    <div class="card"><h3>How the schedule works</h3><ul class="plain-list">
      <li><b style="color:var(--new)">New</b> cards are released ${S.settings.newPerDay} a day.</li>
      <li><b style="color:var(--learn)">Learning</b> cards repeat at 1 and 10 minutes until you know them.</li>
      <li><b style="color:var(--due)">Due</b> cards return after 1 day, then roughly ×2.5 each time you get them right.</li>
      <li>Want to go over a chapter again without touching the schedule? Use <b>Practise cards again</b> on its chapter page.</li></ul></div>
  </div></div>`;
}

// ---------------------------------------------------------------- scheduled session
let SESSION = null;
export function startSession(params) {
  const chapter = params.get('chapter') || null; const onlyDue = params.get('only') === 'due';
  const t = now(), P = sub();
  const inScope = c => chapter ? c.chapter === chapter : (c.chapter === 'mine' || !isExcluded(c.chapter));
  const learning = [], review = [];
  for (const c of D.cards) {
    if (!inScope(c)) continue; const s = P.srs[c.key]; if (!s || s.type === 'new') continue;
    if (isLearning(s) && s.due <= t + LEARN_AHEAD) learning.push(c.key); else if (!isLearning(s) && s.due < dayStart() + DAY) review.push(c.key);
  }
  const news = onlyDue ? [] : newQueue(chapter).slice(0, newLeftToday()).map(c => c.key);
  let ahead = false;
  if (!learning.length && !review.length && !news.length) {
    const next = D.cards.filter(inScope).map(c => [c, P.srs[c.key]]).filter(([, s]) => s && s.type !== 'new').sort((a, b) => a[1].due - b[1].due).slice(0, 15).map(([c]) => c.key);
    if (next.length) review.push(...next); else news.push(...newQueue(chapter).slice(0, 10).map(c => c.key));
    ahead = review.length + news.length > 0;
  }
  SESSION = { chapter, review: shuffle(review), news, learning, shown: false, current: null, done: 0, ahead, xp0: S.xp, again: 0, shownAt: now(), goalBefore: goalMet(dayKey()) };
  nextCard();
}
function nextCard() {
  const s = SESSION, t = now();
  s.learning.sort((a, b) => cardState(a).due - cardState(b).due);
  const lnow = s.learning.find(k => cardState(k).due <= t);
  let pick = null;
  if (lnow) pick = lnow;
  else if (s.review.length && (s.done % 4 !== 3 || !s.news.length)) pick = s.review[0];
  else if (s.news.length) pick = s.news[0];
  else if (s.review.length) pick = s.review[0];
  else if (s.learning.length) pick = s.learning[0];
  s.current = pick; s.shown = false; s.shownAt = now();
}
function grade(g, rerender) {
  const s = SESSION; const key = s.current; if (!key) return;
  const { after } = gradeCard(key, g, (now() - s.shownAt) / 1000);
  if (g === 1) s.again++;
  s.news = s.news.filter(x => x !== key); s.review = s.review.filter(x => x !== key); s.learning = s.learning.filter(x => x !== key);
  if (isLearning(after)) s.learning.push(key);
  s.done++; refreshGoal(); checkBadges();
  if (!s.goalBefore && goalMet(dayKey())) { s.goalBefore = true; confetti(); }
  nextCard(); rerender();
}
export function cardFace(c) {
  if (c.kind === 'spotter' || c.kind === 'describe') {
    const sp = specById(c.spec);
    const front = c.kind === 'spotter'
      ? `<div class="flash-img" style="width:min(100%,340px)">${cropImg(sp.images[0], sp.quizCrop, 'Museum specimen', sp.dims && sp.dims[0])}</div><div class="flash-q">${esc(c.front)}</div>`
      : `<div class="flash-q">${esc(c.front)}</div>`;
    return { front, back: `<div><b>${esc(sp.name)}</b> <span class="muted">· ${esc(sp.organ)}</span><ul>${sp.gross.map(g => `<li>${esc(g)}</li>`).join('')}</ul><a class="small" href="#/museum/${sp.id}">Open in museum →</a></div>` };
  }
  if (c.kind === 'micro') {
    const m = imageBySlug(c.micro);
    return { front: `<div class="flash-img" data-zoom="${esc(m.file)}" data-cap="${esc(m.title + ' — ' + m.caption)}"><img src="${esc(m.file)}" alt="Micrograph"></div><div class="flash-q">${esc(c.front)}</div>`,
      back: `<div><b>${esc(m.title)}</b><p style="margin:6px 0 0">${esc(m.caption)}</p><div class="credit" style="margin-top:8px">Image: ${esc(m.author)} · ${esc(m.license)} · <a href="${esc(m.source)}" target="_blank" rel="noopener">source</a></div></div>` };
  }
  const sp = c.spec ? specById(c.spec) : null;
  const img = c.img ? `<div class="flash-img" style="width:min(100%,340px)">${cropImg(c.img, c.crop, '', c.dims || (sp && sp.dims ? sp.dims[0] : null))}</div>` : '';
  return { front: `${img}<div class="flash-q">${esc(c.front)}</div>`, back: `<div>${esc(c.back)}</div>` };
}
export function viewStudy() {
  const s = SESSION; if (!s) return '';
  if (!s.current) {
    const gained = S.xp - s.xp0; const c = counts(); const tom = forecast(2)[1].n;
    return `<div class="page narrow"><div class="card done"><div class="big">🎉</div><h1>${s.done ? 'Session complete' : 'Nothing to study'}</h1>
      <p class="sub">${s.done ? `${plural(s.done, 'card')} reviewed · +${gained} XP · ${streak()}-day streak` : 'You’re all caught up.'}</p>
      <p class="muted">${tom ? `${plural(tom, 'card')} due tomorrow.` : ''} ${c.newAvail && !c.new ? 'New cards unlock tomorrow.' : ''}</p>
      <div class="hero-actions center"><a class="btn primary" href="#/mcq">${ico('mcq')} Practise MCQs</a>${s.chapter ? `<a class="btn" href="#/cram?chapter=${s.chapter}">${ico('zap')} Practise these cards again</a>` : ''}<a class="btn" href="#/today">Back to Today</a></div></div></div>`;
  }
  const c = D.cardByKey[s.current]; const state = cardState(c.key);
  const face = cardFace(c); const labels = previewLabels(state, c.key);
  const kind = state.type === 'new' ? ['New', 'hema'] : isLearning(state) ? ['Learning', 'eosin'] : ['Review', 'easy'];
  const r = { n: s.news.length, l: s.learning.length, r: s.review.length };
  const total = s.done + r.n + r.l + r.r; const pctDone = total ? Math.round((100 * s.done) / total) : 0;
  const cur = state.type === 'new' ? 'n' : isLearning(state) ? 'l' : 'r';
  return `<div class="study">
    <div class="study-top"><a class="btn ghost sm" href="${s.chapter ? '#/chapter/' + s.chapter : '#/cards'}">${ico('back')} ${s.chapter ? 'Chapter' : 'Decks'}</a><span class="muted strong">${s.chapter ? esc(chapterTitle(s.chapter)) : 'All chapters'}${s.ahead ? ' · studying ahead' : ''}</span>
      <div class="tally" title="New · Learning · Due"><span class="c-new${cur === 'n' ? ' cur' : ''}">${r.n}</span><span class="c-learn${cur === 'l' ? ' cur' : ''}">${r.l}</span><span class="c-due${cur === 'r' ? ' cur' : ''}">${r.r}</span></div></div>
    <div class="progress"><i style="width:${pctDone}%"></i></div>
    <div class="flash${s.shown ? ' flipped' : ''}">
      <div class="flash-meta"><span class="pill ${kind[1]}">${kind[0]}</span><span class="pill">${esc(chapterTitle(c.chapter))}</span>${c.subTitle ? `<span class="pill">${esc(c.subTitle)}</span>` : ''}</div>
      ${face.front}
      ${s.shown ? `<div class="flash-a">${face.back}</div>` : ''}
    </div>
    ${s.shown ? `<div class="answer-bar">
        <button class="grade again" data-act="grade" data-g="1">Again<small>${labels[0]}</small></button>
        <button class="grade hard" data-act="grade" data-g="2">Hard<small>${labels[1]}</small></button>
        <button class="grade good" data-act="grade" data-g="3">Good<small>${labels[2]}</small></button>
        <button class="grade easy" data-act="grade" data-g="4">Easy<small>${labels[3]}</small></button></div>
        <div class="hint">Keys <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span> <span class="kbd">4</span> · Space = Good</div>`
      : `<button class="btn primary lg reveal" data-act="reveal">Show answer <span class="kbd">Space</span></button>`}
  </div>`;
}

// ---------------------------------------------------------------- cram (practise again, schedule untouched)
let CRAM = null;
export function startCram(params) {
  const chapter = params.get('chapter'); const subId = params.get('sub');
  const keys = D.cards.filter(c => c.chapter === chapter && (!subId || c.sub === subId)).map(c => c.key);
  CRAM = { chapter, sub: subId, queue: shuffle(keys), total: keys.length, known: 0, misses: 0, shown: false, shownAt: now(), goalBefore: goalMet(dayKey()) };
}
export function viewCram() {
  const s = CRAM; if (!s) return '';
  const subTitle = s.sub ? (D.chapterById[s.chapter]?.data.subtopics || []).find(x => x.id === s.sub)?.title : '';
  if (!s.queue.length) {
    return `<div class="page narrow"><div class="card done"><div class="big">💪</div><h1>${s.total ? 'Practice round done' : 'No cards here'}</h1>
      <p class="sub">${s.total ? `${s.total} cards · ${s.misses} slip${s.misses === 1 ? '' : 's'} along the way. Your review schedule wasn’t changed.` : ''}</p>
      <div class="hero-actions center">${s.total ? `<a class="btn primary" href="#/cram?chapter=${s.chapter}${s.sub ? '&sub=' + encodeURIComponent(s.sub) : ''}&r=${now()}">${ico('retry')} Go again</a>` : ''}<a class="btn" href="#/chapter/${s.chapter}">Back to chapter</a></div></div></div>`;
  }
  const c = D.cardByKey[s.queue[0]]; const face = cardFace(c);
  return `<div class="study">
    <div class="study-top"><a class="btn ghost sm" href="#/chapter/${s.chapter}">${ico('back')} Chapter</a><span class="muted strong">Practice · ${esc(chapterTitle(s.chapter))}${subTitle ? ' · ' + esc(subTitle) : ''}</span>
      <div class="tally"><span class="c-due">${s.known}</span><span class="muted">/ ${s.total}</span></div></div>
    <div class="progress"><i style="width:${Math.round((100 * s.known) / Math.max(1, s.total))}%;background:var(--due)"></i></div>
    <div class="flash${s.shown ? ' flipped' : ''}">
      <div class="flash-meta"><span class="pill eosin">Practice — schedule unchanged</span>${c.subTitle ? `<span class="pill">${esc(c.subTitle)}</span>` : ''}</div>
      ${face.front}${s.shown ? `<div class="flash-a">${face.back}</div>` : ''}
    </div>
    ${s.shown ? `<div class="answer-bar two"><button class="grade again" data-act="cram" data-v="0">Didn’t know<small>see it again</small></button><button class="grade good" data-act="cram" data-v="1">Knew it<small>done</small></button></div><div class="hint">Keys <span class="kbd">1</span> didn’t know · <span class="kbd">2</span> or Space knew it</div>`
      : `<button class="btn primary lg reveal" data-act="reveal-cram">Show answer <span class="kbd">Space</span></button>`}
  </div>`;
}
function cram(v, rerender) {
  const s = CRAM; const k = s.queue.shift(); practiceCard((now() - s.shownAt) / 1000);
  if (v) s.known++; else { s.misses++; s.queue.splice(Math.min(s.queue.length, 3 + Math.floor(Math.random() * 3)), 0, k); }
  s.shown = false; s.shownAt = now(); checkBadges();
  if (!s.goalBefore && goalMet(dayKey())) { s.goalBefore = true; confetti(); }
  rerender();
}

export const actions = {
  grade: (el, rr) => grade(+el.dataset.g, rr),
  reveal: (el, rr) => { SESSION.shown = true; rr(); },
  'reveal-cram': (el, rr) => { CRAM.shown = true; rr(); },
  cram: (el, rr) => cram(+el.dataset.v, rr)
};
export function keys(e, route, rr) {
  if (route === 'study' && SESSION && SESSION.current) {
    if (!SESSION.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); SESSION.shown = true; rr(); return true; }
    if (SESSION.shown && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); grade(+e.key, rr); return true; }
    if (SESSION.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); grade(3, rr); return true; }
  }
  if (route === 'cram' && CRAM && CRAM.queue.length) {
    if (!CRAM.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); CRAM.shown = true; rr(); return true; }
    if (CRAM.shown && e.key === '1') { e.preventDefault(); cram(0, rr); return true; }
    if (CRAM.shown && (e.key === '2' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); cram(1, rr); return true; }
  }
  return false;
}
