// The "Our Story" tab: chapters, milestones, on this day, your own dictionary, pet names and who caught whose words
import { state, $, esc, who, fmtDate, fmtMonth, fmtDuration, selected, msgLi, colourOf } from './ui.js';
import { bucketList, bucketStart } from './analysis.js';

const DAY = 864e5;

// Little words that never make interesting labels
export const STOP = new Set(`the and you for that this with have are was but not just its it's what all get got can can't
 your yeah yes too out now one when how about there they then them would will like know think from been were did does
 don't dont really going want some more well good time see back still also our had has him her his she just very much
 lol haha okay ok because too here where who which why way make made into over only even any could should their than
 lot lots thing things im i'm you're youre i've ive i'll ill i'd id we're were we've let's lets that's thats there's
 sure gonna wanna yep nope ill did didn't didnt isn't isnt wasn't wasnt doesn't doesnt won't wont aren't arent hmm ah
 omg idk tbh btw xx xxx image omitted message deleted edited http https www com cant couldnt shouldnt wouldnt
 havent hasnt theyre theres whats youll youd shes hes ive thats again`.split(/\s+/));

const SLANG = new Set(`lol lmao lmfao omg tbh idk btw ok okay yeah yep yup nope gonna wanna gotta kinda sorta dunno cos
 coz cuz pls plz thx lmk imo ngl rn wtf ffs oml aww awww ahh ahhh hmm hmmm ooh oooh yay ya yh ye nah naw tho thru u ur
 whatsapp image omitted http https www com deleted message edited null`.split(/\s+/));
const NOISE = /^(a*(ha)+h?|(he)+|x+|o+|m+|h+|a+h*|(xo)+|(lo)+l|\d+.*|.*\d.*)$/;

const isEmoji = t => /\p{Extended_Pictographic}/u.test(t);
const tokensOf = m => [...m.words, ...m.emojis];

// --- chapters ------------------------------------------------------------------------------------
// Split the chat into eras wherever the pattern changes: how much you talk, how happy, how fast you reply
function weeklyFeatures(messages) {
  const weeks = bucketList(messages, 'week');
  const index = new Map(weeks.map((d, i) => [+d, i]));
  const f = weeks.map(() => ({ n: 0, h: 0, hN: 0, e: 0, replies: [] }));
  messages.forEach((m, i) => {
    const w = f[index.get(+bucketStart(m.date, 'week'))];
    w.n++; w.e += m.emojis.length;
    for (const [, s] of m.scored) if (Math.abs(s - 5) > 1) { w.h += s; w.hN++; }
    const prev = messages[i - 1];
    if (prev && prev.author !== m.author && m.date - prev.date < 4 * 36e5) w.replies.push(m.date - prev.date);
  });
  const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const rows = f.map(w => [Math.log1p(w.n), w.hN >= 5 ? w.h / w.hN : null, w.replies.length >= 3 ? Math.log(med(w.replies)) : null,
    w.n ? w.e / w.n : null]);
  // Standardise each feature, filling empty weeks with the average
  const dims = rows[0].length;
  for (let d = 0; d < dims; d++) {
    const vals = rows.map(r => r[d]).filter(v => v != null);
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1;
    rows.forEach(r => (r[d] = r[d] == null ? 0 : (r[d] - mean) / sd));
  }
  return { weeks, rows };
}

function segment(rows, minLen, maxSegs) {
  const n = rows.length, dims = rows[0].length;
  const S = Array.from({ length: dims }, () => new Float64Array(n + 1)), Q = Array.from({ length: dims }, () => new Float64Array(n + 1));
  for (let d = 0; d < dims; d++) for (let i = 0; i < n; i++) { S[d][i + 1] = S[d][i] + rows[i][d]; Q[d][i + 1] = Q[d][i] + rows[i][d] ** 2; }
  const cost = (a, b) => { let c = 0; for (let d = 0; d < dims; d++) { const s = S[d][b] - S[d][a]; c += Q[d][b] - Q[d][a] - s * s / (b - a); } return c; };
  const penalty = Math.max(dims * Math.log(n) * 3, cost(0, n) * 0.04);
  let segs = [[0, n]];
  while (segs.length < maxSegs) {
    let best = null;
    for (const [a, b] of segs) for (let k = a + minLen; k <= b - minLen; k++) {
      const gain = cost(a, b) - cost(a, k) - cost(k, b);
      if (!best || gain > best.gain) best = { gain, a, b, k };
    }
    if (!best || best.gain < penalty) break;
    segs = segs.flatMap(s => s[0] === best.a ? [[best.a, best.k], [best.k, best.b]] : [s]);
  }
  return segs.sort((x, y) => x[0] - y[0]);
}

