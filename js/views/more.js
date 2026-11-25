import { D, chapterTitle, specById } from '../content.js';
import { S, sub, save, openMistakes, removeMistake, streak, bestStreak, levelProgress, goalMet, setSetting, replaceState, defaultState } from '../store.js';
import { analyse, trend, totals, BADGES } from '../stats.js';
import { esc, ico, LETTERS, ring, masteryColor, FLAME_SVG, dayKey, fmtDur, toast, now, ago, GOOGLE_G, plural } from '../util.js';
import { heatmap, focusCard, streakCard } from './home.js';
import { qImg } from './quiz.js';
import * as cloud from '../cloud.js';

// ---------------------------------------------------------------- mistakes
let MF = 'all';
export function viewMistakes() {
  const P = sub();
  const list = openMistakes().filter(([k]) => D.mcqByKey[k]).sort((a, b) => b[1].at - a[1].at);
  const chs = [...new Set(list.map(([k]) => D.mcqByKey[k].chapter))];
  const shown = list.filter(([k]) => MF === 'all' || D.mcqByKey[k].chapter === MF);
  return `<div class="page narrow">
  <div class="head"><div><h1>Mistakes</h1><p class="sub">Every question you get wrong waits here. Answer it correctly twice in a row to clear it. Cleared so far: <b>${S.cleared}</b>.</p></div>
  ${list.length ? `<a class="btn primary lg" href="#/quiz?mode=mistakes${MF !== 'all' ? '&chapter=' + MF : ''}&r=${now()}">${ico('retry')} Retry ${shown.length}</a>` : ''}</div>
  ${list.length ? `<div class="chips" style="margin-bottom:16px"><button class="chip${MF === 'all' ? ' on' : ''}" data-act="mf" data-id="all">All <span class="n">${list.length}</span></button>${chs.map(d => `<button class="chip${MF === d ? ' on' : ''}" data-act="mf" data-id="${d}">${esc(chapterTitle(d))} <span class="n">${list.filter(([k]) => D.mcqByKey[k].chapter === d).length}</span></button>`).join('')}</div>` : ''}
  ${shown.length ? `<div class="stack">${shown.map(([k, m]) => { const q = D.mcqByKey[k];
    return `<div class="card mistake">
      <div class="flash-meta"><span class="pill ${q.diff}">${q.diff}</span><span class="pill">${esc(chapterTitle(q.chapter))}</span>${q.subTitle && q.subTitle !== chapterTitle(q.chapter) ? `<span class="pill">${esc(q.subTitle)}</span>` : ''}<span class="pips"><i class="${m.run >= 1 ? 'on' : ''}"></i><i class="${m.run >= 2 ? 'on' : ''}"></i> ${m.run || 0}/2 to clear</span></div>
      <div class="stem">${esc(q.q)}</div>${q.img ? qImg(q) : ''}
      <div class="ans"><span class="k">You chose</span><span class="bad">${m.chosen != null ? LETTERS[m.chosen] + '. ' + esc(q.opts[m.chosen]) : '—'}</span><span class="k">Answer</span><span class="good">${LETTERS[q.ans]}. ${esc(q.opts[q.ans])}</span></div>
      <details><summary>Why</summary><p class="exp">${esc(q.exp)}</p>${q.related ? `<div class="readnext"><span class="lbl">Read next</span>${q.related.map(x => `<span class="pill hema">${esc(x)}</span>`).join('')}</div>` : ''}</details>
      <div class="actions"><a class="btn sm" href="#/quiz?mode=one&key=${encodeURIComponent(k)}&r=${now()}">${ico('retry')} Retry</a><button class="btn sm" data-act="mkcard" data-k="${esc(k)}">${ico('plus')} Make flashcard</button><button class="btn sm ghost" data-act="rm-mistake" data-k="${esc(k)}">${ico('trash')} Remove</button></div>
    </div>`; }).join('')}</div>`
    : `<div class="card done"><div class="big">✅</div><h2>No mistakes waiting</h2><p class="sub">Wrong answers from MCQ practice will appear here.</p><a class="btn primary" href="#/mcq">Practise MCQs</a></div>`}
  </div>`;
}
function mistakeToCard(k) {
  const q = D.mcqByKey[k]; if (!q) return; const P = sub(); const key = 'mine:' + k;
  if (P.custom.some(c => c.key === key)) { toast('Already in your flashcards'); return; }
  P.custom.push({ id: key, key, sub: q.chapter, subTitle: chapterTitle(q.chapter), front: q.q, back: `${q.opts[q.ans]} — ${q.exp}`, img: q.img || null, crop: q.crop || null, dims: q.dims || null, spec: q.spec || null, at: now() });
  save(S.subject); toast('Added to your flashcards — it comes up first in your next session');
  return true;
}

