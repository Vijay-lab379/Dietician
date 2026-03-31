// ============================================================
//  NourishAI — app.js
//  Personalised food & health suggestion AI with memory
//  Multi-provider: OpenRouter · Groq · Google Gemini
// ============================================================

// ─────────────────────────────────────────────────────────────
//  PROVIDERS
//  No keys here — all keys live in .env and are read by
//  server.js only. The browser calls /api/chat exclusively.
// ─────────────────────────────────────────────────────────────
const PROVIDERS = {
  openrouter: { label: 'OpenRouter' },
  groq:       { label: 'Groq' },
  gemini:     { label: 'Google Gemini' },
};

// ─────────────────────────────────────────────────────────────
//  MODELS
// ─────────────────────────────────────────────────────────────
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
//  USER PROFILE (persisted in localStorage)
// ─────────────────────────────────────────────────────────────
let userProfile = {
  name:         '',
  age:          '',
  diet:         'vegetarian',
  region:       '',
  culture:      '',
  goals:        [],
  restrictions: '',
  aiMemory:     [],   // learned from chat
};

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
let conversationHistory = [];

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  buildModelDropdown();
  renderProfilePanel();
  updateStatPill();
  updateMemoryPill();

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
//  PROFILE PANEL
// ─────────────────────────────────────────────────────────────
function togglePanel() {
  const panel   = document.getElementById('profile-panel');
  const overlay = document.getElementById('panel-overlay');
  const open    = panel.classList.toggle('open');
  overlay.classList.toggle('visible', open);
}

function loadProfile() {
  try {
    const saved = localStorage.getItem('nourish_profile');
    if (saved) userProfile = { ...userProfile, ...JSON.parse(saved) };
  } catch(e) {}
}

function saveProfileToStorage() {
  try {
    localStorage.setItem('nourish_profile', JSON.stringify(userProfile));
  } catch(e) {}
}

function renderProfilePanel() {
  document.getElementById('pref-name').value         = userProfile.name || '';
  document.getElementById('pref-age').value          = userProfile.age || '';
  document.getElementById('pref-region').value       = userProfile.region || '';
  document.getElementById('pref-culture').value      = userProfile.culture || '';
  document.getElementById('pref-restrictions').value = userProfile.restrictions || '';

  // Diet toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === userProfile.diet);
  });

  // Goals chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', userProfile.goals.includes(chip.dataset.val));
  });

  // AI memory
  renderAIMemoryTags();

  // Avatar initial
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
  if (chip.classList.contains('active')) {
    if (!userProfile.goals.includes(val)) userProfile.goals.push(val);
  } else {
    userProfile.goals = userProfile.goals.filter(g => g !== val);
  }
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

  const confirm = document.getElementById('save-confirm');
  confirm.classList.add('visible');
  setTimeout(() => confirm.classList.remove('visible'), 2200);
}

function updateAvatarCircle() {
  const el = document.getElementById('avatar-circle');
  if (userProfile.name) {
    el.textContent = userProfile.name.charAt(0).toUpperCase();
    el.style.fontSize = '1.1rem';
    el.style.fontFamily = "'Cormorant Garamond', serif";
    el.style.fontWeight = '600';
    el.style.color = 'var(--accent)';
  } else {
    el.textContent = '🌿';
    el.style.fontSize = '1.25rem';
  }
}

function updateStatPill() {
  const dietMap = {
    vegetarian:     '🥦 Vegetarian',
    'non-vegetarian':'🍗 Non-Veg',
    vegan:          '🌱 Vegan',
    eggetarian:     '🥚 Eggetarian',
  };
  document.getElementById('stat-diet').textContent =
    dietMap[userProfile.diet] || '🥦 Vegetarian';
}