// Words most typical of one group of messages compared with the rest (log odds with an informative prior)
export function distinctive(inside, outside, all, { min = 4, top = 6, emoji = false } = {}) {
  const total = m => [...m.values()].reduce((a, b) => a + b, 0);
  const nI = total(inside), nO = total(outside), nA = total(all), a0 = 500;
  const out = [];
  for (const [w, y] of inside) {
    if (y < min || isEmoji(w) !== emoji) continue;
    if (!emoji && (w.length < 3 || STOP.has(w) || NOISE.test(w))) continue;
    const aw = (all.get(w) || 0) * a0 / nA, z = outside.get(w) || 0;
    const d = Math.log((y + aw) / (nI + a0 - y - aw)) - Math.log((z + aw) / (nO + a0 - z - aw));
    out.push([w, d / Math.sqrt(1 / (y + aw) + 1 / (z + aw))]);
  }
  return out.sort((x, y) => y[1] - x[1]).slice(0, top).map(x => x[0]);
}

const countTokens = (msgs, c = new Map()) => { for (const m of msgs) for (const t of tokensOf(m)) c.set(t, (c.get(t) || 0) + 1); return c; };

export function chapters(messages) {
  const { weeks, rows } = weeklyFeatures(messages);
  if (weeks.length < 16) return [];
  const segs = segment(rows, 8, Math.min(8, Math.max(2, Math.floor(weeks.length / 12))));
  const all = countTokens(messages);
  const happy = ms => { let s = 0, n = 0; for (const m of ms) for (const [, v] of m.scored) if (Math.abs(v - 5) > 1) { s += v; n++; } return n ? s / n : null; };
  const overall = happy(messages);
  return segs.map(([a, b], i) => {
    const start = weeks[a], end = b < weeks.length ? weeks[b] : new Date(+messages[messages.length - 1].date + DAY);
    const ms = messages.filter(m => m.date >= start && m.date < end);
    const inside = countTokens(ms), outside = new Map(all);
    for (const [w, k] of inside) outside.set(w, outside.get(w) - k);
    const words = distinctive(inside, outside, all, { min: Math.max(4, ms.length / 2000) });
    const emojis = distinctive(inside, outside, all, { emoji: true, min: 3, top: 4 });
    const replies = [];
    ms.forEach((m, k) => { const p = ms[k - 1]; if (p && p.author !== m.author && m.date - p.date < 4 * 36e5) replies.push(m.date - p.date); });
    replies.sort((x, y) => x - y);
    return { n: i + 1, start, end: new Date(+end - DAY), count: ms.length, perDay: ms.length / Math.max(1, (end - start) / DAY),
      mood: happy(ms), overall, words, emojis, reply: replies[replies.length >> 1] };
  });
}

// --- milestones ----------------------------------------------------------------------------------
const FIRSTS = [
  ['👋', 'First message', () => true],
  ['😘', 'First "miss you"', m => /\bmiss(ed)? (you|u|ya)\b/i.test(m.text)],
  ['❤️', 'First heart', m => m.emojis.some(e => /[❤♥\u{1F495}-\u{1F49F}\u{1F970}\u{1F60D}\u{1F618}]/u.test(e))],
  ['💖', 'First "love you"', m => /\blove (you|u|ya)\b/i.test(m.text)],
  ['🙏', 'First "sorry"', m => /\bsorry\b/i.test(m.text)],
  ['🏠', 'First "home" talk', m => /\b(our (place|flat|house|home)|move in|moving in)\b/i.test(m.text)],
];

export function milestones(messages, dyn) {
  const out = [];
  for (const [icon, label, test] of FIRSTS) {
    const m = messages.find(test);
    if (m) out.push({ icon, label, date: m.date, m });
  }
  for (const k of [1000, 10000, 50000, 100000, 250000]) if (messages.length >= k)
    out.push({ icon: '🎉', label: `Message number ${k.toLocaleString()}`, date: messages[k - 1].date, m: messages[k - 1] });
  if (dyn) {
    const longest = dyn.conversations.reduce((a, c) => (c.n > a.n ? c : a));
    out.push({ icon: '🗣️', label: `Longest conversation: ${longest.n.toLocaleString()} messages over ${fmtDuration(longest.end - longest.start)}`, date: longest.start });
    out.push({ icon: '📈', label: `Busiest day: ${dyn.busiest.n.toLocaleString()} messages`, date: dyn.busiest.date });
    if (dyn.longestSilence.from) out.push({ icon: '🤐', label: `Longest silence (${fmtDuration(dyn.longestSilence.ms)}) ends`, date: dyn.longestSilence.to });
  }
  return out.sort((a, b) => a.date - b.date);
}

