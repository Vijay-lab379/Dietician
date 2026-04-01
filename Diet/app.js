// ============================================================
//  NourishAI — app.js
//  With full chat history: autosave, browse, reload, delete
// ============================================================

const PROVIDERS = {
  openrouter: { label: 'OpenRouter' },
  groq:       { label: 'Groq' },
  gemini:     { label: 'Google Gemini' },
};

const MODELS = [
  { value: 'llama-3.3-70b-versatile',                label: 'Llama 3.3 70B 🚀',   provider: 'groq',       group: 'Groq — Free & Fast' },
  { value: 'llama3-8b-8192',                         label: 'Llama 3 8B',          provider: 'groq',       group: 'Groq — Free & Fast' },
  { value: 'gemma2-9b-it',                           label: 'Gemma 2 9B',          provider: 'groq',       group: 'Groq — Free & Fast' },
  { value: 'mixtral-8x7b-32768',                     label: 'Mixtral 8x7B',        provider: 'groq',       group: 'Groq — Free & Fast' },
  { value: 'gemini-2.0-flash',                       label: 'Gemini 2.0 Flash ✨', provider: 'gemini',     group: 'Google Gemini — Free' },
  { value: 'gemini-1.5-flash',                       label: 'Gemini 1.5 Flash',    provider: 'gemini',     group: 'Google Gemini — Free' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B',       provider: 'openrouter', group: 'OpenRouter — Free' },
  { value: 'deepseek/deepseek-chat-v3-0324:free',    label: 'DeepSeek V3',         provider: 'openrouter', group: 'OpenRouter — Free' },
];

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
let userProfile = {
  name: '', age: '', diet: 'vegetarian', region: '', culture: '',
  goals: [], restrictions: '', aiMemory: [],
};

let conversationHistory = [];   // raw messages sent to API
let currentSessionId    = null; // active session ID
let currentSessionStart = null; // ISO timestamp of session start
let autosaveTimer       = null;
let historyCache        = [];   // in-memory list from server

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  buildModelDropdown();
  renderProfilePanel();
  updateStatPill();
  updateMemoryPill();
  loadHistoryList();

  const ta = document.getElementById('question');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 130) + 'px';
  });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); }
  });
});

// ─────────────────────────────────────────────────────────────
//  PANELS
// ─────────────────────────────────────────────────────────────
function togglePanel(which) {
  const profile  = document.getElementById('profile-panel');
  const history  = document.getElementById('history-panel');
  const overlay  = document.getElementById('panel-overlay');

  const target   = which === 'profile' ? profile : history;
  const other    = which === 'profile' ? history : profile;
  const isOpen   = target.classList.contains('open');

  other.classList.remove('open');
  target.classList.toggle('open', !isOpen);
  overlay.classList.toggle('visible', !isOpen);
}

function closeAllPanels() {
  document.getElementById('profile-panel').classList.remove('open');
  document.getElementById('history-panel').classList.remove('open');
  document.getElementById('panel-overlay').classList.remove('visible');
}

// ─────────────────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────────────────
function loadProfile() {
  try {
    const saved = localStorage.getItem('nourish_profile');
    if (saved) userProfile = { ...userProfile, ...JSON.parse(saved) };
  } catch(e) {}
}

function saveProfileToStorage() {
  try { localStorage.setItem('nourish_profile', JSON.stringify(userProfile)); } catch(e) {}
}

function renderProfilePanel() {
  document.getElementById('pref-name').value         = userProfile.name || '';
  document.getElementById('pref-age').value          = userProfile.age  || '';
  document.getElementById('pref-region').value       = userProfile.region || '';
  document.getElementById('pref-culture').value      = userProfile.culture || '';
  document.getElementById('pref-restrictions').value = userProfile.restrictions || '';
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.value === userProfile.diet));
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', userProfile.goals.includes(c.dataset.val)));
  renderAIMemoryTags();
  updateAvatarCircle();
}

function setDiet(btn) {
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  userProfile.diet = btn.dataset.value;
}

function toggleChip(chip) {
  chip.classList.toggle('active');
  const val = chip.dataset.val;
  if (chip.classList.contains('active')) { if (!userProfile.goals.includes(val)) userProfile.goals.push(val); }
  else { userProfile.goals = userProfile.goals.filter(g => g !== val); }
}