function renderAIMemoryTags() {
  const section = document.getElementById('ai-memory-section');
  const container = document.getElementById('ai-memory-tags');

  if (!userProfile.aiMemory || userProfile.aiMemory.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'flex';
  container.innerHTML = '';
  userProfile.aiMemory.forEach(item => {
    const tag = document.createElement('span');
    tag.className = 'memory-tag';
    tag.textContent = item;
    container.appendChild(tag);
  });
}

function updateMemoryPill() {
  const count = (userProfile.aiMemory || []).length;
  document.getElementById('memory-count').textContent = count;
  const pill = document.getElementById('memory-pill');
  if (count > 0) {
    pill.classList.add('updated');
    setTimeout(() => pill.classList.remove('updated'), 1500);
  }
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
//  BUILD SYSTEM PROMPT FROM PROFILE
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const p = userProfile;

  const goalLabels = {
    'weight-loss':  'weight loss',
    'muscle-gain':  'muscle gain',
    'heart-health': 'heart health',
    'diabetes':     'diabetes management',
    'gut-health':   'gut health & digestion',
    'energy':       'sustained energy levels',
  };

  const goalsText = (p.goals || []).map(g => goalLabels[g] || g).join(', ');
  const memText   = (p.aiMemory || []).join(', ');

  let prompt = `You are NourishAI, a warm, knowledgeable personal food and health guide. You specialise in nutrition, meal planning, healthy recipes, and dietary healthcare. You speak with gentle authority — like a trusted nutritionist friend.

Your PRIMARY job: suggest foods, recipes, and meal plans that are perfectly tailored to THIS user's profile. Always refer back to their preferences. Never suggest anything that conflicts with their restrictions.

USER PROFILE:`;

  if (p.name)         prompt += `\n- Name: ${p.name}`;
  if (p.age)          prompt += `\n- Age: ${p.age} years old`;
  if (p.diet)         prompt += `\n- Diet type: ${p.diet}`;
  if (p.region)       prompt += `\n- Region/cuisine preference: ${p.region}`;
  if (p.culture)      prompt += `\n- Cultural/religious restrictions: ${p.culture}`;
  if (goalsText)      prompt += `\n- Health goals: ${goalsText}`;
  if (p.restrictions) prompt += `\n- Known restrictions/allergies: ${p.restrictions}`;
  if (memText)        prompt += `\n- AI-detected preferences from chat: ${memText}`;

  prompt += `

RESPONSE STYLE:
- Be warm, encouraging, and specific. Use the user's name if known.
- For recipes, give clear ingredient quantities and step-by-step instructions.
- Highlight WHY a food is good for their specific goals/conditions.
- Use markdown: bold key nutrients, use bullet points for ingredients, numbered lists for steps.
- When you detect new health conditions, allergies, preferences, or restrictions from the conversation, include a line at the very END of your response in this EXACT format:
  [MEMORY: <short comma-separated list of learned facts>]
  Example: [MEMORY: has IBS, prefers low-spice food, avoids dairy]
  Only include MEMORY if you genuinely learned something new this turn.
- Keep responses focused and practical. If someone asks for a recipe, give one great recipe — not five.
- Respect ALL dietary restrictions absolutely. Never suggest restricted ingredients even as optional.`;

  return prompt;
}

// ─────────────────────────────────────────────────────────────
//  EXTRACT AI MEMORY FROM RESPONSE
// ─────────────────────────────────────────────────────────────
function extractAndSaveMemory(text) {
  const match = text.match(/\[MEMORY:\s*([^\]]+)\]/i);
  if (!match) return null;

  const items = match[1].split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return null;

  // Merge with existing, avoid duplicates (fuzzy)
  items.forEach(item => {
    const exists = (userProfile.aiMemory || []).some(
      m => m.toLowerCase().includes(item.toLowerCase().slice(0, 8))
    );
    if (!exists) {
      if (!userProfile.aiMemory) userProfile.aiMemory = [];
      userProfile.aiMemory.push(item);
    }
  });

  // Also push to restrictions textarea for transparency
  const existingRestrictions = document.getElementById('pref-restrictions').value;
  const newItems = items.filter(i => !existingRestrictions.includes(i));
  if (newItems.length && document.getElementById('pref-restrictions')) {
    // Don't auto-fill restrictions — only track in aiMemory
  }

  saveProfileToStorage();
  renderAIMemoryTags();
  updateMemoryPill();

  return items;
}

