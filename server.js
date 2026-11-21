'use strict';
const express = require('express'), helmet = require('helmet'), cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const Database = require('better-sqlite3'), path = require('path');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) { console.error('Set JWT_SECRET (16+ chars) in your environment.'); process.exit(1); }
const PROD = process.env.NODE_ENV === 'production';
const CATS = ['Action','Adventure','Arcade','Car/Driving','Puzzle','Shooting','Sports','Simulation','Skill','Multiplayer/.io','2-Player','Relaxing/Casual'];

const db = new Database(process.env.DB_PATH || 'ugs.db');
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'developer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, thumb_url TEXT, build_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', review_notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS games(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL,
  thumb_url TEXT, play_url TEXT, status TEXT NOT NULL DEFAULT 'live', plays INTEGER DEFAULT 0,
  submission_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);

// First admin
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD &&
    !db.prepare('SELECT 1 FROM users WHERE email=?').get(process.env.ADMIN_EMAIL.toLowerCase())) {
  db.prepare('INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,?)')
    .run(process.env.ADMIN_EMAIL.toLowerCase(), 'Admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12), 'admin');
}
// Studio titles: roadmap only (no playable web build yet). Set play_url + status 'live' when a WebGL build exists.
if (!db.prepare('SELECT COUNT(*) c FROM games').get().c) {
  const ins = db.prepare("INSERT INTO games(title,description,category,status) VALUES(?,?,?,'roadmap')");
  ins.run('Arrow Out: Block Tap Away', 'Tap arrow blocks in the right order so they slide away.', 'Puzzle');
  ins.run('Animal Kingdom: Merge Animal', 'Merge animals to unlock new creatures.', 'Relaxing/Casual');
  ins.run('Snake Escape: Slither Maze', 'Guide each snake out of a tangled maze.', 'Puzzle');
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'https:', 'data:'],
  frameSrc: ['https:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"]
  // To enable AdSense/IMA later, add their hosts to scriptSrc/frameSrc/connectSrc here.
} } }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const apiLimit = rateLimit({ windowMs: 60 * 1000, limit: 200 });
app.use('/api', apiLimit);

const sign = u => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
const setCookie = (res, u) => res.cookie('t', sign(u), { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 7 * 864e5 });
function auth(req, res, next) {
  try { const p = jwt.verify(req.cookies.t, SECRET);
    const u = db.prepare('SELECT id,email,name,role FROM users WHERE id=?').get(p.id);
    if (!u) throw 0; req.user = u; next();
  } catch { res.status(401).json({ error: 'Please log in.' }); }
}
const admin = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only.' });

function httpsUrl(v, req, required) {
  if (!v) return required ? null : '';
  try { const u = new URL(String(v)); if (u.protocol !== 'https:') return null;
    if (u.hostname === req.hostname) return null; return u.href.slice(0, 500); } catch { return null; }
}

app.post('/api/register', authLimit, (req, res) => {
  const { email, name, password } = req.body || {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') || !name || String(name).length > 60 || (password || '').length < 8)
    return res.status(400).json({ error: 'Valid email, name and a password of 8+ characters are required.' });
  try {
    const r = db.prepare('INSERT INTO users(email,name,password_hash) VALUES(?,?,?)')
      .run(email.toLowerCase(), String(name).trim(), bcrypt.hashSync(password, 12));
    const u = { id: r.lastInsertRowid, role: 'developer' }; setCookie(res, u); res.json({ ok: 1 });
  } catch { res.status(409).json({ error: 'That email is already registered.' }); }
});
app.post('/api/login', authLimit, (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
  setCookie(res, u); res.json({ ok: 1 });
});
app.post('/api/logout', (req, res) => { res.clearCookie('t'); res.json({ ok: 1 }); });
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));
app.get('/api/config', (req, res) => res.json({ cats: CATS, revShare: process.env.REV_SHARE_TEXT || 'Revenue-share terms are agreed in writing before a game goes live.' }));

app.get('/api/games', (req, res) => {
  const q = `%${String(req.query.q || '').slice(0, 60)}%`, cat = req.query.cat;
  const order = req.query.sort === 'popular' ? 'plays DESC' : 'created_at DESC, id DESC';
  const rows = CATS.includes(cat)
    ? db.prepare(`SELECT id,title,description,category,thumb_url,play_url,status,plays FROM games WHERE title LIKE ? AND category=? ORDER BY ${order}`).all(q, cat)
    : db.prepare(`SELECT id,title,description,category,thumb_url,play_url,status,plays FROM games WHERE title LIKE ? ORDER BY ${order}`).all(q);
  res.json(rows);
});
app.post('/api/games/:id/play', (req, res) => {
  db.prepare("UPDATE games SET plays=plays+1 WHERE id=? AND status='live'").run(req.params.id); res.json({ ok: 1 });
});

app.get('/api/submissions', auth, (req, res) =>
  res.json(db.prepare('SELECT id,title,category,build_url,status,review_notes,created_at FROM submissions WHERE user_id=? ORDER BY id DESC').all(req.user.id)));
app.post('/api/submissions', auth, (req, res) => {
  const b = req.body || {}, build = httpsUrl(b.build_url, req, true), thumb = httpsUrl(b.thumb_url, req, false);
  if (!b.title || b.title.length < 2 || b.title.length > 80) return res.status(400).json({ error: 'Title must be 2-80 characters.' });
  if (!CATS.includes(b.category)) return res.status(400).json({ error: 'Choose a valid category.' });
  if (!build) return res.status(400).json({ error: 'Build URL must be a public HTTPS link on another domain.' });
  if (thumb === null) return res.status(400).json({ error: 'Thumbnail must be an HTTPS link.' });
  db.prepare('INSERT INTO submissions(user_id,title,description,category,thumb_url,build_url) VALUES(?,?,?,?,?,?)')
    .run(req.user.id, b.title.trim(), String(b.description || '').slice(0, 500), b.category, thumb, build);
  res.json({ ok: 1 });
});

app.get('/api/admin/submissions', auth, admin, (req, res) =>
  res.json(db.prepare(`SELECT s.*, u.email dev_email FROM submissions s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC`).all()));
app.post('/api/admin/submissions/:id', auth, admin, (req, res) => {
  const { status, notes } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found.' });
  db.transaction(() => {
    db.prepare('UPDATE submissions SET status=?, review_notes=? WHERE id=?').run(status, String(notes || '').slice(0, 500), s.id);
    db.prepare('DELETE FROM games WHERE submission_id=?').run(s.id);
    if (status === 'approved')
      db.prepare("INSERT INTO games(title,description,category,thumb_url,play_url,status,submission_id) VALUES(?,?,?,?,?,'live',?)")
        .run(s.title, s.description, s.category, s.thumb_url, s.build_url, s.id);
  })();
  res.json({ ok: 1 });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('UGS portal running on port ' + (process.env.PORT || 3000)));
