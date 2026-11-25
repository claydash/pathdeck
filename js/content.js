// Loads content/index.json, then the active subject's chapters. Builds flat card/MCQ lists
// with namespaced keys "chapter:id" so chapters can reuse ids safely.
import { hash, seeded, shuffle } from './util.js';

export const D = {
  index: null, subject: null, subjectId: null,
  chapters: [],          // [{id, title, section, sectionTitle, competency, ref, subtopics, counts, kind, data}]
  chapterById: {}, cards: [], cardByKey: {}, mcqs: [], mcqByKey: {}, specimens: [], images: []
};

async function getJSON(path) { const r = await fetch(path); if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`); return r.json(); }

export async function loadIndex() {
  D.index = await getJSON(`content/index.json?b=${Date.now() >> 22}`);
  return D.index;
}
export const subjects = () => (D.index ? D.index.subjects : []);

export async function loadSubject(subjectId, customCards = []) {
  const subj = subjects().find(s => s.id === subjectId) || subjects()[0];
  D.subject = subj; D.subjectId = subj.id;
  const metas = subj.sections.flatMap(sec => sec.chapters.map(ch => ({ ...ch, section: sec.id, sectionTitle: sec.title })));
  const datas = await Promise.all(metas.map(m => getJSON(`content/${subj.id}/${m.id}.json?h=${m.hash}`).catch(() => null)));
  D.chapters = metas.map((m, i) => ({ ...m, data: datas[i] })).filter(c => c.data);
  D.chapterById = Object.fromEntries(D.chapters.map(c => [c.id, c]));
  build(customCards);
  return D;
}

export function build(customCards = []) {
  D.cards = []; D.mcqs = []; D.specimens = []; D.images = [];
  D.chapters.forEach((ch, ci) => {
    const j = ch.data; const subTitle = Object.fromEntries((j.subtopics || []).map(s => [s.id, s.title]));
    const key = id => `${ch.id}:${id}`;
    (j.cards || []).forEach((c, i) => D.cards.push({ ...c, key: key(c.id), chapter: ch.id, subTitle: subTitle[c.sub] || '', order: ci * 10000 + i }));
    (j.mcqs || []).forEach(m => D.mcqs.push({ ...m, key: key(m.id), chapter: ch.id, subTitle: subTitle[m.sub] || '', ref: m.ref || j.ref }));

    const items = j.specimens || [];
    items.forEach((s, i) => {
      const spec = { ...s, chapter: ch.id }; D.specimens.push(spec);
      const photo = s.images && s.images.length && s.quizCrop;
      D.cards.push({ id: (photo ? 'sp-c-' : 'sp-g-') + s.id, key: key((photo ? 'sp-c-' : 'sp-g-') + s.id), chapter: ch.id, sub: s.group, subTitle: s.group, order: ci * 10000 + 5000 + i,
        kind: photo ? 'spotter' : 'describe', spec: s.id,
        front: photo ? 'Identify this specimen and give two gross features.' : `Describe the gross appearance of ${s.name.charAt(0).toLowerCase() + s.name.slice(1)}.` });
    });
    items.filter(s => s.images && s.images.length && s.quizCrop).forEach((s, i) => {
      const rnd = seeded(hash(s.id));
      const same = items.filter(o => o.id !== s.id && (o.organ === s.organ || o.group === s.group));
      const pool = shuffle(same, rnd).concat(shuffle(items.filter(o => o.id !== s.id && !same.includes(o)), rnd));
      const distract = []; for (const o of pool) { if (distract.length === 3) break; if (!distract.some(d => d.name === o.name)) distract.push(o); }
      const ans = hash(s.id + 'k') % 4; const opts = distract.map(d => d.name); opts.splice(ans, 0, s.name);
      D.mcqs.push({ id: 'sp-q-' + s.id, key: key('sp-q-' + s.id), chapter: ch.id, sub: s.group, subTitle: s.group, diff: i % 3 === 0 ? 'easy' : 'medium',
        q: 'Identify this museum specimen.', img: s.images[0], crop: s.quizCrop, dims: s.dims ? s.dims[0] : null, opts, ans,
        exp: `${s.name}: ${s.gross.slice(0, 2).join(' ')}`, related: [s.organ, s.group], ref: 'Gross specimen', spec: s.id });
    });

    const imgs = j.images || [];
    imgs.forEach((m, i) => {
      const im = { ...m, chapter: ch.id }; D.images.push(im);
      const st = subTitle[m.topic] || '';
      D.cards.push({ id: 'mi-c-' + m.slug, key: key('mi-c-' + m.slug), chapter: ch.id, sub: m.topic, subTitle: st, order: ci * 10000 + 7000 + i, kind: 'micro', micro: m.slug,
        front: 'Name the lesion in this micrograph and the feature that gives it away.' });
      const rnd = seeded(hash(m.slug));
      const others = shuffle(imgs.filter(o => o.slug !== m.slug), rnd).slice(0, 3).map(o => o.title);
      const ans = hash(m.slug + 'k') % 4; const opts = others.slice(); opts.splice(ans, 0, m.title);
      if (opts.length === 4) D.mcqs.push({ id: 'mi-q-' + m.slug, key: key('mi-q-' + m.slug), chapter: ch.id, sub: m.topic, subTitle: st, diff: 'medium',
        q: 'What does this micrograph show?', img: m.file, opts, ans, exp: m.caption, related: [st || m.topic], ref: `Image: ${m.author}, ${m.license}`, micro: m.slug });
    });
  });
  customCards.forEach((c, i) => D.cards.push({ ...c, chapter: 'mine', order: -100000 + i }));
  D.cardByKey = Object.fromEntries(D.cards.map(c => [c.key, c]));
  D.mcqByKey = Object.fromEntries(D.mcqs.map(m => [m.key, m]));
}

export const chapterTitle = id => (id === 'mine' ? 'My cards' : (D.chapterById[id] || {}).title || id);
export const specById = id => D.specimens.find(s => s.id === id);
export const imageBySlug = slug => D.images.find(m => m.slug === slug);
export const chapterOrder = () => D.chapters.map(c => c.id);
