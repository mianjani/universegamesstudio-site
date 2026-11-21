'use strict';
const $ = s => document.querySelector(s), app = $('#app');
const T = {
  en: { games: 'Games', dev: 'Developers', legal: 'Legal', search: 'Search games', popular: 'Popular games', fresh: 'New games', all: 'All games', none: 'No games found.' },
  ur: { games: 'گیمز', dev: 'ڈویلپرز', legal: 'قانونی', search: 'گیمز تلاش کریں', popular: 'مقبول گیمز', fresh: 'نئی گیمز', all: 'تمام گیمز', none: 'کوئی گیم نہیں ملی۔' },
  es: { games: 'Juegos', dev: 'Desarrolladores', legal: 'Legal', search: 'Buscar juegos', popular: 'Juegos populares', fresh: 'Juegos nuevos', all: 'Todos los juegos', none: 'No hay juegos.' }
};
let lang = localStorage.getItem('lang') || 'en', cfg = { cats: [], revShare: '' }, cat = '', me = null;
const t = k => (T[lang] || T.en)[k] || T.en[k] || k;

// Escape-safe element builder (never uses innerHTML)
function h(tag, a, ...c) {
  const e = document.createElement(tag);
  for (const k in a || {}) {
    if (k === 'on') for (const ev in a.on) e.addEventListener(ev, a.on[ev]);
    else if (k === 'class') e.className = a[k]; else e.setAttribute(k, a[k]);
  }
  c.flat().forEach(x => e.append(x == null ? '' : x)); return e;
}
async function api(p, o = {}) {
  const r = await fetch('/api' + p, { method: o.method || 'GET', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed'); return d;
}
function toast(m) { const e = h('div', { class: 'toast' }, m); document.body.append(e); setTimeout(() => e.remove(), 2600); }

// Ad hooks: connect your real SDK (Google IMA / AdSense for Games) inside these functions.
window.UGSAds = {
  async preroll(game) { /* show pre-roll, resolve when finished or skipped */ },
  async midroll(game) { /* interstitial between levels */ },
  async rewarded(game) { /* return true if the player earned the reward */ return false; }
};
const adSlot = id => h('div', { class: 'ad', 'data-slot': id }, 'Advertisement');

function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = t(e.dataset.i));
  $('#q').placeholder = t('search'); $('#lang').value = lang;
}
const BADGE = { live: 'Live', build: 'In Build', roadmap: 'Roadmap' };
function card(g) {
  const pic = g.thumb_url ? h('img', { src: g.thumb_url, alt: '', loading: 'lazy' }) : h('div', { class: 'ph' }, g.title[0]);
  return h('button', { class: 'card', on: { click: () => play(g) } }, pic, h('span', { class: 'badge ' + g.status }, BADGE[g.status] || g.status), h('span', { class: 'ct' }, g.title));
}
async function play(g) {
  if (g.status !== 'live' || !g.play_url) return toast(g.title + ': ' + (g.status === 'build' ? BADGE.build : BADGE.roadmap));
  await window.UGSAds.preroll(g); api('/games/' + g.id + '/play', { method: 'POST' }).catch(() => {});
  const load = h('div', { class: 'load' }, h('div', {}, h('div', { class: 'spin' }), 'Loading…'));
  const f = h('iframe', { src: g.play_url, title: g.title, allow: 'fullscreen; gamepad; autoplay', allowfullscreen: '', referrerpolicy: 'no-referrer',
    sandbox: 'allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups' });
  f.addEventListener('load', () => load.remove());
  const stage = h('div', { class: 'stage' }, f, load);
  const close = () => { m.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => e.key === 'Escape' && close();
  const m = h('div', { class: 'modal', role: 'dialog', 'aria-label': g.title },
    h('div', { class: 'mh' }, h('b', {}, g.title),
      h('button', { class: 'btn sm alt', on: { click: () => (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage) } }, 'Fullscreen'),
      h('button', { class: 'btn sm', on: { click: close } }, 'Close')), stage);
  document.addEventListener('keydown', esc); document.body.append(m);
}

async function home() {
  const q = $('#q').value.trim(), qs = '?q=' + encodeURIComponent(q);
  const [all, pop, fresh] = await Promise.all([api('/games' + qs + (cat ? '&cat=' + encodeURIComponent(cat) : '')),
    api('/games' + qs + '&sort=popular'), api('/games' + qs)]);
  const chips = h('div', { class: 'chips' }, [''].concat(cfg.cats).map(c =>
    h('button', { class: 'chip', 'aria-pressed': String(c === cat), on: { click: () => { cat = c; home(); } } }, c || t('all'))));
  const sec = (title, list) => [h('h2', {}, title), list.length ? h('div', { class: 'grid' }, list.map(card)) : h('p', { class: 'empty' }, t('none'))];
  app.replaceChildren(h('div', { class: 'wrap' }, adSlot('home-top'), chips,
    !q && !cat ? [sec(t('popular'), pop.slice(0, 6)), sec(t('fresh'), fresh.slice(0, 6))] : [],
    sec(cat || t('all'), all), adSlot('home-bottom')));
}

function form(fields, onSubmit, label) {
  const err = h('div', { class: 'err' }), inputs = {};
  const f = h('div', {}, fields.map(([k, lab, el]) => { inputs[k] = el; return [h('label', {}, lab), el]; }), err,
    h('p', {}, h('button', { class: 'btn', on: { click: async () => {
      err.textContent = ''; const v = {}; for (const k in inputs) v[k] = inputs[k].value;
      try { await onSubmit(v); } catch (e) { err.textContent = e.message; } } } }, label)));
  return f;
}
const inp = (type = 'text', extra = {}) => h('input', { type, ...extra });

async function dev() {
  try { me = (await api('/me')).user; } catch { me = null; }
  const info = h('div', { class: 'panel' }, h('h2', {}, 'Publishing & monetization'),
    h('p', {}, 'Submit an HTTPS HTML5/WebGL build. Approved games are listed in the public catalog and can show portal ads plus in-game ads (pre-roll, mid-roll, rewarded) through the UGS Ads hooks (window.UGSAds.preroll / midroll / rewarded).'),
    h('p', {}, cfg.revShare));
  if (!me) {
    const em = inp('email'), pw = inp('password'), nm = inp('text');
    const login = form([['email', 'Email', em], ['password', 'Password', pw]], async v => { await api('/login', { method: 'POST', body: v }); dev(); }, 'Log in');
    const em2 = inp('email'), pw2 = inp('password', { placeholder: '8+ characters' }), nm2 = inp('text');
    const reg = form([['name', 'Name or studio', nm2], ['email', 'Email', em2], ['password', 'Password', pw2]],
      async v => { await api('/register', { method: 'POST', body: v }); dev(); }, 'Create developer account');
    return app.replaceChildren(h('div', { class: 'wrap' }, h('h1', {}, 'Developer console'), info,
      h('div', { class: 'row' }, h('div', { class: 'panel' }, h('h2', {}, 'Log in'), login), h('div', { class: 'panel' }, h('h2', {}, 'Register'), reg))));
  }
  const mine = await api('/submissions');
  const title = inp('text'), desc = h('textarea', { rows: '3' }), build = inp('url', { placeholder: 'https://your-game-host.com/index.html' }), thumb = inp('url', { placeholder: 'https://…/thumb.png (optional)' });
  const sel = h('select', {}, cfg.cats.map(c => h('option', { value: c }, c)));
  const sub = form([['title', 'Game title', title], ['description', 'Description', desc], ['category', 'Category', sel], ['build_url', 'HTTPS build URL', build], ['thumb_url', 'Thumbnail URL', thumb]],
    async v => { await api('/submissions', { method: 'POST', body: v }); toast('Submitted for review'); dev(); }, 'Submit game');
  const rows = mine.map(s => h('tr', {}, h('td', {}, s.title), h('td', {}, s.category), h('td', { class: 'st ' + s.status }, s.status), h('td', {}, s.review_notes || '-')));
  app.replaceChildren(h('div', { class: 'wrap' }, h('h1', {}, 'Developer console'),
    h('p', { class: 'empty' }, me.name + ' (' + me.email + ') ', h('a', { href: '#/dev', on: { click: async e => { e.preventDefault(); await api('/logout', { method: 'POST' }); dev(); } } }, 'Log out'),
      me.role === 'admin' ? [' | ', h('a', { href: '#/admin' }, 'Admin review')] : ''),
    info, h('div', { class: 'row' }, h('div', { class: 'panel' }, h('h2', {}, 'Submit a game'), sub),
      h('div', { class: 'panel' }, h('h2', {}, 'Your submissions'), mine.length ? h('table', {}, h('tr', {}, ['Title', 'Category', 'Status', 'Review notes'].map(x => h('th', {}, x))), rows) : h('p', { class: 'empty' }, 'Nothing submitted yet.')))));
}

async function adminView() {
  let list; try { list = await api('/admin/submissions'); } catch { return app.replaceChildren(h('div', { class: 'wrap' }, h('p', { class: 'err' }, 'Admin access required. Log in from the Developers tab.'))); }
  const set = async (s, status, notes) => { await api('/admin/submissions/' + s.id, { method: 'POST', body: { status, notes } }); toast('Marked ' + status); adminView(); };
  app.replaceChildren(h('div', { class: 'wrap' }, h('h1', {}, 'Admin review'), list.length ? list.map(s => {
    const notes = h('input', { type: 'text', placeholder: 'Review notes', value: s.review_notes || '' });
    return h('div', { class: 'panel' }, h('b', {}, s.title), ' ', h('span', { class: 'st ' + s.status }, s.status),
      h('p', { class: 'empty' }, s.category + ' | ' + s.dev_email), h('p', {}, h('a', { href: s.build_url, target: '_blank', rel: 'noopener noreferrer' }, s.build_url)), notes,
      h('p', {}, h('button', { class: 'btn sm', on: { click: () => set(s, 'approved', notes.value) } }, 'Approve'), ' ',
        h('button', { class: 'btn sm alt', on: { click: () => set(s, 'rejected', notes.value) } }, 'Reject'), ' ',
        h('button', { class: 'btn sm alt', on: { click: () => set(s, 'pending', notes.value) } }, 'Set pending')));
  }) : h('p', { class: 'empty' }, 'No submissions yet.')));
}

const L = {
  privacy: ['Privacy Policy', ['Effective November 21, 2026. Universe Games Studio (UGS) (SMC-Private) Limited ("we") runs this portal.',
    'We collect: the game plays you start (counts only), technical data such as browser, device type and IP address (used for security and country-level statistics), and, for developers, the name, email and submissions you provide. Passwords are stored hashed.',
    'Advertising partners may use cookies or advertising identifiers to show and measure ads. Games in iframes are run by their developers and may collect their own data under their own policies.',
    'We do not sell personal information. We share data only with service providers needed to run the portal and ads, and with authorities when the law requires it.',
    'The portal is for a general audience and is not directed at children under 13. We do not knowingly collect their personal data.',
    'To access, correct or delete your data, email info@universegamesstudio.com with the subject "Data request".']],
  cookies: ['Cookie Statement', ['Essential: a login cookie (httpOnly) keeps developers signed in for up to 7 days. Language choice is saved in your browser storage.',
    'Advertising and measurement: when ad services are enabled, their providers may set cookies or use identifiers to deliver and measure ads. Where the law requires consent, we ask before using them.',
    'You can block or delete cookies in your browser settings. Some features, such as developer login, will not work without essential cookies.']],
  terms: ['Terms of Use', ['By using this portal you agree to these terms. Play games for personal, lawful use only.',
    'Do not attack, scrape at scale, reverse engineer, or interfere with the portal or the games.',
    'Developers keep ownership of their games. By submitting, you give us a non-exclusive licence to list, host a link to, promote and show ads around your game. You confirm you own or have rights to everything in it and that it contains no malware, illegal or hateful content.',
    'We may approve, reject or remove any game at any time. The portal and games are provided "as is" without warranties, and to the extent the law allows we are not liable for losses from their use.',
    'We may update these terms; continued use means you accept the update.']],
  takedown: ['Content & Takedown Policy', ['Games must not infringe copyright or trademarks, contain malware, sexual content involving minors, hate, or illegal material, or mislead users.',
    'To report a game, email info@universegamesstudio.com with the game title, the link, your contact details and the reason (for copyright claims, identify the work and state you are the owner or authorised to act for them).',
    'We review reports promptly and may remove content while we investigate. Developers can reply with notes and, if removed in error, ask for reinstatement.']],
  faq: ['FAQ', ['Do I need to download anything? No. Games run in your browser using HTML5/WebGL.',
    'Why is a game marked Roadmap or In Build? It is planned or being built and cannot be played yet.',
    'How do developers publish? Create an account in Developers, submit an HTTPS build and wait for review. Check your status there.',
    'Does it cost money? Playing is free; games are supported by ads.']],
  contact: ['Contact', ['Universe Games Studio (UGS) (SMC-Private) Limited', 'House No. D-201, Muhallah Chiri Maran, Inside Mori Gate, Lahore, Pakistan',
    'Email: info@universegamesstudio.com', 'Monday to Friday, 9:00 AM to 6:00 PM (PKT)']]
};
function legal(k) {
  const [title, paras] = L[k] || L.privacy;
  app.replaceChildren(h('div', { class: 'wrap legal' }, h('div', { class: 'tabs' }, Object.keys(L).map(x =>
    h('a', { class: 'btn sm ' + (x === k ? '' : 'alt'), href: '#/legal/' + x }, L[x][0]))), h('h1', {}, title), paras.map(p => h('p', {}, p))));
}

function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/'); window.scrollTo(0, 0);
  if (p[0] === 'dev') dev(); else if (p[0] === 'admin') adminView(); else if (p[0] === 'legal') legal(p[1]); else home();
}
$('#lang').addEventListener('change', e => { lang = e.target.value; localStorage.setItem('lang', lang); applyLang(); route(); });
let tm; $('#q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { location.hash = '#/'; home(); }, 250); });
window.addEventListener('hashchange', route);
api('/config').then(c => { cfg = c; applyLang(); route(); });
