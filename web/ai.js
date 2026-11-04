// The AI Lab: runs the emotion model in a worker, saves readings in this browser, and draws the results
import { state, $, esc, who, selected, drawChart, fmtBucket, msgLi, lineChart } from './ui.js';
import { bucketList, bucketStart, extremeMessages } from './analysis.js';

// Same order as GROUPS in sentiment-worker.js
export const EMOTIONS = [['love', '💖', '#ff00cc'], ['joy', '😁', '#ffb300'], ['amusement', '🤣', '#2ecc00'], ['gratitude', '🙏', '#00c48c'],
  ['caring', '🤗', '#00b8d4'], ['surprise', '😲', '#7c4dff'], ['sadness', '😢', '#2962ff'], ['anger', '😠', '#ff1744'], ['fear', '😰', '#8d6e63']];

const MODEL_FILE = 'roberta-base-go_emotions';
// Messages per second for short, text-message sized messages. Measured ~970/s on an RTX 50 series card, ~35/s on its processor
const AI_RATE = { gpu: { fast: 1000, slow: 300, download: '500 MB' }, cpu: { fast: 30, slow: 10, download: '125 MB' } };
let onDone = () => {}, worker = null;

let gpuCheck = null;
const hasGpu = () => (gpuCheck ??= (async () => {
  try { return !!(navigator.gpu && await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })); } catch { return false; }
})());

// --- saved readings (IndexedDB, this browser only) -------------------------------------------------
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hedonometer', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('ai');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function loadSaved(key) {
  try {
    const d = await db();
    return await new Promise(r => { const q = d.transaction('ai').objectStore('ai').get(key); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); });
  } catch { return null; }
}
export async function save(key, value) {
  try { const d = await db(); d.transaction('ai', 'readwrite').objectStore('ai').put(value, key); } catch { /* storage blocked: readings just won't survive a reload */ }
}
async function forget(key) {
  try { const d = await db(); d.transaction('ai', 'readwrite').objectStore('ai').delete(key); } catch { /* nothing saved */ }
}

// Score each distinct text once: chats repeat 'ok', 'lol' and friends constantly
const keyOf = m => m.text.toLowerCase();
function distinctTexts() {
  const byText = new Map();
  state.messages.forEach((m, i) => {
    if (!m.text || !m.words.length) return;
    const k = keyOf(m);
    if (!byText.has(k)) byText.set(k, []);
    byText.get(k).push(i);
  });
  return byText;
}

let readings = {}; // text -> [mood, ...emotions]
function apply() {
  for (const m of state.messages) {
    const r = m.text && readings[keyOf(m)];
    if (r) { m.ai = r[0]; m.emo = r.length > 1 ? r.slice(1) : undefined; }
  }
  state.aiDone = Object.keys(readings).length > 0;
}

// The graphics card uses the full size model (model.onnx), the processor the compressed one (model_quantized.onnx)
// Model files are saved in the page's private file storage by sentiment-worker.js
async function modelCached(gpu) {
  try {
    const dir = await navigator.storage.getDirectory();
    const file = gpu ? '_model.onnx' : '_model_quantized.onnx';
    for await (const name of dir.keys()) if (name.includes(MODEL_FILE) && name.endsWith(file)) return true;
    return false;
  } catch { return false; }
}

async function showEstimate() {
  const todo = [...distinctTexts().keys()].filter(k => !readings[k]);
  const done = Object.keys(readings).length;
  if (!todo.length) { $('ai-estimate').textContent = `✅ All ${done.toLocaleString()} messages read (saved in this browser).`; $('ai-run').hidden = true; return; }
  $('ai-run').hidden = false;
  $('ai-run').textContent = done ? `🧠 Carry on reading (${todo.length.toLocaleString()} left)` : '🧠 Read the vibes';
  const gpu = await hasGpu(), rate = AI_RATE[gpu ? 'gpu' : 'cpu'];
  const avgWords = state.messages.reduce((a, m) => a + m.words.length, 0) / Math.max(1, state.messages.length);
  const mins = r => todo.length / r * Math.max(1, avgWords / 8) / 60;
  const lo = mins(rate.fast), hi = mins(rate.slow);
  const span = hi < 1 ? 'under a minute' : lo < 1 ? `up to ${Math.ceil(hi)} min`
    : hi < 90 ? `about ${Math.round(lo)}–${Math.ceil(hi)} min` : `about ${(lo / 60).toFixed(1)}–${(hi / 60).toFixed(1)} hours`;
  const download = await modelCached(gpu) ? 'model already downloaded' : `plus a one-time ${rate.download} download`;
  $('ai-estimate').textContent = `⏱️ ${todo.length.toLocaleString()} different messages to read on your ${gpu ? 'graphics card 🚀' : 'processor'}: ${span} (${download}). You can stop any time and carry on later.`;
}

export async function aiChatLoaded(chatKey) {
  readings = (await loadSaved(chatKey))?.readings || {};
  apply();
  $('ai-progress').hidden = true; $('ai-run').disabled = false;
  $('ai-forget').hidden = !state.aiDone;
  showEstimate();
}

