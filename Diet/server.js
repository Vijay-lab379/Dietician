// ============================================================
//  NourishAI — server.js
//  Secure Express proxy + chat history persistence
// ============================================================

require('dotenv').config();
const express  = require('express');
const fetch    = require('node-fetch');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

// ── Chat history folder ───────────────────────────────────────
const HISTORY_DIR = path.join(__dirname, 'chat_history');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);

// ─────────────────────────────────────────────────────────────
//  Load API keys from .env  (OPENROUTER_KEY_1, GROQ_KEY_1, …)
// ─────────────────────────────────────────────────────────────
function loadKeys(prefix) {
  const keys = [];
  let i = 1;
  while (process.env[`${prefix}_${i}`]) {
    const k = process.env[`${prefix}_${i}`].trim();
    if (k && !k.startsWith('YOUR_') && !k.startsWith('sk-or-v1-YOUR') && !k.startsWith('gsk_YOUR')) {
      keys.push(k);
    }
    i++;
  }
  return keys;
}

const KEY_POOL = {
  openrouter: { keys: loadKeys('OPENROUTER_KEY'), _idx: 0 },
  groq:       { keys: loadKeys('GROQ_KEY'),       _idx: 0 },
  gemini:     { keys: loadKeys('GEMINI_KEY'),      _idx: 0 },
};

const PROVIDER_URLS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  gemini:     'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};

console.log('🔑 Keys loaded:');
for (const [name, pool] of Object.entries(KEY_POOL)) {
  console.log(`   ${name}: ${pool.keys.length} key(s)`);
}

// ─────────────────────────────────────────────────────────────
//  POST /api/chat  — proxy AI call (keys never reach browser)
// ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { provider, model, messages, max_tokens = 700, temperature = 0.75 } = req.body;

  if (!provider || !PROVIDER_URLS[provider])
    return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } });

  const pool = KEY_POOL[provider];
  if (pool.keys.length === 0)
    return res.status(500).json({ error: { message: `No valid keys for ${provider}. Check .env` } });

  const startIdx = pool._idx % pool.keys.length;
  let attempted = 0;

  while (attempted < pool.keys.length) {
    const keyIdx = (startIdx + attempted) % pool.keys.length;
    const key    = pool.keys[keyIdx];
    attempted++;

    const url = provider === 'gemini'
      ? `${PROVIDER_URLS.gemini}?key=${key}`
      : PROVIDER_URLS[provider];

    const headers = { 'Content-Type': 'application/json' };
    if (provider !== 'gemini')     headers['Authorization'] = `Bearer ${key}`;
    if (provider === 'openrouter') headers['X-Title']       = 'NourishAI';

    try {
      const upstream = await fetch(url, {
        method: 'POST', headers,
        body: JSON.stringify({ model, messages, max_tokens, temperature }),
      });
      const data = await upstream.json();

      if (upstream.status === 429) { console.warn(`[${provider}] key ${keyIdx+1} rate-limited`); continue; }
      if (upstream.status === 401 || upstream.status === 403) { console.warn(`[${provider}] key ${keyIdx+1} rejected`); continue; }

      pool._idx = (keyIdx + 1) % pool.keys.length;
      return res.status(upstream.status).json(data);

    } catch (err) {
      console.error(`[${provider}] network error:`, err.message);
    }
  }

  return res.status(503).json({ error: { message: `All ${provider} keys exhausted. Try another model.` } });
});

// ─────────────────────────────────────────────────────────────
//  CHAT HISTORY API
// ─────────────────────────────────────────────────────────────

// GET /api/history — list all saved sessions (newest first)
app.get('/api/history', (_req, res) => {
  try {
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const raw  = fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8');
        const data = JSON.parse(raw);
        return {
          id:        data.id,
          title:     data.title,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          msgCount:  data.messages.length,
        };
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history/:id — load one full session
app.get('/api/history/:id', (req, res) => {
  const file = path.join(HISTORY_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Session not found' });
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// POST /api/history — save / update a session
app.post('/api/history', (req, res) => {
  try {
    const { id, title, messages, createdAt } = req.body;
    if (!id || !messages) return res.status(400).json({ error: 'id and messages required' });

    const session = {
      id,
      title:     title || 'Untitled Chat',
      messages,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(HISTORY_DIR, `${id}.json`),
      JSON.stringify(session, null, 2),
      'utf8'
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/history/:id — delete a session
app.delete('/api/history/:id', (req, res) => {
  const file = path.join(HISTORY_DIR, `${req.params.id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// GET /api/status
app.get('/api/status', (_req, res) => {
  const status = {};
  for (const [name, pool] of Object.entries(KEY_POOL))
    status[name] = { keyCount: pool.keys.length, hasKeys: pool.keys.length > 0 };
  res.json(status);
});

app.listen(PORT, () => {
  console.log(`\n🌿 NourishAI running at http://localhost:${PORT}`);
  console.log(`   Chat history folder: ${HISTORY_DIR}\n`);
});
