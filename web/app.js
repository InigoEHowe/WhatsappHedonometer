import { parseChat, readChatFile } from './parse.js';
import * as A from './analysis.js';
import { demoChat } from './demo.js';
import { state, $, esc, colourOf, selected, fmtDate, fmtDuration, pct, lineChart, drawChart, fmtBucket, msgLi } from './ui.js';
import { renderStory, renderOnThisDay } from './story.js';
import { renderTalk } from './talk.js';
import { renderTopics } from './topics.js';
import { setupGames, renderGames } from './games.js';
import { setupCard, renderCard } from './card.js';
import { setupAI, aiChatLoaded, renderAI } from './ai.js';
import { setupStoryteller } from './storyteller.js';

const MAX_PEOPLE = 8;
const lexiconReady = fetch('labmt.json').then(r => r.json()).then(l => (state.lexicon = l));

// --- loading ---------------------------------------------------------------------------------------
async function load(text) {
  $('error').hidden = true;
  try {
    await lexiconReady;
    const { messages } = parseChat(text);
    if (messages.length < 10) throw new Error('Only found ' + messages.length + ' messages. Is this the right file?');
    state.messages = A.enrich(messages, state.lexicon);
    state.everyone = A.people(messages);
    state.names = state.everyone.slice(0, MAX_PEOPLE).map(p => p.name);
    state.chatKey = [messages.length, +messages[0].date, +messages[messages.length - 1].date, state.everyone.map(p => p.name).join('|')].join('/');
    await aiChatLoaded(state.chatKey);
    $('results').hidden = false;
    renderPeople();
    render();
    bumpHits();
    $('results').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    $('error').textContent = '⚠️ ' + e.message;
    $('error').hidden = false;
  }
}

const fileInput = $('file'), drop = $('dropzone');
fileInput.addEventListener('change', async () => fileInput.files[0] && load(await readChatFile(fileInput.files[0])));
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', async e => {
  e.preventDefault(); drop.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) load(await readChatFile(f));
});
$('demo').addEventListener('click', () => load(demoChat()));

// --- controls --------------------------------------------------------------------------------------
function segmented(id, key) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $(id).children) x.classList.toggle('on', x === b);
    state[key] = b.dataset.v; render();
  });
}
segmented('period', 'period');
segmented('cloud-mode', 'cloudMode');
$('delh').addEventListener('input', e => { state.delh = +e.target.value; $('delh-v').textContent = e.target.value; render(); });
$('track-form').addEventListener('submit', e => {
  e.preventDefault();
  state.track = $('track').value.split(',').map(w => w.trim().toLowerCase()).filter(Boolean).slice(0, 6);
  render();
});
$('otd-date').addEventListener('change', renderOnThisDay);
setupGames();
setupCard();
setupAI(() => render());
setupStoryteller();

function renderPeople() {
  $('people').innerHTML = '';
  for (const p of state.everyone.slice(0, 30)) {
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `<input type="checkbox" ${state.names.includes(p.name) ? 'checked' : ''}><span class="swatch"></span><span></span>`;
    label.lastChild.textContent = `${p.name} (${p.n.toLocaleString()})`;
    label.querySelector('.swatch').style.background = colourOf(p.name);
    label.querySelector('input').addEventListener('change', e => {
      state.names = e.target.checked ? [...state.names, p.name] : state.names.filter(n => n !== p.name);
      state.names.sort((a, b) => state.everyone.findIndex(x => x.name === a) - state.everyone.findIndex(x => x.name === b));
      render();
    });
    $('people').append(label);
  }
}

// --- tabs: each tab only draws when it is opened, and again when something changes ---------------------
let activeTab = 'overview';
const dirty = new Set();
let cache = {};
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  activeTab = b.dataset.tab;
  for (const x of $('tabs').children) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }
  for (const p of document.querySelectorAll('.tab-panel')) p.hidden = p.dataset.panel !== activeTab;
  drawTab(activeTab);
});

const timeline = () => (cache.tl ??= A.timeline(state.messages, state.names, state.period, state.delh, state.period === 'day' ? 5 : 10, state.track));
const dynamics = () => (cache.dyn ??= A.dynamics(state.messages, state.names));

function render() {
  if (!state.messages.length) return;
  cache = {};
  for (const t of ['overview', 'story', 'talk', 'words', 'ai', 'games']) dirty.add(t);
  renderCounters();
  renderTicker();
  drawTab(activeTab);
}