// Strip the [MEMORY:...] tag from displayed text
function stripMemoryTag(text) {
  return text.replace(/\[MEMORY:[^\]]*\]/gi, '').trim();
}

// ─────────────────────────────────────────────────────────────
//  BUILD MODEL DROPDOWN
// ─────────────────────────────────────────────────────────────
function buildModelDropdown() {
  const select = document.getElementById('model');
  select.innerHTML = '';
  const groups = {};
  for (const m of MODELS) {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  }
  let first = true;
  for (const [groupName, models] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = groupName;
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
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
  const provider     = PROVIDERS[providerName];

  // Hide suggestions after first message
  document.getElementById('suggestions-row').style.display = 'none';

  conversationHistory.push({ role: 'user', content: question });
  renderBubble('user', question);

  const ta = document.getElementById('question');
  ta.value = ''; ta.style.height = 'auto';

  const aiBubbleId = 'bubble-' + Date.now();
  renderAISkeleton(aiBubbleId);
  scrollChat();
  setLoading(true);

  // Build messages — always inject fresh system prompt
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationHistory,
  ];

  try {
    // All requests go through our local server — keys never touch the browser
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        provider:    providerName,
        model:       modelMeta.value,
        messages,
        max_tokens:  700,
        temperature: 0.75,
      }),
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

  } catch (err) {
    removeSkeleton(aiBubbleId);
    conversationHistory.pop();
    showError('Could not reach server. Is `node server.js` running? (' + err.message + ')');
  }

  setLoading(false);
  scrollChat();
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
  if (role === 'user') {
    avatar.textContent = userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'You';
  } else {
    avatar.textContent = '🌿';
  }

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
  row.className = 'bubble-row ai-row';
  row.id = id;

  const avatar = document.createElement('div');
  avatar.className = 'bubble-avatar';
  avatar.textContent = '🌿';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `
    <div class="bubble-skeleton">
      <div class="shimmer-bar" style="width:85%"></div>
      <div class="shimmer-bar" style="width:68%"></div>
      <div class="shimmer-bar" style="width:76%"></div>
    </div>`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  msgs.appendChild(row);
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

  // If AI learned something, show a notice
  if (learned && learned.length > 0) {
    const notice = document.createElement('div');
    notice.className = 'memory-notice';
    notice.innerHTML = `🧠 Remembered: <em>${learned.join(', ')}</em>`;
    bubble.appendChild(notice);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'bubble-footer';

  const tokens = document.createElement('span');
  tokens.className = 'bubble-tokens';
  if (usage) {
    tokens.textContent =
      `${providerName} · ${usage.prompt_tokens ?? '?'}p + ${usage.completion_tokens ?? '?'}c tokens`;
  }

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/>
  </svg><span>Copy</span>`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(raw).then(() => {
      copyBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => copyBtn.querySelector('span').textContent = 'Copy', 2000);
    }).catch(() => {});
  };

  footer.appendChild(tokens);
  footer.appendChild(copyBtn);
  bubble.appendChild(footer);
  scrollChat();
}

function removeSkeleton(id) {
  document.getElementById(id)?.remove();
}

// ─────────────────────────────────────────────────────────────
//  CLEAR
// ─────────────────────────────────────────────────────────────
function clearConversation() {
  conversationHistory = [];
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-empty').style.display = '';
  document.getElementById('error-box').classList.add('hidden');
  document.getElementById('suggestions-row').style.display = 'flex';
  const ta = document.getElementById('question');
  ta.value = ''; ta.style.height = 'auto';
}

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

function formatAnswer(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${esc(code.trim())}</code></pre>`)
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
    .map(p => p.trim() && !p.startsWith('<') ? `<p>${p.replace(/\n/g, '<br>')}</p>` : p)
    .join('');
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
