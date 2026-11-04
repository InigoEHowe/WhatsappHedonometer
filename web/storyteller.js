// The storyteller: a language model running on the graphics card (WebLLM) writes a short recap of each chapter.
// It only ever sees a sample of messages, and nothing leaves this computer
import { state, $, esc, fmtMonth } from './ui.js';
import { loadSaved, save } from './ai.js';
import { valence } from './talk.js';

const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm';
export const STORY_MODELS = [
  { id: 'Llama-3.1-8B-Instruct', label: 'Large: best writing', download: '4.5 GB', vramGB: 5 },
  { id: 'Qwen3.5-4B', label: 'Small: for less powerful graphics cards', download: '2.5 GB', vramGB: 4 },];
const CONTEXT = 8192, MESSAGE_CHARS = 14000; // ~4,000 tokens of messages per chapter, leaving room for the answer

let current = { chapters: [], msgs: [] }, engine = null, engineModel = null, worker = null, stopping = false;

// --- choosing which messages the model sees --------------------------------------------------------
// Messages spread across the whole chapter, favouring the emotional ones, the busy days and the chapter's typical words
function sampleChapter(msgs, ch) {
  const inside = msgs.filter(m => m.date >= ch.start && m.date < new Date(+ch.end + 864e5) && m.text.length >= 12 && !/https?:\/\//.test(m.text));
  if (!inside.length) return [];
  const typical = new Set(ch.words);
  const perDay = new Map();
  for (const m of inside) { const d = m.date.toDateString(); perDay.set(d, (perDay.get(d) || 0) + 1); }
  const busiest = Math.max(...perDay.values());
  const score = m => (m.words.length >= 4 ? 1 : 0) + (m.words.some(w => typical.has(w)) ? 2 : 0)
    + (m.emo ? 2 * Math.max(...m.emo) : 0) + Math.abs(valence(m) ?? 0) + perDay.get(m.date.toDateString()) / busiest
    + (m.laughs ? 0.5 : 0);
  // Pick the best from each of 16 time slices in turn, so the whole chapter is covered
  const slices = Array.from({ length: 16 }, () => []), span = Math.max(1, ch.end - ch.start + 864e5);
  for (const m of inside) slices[Math.min(15, Math.floor(16 * (m.date - ch.start) / span))].push([score(m) + Math.random() * 0.3, m]);
  for (const s of slices) s.sort((a, b) => b[0] - a[0]);
  const picked = new Set(); let chars = 0;
  for (let round = 0; chars < MESSAGE_CHARS && slices.some(s => s[round]); round++)
    for (const s of slices) if (s[round] && chars < MESSAGE_CHARS) { const m = s[round][1]; picked.add(m); chars += Math.min(180, m.text.length) + 30; }
  return [...picked].sort((a, b) => a.date - b.date);
}

const line = m => `[${m.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}] ${m.author}: ${m.text.replace(/\s+/g, ' ').slice(0, 180)}`;

function prompts(ch, total, sample) {
  const people = state.names.length === 2 ? `${state.names[0]} and ${state.names[1]}` : state.names.join(', ');
  const you = state.names.length === 2 ? 'you two' : 'you all';
  const moodDiff = ch.mood && ch.overall ? ch.mood - ch.overall : 0;
  const months = Math.max(1, Math.round((ch.end - ch.start) / (30.4 * 864e5)));
  const facts = [
    `${months} month${months > 1 ? 's' : ''} long`,
    `${ch.perDay.toFixed(1)} messages a day`,
    moodDiff > 0.05 ? 'happier than usual' : moodDiff < -0.05 ? 'gloomier than usual' : 'usual mood',
    ch.words.length && `typical words: ${ch.words.join(', ')}`,
    ch.emojis.length && `typical emoji: ${ch.emojis.join(' ')}`,
  ].filter(Boolean).join('; ');
  return [
    { role: 'system', content: `You write short, warm, playful recaps of eras in a WhatsApp chat between ${people}, for the people in it. ` +
      `Always talk to them directly as "${you}" (never "they"), using their names when it helps. ` +
      'Only mention things that clearly appear in the messages or facts you are given: never invent events, places, people, feelings or lengths of time. ' +
      'Mention two or three different specific things they talked about, rather than repeating one phrase. ' +
      'Write 3 or 4 sentences of plain prose: no title, no list, no quotes longer than a few words.' },
    { role: 'user', content: `Chapter ${ch.n} of ${total}: ${fmtMonth(ch.start)} to ${fmtMonth(ch.end)}. ${facts}.\n\nA sample of messages from this chapter, in order:\n${sample.map(line).join('\n')}\n\nWrite the recap of this chapter.` },
  ];
}

// Strip thinking, and chatty openers like 'Here's the blurb:' and wrapping quotes
const clean = text => text.replace(/<think>[\s\S]*?<\/think>/g, '')
  .replace(/^\s*(here(?:'s| is)[^:\n]*:|recap:|chapter \d+[:\-–])\s*/i, '').trim()
  .replace(/^"([\s\S]*)"$/, '$1').trim();

// --- saving ---------------------------------------------------------------------------------------
const storyKey = model => `story|${state.chatKey}|${state.names.join(',')}|${model}|` + current.chapters.map(c => +c.start).join(',');
let saved = null;

async function showSaved() {
  const model = $('story-model').value;
  saved = await loadSaved(storyKey(model)) || { texts: {} };
  current.chapters.forEach(c => setText(c.n, saved.texts[c.n] || ''));
  $('story-blurb').textContent = saved.blurb || '';
  $('story-blurb').hidden = !saved.blurb;
  const done = current.chapters.filter(c => saved.texts[c.n]).length;
  $('story-run').textContent = done === 0 ? '✍️ Write our story' : done < current.chapters.length ? '✍️ Finish our story' : '🔄 Rewrite our story';
}

function setText(n, text) {
  const el = document.querySelector(`.ch-story[data-ch="${n}"]`);
  if (el) { el.textContent = text; el.hidden = !text; }
}

// --- running the model ----------------------------------------------------------------------------
async function gpuInfo() {
  try {
    const adapter = navigator.gpu && await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    return adapter ? { f16: adapter.features.has('shader-f16') } : null;
  } catch { return null; }
}
const modelId = (base, f16) => `${base}-${f16 ? 'q4f16_1' : 'q4f32_1'}-MLC`;

async function estimate() {
  const gpu = await gpuInfo();
  if (!gpu) { $('story-estimate').textContent = '😢 The storyteller needs a graphics card that the browser can use (WebGPU, e.g. Chrome or Edge).'; $('story-run').disabled = true; return; }
  const m = STORY_MODELS.find(x => x.id === $('story-model').value);
  let cached = false;
  try { cached = await (await import(WEBLLM)).hasModelInCache(modelId(m.id, gpu.f16)); } catch { /* assume not */ }
  $('story-estimate').textContent = `${cached ? 'Model already downloaded. About' : `One-time ${m.download} download, then about`} 10–20 seconds a chapter. Needs about ${m.vramGB} GB of graphics memory.`;
}

async function run() {
  const gpu = await gpuInfo();
  if (!gpu) return;
  const m = STORY_MODELS.find(x => x.id === $('story-model').value), id = modelId(m.id, gpu.f16);
  const key = storyKey(m.id), chapters = current.chapters, msgs = current.msgs;
  stopping = false;
  $('story-run').disabled = true; $('story-stop').hidden = false; $('story-progress').hidden = false;
  const bar = $('story-progress').querySelector('.bar'), txt = $('story-progress').querySelector('.ptext');
  const rewrite = chapters.every(c => saved.texts[c.n]);
  if (rewrite) saved = { texts: {} };
  try {
    if (!engine || engineModel !== id) {
      txt.textContent = 'Waking up the storyteller…';
      const webllm = await import(WEBLLM);
      worker?.terminate();
      worker = new Worker('llm-worker.js', { type: 'module' });
      engine = await webllm.CreateWebWorkerMLCEngine(worker, id, {
        initProgressCallback: p => { bar.style.width = Math.round(100 * p.progress) + '%'; txt.textContent = p.text.replace(/\[.*?\]\s*/, '').slice(0, 90); },
      }, { context_window_size: CONTEXT });
      engineModel = id;
    }
    for (const ch of chapters) {
      if (stopping) break;
      if (saved.texts[ch.n]) continue;
      bar.style.width = (100 * (ch.n - 1) / chapters.length) + '%';
      txt.textContent = `✍️ Writing chapter ${ch.n} of ${chapters.length}…`;
      const stream = await engine.chat.completions.create({
        model: id, messages: prompts(ch, chapters.length, sampleChapter(msgs, ch)), stream: true, temperature: 0.7, max_tokens: 260,
        extra_body: { enable_thinking: false },
      });
      let text = '';
      for await (const chunk of stream) { text += chunk.choices[0]?.delta?.content || ''; setText(ch.n, clean(text)); }
      if (stopping) break;
      saved.texts[ch.n] = clean(text);
      await save(key, saved);
    }
    // A blurb for the whole story, like the back of a book
    if (!stopping && chapters.every(c => saved.texts[c.n])) {
      txt.textContent = '✍️ Writing the blurb…';
      const reply = await engine.chat.completions.create({
        model: id, messages: [{ role: 'system', content: 'You write one or two sentence blurbs, like the back of a book, using only what you are told.' },
          { role: 'user', content: 'Here are the chapters of a WhatsApp chat:\n\n' + chapters.map(c => `Chapter ${c.n}: ${saved.texts[c.n]}`).join('\n\n') + '\n\nWrite a playful one or two sentence blurb for the whole story.' }],
        temperature: 0.8, max_tokens: 90, extra_body: { enable_thinking: false },
      });
      saved.blurb = clean(reply.choices[0].message.content);
      await save(key, saved);
    }
    txt.textContent = stopping ? '⏸ Stopped. Finished chapters are saved.' : '✅ Story written!';
    bar.style.width = '100%';
  } catch (e) {
    console.error(e);
    txt.textContent = '⚠️ ' + String(e.message || e).slice(0, 200);
  }
  $('story-run').disabled = false; $('story-stop').hidden = true;
  showSaved();
}

export function setupStoryteller() {
  $('story-model').innerHTML = STORY_MODELS.map(m => `<option value="${m.id}">${esc(m.label)} (${m.download})</option>`).join('');
  $('story-model').addEventListener('change', () => { showSaved(); estimate(); });
  $('story-run').addEventListener('click', run);
  $('story-stop').addEventListener('click', () => { stopping = true; engine?.interruptGenerate(); });
}

// Called by the Our Story tab each time the chapters are worked out
export function chaptersReady(chapters, msgs) {
  current = { chapters, msgs };
  $('storyteller').hidden = !chapters.length;
  if (!chapters.length) return;
  showSaved();
  estimate();
}