// --- our dictionary, pet names and word adoption --------------------------------------------------
function knownWords(lexicon) {
  const known = new Set(Object.keys(lexicon));
  for (const w of Object.keys(lexicon)) if (w.includes("'")) known.add(w.replace(/'/g, ''));
  return known;
}
let knownCache = null;

export function ourWords(messages, names, lexicon, top = 24) {
  knownCache ??= knownWords(lexicon);
  const stats = new Map();
  for (const m of messages) for (const w of m.words) {
    const base = w.replace(/(.)\1{2,}/g, '$1$1');
    if (w.length < 3 || SLANG.has(base) || NOISE.test(w) || STOP.has(w) || knownCache.has(base) || knownCache.has(base.replace(/(.)\1/g, '$1'))) continue;
    let s = stats.get(w);
    if (!s) stats.set(w, (s = { word: w, n: 0, per: {}, first: m }));
    s.n++; s.per[m.author] = (s.per[m.author] || 0) + 1;
  }
  const min = Math.max(8, messages.length / 4000);
  return [...stats.values()].filter(s => s.n >= min && (names.length < 2 || Object.keys(s.per).length >= 2))
    .sort((a, b) => b.n - a.n).slice(0, top);
}

const GREETING = /\b(?:hey|hi|hello|morning|night|night night|nite|love you|love u|miss you|miss u|thanks|thank you|bye|sorry|aw+)\s+([\p{L}']{2,})/giu;
const NOT_NAMES = new Set(`so too more much lots all and the for a an to it that this you u me very now again soon back later then
 though tho mate guys everyone there here as i im just xx xxx x so sooo really too lol haha ok okay if how what when sweet
 have was is am are see talk speak tomorrow tonight bit loads always forever already anyway everything`.split(/\s+/));

export function petNames(messages, names) {
  const per = Object.fromEntries(names.map(n => [n, new Map()]));
  for (const m of messages) {
    if (!per[m.author]) continue;
    for (const [, w] of m.text.matchAll(GREETING)) {
      const k = w.toLowerCase().replace(/(.)\1{2,}/g, '$1$1');
      if (NOT_NAMES.has(k) || NOISE.test(k)) continue;
      per[m.author].set(k, (per[m.author].get(k) || 0) + 1);
    }
  }
  return Object.fromEntries(names.map(n => [n, [...per[n].entries()].filter(([, k]) => k >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5)]));
}

// Words (and emoji) one person used for a while before the other started using them too
export function adoption(messages, names) {
  const first = new Map(); // token -> {person: {date, n}}
  for (const m of messages) {
    if (!names.includes(m.author)) continue;
    for (const t of new Set(tokensOf(m))) {
      if (!isEmoji(t) && (t.length < 3 || STOP.has(t) || NOISE.test(t))) continue;
      let f = first.get(t);
      if (!f) first.set(t, (f = {}));
      if (!f[m.author]) f[m.author] = { date: m.date, n: 0, countsAtOthersFirst: {} };
      f[m.author].n++;
      // When someone uses a word for the first time, note how many times everyone else had already used it
      if (f[m.author].n === 1) for (const o of Object.keys(f)) if (o !== m.author) f[m.author].countsAtOthersFirst[o] = f[o].n;
    }
  }
  const out = [];
  for (const [t, f] of first) {
    const people = Object.keys(f);
    if (people.length < 2) continue;
    const [orig, ...rest] = people.sort((a, b) => f[a].date - f[b].date);
    for (const adopter of rest) {
      const lag = f[adopter].date - f[orig].date, prior = f[adopter].countsAtOthersFirst[orig] || 0;
      if (lag >= 30 * DAY && prior >= 3 && f[adopter].n >= 4) out.push({ token: t, from: orig, to: adopter, lag, since: f[adopter].date, uses: f[adopter].n, prior });
    }
  }
  // Words caught together from one phrase ('goblin mode') show once, under the most used one
  const seen = new Set();
  return out.sort((a, b) => b.uses - a.uses).filter(a => {
    const k = [a.from, a.to, +a.since, isEmoji(a.token)].join('|');
    return !seen.has(k) && seen.add(k);
  });
}

// --- render ----------------------------------------------------------------------------------------
export function renderStory(dyn) {
  const msgs = selected();
  if (!msgs.length) return;

  const chs = chapters(msgs);
  $('chapters').innerHTML = chs.length ? chs.map(c => {
    const moodDiff = c.mood && c.overall ? c.mood - c.overall : 0;
    const mood = moodDiff > 0.05 ? '☀️ happier than usual' : moodDiff < -0.05 ? '🌧️ gloomier than usual' : '⛅ usual mood';
    const title = c.words[0] ? `The “${c.words[0]}” era` : `Chapter ${c.n}`;
    return `<div class="chapter"><span class="ch-num">CHAPTER ${c.n}</span><h4>${esc(title)}</h4>
      <span class="ch-dates">${fmtMonth(c.start)} – ${fmtMonth(c.end)}</span>
      <span class="ch-emoji">${c.emojis.join(' ') || '&nbsp;'}</span>
      <ul><li>💬 ${c.perDay.toFixed(1)} messages a day</li><li>${mood}</li><li>⚡ replies in ${fmtDuration(c.reply)}</li></ul>
      <p class="ch-words">${c.words.slice(1).map(w => `<span>${esc(w)}</span>`).join('')}</p></div>`;
  }).join('') : '<p>Chapters need at least 4 months of messages.</p>';

  $('milestones').innerHTML = milestones(msgs, dyn).map(x => `<li><span class="ms-icon">${x.icon}</span><span class="ms-date">${fmtDate(x.date)}</span>
    <span class="ms-label">${esc(x.label)}${x.m ? `: <q>${esc(x.m.text.slice(0, 120) || '📷')}</q> <small>– ${esc(x.m.author)}</small>` : ''}</span></li>`).join('');

  renderOnThisDay();

  const words = ourWords(msgs, state.names, state.lexicon);
  $('our-words').innerHTML = words.length ? words.map(s => {
    const bar = state.names.filter(n => s.per[n]).map(n => `<span style="flex:${s.per[n]};background:${colourOf(n)}" title="${esc(n)}: ${s.per[n]}"></span>`).join('');
    return `<div class="dict"><b>${esc(s.word)}</b><span class="dict-n">×${s.n.toLocaleString()}</span><span class="dict-bar">${bar}</span>
      <small>first: ${esc(s.first.author)}, ${fmtDate(s.first.date)}</small></div>`;
  }).join('') : '<p>No special words found yet.</p>';

  const pets = petNames(msgs, state.names);
  $('pet-names').innerHTML = state.names.map(n => {
    const list = pets[n];
    return `<div class="pet">${who(n)} says: ${list.length ? list.map(([w, k]) => `<span class="pet-word">${esc(w)} <small>×${k}</small></span>`).join(' ') : '<i>no pet names found</i>'}</div>`;
  }).join('');

  const ad = adoption(msgs, state.names);
  const pairs = new Map();
  for (const a of ad) { const k = a.from + '→' + a.to; if (!pairs.has(k)) pairs.set(k, []); if (pairs.get(k).length < 8) pairs.get(k).push(a); }
  $('adoption').innerHTML = pairs.size ? [...pairs.values()].slice(0, 6).map(list => `<div class="adopt"><h4>${who(list[0].to)} picked up from ${who(list[0].from)}</h4>
    <ul>${list.map(a => `<li><b class="tok">${esc(a.token)}</b> – after ${fmtDuration(a.lag)} (${a.prior}× by ${esc(a.from)} first), now used ${a.uses.toLocaleString()}×</li>`).join('')}</ul></div>`).join('')
    : '<p>Nobody has caught anyone else’s words yet.</p>';
}

export function renderOnThisDay() {
  const input = $('otd-date');
  if (!input.value) { const t = new Date(); input.value = t.toISOString().slice(0, 10); }
  const [, mm, dd] = input.value.split('-').map(Number);
  const hits = selected().filter(m => m.date.getMonth() + 1 === mm && m.date.getDate() === dd);
  const years = new Map();
  for (const m of hits) { const y = m.date.getFullYear(); if (!years.has(y)) years.set(y, []); years.get(y).push(m); }
  $('otd').innerHTML = years.size ? [...years.entries()].sort((a, b) => b[0] - a[0]).map(([y, ms]) => {
    const pick = ms.filter(m => m.words.length >= 4 && m.text.length < 220).sort((a, b) => (b.laughs + b.emojis.length) - (a.laughs + a.emojis.length))[0] || ms[0];
    return `<div class="otd-year"><b>${y}</b> <small>${ms.length} messages</small><ul class="msgs">${msgLi(pick)}</ul></div>`;
  }).join('') : '<p>No messages on this day. Try another date!</p>';
}