function saveProfile() {
  userProfile.name         = document.getElementById('pref-name').value.trim();
  userProfile.age          = document.getElementById('pref-age').value.trim();
  userProfile.region       = document.getElementById('pref-region').value.trim();
  userProfile.culture      = document.getElementById('pref-culture').value.trim();
  userProfile.restrictions = document.getElementById('pref-restrictions').value.trim();
  saveProfileToStorage();
  updateStatPill();
  updateAvatarCircle();
  const c = document.getElementById('save-confirm');
  c.classList.add('visible');
  setTimeout(() => c.classList.remove('visible'), 2200);
}

function updateAvatarCircle() {
  const el = document.getElementById('avatar-circle');
  if (userProfile.name) {
    el.textContent = userProfile.name.charAt(0).toUpperCase();
    el.style.cssText = "font-size:1.05rem;font-family:'Cormorant Garamond',serif;font-weight:600;color:var(--accent)";
  } else {
    el.textContent = '🌿'; el.style.cssText = 'font-size:1.2rem';
  }
}

function updateStatPill() {
  const map = { vegetarian:'🥦 Vegetarian','non-vegetarian':'🍗 Non-Veg',vegan:'🌱 Vegan',eggetarian:'🥚 Eggetarian' };
  document.getElementById('stat-diet').textContent = map[userProfile.diet] || '🥦 Vegetarian';
}

function renderAIMemoryTags() {
  const section   = document.getElementById('ai-memory-section');
  const container = document.getElementById('ai-memory-tags');
  if (!userProfile.aiMemory || userProfile.aiMemory.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'flex';
  container.innerHTML = '';
  userProfile.aiMemory.forEach(item => {
    const tag = document.createElement('span'); tag.className = 'memory-tag'; tag.textContent = item;
    container.appendChild(tag);
  });
}

function updateMemoryPill() {
  const count = (userProfile.aiMemory || []).length;
  document.getElementById('memory-count').textContent = count;
  const pill = document.getElementById('memory-pill');
  if (count > 0) { pill.classList.add('updated'); setTimeout(() => pill.classList.remove('updated'), 1500); }
}

// ─────────────────────────────────────────────────────────────
//  QUICK SUGGESTIONS
// ─────────────────────────────────────────────────────────────
function injectPrompt(btn) {
  const text = btn.querySelector('span:last-child').textContent;
  document.getElementById('question').value = text;
  document.getElementById('suggestions-row').style.display = 'none';
  askQuestion();
}

// ─────────────────────────────────────────────────────────────
//  SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const p = userProfile;
  const goalLabels = { 'weight-loss':'weight loss','muscle-gain':'muscle gain','heart-health':'heart health','diabetes':'diabetes management','gut-health':'gut health & digestion','energy':'sustained energy levels' };
  const goalsText = (p.goals||[]).map(g => goalLabels[g]||g).join(', ');
  const memText   = (p.aiMemory||[]).join(', ');
  let prompt = `You are NourishAI, a warm, knowledgeable personal food and health guide. You specialise in nutrition, meal planning, healthy recipes, and dietary healthcare. Speak with gentle authority — like a trusted nutritionist friend.\n\nYour PRIMARY job: suggest foods, recipes, and meal plans perfectly tailored to THIS user. Never suggest anything conflicting with their restrictions.\n\nUSER PROFILE:`;
  if (p.name)         prompt += `\n- Name: ${p.name}`;
  if (p.age)          prompt += `\n- Age: ${p.age} years old`;
  if (p.diet)         prompt += `\n- Diet type: ${p.diet}`;
  if (p.region)       prompt += `\n- Region/cuisine preference: ${p.region}`;
  if (p.culture)      prompt += `\n- Cultural/religious restrictions: ${p.culture}`;
  if (goalsText)      prompt += `\n- Health goals: ${goalsText}`;
  if (p.restrictions) prompt += `\n- Known restrictions/allergies: ${p.restrictions}`;
  if (memText)        prompt += `\n- AI-detected preferences from chat: ${memText}`;
  prompt += `\n\nRESPONSE STYLE:\n- Be warm, encouraging, and specific. Use the user's name if known.\n- For recipes, give clear quantities and step-by-step instructions.\n- Highlight WHY a food suits their specific goals/conditions.\n- Use markdown: bold key nutrients, bullets for ingredients, numbered lists for steps.\n- When you detect new health conditions, allergies, preferences, or restrictions, include at the VERY END:\n  [MEMORY: <comma-separated learned facts>]\n  Only include this if you genuinely learned something new this turn.\n- Keep responses focused. One great recipe beats five mediocre ones.\n- Respect ALL dietary restrictions absolutely.`;
  return prompt;
}

