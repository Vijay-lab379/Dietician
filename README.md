# 🌿 NourishAI — Personalised AI Dietician

> A zero-friction, privacy-first web app that gives anyone access to personalised
> nutritional guidance through an AI dietician — without ever exposing API keys to
> the browser.

---

## 1. Chosen Vertical

**Health & Nutrition — Personalised Dietary Guidance**

Diet advice is not one-size-fits-all. A diabetic teenager in South India eats
completely differently from a vegan bodybuilder in North America. Yet most people
who need tailored dietary guidance — because of medical conditions, allergies,
cultural food practices, regional ingredient availability, or personal goals —
cannot afford a human dietician.

NourishAI targets this gap. It acts as a **context-aware AI dietician** that:

- Remembers your health profile (age, diet type, region, medical restrictions)
- Learns new facts about you *during conversation* (e.g. "I am lactose-intolerant")
  and persists them across sessions
- Answers dietary questions, generates recipes, and builds meal plans tailored
  specifically to the context it has collected

The vertical is broad enough to be useful to almost anyone, but the *personalisation
layer* keeps responses concrete, relevant, and safe.

---

## 2. Approach and Logic

### 2.1 Zero-Backend for Users, Secure Proxy for Keys

The original design stored API keys directly in `app.js` (client-side). The
architecture was refactored to a **thin Express proxy server** (`server.js`) that:

1. Reads API keys from a `.env` file (never committed to version control)
2. Exposes a single endpoint — `POST /api/chat` — to the browser
3. Rotates through multiple keys automatically on rate-limit or rejection errors
4. Logs *only key counts*, never key values, to the console

The browser never sees a key. The user still gets a snappy, single-page experience
because the server also serves all static files.

```
Browser ──── POST /api/chat ────► server.js ──► Groq / Gemini / OpenRouter
                                     ▲
                                  .env keys
                                (never sent down)
```

### 2.2 Profile-Driven System Prompt

Every AI request is preceded by a dynamically assembled **system prompt** built
from the user's stored profile:

```
You are NourishAI, a personalised dietician.
User profile:
  Name:        Aisha
  Age:         28
  Diet type:   Vegetarian
  Region:      South India
  Goals:       Weight loss, manage PCOS
  Restrictions: No dairy, no refined sugar
Memory (learned):
  - Prefers quick recipes under 30 minutes
  - Dislikes bitter gourd
```

This means the model never gives generic advice. Every suggestion is filtered
through the user's real constraints before generation begins.

### 2.3 AI Memory Engine

The AI is instructed to embed a hidden `[MEMORY: ...]` tag whenever it detects a
new user fact:

```
Sure! Here's a great recipe for you. [MEMORY: user is lactose-intolerant]
```

`app.js` strips this tag before displaying the message, extracts the learned fact,
and appends it to `localStorage`. On the next session, this fact re-enters the
system prompt automatically.

This produces a **continuously improving personal context** with no extra user
effort.

### 2.4 Multi-Provider Fallback with Key Rotation

Three providers are supported — **Groq**, **Google Gemini**, and **OpenRouter**.
`server.js` maintains a separate key pool for each provider. On a `429 Too Many
Requests` or `401/403` error it silently rotates to the next key and retries,
so the user never sees a failure caused by a rate-limited key.

---

## 3. How the Solution Works

### 3.1 File Structure

```
Dietician/
├── server.js          ← Express proxy server (Node.js)
├── .env               ← API keys (never committed)
├── .env.example       ← Template showing expected key names
├── package.json       ← Dependencies: express, dotenv, node-fetch
│
├── index.html         ← Single-page app shell
├── style.css          ← Custom design system ("Vitality" theme)
└── app.js             ← All frontend logic (profile, memory, chat UI)
```

### 3.2 Request Lifecycle

```
1. User types a message and presses Send.

2. app.js:
   a. Reads the user profile from localStorage
   b. Reads the AI memory list from localStorage
   c. Builds a full system prompt containing both
   d. Appends the user message to conversationHistory[]

3. fetch('/api/chat', { provider, model, messages, … })
   → goes to server.js

4. server.js:
   a. Looks up the provider's key pool
   b. Selects the current key (round-robin, starting from _idx)
   c. Calls the upstream AI endpoint
   d. On 429/401/403 → rotates to next key, retries
   e. On success → advances _idx and returns the JSON response

5. app.js:
   a. Scans the reply for [MEMORY: …] tags → saves to localStorage
   b. Strips the tag → renders markdown into the chat bubble
   c. Shows token usage (provider · Np + Mc tokens)
```