// ---------------------------------------------------------------- museum
const MUSEUM = { group: 'all', tab: 'gross', img: null };
export function viewMuseum(params) {
  if (params && params.get('tab')) MUSEUM.tab = params.get('tab');
  if (!D.specimens.length && !D.images.length) return `<div class="page"><div class="card done"><h2>No specimens in this subject yet</h2><a class="btn" href="#/library">Library</a></div></div>`;
  const groups = [...new Set(D.specimens.map(s => s.group))];
  const items = D.specimens.filter(s => MUSEUM.group === 'all' || s.group === MUSEUM.group);
  const tabs = `<div class="seg"><button data-act="mtab" data-v="gross" class="${MUSEUM.tab === 'gross' ? 'on' : ''}">Gross specimens · ${D.specimens.length}</button><button data-act="mtab" data-v="micro" class="${MUSEUM.tab === 'micro' ? 'on' : ''}">Histology · ${D.images.length}</button></div>`;
  const nCorr = D.specimens.filter(s => s.correction).length;
  const body = MUSEUM.tab === 'micro'
    ? `<div class="micro-grid">${D.images.map(m => `<div class="card micro"><img src="${esc(m.file)}" alt="${esc(m.title)}" loading="lazy" data-zoom="${esc(m.file)}" data-cap="${esc(m.title + ' — ' + m.caption)}"><div class="body"><b>${esc(m.title)}</b><span class="ink-2">${esc(m.caption)}</span><span class="credit">${esc(m.author)} · ${esc(m.license)} · <a href="${esc(m.source)}" target="_blank" rel="noopener">source</a></span></div></div>`).join('')}</div>`
    : `<div class="chips" style="margin-bottom:16px"><button class="chip${MUSEUM.group === 'all' ? ' on' : ''}" data-act="mgrp" data-id="all">All <span class="n">${D.specimens.length}</span></button>${groups.map(g => `<button class="chip${MUSEUM.group === g ? ' on' : ''}" data-act="mgrp" data-id="${esc(g)}">${esc(g)} <span class="n">${D.specimens.filter(s => s.group === g).length}</span></button>`).join('')}</div>
      <div class="gallery">${items.map(s => `<a class="spec" href="#/museum/${s.id}"><div class="ph">${s.images.length ? `<img src="${esc(s.images[0])}" alt="${esc(s.name)}" loading="lazy">` : `<div class="noimg">${esc(s.organ)}<br><small>description only</small></div>`}${s.correction ? '<span class="badge pill medium">Corrected</span>' : ''}</div><div class="body"><b>${esc(s.name)}</b><small>${esc(s.organ)} · ${esc(s.group)}</small></div></a>`).join('')}</div>`;
  return `<div class="page">
  <div class="head"><div><div class="eyebrow">Practicals</div><h1>Specimen museum</h1><p class="sub">Your class jars with exam-ready descriptions, checked against Robbins.${nCorr ? ` ${nCorr} descriptions were corrected or completed from the original notes.` : ''}</p></div>
  <div class="hero-actions"><a class="btn primary" href="#/quiz?mode=spotter&r=${now()}">${ico('image')} Spotter quiz</a>${D.images.length ? `<a class="btn" href="#/quiz?mode=histo&r=${now()}">Histology quiz</a>` : ''}</div></div>
  <div style="margin-bottom:16px">${tabs}</div>${body}</div>`;
}
export function viewSpecimen(id) {
  const s = specById(id); if (!s) return viewMuseum();
  const i = MUSEUM.img && MUSEUM.img[0] === id ? MUSEUM.img[1] : 0;
  const idx = D.specimens.findIndex(x => x.id === id); const prev = D.specimens[idx - 1], next = D.specimens[idx + 1];
  return `<div class="page">
  <div class="qtop" style="margin-bottom:18px"><a class="btn ghost sm" href="#/museum">${ico('back')} Museum</a><span class="spacer"></span>${prev ? `<a class="btn sm" href="#/museum/${prev.id}">${ico('back')} <span class="hide-sm">${esc(prev.name)}</span></a>` : ''}${next ? `<a class="btn sm" href="#/museum/${next.id}"><span class="hide-sm">${esc(next.name)}</span> ${ico('right')}</a>` : ''}</div>
  <div class="detail">
    <div class="photos">${s.images.length ? `<img src="${esc(s.images[i])}" alt="${esc(s.name)}" data-zoom="${esc(s.images[i])}" data-cap="${esc(s.name)}">${s.images.length > 1 ? `<div class="thumbs">${s.images.map((im, k) => `<button data-act="thumb" data-id="${s.id}" data-k="${k}" class="${k === i ? 'on' : ''}"><img src="${esc(im)}" alt=""></button>`).join('')}</div>` : ''}<div class="credit">Photo from the class specimen set.</div>` : `<div class="card noimg-card"><div class="muted">No photo of this jar — learn it from the description.</div></div>`}</div>
    <div class="facts">
      <div><div class="eyebrow">${esc(s.organ)} · ${esc(s.group)}</div><h1 style="margin-top:4px">${esc(s.name)}</h1></div>
      <div><h3>Gross features</h3><ul>${s.gross.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
      <div><h3>Key points</h3><ul>${(s.keyPoints || []).map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
      ${s.correction ? `<div class="callout"><b>Corrected from the class notes.</b> ${esc(s.correction)}</div>` : ''}
      ${(s.viva || []).length ? `<div><h3 style="margin-bottom:8px">Viva questions</h3><div class="stack sm">${s.viva.map(v => `<details class="viva"><summary>${esc(v.q)}</summary><div>${esc(v.a)}</div></details>`).join('')}</div></div>` : ''}
      ${s.topic && D.chapterById[s.topic] ? `<div class="hero-actions"><a class="btn" href="#/chapter/${s.topic}">${ico('layers')} ${esc(chapterTitle(s.topic))}</a></div>` : ''}
    </div>
  </div></div>`;
}