// ─────────────────────────────────────────────────────────────
//  AI MEMORY EXTRACTION
// ─────────────────────────────────────────────────────────────
function extractAndSaveMemory(text) {
  const match = text.match(/\[MEMORY:\s*([^\]]+)\]/i);
  if (!match) return null;
  const items = match[1].split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return null;
  items.forEach(item => {
    const exists = (userProfile.aiMemory||[]).some(m => m.toLowerCase().includes(item.toLowerCase().slice(0,8)));
    if (!exists) { if (!userProfile.aiMemory) userProfile.aiMemory = []; userProfile.aiMemory.push(item); }
  });
  saveProfileToStorage();
  renderAIMemoryTags();
  updateMemoryPill();
  return items;
}

function stripMemoryTag(text) { return text.replace(/\[MEMORY:[^\]]*\]/gi,'').trim(); }

// ─────────────────────────────────────────────────────────────
//  MODEL DROPDOWN
// ─────────────────────────────────────────────────────────────
function buildModelDropdown() {
  const select = document.getElementById('model');
  select.innerHTML = '';
  const groups = {};
  for (const m of MODELS) { if (!groups[m.group]) groups[m.group] = []; groups[m.group].push(m); }
  let first = true;
  for (const [groupName, models] of Object.entries(groups)) {
    const og = document.createElement('optgroup'); og.label = groupName;
    for (const m of models) {
      const opt = document.createElement('option'); opt.value = m.value; opt.textContent = m.label;
      if (first) { opt.selected = true; first = false; }
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
}

function getCurrentModel() {
  const value = document.getElementById('model').value;
  return MODELS.find(m => m.value === value) || MODELS[0];
}

// ─────────────────────────────────────────────────────────────
//  MAIN ASK
// ─────────────────────────────────────────────────────────────
async function askQuestion() {
  const question = document.getElementById('question').value.trim();
  const errBox   = document.getElementById('error-box');
  errBox.classList.add('hidden');
  if (!question) return;

  const modelMeta    = getCurrentModel();
  const providerName = modelMeta.provider;

  document.getElementById('suggestions-row').style.display = 'none';

  // Start session if first message
  if (!currentSessionId) startNewSession();

  conversationHistory.push({ role: 'user', content: question });
  renderBubble('user', question);

  const ta = document.getElementById('question');
  ta.value = ''; ta.style.height = 'auto';

  const aiBubbleId = 'bubble-' + Date.now();
  renderAISkeleton(aiBubbleId);
  scrollChat();
  setLoading(true);

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationHistory,
  ];

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerName, model: modelMeta.value, messages, max_tokens: 700, temperature: 0.75 }),
    });

    const data = await res.json();

    if (!res.ok) {
      removeSkeleton(aiBubbleId);
      conversationHistory.pop();
      showError(data?.error?.message || `Server error ${res.status}`);
      setLoading(false);
      return;
    }

    const raw     = data?.choices?.[0]?.message?.content || 'No response received.';
    const usage   = data?.usage;
    const learned = extractAndSaveMemory(raw);
    const display = stripMemoryTag(raw);

    conversationHistory.push({ role: 'assistant', content: raw });
    await typeIntoBubble(aiBubbleId, display, usage, providerName, learned);

    // Auto-save after every AI reply
    scheduleAutosave();

  } catch (err) {
    removeSkeleton(aiBubbleId);
    conversationHistory.pop();
    showError('Could not reach server. Is `node server.js` running? (' + err.message + ')');
  }

  setLoading(false);
  scrollChat();
}

// ─────────────────────────────────────────────────────────────
//  CHAT HISTORY — Session management
// ─────────────────────────────────────────────────────────────

function startNewSession() {
  currentSessionId    = 'session_' + Date.now();
  currentSessionStart = new Date().toISOString();
  document.getElementById('session-title-row').style.display = 'flex';
  document.getElementById('session-title').value = autoTitle();
  document.getElementById('autosave-pill').style.display = 'flex';
}

