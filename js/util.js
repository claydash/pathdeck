// Shared helpers: DOM, dates (4 am day rollover), randomness, formatting, icons.
export const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
export const ROLLOVER_H = 4;
export const LETTERS = ['A', 'B', 'C', 'D'];

export const $ = (s, el = document) => el.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const now = () => Date.now();
export const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

export function dayKey(ts = now()) {
  const d = new Date(ts - ROLLOVER_H * HOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dayStart(ts = now()) { const d = new Date(ts - ROLLOVER_H * HOUR); d.setHours(0, 0, 0, 0); return d.getTime() + ROLLOVER_H * HOUR; }
export function addDays(key, n) { const [y, m, d] = key.split('-').map(Number); const dt = new Date(y, m - 1, d + n, 12); return dayKey(dt.getTime() + ROLLOVER_H * HOUR); }
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seeded(seed) { let s = seed || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
export function shuffle(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function fmtIvl(ms) {
  if (ms < MIN) return '<1m';
  if (ms < HOUR) return Math.round(ms / MIN) + 'm';
  if (ms < DAY) return Math.round(ms / HOUR) + 'h';
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + 'd';
  if (d < 365) return (d / 30).toFixed(1).replace(/\.0$/, '') + 'mo';
  return (d / 365).toFixed(1).replace(/\.0$/, '') + 'y';
}
export function fmtDur(secs) {
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.round(secs / 60); if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); return `${h} h ${m % 60} min`;
}
export function ago(ts) {
  if (!ts) return 'never';
  const s = (now() - ts) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`; const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

const I = {
  today: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  library: '<path d="M4 19.5V5a2 2 0 0 1 2-2h3v16.5"/><path d="M9 3h4v16.5"/><path d="m14.5 4.2 3.6-1 3 14.6-3.6 1Z"/><path d="M3 20.5h18"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/>',
  mcq: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4.2"/><path d="M12 17.5h.01"/>',
  mistakes: '<path d="M4 4v16"/><path d="M4 4h12l-2 4 2 4H4"/>',
  museum: '<path d="M3 21h18"/><path d="M4 10h16"/><path d="M12 3 3.5 8h17Z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  insights: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  flame: '<path d="M12 2s5 5.2 5 10.2A5 5 0 0 1 7 12.5C7 9 9.5 7.6 9.5 7.6S9 10.5 11 11.5C11 7.5 12 2 12 2Z"/>',
  play: '<path d="M7 4.5v15l12-7.5Z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  retry: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 11a4 4 0 0 1-1 7.9Z"/>',
  cloudoff: '<path d="M3 3l18 18"/><path d="M8.5 8.4A5 5 0 0 0 7 18h10.5M20 16.5A4 4 0 0 0 17.6 11a6 6 0 0 0-6.8-4.8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'
};
export const ico = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
export const GOOGLE_G = '<svg class="gicon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
export const FLAME_SVG = (cold, size) => `<svg class="flame${cold ? ' cold' : ''}"${size ? ` style="width:${size}px;height:${size}px"` : ''} viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="fg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e2558a"/><stop offset=".55" stop-color="#f07a2a"/><stop offset="1" stop-color="#ffc14d"/></linearGradient></defs><path fill="url(#fg)" d="M32 4s16 14 16 30a16 16 0 0 1-32 0c0-10 7-15 7-15s-1 9 6 12c-1-13 3-27 3-27Z"/><path fill="#fff" fill-opacity=".55" d="M32 34s7 5 7 11a7 7 0 0 1-14 0c0-5 4-7 4-7s0 4 3 5c0-4 0-9 0-9Z"/></svg>`;

/** Circular progress ring. value 0–100. */
export function ring(value, size = 44, stroke = 5, color = 'var(--hema)', label) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = clamp(value || 0, 0, 100);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${label != null ? `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="${Math.round(size * 0.27)}" font-weight="800" fill="var(--ink)">${label}</text>` : ''}</svg>`;
}
export const masteryColor = m => (m >= 75 ? 'var(--good)' : m >= 45 ? 'var(--warn)' : m > 0 ? 'var(--bad)' : 'var(--line-strong)');

/** Image with a vertical crop window (used to hide jar labels in spotter questions). */
export function cropImg(src, crop, alt, dims) {
  if (crop && dims) {
    const [top, bottom] = crop; const vis = Math.max(10, bottom - top); const [w, h] = dims;
    return `<div class="crop" style="aspect-ratio:${w} / ${((h * vis) / 100).toFixed(1)}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" style="position:absolute;left:0;width:100%;height:${(10000 / vis).toFixed(2)}%;top:-${((100 * top) / vis).toFixed(2)}%"></div>`;
  }
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti';
  const colors = ['#4a3f8f', '#d0457a', '#f07a2a', '#ffc14d', '#1f8a55', '#7d9cf5'];
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw'; s.style.background = colors[i % colors.length];
    s.style.animationDelay = Math.random() * 0.4 + 's'; s.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(s);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 3400);
}