export function setupAI(rerender) {
  onDone = rerender;
  $('ai-forget').addEventListener('click', async () => {
    await forget(state.chatKey);
    readings = {};
    for (const m of state.messages) { delete m.ai; delete m.emo; }
    state.aiDone = false; $('ai-forget').hidden = true;
    showEstimate(); onDone();
  });
  $('ai-stop').addEventListener('click', () => {
    if (!worker) return;
    worker.terminate(); worker = null;
    save(state.chatKey, { readings }); apply();
    $('ai-stop').hidden = true; $('ai-run').disabled = false;
    $('ai-progress').querySelector('.ptext').textContent = '⏸ Stopped. Progress saved.';
    $('ai-forget').hidden = !state.aiDone;
    showEstimate(); onDone();
  });
  $('ai-run').addEventListener('click', async () => {
    const byText = distinctTexts();
    const todo = [...byText.keys()].filter(k => !readings[k]);
    const chatKey = state.chatKey;
    $('ai-run').disabled = true; $('ai-estimate').textContent = '';
    $('ai-progress').hidden = false; $('ai-stop').hidden = false;
    const bar = $('ai-progress').querySelector('.bar'), txt = $('ai-progress').querySelector('.ptext');
    bar.style.width = '0%';
    txt.textContent = 'Downloading the AI brain…';
    const useGpu = await hasGpu();
    worker?.terminate();
    const w = worker = new Worker('sentiment-worker.js', { type: 'module' });
    const end = () => { w.terminate(); if (worker === w) worker = null; $('ai-stop').hidden = true; };
    const started = Date.now();
    let sinceSave = 0;
    w.onmessage = ({ data }) => {
      if (state.chatKey !== chatKey) { end(); return; } // a different chat was loaded
      if (data.type === 'ready') txt.textContent = `Warming up on your ${data.model.includes('graphics') ? 'graphics card 🚀' : 'processor'}…`;
      if (data.type === 'download') { bar.style.width = (data.progress || 0) + '%'; txt.textContent = `Downloading the AI brain… ${Math.round(data.progress || 0)}%`; }
      if (data.type === 'scores') {
        data.ids.forEach((id, k) => (readings[todo[id]] = data.scores[k]));
        sinceSave += data.ids.length;
        bar.style.width = (100 * data.done / data.total) + '%';
        const eta = (Date.now() - started) / data.done * (data.total - data.done) / 1000;
        txt.textContent = `Reading messages… ${data.done.toLocaleString()} / ${data.total.toLocaleString()} (about ${Math.ceil(eta / 60)} min left)`;
        if (sinceSave >= 512 || data.done === data.total) {
          sinceSave = 0; save(chatKey, { readings }); apply(); $('ai-forget').hidden = false; onDone();
        }
      }
      if (data.type === 'finished') { txt.textContent = '✅ Done! Vibes read.'; end(); save(chatKey, { readings }); apply(); showEstimate(); onDone(); }
      if (data.type === 'error') { txt.textContent = '⚠️ ' + data.message; $('ai-run').disabled = false; end(); showEstimate(); }
    };
    w.postMessage({ useGpu, texts: todo.map(k => state.messages[byText.get(k)[0]].text), ids: todo.map((_, k) => k) });
  });
  $('emo-pick').innerHTML = EMOTIONS.map(([e, icon], i) => `<option value="${i}">${icon} ${e}</option>`).join('');
  $('emo-pick').addEventListener('change', renderEmotionMessages);
}

// --- render ----------------------------------------------------------------------------------------
export function renderAI(tl) {
  $('ai-results').hidden = !state.aiDone;
  if (!state.aiDone) return;
  lineChart('ch-ai', tl, b => b.ai, { yTitle: 'AI mood (−1 to +1)', everyone: state.names.length > 2 });
  const { happiest, saddest } = extremeMessages(selected(), state.delh, 'ai', 5);
  $('ai-happy').innerHTML = happiest.map(([m, s]) => msgLi(m, ` · ${s.toFixed(2)}`)).join('');
  $('ai-sad').innerHTML = saddest.map(([m, s]) => msgLi(m, ` · ${s.toFixed(2)}`)).join('');

  const msgs = selected().filter(m => m.emo);
  $('emo-section').hidden = !msgs.length;
  if (!msgs.length) return;

  // Share of messages where each emotion is the strongest one
  const size = state.period === 'day' ? 'week' : state.period;
  const buckets = bucketList(selected(), size), index = new Map(buckets.map((d, i) => [+d, i]));
  const counts = EMOTIONS.map(() => buckets.map(() => 0)), totals = buckets.map(() => 0);
  for (const m of msgs) {
    const i = index.get(+bucketStart(m.date, size));
    totals[i]++;
    const top = m.emo.indexOf(Math.max(...m.emo));
    if (m.emo[top] > 0.3) counts[top][i]++;
  }
  drawChart('ch-emo', buckets.map(fmtBucket), EMOTIONS.map(([e, icon, c], k) => ({
    label: `${icon} ${e}`, data: counts[k].map((v, i) => totals[i] >= 5 ? 100 * v / totals[i] : null),
    backgroundColor: c + 'cc', borderColor: c, fill: true, pointRadius: 0, tension: 0.3, spanGaps: true,
  })), '% of messages', { stacked: true });

  // Each person's emotional fingerprint
  $('emo-profiles').innerHTML = state.names.map(n => {
    const mine = msgs.filter(m => m.author === n);
    if (!mine.length) return '';
    const avg = EMOTIONS.map((_, k) => mine.reduce((a, m) => a + m.emo[k], 0) / mine.length);
    const max = Math.max(...avg);
    return `<div class="emo-card"><h4>${who(n)}</h4>${EMOTIONS.map(([e, icon, c], k) =>
      `<div class="cbar"><span class="cl">${icon} ${e}</span><span class="track"><span style="width:${(100 * avg[k] / max).toFixed(0)}%;background:${c}"></span></span></div>`).join('')}</div>`;
  }).join('');
  renderEmotionMessages();
}

function renderEmotionMessages() {
  const k = +$('emo-pick').value || 0, seen = new Set();
  const top = selected().filter(m => m.emo && m.words.length >= 3).sort((a, b) => b.emo[k] - a.emo[k])
    .filter(m => !seen.has(keyOf(m)) && seen.add(keyOf(m))).slice(0, 6);
  $('emo-msgs').innerHTML = top.map(m => msgLi(m)).join('');
}