### 3.3 Running the App

**Prerequisites:** Node.js ≥ 18

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template and add your keys
copy .env.example .env
# Open .env and fill in at least one real key

# 3. Start the server
npm start          # production
npm run dev        # auto-restart on file changes (uses nodemon)

# 4. Open http://localhost:3000 in your browser
```

**Free API keys:**

| Provider | Sign-up URL |
|---|---|
| Groq | https://console.groq.com/keys |
| Google Gemini | https://aistudio.google.com/app/apikey |
| OpenRouter | https://openrouter.ai/keys |

Groq and Gemini both offer free tiers with generous daily limits.

### 3.4 Key Environment Variables

| Variable | Description |
|---|---|
| `GROQ_KEY_1` | First Groq API key |
| `GROQ_KEY_2` | (Optional) second key for rotation |
| `GEMINI_KEY_1` | First Gemini API key |
| `OPENROUTER_KEY_1` | First OpenRouter key |
| `PORT` | Port to serve on (default: `3000`) |

Add `_2`, `_3`, … suffixes for additional keys. The server loads them all
automatically.

### 3.5 Supported Models

| Model | Provider | Speed |
|---|---|---|
| Llama 3.3 70B | Groq | Fast |
| Llama 3.1 8B | Groq | Fastest |
| Gemma 2 9B | Groq | Fast |
| Gemini 2.0 Flash | Gemini | Fast |
| Gemini 1.5 Flash | Gemini | Fast |
| Gemini 1.5 Pro | Gemini | Quality |
| Llama 3.3 70B | OpenRouter | Balanced |
| Mistral 7B | OpenRouter | Fast |

---

## 4. Assumptions Made

| # | Assumption |
|---|---|
| 1 | **Node.js is available locally.** The proxy server requires Node ≥ 18. If the deployment target is purely static (e.g. GitHub Pages), a serverless function (Vercel/Cloudflare Worker) would replace `server.js`. |
| 2 | **Free-tier API limits are sufficient.** Groq provides ~7,000 requests/day free; Gemini provides 1,500/day. For personal or demo use this is ample. High-traffic production use would need paid plans. |
| 3 | **localStorage persistence is acceptable.** User profiles and AI memory are stored in the browser's `localStorage`. This is per-device and per-browser — multi-device sync is out of scope. |
| 4 | **The AI's medical knowledge is advisory, not clinical.** The app is not a substitute for a registered dietician or doctor. Users with serious medical conditions are expected to consult a professional. |
| 5 | **Single-user, single-browser deployment.** There is no authentication system. Anyone with access to the running URL can use the app. Adding auth (e.g. Clerk, Supabase) is a planned next step for multi-user deployment. |
| 6 | **English-primary interface.** The AI can respond in other languages if the user writes in them, but the UI text is in English only. |
| 7 | **Key rotation handles all rate-limiting.** If a user exhausts all keys simultaneously the UI shows an error and asks them to try a different model. Queuing/retry with backoff is not implemented. |

---

## Security Note

`.env` is listed in `.gitignore` and should **never** be committed. Only
`.env.example` (containing placeholder values) is committed to the repository.

All API keys stay on the server. The browser receives only the AI's text response.

---

## Roadmap

- [ ] **Voice input** — Web Speech API for hands-free questions
- [ ] **Meal logging** — Log meals and track daily macros
- [ ] **PDF export** — Download generated meal plans
- [ ] **Dark mode** — Theme toggle
- [ ] **Multi-user auth** — Clerk / Supabase authentication
- [ ] **Serverless deploy** — Replace `server.js` with a Vercel Edge Function

---

## Disclaimer

NourishAI provides general nutritional information for educational purposes only.
It is not a substitute for professional medical or dietary advice. Always consult
a qualified healthcare provider before making significant changes to your diet,
especially if you have a medical condition.