function autoTitle() {
  const name = userProfile.name ? `${userProfile.name}'s` : 'My';
  const d    = new Date();
  return `${name} chat — ${d.toLocaleDateString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
}

// Debounced autosave — fires 2s after last message
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveCurrentChat, 2000);
}

async function saveCurrentChat() {
  if (!currentSessionId || conversationHistory.length === 0) return;

  const title = document.getElementById('session-title')?.value.trim() || autoTitle();

  // Store only user/assistant turns (strip system messages)
  const toSave = conversationHistory.filter(m => m.role !== 'system');

  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:        currentSessionId,
        title,
        messages:  toSave,
        createdAt: currentSessionStart,
      }),
    });
    // Refresh sidebar list
    loadHistoryList();
  } catch(e) {
    console.warn('Autosave failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  CHAT HISTORY — Sidebar list
// ─────────────────────────────────────────────────────────────

async function loadHistoryList() {
  try {
    const res  = await fetch('/api/history');
    historyCache = await res.json();
    renderHistoryList(historyCache);
  } catch(e) {
    console.warn('Could not load history:', e.message);
  }
}

function renderHistoryList(sessions) {
  const container = document.getElementById('history-list');

  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<div class="history-empty">No saved chats yet.<br>Start a conversation!</div>';
    return;
  }

  // Group by date
  const groups = {};
  sessions.forEach(s => {
    const d   = new Date(s.updatedAt);
    const now = new Date();
    let label;
    if (isSameDay(d, now))                     label = 'Today';
    else if (isSameDay(d, daysAgo(now, 1)))    label = 'Yesterday';
    else if (d > daysAgo(now, 7))              label = 'This Week';
    else                                        label = d.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });

  container.innerHTML = '';
  for (const [label, items] of Object.entries(groups)) {
    const gl = document.createElement('div');
    gl.className = 'history-group-label';
    gl.textContent = label;
    container.appendChild(gl);

    items.forEach(s => {
      const item = document.createElement('div');
      item.className = 'history-item' + (s.id === currentSessionId ? ' active' : '');
      item.dataset.id = s.id;

      const body = document.createElement('div');
      body.className = 'history-item-body';

      const title = document.createElement('div');
      title.className = 'history-item-title';
      title.textContent = s.title;

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';
      const d = new Date(s.updatedAt);
      meta.textContent = `${d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} · ${s.msgCount} messages`;

      body.appendChild(title);
      body.appendChild(meta);

      const del = document.createElement('button');
      del.className = 'history-item-del';
      del.title = 'Delete';
      del.textContent = '✕';
      del.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${s.title}"?`)) return;
        await fetch(`/api/history/${s.id}`, { method: 'DELETE' });
        if (s.id === currentSessionId) clearConversation();
        loadHistoryList();
      };

      item.appendChild(body);
      item.appendChild(del);
      item.onclick = () => loadSession(s.id);
      container.appendChild(item);
    });
  }
}

function filterHistory(query) {
  const q = query.toLowerCase();
  const filtered = q ? historyCache.filter(s => s.title.toLowerCase().includes(q)) : historyCache;
  renderHistoryList(filtered);
}

