// ============================================================
//  NourishAI — server.js
//  Secure Express proxy — reads API keys from .env
//  and forwards requests to AI providers.
//  Keys are NEVER sent to the browser.
// ============================================================

require('dotenv').config();
const express  = require('express');
const fetch    = require('node-fetch');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Serve static frontend files ───────────────────────────────
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────
//  Load keys from .env into arrays (supports KEY_1, KEY_2, …)
// ─────────────────────────────────────────────────────────────
function loadKeys(prefix) {
  const keys = [];
  let i = 1;
  while (process.env[`${prefix}_${i}`]) {
    const k = process.env[`${prefix}_${i}`].trim();
    // Skip placeholder values
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

// Log loaded key counts (never the key values themselves)
console.log('🔑 Keys loaded:');
for (const [name, pool] of Object.entries(KEY_POOL)) {
  console.log(`   ${name}: ${pool.keys.length} key(s)`);
}

// ─────────────────────────────────────────────────────────────
//  POST /api/chat — the only route the browser calls
// ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { provider, model, messages, max_tokens = 700, temperature = 0.75 } = req.body;

  if (!provider || !PROVIDER_URLS[provider]) {
    return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } });
  }

  const pool = KEY_POOL[provider];

  if (pool.keys.length === 0) {
    return res.status(500).json({
      error: { message: `No valid keys found for ${provider}. Check your .env file.` }
    });
  }

  const startIdx = pool._idx % pool.keys.length;
  let attempted  = 0;

  while (attempted < pool.keys.length) {
    const keyIdx = (startIdx + attempted) % pool.keys.length;
    const key    = pool.keys[keyIdx];
    attempted++;

    const url     = provider === 'gemini'
      ? `${PROVIDER_URLS.gemini}?key=${key}`
      : PROVIDER_URLS[provider];

    const headers = { 'Content-Type': 'application/json' };
    if (provider !== 'gemini')     headers['Authorization'] = `Bearer ${key}`;
    if (provider === 'openrouter') headers['X-Title']       = 'NourishAI';

    try {
      const upstream = await fetch(url, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ model, messages, max_tokens, temperature }),
      });

      const data = await upstream.json();

      // Rate limit → rotate to next key
      if (upstream.status === 429) {
        console.warn(`[${provider}] key ${keyIdx + 1} rate-limited, rotating…`);
        continue;
      }
      // Bad key → rotate
      if (upstream.status === 401 || upstream.status === 403) {
        console.warn(`[${provider}] key ${keyIdx + 1} rejected, rotating…`);
        continue;
      }

      // Advance pool index on success
      pool._idx = (keyIdx + 1) % pool.keys.length;

      // Pass through the response (with status) but never expose the key
      return res.status(upstream.status).json(data);

    } catch (err) {
      console.error(`[${provider}] network error:`, err.message);
      // Try next key on network error
    }
  }

  return res.status(503).json({
    error: { message: `All ${provider} keys exhausted or unavailable. Try another model.` }
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /api/status — lets the frontend check which providers
//  have keys loaded (count only — never the key values)
// ─────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  const status = {};
  for (const [name, pool] of Object.entries(KEY_POOL)) {
    status[name] = { keyCount: pool.keys.length, hasKeys: pool.keys.length > 0 };
  }
  res.json(status);
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 NourishAI running at http://localhost:${PORT}`);
  console.log(`   Open that URL in your browser.\n`);
});
