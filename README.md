# EcoPaathshala — Full App (multi-page, database, login, games)

A gamified environmental-education web app for a college mini-project: real login (hashed
passwords, sessions), a local JSON database, an AI study assistant, an eco-habit tracker,
three offline mini-games, and AI-generated homework with feedback.

## What's inside

```
server.js            Express server — auth, database, AI proxy, all API routes
db.json               Auto-created local database file (users, tracker entries, game scores, homework)
public/
  index.html          Home dashboard (cards)
  login.html          Login
  signup.html         Sign up (live strong-password checklist)
  mitra.html          AI Mitra — general study assistant + environment expertise
  tracker.html        Eco Tracker (saves to database)
  issues.html         Local Issues + city field-reading widget
  homework.html       AI-generated assignments + AI feedback
  games/
    index.html        Games hub
    waste-sort.html   Waste Sorting Sprint (offline)
    quiz.html         Eco Quiz Challenge (offline)
    memory.html       Eco Memory Match (offline)
  css/style.css        Shared styling (dark/light theme included)
  js/theme.js, api.js, header.js   Shared logic used by every page
```

The three games and the local-issues page never call the AI — they work with **no API key
at all**. Only AI Mitra, Eco Tracker feedback, and Homework question/feedback need a working
Anthropic API key.

## Setup

1. **Install Node.js** (v18+) — https://nodejs.org, check with `node -v`.

2. Open a terminal in this folder:
   ```
   cd ecopaathshala-app
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Create your `.env` file:
   - Mac/Linux: `cp .env.example .env`
   - Windows (PowerShell): `copy .env.example .env`

5. Open `.env` and fill in:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx
   SESSION_SECRET=any-long-random-string-you-make-up
   ```
   Get an API key from **https://console.anthropic.com/settings/keys**.
   `SESSION_SECRET` can be any random text — it's used to sign login session cookies.

6. Start the server:
   ```
   npm start
   ```

7. Open **http://localhost:3000** — sign up for an account, and explore.

## Admin dashboard

Visit **http://localhost:3000/admin.html** to see every registered user in a table — name,
email, college, points, badge, and their activity counts (tracker entries, game scores,
homework submissions). It asks for the `ADMIN_KEY` value from your `.env` file first, so it's
not wide open to anyone who finds the URL. This page is intentionally not linked from the
main navigation — you access it by typing the URL directly.

## Database

This uses **lowdb**, a lightweight JSON-file database (`db.json`), chosen deliberately so the
whole project installs with a plain `npm install` — no native compilers, no separate database
server to install (like MySQL/MongoDB), which is a common setup headache on Windows for a
mini-project. `db.json` is created automatically on first run and stores:
- `users` — name, email, **bcrypt-hashed** password (never plain text), college, points
- `trackerEntries`, `gameScores`, `homework` — all linked to a `userId`

If your project needs to demonstrate "real SQL", you can mention in your report that lowdb
was chosen for zero-setup reliability, and that swapping it for PostgreSQL/MySQL would only
require changing the data-access lines in `server.js` — the rest of the app (routes, pages)
would stay the same.

## Password requirements

Enforced both in the browser (live checklist on the sign-up page) and on the server
(`server.js`, so it can't be bypassed): minimum 8 characters, at least one uppercase letter,
one lowercase letter, one number, and one special character.

## Login/session notes

- Sessions use `express-session` with the default in-memory store — fine for a local demo,
  but it means **restarting the server logs everyone out**. For a real deployment you'd swap
  in a persistent session store (e.g. `connect-sqlite3`).
- Passwords are hashed with `bcryptjs` before being stored — the server never keeps or logs
  the plain-text password.

## Making it public (so anyone can use it via a link)

Running `npm start` only works on your own computer — for a real shareable link, you need to
host it on a cloud platform. Recommended: **Railway** (free trial credit, handles persistent
storage well, simple GitHub-based deploy).

1. **Push this project to GitHub**
   - Create a new repo on github.com
   - In this folder: `git init`, `git add .`, `git commit -m "EcoPaathshala"`,
     then follow GitHub's instructions to push (`git remote add origin ...`, `git push`)
   - `.env` and `db.json` are already in `.gitignore` — they will NOT be uploaded (good, they
     have your API key and user data)

2. **Sign up at railway.app** (GitHub login works)

3. **New Project → Deploy from GitHub repo** → pick this repo

4. **Add environment variables** in Railway's dashboard (Variables tab) — same values as your
   local `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-5
   SESSION_SECRET=some-random-string
   ADMIN_KEY=some-random-password
   ```
   (`PORT` is set automatically by Railway — don't set it yourself)

5. **Add a persistent volume** (Settings → Volumes) mounted at `/app` so `db.json` survives
   restarts and redeploys — without this, your database resets every time Railway restarts
   the app.

6. Railway gives you a public URL like `https://ecopaathshala-production.up.railway.app` —
   that's your shareable link.

**Alternative:** Render.com works similarly, but its free tier does NOT have persistent disk
(your database would reset on every restart/sleep) — a paid instance ($7/mo) does.

### Cost protection

Since a public link means anyone can trigger AI calls (which cost you money per request), this
app rate-limits `/api/chat` to 30 requests per 15 minutes per visitor. You can tighten this
further in `server.js` (search for `chatLimiter`) if you're worried about cost with many users.

## Costs

Only AI-powered features (AI Mitra chat, Tracker feedback, Homework questions/feedback) use
the Anthropic API and cost a small amount per request. The three games and Local Issues page
are entirely free/offline. Check usage at **https://console.anthropic.com/settings/billing**.

## Safety

Never commit `.env` or `db.json` to GitHub or share them — `.env` has your API key,
`db.json` has (hashed) user data. Both are already listed in `.gitignore`.