async function loadSession(id) {
  try {
    const res     = await fetch(`/api/history/${id}`);
    const session = await res.json();

    // Restore state
    conversationHistory = session.messages || [];
    currentSessionId    = session.id;
    currentSessionStart = session.createdAt;

    // Re-render chat
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('suggestions-row').style.display = 'none';
    document.getElementById('session-title-row').style.display = 'flex';
    document.getElementById('session-title').value = session.title;
    document.getElementById('autosave-pill').style.display = 'flex';

    conversationHistory.forEach(msg => {
      if (msg.role === 'user') renderBubble('user', msg.content);
      else if (msg.role === 'assistant') renderBubble('ai', stripMemoryTag(msg.content));
    });

    scrollChat();
    closeAllPanels();

    // Highlight active item
    loadHistoryList();

  } catch(e) {
    showError('Could not load session: ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  NEW / CLEAR
// ─────────────────────────────────────────────────────────────

function newChat() {
  // Save current before resetting
  if (conversationHistory.length > 0) saveCurrentChat();
  clearConversation();
}

function clearConversation() {
  clearTimeout(autosaveTimer);
  conversationHistory = [];
  currentSessionId    = null;
  currentSessionStart = null;
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-empty').style.display = '';
  document.getElementById('error-box').classList.add('hidden');
  document.getElementById('suggestions-row').style.display = 'flex';
  document.getElementById('session-title-row').style.display = 'none';
  document.getElementById('autosave-pill').style.display = 'none';
  const ta = document.getElementById('question');
  ta.value = ''; ta.style.height = 'auto';
}

// ─────────────────────────────────────────────────────────────
//  RENDER BUBBLES
// ─────────────────────────────────────────────────────────────
function renderBubble(role, content) {
  document.getElementById('chat-empty').style.display = 'none';
  const msgs = document.getElementById('chat-messages');
  const row  = document.createElement('div');
  row.className = `bubble-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

  const avatar = document.createElement('div');
  avatar.className = 'bubble-avatar';
  avatar.textContent = role === 'user' ? (userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'You') : '🌿';

  const bubble = document.createElement('div');
  bubble.className = role === 'user' ? 'bubble' : 'bubble prose';
  bubble[role === 'user' ? 'textContent' : 'innerHTML'] =
    role === 'user' ? content : formatAnswer(content);

  row.appendChild(avatar);
  row.appendChild(bubble);
  msgs.appendChild(row);
  scrollChat();
}

function renderAISkeleton(id) {
  document.getElementById('chat-empty').style.display = 'none';
  const msgs = document.getElementById('chat-messages');
  const row  = document.createElement('div');
  row.className = 'bubble-row ai-row'; row.id = id;

  const avatar = document.createElement('div');
  avatar.className = 'bubble-avatar'; avatar.textContent = '🌿';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `<div class="bubble-skeleton"><div class="shimmer-bar" style="width:85%"></div><div class="shimmer-bar" style="width:68%"></div><div class="shimmer-bar" style="width:76%"></div></div>`;

  row.appendChild(avatar); row.appendChild(bubble); msgs.appendChild(row);
}

async function typeIntoBubble(id, raw, usage, providerName, learned) {
  const row = document.getElementById(id);
  if (!row) return;

  const bubble = row.querySelector('.bubble');
  bubble.className = 'bubble prose typing-cursor';
  bubble.innerHTML = '';

  const chars = raw.split('');
  const delay = Math.max(3, Math.min(12, 1000 / chars.length));
  let built = '';

  for (const ch of chars) {
    built += ch;
    bubble.innerHTML = `<p>${esc(built)}</p>`;
    scrollChat();
    await new Promise(r => setTimeout(r, delay));
  }

  bubble.classList.remove('typing-cursor');
  bubble.innerHTML = formatAnswer(raw);

  if (learned && learned.length > 0) {
    const notice = document.createElement('div');
    notice.className = 'memory-notice';
    notice.innerHTML = `🧠 Remembered: <em>${learned.join(', ')}</em>`;
    bubble.appendChild(notice);
  }

  const footer = document.createElement('div');
  footer.className = 'bubble-footer';

  const tokens = document.createElement('span');
  tokens.className = 'bubble-tokens';
  if (usage) tokens.textContent = `${providerName} · ${usage.prompt_tokens??'?'}p + ${usage.completion_tokens??'?'}c tokens`;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg><span>Copy</span>`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(raw).then(() => {
      copyBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => copyBtn.querySelector('span').textContent = 'Copy', 2000);
    }).catch(() => {});
  };

  footer.appendChild(tokens); footer.appendChild(copyBtn);
  bubble.appendChild(footer);
  scrollChat();
}

function removeSkeleton(id) { document.getElementById(id)?.remove(); }

// ─────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────
function scrollChat() {
  const win = document.getElementById('chat-window');
  if (win) win.scrollTop = win.scrollHeight;
}

function setLoading(on) {
  document.getElementById('ask-btn').disabled = on;
  document.getElementById('btn-icon')?.classList.toggle('hidden', on);
  document.getElementById('btn-spinner')?.classList.toggle('hidden', !on);
}

function showError(msg) {
  const el = document.getElementById('error-box');
  el.textContent = '⚠  ' + msg;
  el.classList.remove('hidden');
}

function isSameDay(a, b) { return a.toDateString() === b.toDateString(); }
function daysAgo(d, n)   { const r = new Date(d); r.setDate(r.getDate() - n); return r; }

function formatAnswer(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="lang-${lang}">${esc(code.trim())}</code></pre>`)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/^### (.+)/gm,   '<h3>$1</h3>')
    .replace(/^## (.+)/gm,    '<h2>$1</h2>')
    .replace(/^# (.+)/gm,     '<h1>$1</h1>')
    .replace(/^[*\-] (.+)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)/gm, '<li class="ordered">$1</li>')
    .replace(/((<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>')
    .split(/\n{2,}/)
    .map(p => p.trim() && !p.startsWith('<') ? `<p>${p.replace(/\n/g,'<br>')}</p>` : p)
    .join('');
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
