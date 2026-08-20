require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);
db.defaults({ users: [], trackerEntries: [], gameScores: [], homework: [] }).write();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ecopaathshala-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

if (!API_KEY) {
  console.warn('\n⚠️  WARNING: ANTHROPIC_API_KEY set nahi hai .env mein — AI Mitra/Homework AI feedback fail hoga.\n');
}

function badgeFor(pts){
  if (pts >= 100) return { name: 'Van (Forest)', next: null };
  if (pts >= 60) return { name: 'Vriksh (Tree)', next: 100 };
  if (pts >= 25) return { name: 'Ankur (Sprout)', next: 60 };
  return { name: 'Beej (Seed)', next: 25 };
}
function publicUser(u){
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, college: u.college, points: u.points, badge: badgeFor(u.points) };
}
function requireAuth(req, res, next){
  if (!req.session.userId) return res.status(401).json({ error: 'Login required.' });
  next();
}
function requireAdmin(req, res, next){
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY) return res.status(500).json({ error: 'ADMIN_KEY set nahi hai .env mein.' });
  if (req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(401).json({ error: 'Galat admin key.' });
  next();
}
function addPoints(userId, amount){
  const user = db.get('users').find({ id: userId }).value();
  if (!user) return;
  db.get('users').find({ id: userId }).assign({ points: (user.points || 0) + amount }).write();
}

/* ---------------- AUTH ---------------- */
app.post('/api/signup', (req, res) => {
  const { name, email, password, college } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email aur password zaroori hain.' });
  }
  if (!STRONG_PW.test(password)) {
    return res.status(400).json({ error: 'Password kam se kam 8 characters ka ho, aur usme ek uppercase, ek lowercase, ek number, aur ek special character ho.' });
  }
  const emailNorm = String(email).trim().toLowerCase();
  if (db.get('users').find({ email: emailNorm }).value()) {
    return res.status(409).json({ error: 'Is email se pehle se account bana hua hai. Login karo.' });
  }
  const user = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: String(name).trim(),
    email: emailNorm,
    college: (college || '').trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    points: 0,
    createdAt: Date.now()
  };
  db.get('users').push(user).write();
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email aur password daalo.' });
  const emailNorm = String(email).trim().toLowerCase();
  const user = db.get('users').find({ email: emailNorm }).value();
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Email ya password galat hai.' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.get('users').find({ id: req.session.userId }).value();
  res.json({ user: publicUser(user) });
});

/* ---------------- AI PROXY ---------------- */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bahut zyada AI requests ho gayi hain — thodi der baad try karo (cost protection).' }
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { system, userText, maxTokens } = req.body || {};
    if (!userText) return res.status(400).json({ error: 'userText is required' });
    if (!API_KEY) return res.status(500).json({ error: 'Server par ANTHROPIC_API_KEY set nahi hai.' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 1000, system: system || '', messages: [{ role: 'user', content: userText }] })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: (data.error && data.error.message) || 'Anthropic API error' });
    }
    const text = (data.content || []).map(b => (b.type === 'text' ? b.text : '')).filter(Boolean).join('\n');
    res.json({ text });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error — terminal console check karo.' });
  }
});

/* ---------------- TRACKER ---------------- */
app.post('/api/tracker', requireAuth, (req, res) => {
  const { transport, plastic, resource, note, feedback } = req.body || {};
  const entry = {
    id: 'e_' + Date.now(), userId: req.session.userId,
    transport, plastic, resource, note: note || '', feedback: feedback || '', createdAt: Date.now()
  };
  db.get('trackerEntries').push(entry).write();
  addPoints(req.session.userId, 5);
  const user = db.get('users').find({ id: req.session.userId }).value();
  res.json({ entry, user: publicUser(user) });
});
app.get('/api/tracker', requireAuth, (req, res) => {
  const entries = db.get('trackerEntries').filter({ userId: req.session.userId }).sortBy('createdAt').reverse().take(10).value();
  res.json({ entries });
});

/* ---------------- GAME SCORES ---------------- */
app.post('/api/game-score', requireAuth, (req, res) => {
  const { game, score } = req.body || {};
  if (!game || typeof score !== 'number') return res.status(400).json({ error: 'game and score required' });
  const record = { id: 'g_' + Date.now(), userId: req.session.userId, game, score, createdAt: Date.now() };
  db.get('gameScores').push(record).write();

  const best = db.get('gameScores').filter({ userId: req.session.userId, game }).map('score').max().value() || 0;
  const earned = Math.max(1, Math.round(score / 5));
  addPoints(req.session.userId, earned);
  const user = db.get('users').find({ id: req.session.userId }).value();
  res.json({ best, earned, user: publicUser(user) });
});
app.get('/api/game-score/:game/best', requireAuth, (req, res) => {
  const best = db.get('gameScores').filter({ userId: req.session.userId, game: req.params.game }).map('score').max().value() || 0;
  res.json({ best });
});

/* ---------------- HOMEWORK ---------------- */
app.post('/api/homework', requireAuth, (req, res) => {
  const { topic, question, answer, aiFeedback } = req.body || {};
  const record = { id: 'h_' + Date.now(), userId: req.session.userId, topic, question, answer, aiFeedback, createdAt: Date.now() };
  db.get('homework').push(record).write();
  addPoints(req.session.userId, 8);
  const user = db.get('users').find({ id: req.session.userId }).value();
  res.json({ record, user: publicUser(user) });
});
app.get('/api/homework', requireAuth, (req, res) => {
  const list = db.get('homework').filter({ userId: req.session.userId }).sortBy('createdAt').reverse().take(15).value();
  res.json({ list });
});

/* ---------------- ADMIN ---------------- */
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.get('users').value();
  const rows = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    college: u.college,
    points: u.points,
    badge: badgeFor(u.points).name,
    createdAt: u.createdAt,
    trackerCount: db.get('trackerEntries').filter({ userId: u.id }).size().value(),
    gameCount: db.get('gameScores').filter({ userId: u.id }).size().value(),
    homeworkCount: db.get('homework').filter({ userId: u.id }).size().value()
  })).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ users: rows });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🌱 EcoPaathshala chal raha hai: http://localhost:${PORT}\n`));