function drawTab(tab) {
  if (!dirty.has(tab) || !state.messages.length) return;
  dirty.delete(tab);
  if (!state.names.length) return;
  const tl = timeline();
  if (tab === 'overview') {
    renderOverall();
    lineChart('ch-happy', tl, b => b.happiness, { yTitle: 'Average word happiness', everyone: state.names.length > 2 });
    renderAwards(dynamics());
    renderCard();
  }
  if (tab === 'story') renderStory(dynamics());
  if (tab === 'talk') {
    renderTalk();
    renderDynamics(dynamics());
    renderHeatmap();
    lineChart('ch-count', tl, b => b.n, { yTitle: 'Messages' });
    lineChart('ch-len', tl, b => b.avgLen, { yTitle: 'Words per message' });
  }
  if (tab === 'words') {
    renderTopics();
    renderEmoji();
    lineChart('ch-laugh', tl, b => b.laughRate, { yTitle: 'Laughs per message' });
    lineChart('ch-emoji', tl, b => b.emojiRate, { yTitle: 'Emoji per message' });
    renderClouds();
    trackChart(tl);
    renderExtremes();
  }
  if (tab === 'ai') renderAI(tl);
  if (tab === 'games') renderGames();
}

// --- overview --------------------------------------------------------------------------------------
function renderCounters() {
  const m = state.messages, pad = n => String(n).padStart(6, '0');
  $('c-msgs').textContent = pad(m.length);
  $('c-days').textContent = pad(Math.round((m[m.length - 1].date - m[0].date) / 864e5) + 1);
  $('c-words').textContent = pad(m.reduce((a, x) => a + x.words.length, 0));
  $('c-emoji').textContent = pad(m.reduce((a, x) => a + x.emojis.length, 0));
}

function renderOverall() {
  $('overall').innerHTML = state.names.map(n => {
    const h = A.overallHappiness(state.messages, n, state.delh);
    return `<span class="pill" style="border-color:${colourOf(n)}">${esc(n)}: <b>${h ? h.toFixed(2) : '–'}</b></span>`;
  }).join('');
}

function renderAwards(dyn) {
  const s = dyn.stat, names = state.names.filter(n => s[n].n > 0);
  if (!names.length) { $('awards').innerHTML = ''; return; }
  const best = (f, min = true) => names.reduce((a, b) => ((f(b) ?? Infinity * (min ? 1 : -1)) < (f(a) ?? Infinity * (min ? 1 : -1))) === min ? b : a);
  const rate = (n, k) => s[n][k] / s[n].n;
  const awards = [];
  // Skip awards nobody earned, e.g. 'deleted 0 messages'
  const add = (icon, title, who, why) => who && !/(^|\D)0 (messages|questions|times|conversations|photos)/.test(why(who)) &&
    awards.push({ icon, title, who, why });
  const sum = (n, f) => state.messages.reduce((a, m) => a + (m.author === n ? f(m) : 0), 0);

  add('⚡', 'Speed Demon', best(n => s[n].medianReply), n => `replies in ${fmtDuration(s[n].medianReply)} (median)`);
  add('🐢', 'Fashionably Late', best(n => s[n].medianReply, false), n => `takes ${fmtDuration(s[n].medianReply)} to reply`);
  add('🦉', 'Night Owl', best(n => rate(n, 'nightOwl'), false), n => `${s[n].nightOwl.toLocaleString()} messages between midnight and 5am`);
  add('🐓', 'Early Bird', best(n => rate(n, 'earlyBird'), false), n => `${s[n].earlyBird.toLocaleString()} messages before 8am`);
  add('📣', 'Conversation Starter', best(n => s[n].starts / dyn.conversations.length, false), n => `started ${s[n].starts.toLocaleString()} conversations`);
  add('🎤', 'Last Word', best(n => s[n].ends / dyn.conversations.length, false), n => `ended ${s[n].ends.toLocaleString()} conversations`);
  add('📨', 'Double Texter', best(n => rate(n, 'doubleTexts'), false), n => `followed up ${s[n].doubleTexts.toLocaleString()} times with no reply`);
  add('👻', 'Left on Read', best(n => rate(n, 'ghosted'), false), n => `${s[n].ghosted.toLocaleString()} questions never answered`);
  add('📜', 'Essay Writer', best(n => s[n].words / s[n].n, false), n => `${(s[n].words / s[n].n).toFixed(1)} words per message`);
  const happy = n => A.overallHappiness(state.messages, n, state.delh);
  add('🌞', 'Ray of Sunshine', best(happy, false), n => `happiest words (${happy(n)?.toFixed(2)})`);
  const emojiRate = n => sum(n, m => m.emojis.length) / s[n].n;
  add('👑', 'Emoji Monarch', best(emojiRate, false), n => `${emojiRate(n).toFixed(2)} emoji per message`);
  const laughRate = n => sum(n, m => m.laughs) / s[n].n;
  add('🤣', 'Easily Amused', best(laughRate, false), n => `laughs in ${(laughRate(n) * 100).toFixed(0)}% of messages`);
  add('📸', 'Paparazzi', best(n => rate(n, 'media'), false), n => `sent ${s[n].media.toLocaleString()} photos/videos/stickers`);
  add('🗑️', 'Regrets', best(n => rate(n, 'deleted'), false), n => `deleted ${s[n].deleted.toLocaleString()} messages`);

  $('awards').innerHTML = awards.map(a => `<div class="award"><span class="icon">${a.icon}</span><span class="title">${a.title}</span>
    <span class="who" style="color:${colourOf(a.who)}">${esc(a.who)}</span><span class="why">${esc(a.why(a.who))}</span></div>`).join('');
}