// ---------------------------------------------------------------- insights
export function viewInsights() {
  const A = analyse(); const o = A.overall; const T = trend(14); const t = totals();
  const maxV = Math.max(1, ...T.map(d => d.mcq + d.cards));
  const diffs = ['easy', 'medium', 'hard'].map(d => { const [n, r] = o.byDiff[d]; return { d, n, r, p: n ? Math.round((100 * r) / n) : null }; });
  const weekSecs = T.slice(-7).reduce((a, d) => a + d.secs, 0);
  const pctv = v => (v == null ? '—' : Math.round(v * 100) + '%');
  const worstHeads = A.headings.filter(h => h.qTried >= 1).sort((a, b) => a.acc - b.acc).slice(0, 8);
  return `<div class="page">
  <div class="head"><div><div class="eyebrow">${esc(D.subject.title)}</div><h1>Insights</h1><p class="sub">Where you stand, and what to study next. Recent answers count more than old ones.</p></div></div>
  <div class="insight-top">
    <div class="card overall">${ring(o.mastery, 128, 11, masteryColor(o.mastery), o.started ? o.mastery : '–')}<div><div class="eyebrow">Overall mastery</div><h2>${o.started ? (o.mastery >= 75 ? 'Strong' : o.mastery >= 45 ? 'Building' : 'Early days') : 'Not started'}</h2>
      <p class="muted small">Blends question accuracy, how well you recall cards, and how much of the subject you’ve covered.</p></div></div>
    <div class="grid g2 tight">
      <div class="card stat"><b>${pctv(o.acc)}</b><span>question accuracy</span></div>
      <div class="card stat"><b>${pctv(o.retention)}</b><span>card recall</span></div>
      <div class="card stat"><b>${Math.round(o.coverage * 100)}%</b><span>covered</span></div>
      <div class="card stat"><b>${fmtDur(weekSecs)}</b><span>studied this week</span></div>
    </div>
  </div>
  <div class="card focus-card"><div class="card-head"><h2>${ico('target')} Focus next</h2><span class="muted small">Ranked by how much each would raise your score</span></div>${focusCard(A, 6)}</div>
  <div class="section-title"><h2>Chapters</h2><span class="muted">Tap one for headings and “start over” options</span></div>
  <div class="card" style="padding:6px 8px"><div class="heads">${A.chapters.map(c => `<a class="head-row link-row" href="#/chapter/${c.id}">${ring(c.mastery, 40, 4, masteryColor(c.mastery), c.started ? c.mastery : '–')}<div class="grow"><b>${esc(c.title)}</b><small>${c.qTried}/${c.qTotal} questions · ${c.cSeen}/${c.cTotal} cards${c.mistakes ? ` · <span class="c-bad">${c.mistakes} mistakes</span>` : ''}</small></div>
    <div class="hbar"><div class="meter"><i style="width:${c.acc == null ? 0 : Math.round(c.acc * 100)}%;background:${c.acc == null ? 'var(--line-strong)' : c.acc >= 0.75 ? 'var(--good)' : c.acc >= 0.5 ? 'var(--warn)' : 'var(--bad)'}"></i></div><small>${c.acc == null ? 'no answers' : Math.round(c.acc * 100) + '% accuracy'}</small></div>${ico('right')}</a>`).join('')}</div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Last 14 days</h3><p class="muted small" style="margin:4px 0 0">Cards + questions per day · dot = question accuracy</p>
      <div class="trend">${T.map(d => { const v = d.mcq + d.cards; const a = d.mcq ? d.right / d.mcq : null; return `<div class="tcol" title="${d.k}: ${d.cards} cards, ${d.mcq} questions${a != null ? `, ${Math.round(a * 100)}% right` : ''}"><span class="tdot" style="bottom:${a == null ? -20 : 8 + a * 80}%;${a == null ? 'opacity:0' : ''}"></span><i style="height:${Math.round((90 * v) / maxV)}%"></i><small>${new Date(d.k + 'T12:00').toLocaleDateString(undefined, { day: 'numeric' })}</small></div>`; }).join('')}</div></div>
    <div class="card"><h3>By difficulty</h3><div class="mini-bars">${diffs.map(x => `<div class="mb"><span class="grow"><span class="pill ${x.d}">${x.d}</span> <span class="muted small">${x.n} tried</span></span><span class="meter"><i style="width:${x.p || 0}%;background:${x.p == null ? 'var(--line-strong)' : x.p >= 75 ? 'var(--good)' : x.p >= 50 ? 'var(--warn)' : 'var(--bad)'}"></i></span><b>${x.p == null ? '—' : x.p + '%'}</b></div>`).join('')}</div>
      <h3 style="margin-top:20px">Weakest headings</h3><div class="mini-bars">${worstHeads.length ? worstHeads.map(h => `<a class="mb" href="#/quiz?mode=heading&chapter=${h.chapter}&sub=${encodeURIComponent(h.sub)}&r=${now()}"><span class="grow">${esc(h.title)}</span><span class="meter"><i style="width:${Math.round(h.acc * 100)}%;background:${h.acc >= 0.75 ? 'var(--good)' : h.acc >= 0.5 ? 'var(--warn)' : 'var(--bad)'}"></i></span><b>${Math.round(h.acc * 100)}%</b></a>`).join('') : '<div class="empty">Answer some questions to see this.</div>'}</div></div>
  </div>
  <div class="section-title"><h2>Activity</h2><span class="muted">${t.days} study day${t.days === 1 ? '' : 's'} · ${fmtDur(t.secs)} total</span></div>
  <div class="card">${heatmap(26)}</div>
  </div>`;
}