// --- how we talk -----------------------------------------------------------------------------------
function renderDynamics(dyn) {
  const facts = [
    [dyn.conversations.length.toLocaleString(), 'conversations (4h+ gap = new one)'],
    [dyn.streak.len + ' days', `longest daily streak, ending ${fmtDate(dyn.streak.end)}`],
    [fmtDuration(dyn.longestSilence.ms), `longest silence, broken by ${dyn.longestSilence.broke ?? '–'}`],
    [dyn.busiest.n.toLocaleString(), `messages on the busiest day, ${fmtDate(dyn.busiest.date)}`],
    [Math.round(100 * dyn.activeDays / dyn.totalDays) + '%', 'of days you talked'],
  ];
  $('facts').innerHTML = facts.map(([b, s]) => `<div class="fact"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
  const rows = [
    ['Messages', n => dyn.stat[n].n.toLocaleString()],
    ['Starts convos', n => pct(dyn.stat[n].starts, dyn.conversations.length)],
    ['Gets last word', n => pct(dyn.stat[n].ends, dyn.conversations.length)],
    ['Median reply', n => fmtDuration(dyn.stat[n].medianReply)],
    ['Double texts', n => dyn.stat[n].doubleTexts.toLocaleString()],
    ['Unanswered questions', n => dyn.stat[n].ghosted.toLocaleString()],
    ['Longest message', n => (dyn.stat[n].longest?.words.length ?? 0) + ' words'],
  ];
  $('dyn').innerHTML = `<thead><tr><th></th>${state.names.map(n => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(([label, f]) => `<tr><td>${label}</td>${state.names.map(n => `<td>${f(n)}</td>`).join('')}</tr>`).join('') + '</tbody>';
}

function renderHeatmap() {
  const grid = A.heatmap(selected());
  const max = Math.max(1, ...grid.flat());
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = '<span></span>' + Array.from({ length: 24 }, (_, h) => `<span class="hl">${h % 3 ? '' : h}</span>`).join('');
  grid.forEach((row, d) => {
    html += `<span class="dl">${days[d]}</span>` + row.map((v, h) => {
      const t = v / max;
      // Black → purple → hot pink → yellow
      const c = t === 0 ? '#1a1a2e' : `hsl(${300 - t * 240}, 100%, ${25 + t * 40}%)`;
      return `<span class="cell" style="background:${c}" title="${days[d]} ${h}:00 – ${v} messages"></span>`;
    }).join('');
  });
  $('heatmap').innerHTML = html;
  const peak = grid.flatMap((r, d) => r.map((v, h) => [v, d, h])).sort((a, b) => b[0] - a[0])[0];
  $('heat-legend').textContent = `🔥 Peak chat time: ${days[peak[1]]}s at ${peak[2]}:00`;
}

// --- words & emoji ---------------------------------------------------------------------------------
function renderEmoji() {
  $('emoji-top').innerHTML = state.names.map(n => {
    const top = A.topEmoji(state.messages, n, 8);
    const row = top.length ? top.map(([e, k]) => `${e}<small>${k}</small>`).join('') : '<small>no emoji 😐</small>';
    return `<div class="emoji-card"><span class="name" style="color:${colourOf(n)}">${esc(n)}</span><div class="row-e">${row}</div></div>`;
  }).join('');
}

function trackChart(tl) {
  const datasets = [];
  state.track.forEach((w, wi) => state.names.forEach(n => datasets.push({
    label: `“${w}” – ${n}`, data: tl.per[n].map(b => b.track[w]), borderColor: colourOf(n), backgroundColor: colourOf(n),
    borderDash: wi ? [5, 4] : [], borderWidth: 2, pointRadius: 0, tension: 0.25, spanGaps: true,
  })));
  drawChart('ch-track', tl.buckets.map(fmtBucket), datasets, 'Times said per message');
}

function renderClouds() {
  const counts = Object.fromEntries(state.names.map(n => [n, A.wordCounts(state.messages, n, state.lexicon, state.delh)]));
  $('clouds').innerHTML = state.names.map(n => {
    const list = state.cloudMode === 'most'
      ? [...counts[n].entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)
      : A.distinctiveWords(counts, n, state.names).map(([w, d]) => [w, d]);
    if (!list.length) return `<div class="cloud"><h4>${esc(n)}</h4><p>Not enough words yet!</p></div>`;
    const max = list[0][1], min = list[list.length - 1][1];
    // Shuffle (repeatably) so the big words aren't all at the start
    const shuffled = list.map((x, i) => [x, Math.sin(i * 99.7)]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const spans = shuffled.map(([w, v]) => {
      const size = 13 + 34 * (max === min ? 1 : Math.sqrt((v - min) / (max - min)));
      const h = state.lexicon[w];
      const r = Math.round(255 * (10 - h) / 10 * 1.3), g = Math.round(255 * h / 10 * 0.9);
      return `<span style="font-size:${size.toFixed(0)}px;color:rgb(${Math.min(r, 230)},${g},40)" title="${esc(w)}: happiness ${h}">${esc(w)}</span>`;
    }).join(' ');
    return `<div class="cloud"><h4 style="color:${colourOf(n)}">${esc(n)}</h4><div class="words">${spans}</div></div>`;
  }).join('');
}

function renderExtremes() {
  const { happiest, saddest } = A.extremeMessages(selected(), state.delh, 'h', 5);
  $('happy-msgs').innerHTML = happiest.map(([m, s]) => msgLi(m, ` · score ${s.toFixed(2)}`)).join('');
  $('sad-msgs').innerHTML = saddest.map(([m, s]) => msgLi(m, ` · score ${s.toFixed(2)}`)).join('');
}

function renderTicker() {
  const dyn = dynamics(), s = dyn.stat;
  const bits = [`${state.messages.length.toLocaleString()} messages analysed`,
    `Longest streak: ${dyn.streak.len} days in a row`,
    ...state.names.slice(0, 4).map(x => `${x} replies in ${fmtDuration(s[x].medianReply)}`),
    `Busiest day: ${fmtDate(dyn.busiest.date)} with ${dyn.busiest.n} messages`,
    'Your chat never left your computer'];
  $('ticker').textContent = '*** ' + bits.join(' *** ') + ' ***';
}

// --- silly extras ----------------------------------------------------------------------------------
function bumpHits() {
  try {
    const n = (+localStorage.getItem('hedonometer-hits') || 0) + 1;
    localStorage.setItem('hedonometer-hits', n);
    $('hits').textContent = String(n).padStart(6, '0');
  } catch { /* storage blocked: keep the default */ }
}

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let last = 0;
  addEventListener('pointermove', e => {
    if (e.timeStamp - last < 60) return;
    last = e.timeStamp;
    const s = document.createElement('span');
    s.className = 'sparkle'; s.textContent = ['✨', '⭐', '💖', '✦'][Math.floor(Math.random() * 4)];
    s.style.left = e.clientX + 6 + 'px'; s.style.top = e.clientY + 6 + 'px';
    document.body.append(s);
    setTimeout(() => s.remove(), 900);
  });
}