// ---------------------------------------------------------------- scoreboard + settings + account
export function viewProfile() {
  const t = totals(), lp = levelProgress(), u = cloud.currentUser(), st = cloud.status;
  const got = BADGES.filter(b => S.badges[b.id]).length;
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="setting" data-k="${k}" data-v="${v}" class="${String(S.settings[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return `<div class="page">
  <div class="head"><div><h1>Scoreboard</h1><p class="sub">Hit your daily goal — ${S.settings.goal} cards or questions, or clear everything due — to keep the streak alive.</p></div></div>
  ${accountCard(u, st)}
  <div class="hero" style="margin-top:16px">
    <div class="card streak-card"><div class="streak-top">${FLAME_SVG(!goalMet(dayKey()))}<div><div class="streak-num">${streak()}</div><div class="streak-lbl">current streak · best ${bestStreak()}</div></div></div>
      <div><div class="goal-row"><span>Level ${lp.L}</span><span>${S.xp} XP · ${lp.toNext} to level ${lp.L + 1}</span></div><div class="goal-bar"><i style="width:${lp.pct}%"></i></div></div>
      <p class="muted small" style="margin:0">+1 XP per card, +3 per correct answer, +1 per attempt, +5 per mistake cleared.</p></div>
    <div class="grid g2 tight">
      <div class="card stat"><b>${t.cards}</b><span>cards reviewed</span></div>
      <div class="card stat"><b>${t.mcq}</b><span>questions answered</span></div>
      <div class="card stat"><b>${t.mcq ? t.acc + '%' : '—'}</b><span>accuracy</span></div>
      <div class="card stat"><b>${t.mature}</b><span>cards in long-term memory</span></div>
    </div>
  </div>
  <div class="section-title"><h2>Badges</h2><span class="muted">${got} of ${BADGES.length}</span></div>
  <div class="badges">${BADGES.map(b => `<div class="badge-item${S.badges[b.id] ? ' got' : ''}"><div class="medal">${b.icon}</div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join('')}</div>
  <div class="section-title"><h2>Settings</h2></div>
  <div class="card settings">
    <div class="setting"><div><b>New cards per day</b><small>How many fresh flashcards are released each day.</small></div>${seg('newPerDay', [[10, '10'], [20, '20'], [30, '30'], [50, '50']])}</div>
    <div class="setting"><div><b>Daily goal</b><small>Cards + questions needed to count the day for your streak.</small></div>${seg('goal', [[10, '10'], [20, '20'], [40, '40'], [60, '60']])}</div>
    <div class="setting"><div><b>New card order</b><small>Syllabus finishes one chapter before the next; mixed rotates chapters.</small></div>${seg('order', [['syllabus', 'Syllabus'], ['mixed', 'Mixed']])}</div>
    <div class="setting"><div><b>Theme</b></div>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
    <div class="setting"><div><b>Backup file</b><small>${u ? 'Your progress already syncs to your account. ' : ''}Download a copy, or restore one.</small></div><div class="row-gap"><button class="btn sm" data-act="export">${ico('download')} Export</button><label class="btn sm">${ico('upload')} Import<input type="file" id="import" accept="application/json" hidden></label></div></div>
    <div class="setting"><div><b>Erase all progress</b><small>Wipes cards, questions, mistakes and streak${u ? ' on this device and in your account' : ' on this device'}.</small></div><button class="btn sm danger" data-act="erase">Erase everything</button></div>
  </div>
  <p class="muted small" style="margin-top:22px">Content follows Robbins Basic Pathology and is checked by a second reviewer; Harsh Mohan is used for emphasis. Textbook figures are copyrighted, so pictures are class specimen photos and openly licensed micrographs from Wikimedia Commons (credited on each image).</p>
  </div>`;
}
function syncLine(st) {
  const m = { synced: [`cloud`, `Synced ${ago(st.at)}`], syncing: ['cloud', 'Syncing…'], offline: ['cloudoff', 'Offline — saved on this device'], error: ['cloudoff', st.error || 'Sync problem'], local: ['cloudoff', 'Not syncing'] };
  const [i, l] = m[st.state] || m.local; return `<span class="sync ${st.state}">${ico(i)} ${esc(l)}</span>`;
}
export function avatar(u, size = 40) {
  if (u && u.photo) return `<img class="avatar" src="${esc(u.photo)}" alt="" width="${size}" height="${size}" referrerpolicy="no-referrer">`;
  const ch = ((u && (u.name || u.email)) || '?').trim()[0].toUpperCase();
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc(ch)}</span>`;
}
function accountCard(u, st) {
  if (!cloud.authEnabled) return `<div class="card account-card guest"><div class="grow"><b>Progress is saved in this browser</b><small>Accounts with Google and email sign-in are being switched on. When they are, your progress here moves into your account the first time you sign in.</small></div></div>`;
  if (!u) return `<div class="card account-card guest"><div class="grow"><b>You’re studying as a guest</b><small>Progress is saved only in this browser. Sign in to keep it safe and use it on your phone and laptop.</small></div><a class="btn primary" href="#/signin">${ico('user')} Sign in or create account</a></div>`;
  return `<div class="card account-card">${avatar(u, 48)}<div class="grow"><b>${esc(u.name || 'Your account')}</b><small>${esc(u.email || '')} · ${syncLine(st)}</small></div><div class="row-gap"><button class="btn sm" data-act="sync-now">${ico('retry')} Sync now</button><button class="btn sm ghost" data-act="signout">${ico('logout')} Sign out</button></div></div>`;
}

// ---------------------------------------------------------------- sign-in + welcome
const AUTH = { mode: 'signin', busy: false, error: '', info: '', email: '', name: '' };
export function viewSignin() {
  const u = cloud.currentUser();
  if (!cloud.authEnabled) return `<div class="auth-wrap"><div class="card auth-card"><div class="brand-lg"><span class="brand-mark"></span></div><h1>Accounts are almost ready</h1><p class="sub">Sign-in with Google and email is being switched on. Until then your progress is saved in this browser — it will move into your account automatically the first time you sign in.</p><a class="btn primary lg block" href="#/today" data-act="guest">Keep studying</a></div></div>`;
  if (u) return `<div class="auth-wrap"><div class="card auth-card">${avatar(u, 64)}<h1>You’re signed in</h1><p class="sub">${esc(u.email || '')}</p><p class="muted">${syncLine(cloud.status)}</p><a class="btn primary lg block" href="#/today">Go to Today</a></div></div>`;
  const m = AUTH.mode;
  return `<div class="auth-wrap"><div class="card auth-card">
    <div class="brand-lg"><span class="brand-mark"></span></div>
    <h1>${m === 'signup' ? 'Create your account' : m === 'reset' ? 'Reset your password' : 'Sign in to PathDeck'}</h1>
    <p class="sub">${m === 'reset' ? 'We’ll email you a link to set a new password.' : 'Keep your streak, cards and scores safe — on every device.'}</p>
    ${AUTH.error ? `<div class="alert bad">${esc(AUTH.error)}</div>` : ''}${AUTH.info ? `<div class="alert good">${esc(AUTH.info)}</div>` : ''}
    ${m !== 'reset' && cloud.hasProvider('google') ? `<button class="btn lg block google" data-act="google" ${AUTH.busy ? 'disabled' : ''}>${GOOGLE_G} Continue with Google</button>${cloud.hasProvider('password') ? '<div class="or"><span>or with email</span></div>' : ''}` : ''}
    ${cloud.hasProvider('password') ? `<form class="auth-form" data-form="${m}">
      ${m === 'signup' ? `<label>Name<input class="input" name="name" autocomplete="name" value="${esc(AUTH.name)}" placeholder="Your name"></label>` : ''}
      <label>Email<input class="input" name="email" type="email" autocomplete="email" required value="${esc(AUTH.email)}" placeholder="you@example.com"></label>
      ${m !== 'reset' ? `<label>Password${m === 'signin' ? `<button type="button" class="link small" data-act="auth-mode" data-v="reset">Forgot?</button>` : ''}<input class="input" name="password" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" required minlength="6" placeholder="${m === 'signup' ? 'At least 6 characters' : ''}"></label>` : ''}
      <button class="btn primary lg block" type="submit" ${AUTH.busy ? 'disabled' : ''}>${AUTH.busy ? 'Please wait…' : m === 'signup' ? 'Create account' : m === 'reset' ? 'Send reset link' : 'Sign in'}</button>
    </form>` : ''}
    ${cloud.hasProvider('password') ? `<p class="switch-line">${m === 'signup' ? `Already have an account? <button class="link" data-act="auth-mode" data-v="signin">Sign in</button>` : m === 'reset' ? `<button class="link" data-act="auth-mode" data-v="signin">Back to sign in</button>` : `New here? <button class="link" data-act="auth-mode" data-v="signup">Create an account</button>`}</p>` : ''}
    <a class="guest-link" href="#/today" data-act="guest">Continue without an account →</a>
  </div></div>`;
}
export function viewWelcome() {
  return `<div class="welcome">
    <div class="welcome-hero">
      <div class="brand-lg"><span class="brand-mark"></span><span class="brand-name">PathDeck</span></div>
      <h1>Pathology that sticks.</h1>
      <p class="lead">Spaced-repetition flashcards, exam-style MCQs with explanations, your specimen museum, and insights that tell you exactly what to revise next.</p>
      ${cloud.authEnabled ? `<div class="welcome-actions">
        ${cloud.hasProvider('google') ? `<button class="btn lg google" data-act="google">${GOOGLE_G} Continue with Google</button>` : ''}
        ${cloud.hasProvider('password') ? `<a class="btn lg" href="#/signin">${ico('mail')} Use email</a>` : ''}
      </div>
      <a class="guest-link" href="#/today" data-act="guest">Try it without an account →</a>` : `<div class="welcome-actions"><a class="btn primary lg" href="#/today" data-act="guest">${ico('play')} Start studying</a></div><p class="muted small">No account needed — progress is saved in your browser.</p>`}
      ${AUTH.error ? `<div class="alert bad" style="margin-top:14px">${esc(AUTH.error)}</div>` : ''}
    </div>
    <div class="welcome-grid">
      <div class="wcard">${ico('cards')}<b>Cards that come back on time</b><span>An Anki-style schedule brings each card back just before you’d forget it.</span></div>
      <div class="wcard">${ico('mcq')}<b>${D.mcqs.length}+ graded MCQs</b><span>Easy, medium and hard, each with an explanation and what to read next.</span></div>
      <div class="wcard">${ico('museum')}<b>Your specimen museum</b><span>Real jars, spotter quizzes, and corrected, exam-ready descriptions.</span></div>
      <div class="wcard">${ico('insights')}<b>Know where to focus</b><span>Mastery per chapter and a ranked list of what to revise next.</span></div>
    </div>
  </div>`;
}
async function doAuth(fn, rr) {
  AUTH.busy = true; AUTH.error = ''; AUTH.info = ''; rr();
  try { await fn(); S.onboarded = true; save(); AUTH.busy = false; location.hash = '#/today'; toast('Signed in — your progress will sync'); }
  catch (e) { AUTH.busy = false; AUTH.error = e.message; rr(); }
}
export async function submitAuth(form, rr) {
  const f = new FormData(form); const email = String(f.get('email') || ''); const pw = String(f.get('password') || ''); const name = String(f.get('name') || '');
  AUTH.email = email; AUTH.name = name;
  if (form.dataset.form === 'reset') {
    AUTH.busy = true; AUTH.error = ''; rr();
    try { await cloud.resetPassword(email); AUTH.info = `If an account exists for ${email}, a reset link is on its way.`; AUTH.mode = 'signin'; } catch (e) { AUTH.error = e.message; }
    AUTH.busy = false; rr(); return;
  }
  doAuth(() => (form.dataset.form === 'signup' ? cloud.signUpEmail(name, email, pw) : cloud.signInEmail(email, pw)), rr);
}

export const actions = {
  mf: (el, rr) => { MF = el.dataset.id; rr(); },
  'rm-mistake': (el, rr) => { removeMistake(el.dataset.k); toast('Removed from mistakes'); rr(); },
  mkcard: (el, rr, ctx) => { if (mistakeToCard(el.dataset.k)) ctx.rebuild(); rr(); },
  mtab: (el, rr) => { MUSEUM.tab = el.dataset.v; rr(); },
  mgrp: (el, rr) => { MUSEUM.group = el.dataset.id; rr(); },
  thumb: (el, rr) => { MUSEUM.img = [el.dataset.id, +el.dataset.k]; rr(); },
  setting: (el, rr, ctx) => { const k = el.dataset.k, v = el.dataset.v; setSetting(k, isNaN(+v) ? v : +v); if (k === 'theme') ctx.applyTheme(); rr(); },
  export: () => { const blob = new Blob([JSON.stringify(S)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pathdeck-backup-${dayKey()}.json`; a.click(); },
  erase: (el, rr, ctx) => { if (!el.dataset.confirm) { el.dataset.confirm = 1; el.textContent = 'Tap again — this can’t be undone'; return; } const owner = S.owner; replaceState({ ...defaultState(), onboarded: true, owner }); import('../store.js').then(m => { m.save(); m.save(m.S.subject); }); ctx.rebuild(); toast('All progress erased'); rr(); },
  'sync-now': async (el, rr) => { el.disabled = true; await cloud.flush(); await cloud.pull(false); toast(cloud.status.state === 'synced' ? 'Synced' : (cloud.status.error || 'Could not sync')); rr(); },
  signout: async (el, rr, ctx) => { if (!el.dataset.confirm) { el.dataset.confirm = 1; el.innerHTML = 'Tap again to sign out'; return; } await cloud.signOutUser(); ctx.rebuild(); toast('Signed out. Your progress is safe in your account.'); location.hash = '#/today'; },
  'auth-mode': (el, rr) => { AUTH.mode = el.dataset.v; AUTH.error = ''; AUTH.info = ''; rr(); },
  google: (el, rr) => doAuth(() => cloud.signInGoogle(), rr),
  guest: () => { S.onboarded = true; save(); }
};
