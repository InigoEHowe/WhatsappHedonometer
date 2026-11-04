// All the number crunching. Everything here is plain functions over the parsed messages.

const HOUR = 3600e3, DAY = 24 * HOUR;

export function tokenize(text) {
  return text.toLowerCase().replace(/’/g, "'")
    .split(/[^\p{L}\p{N}'_-]+/u)
    .map(w => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export function emojis(text) {
  const out = [];
  for (const { segment } of segmenter.segment(text)) {
    if (/\p{Extended_Pictographic}/u.test(segment) && !/^[©®™]$/.test(segment)) out.push(segment);
  }
  return out;
}

const LAUGH = /(?<![\p{L}])(a?(ha){2,}h?|(he){2,}|lo+l+|lmf?a+o+|rofl|jaja(ja)*|kek)(?![\p{L}])|\u{1F602}|\u{1F923}|\u{1F606}|\u{1F480}/giu;
export const countLaughs = text => (text.match(LAUGH) || []).length;

// --- time buckets -------------------------------------------------------------------------------
export function bucketStart(date, size) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (size === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (size === 'month') d.setDate(1);
  return d;
}

function nextBucket(d, size) {
  const n = new Date(d);
  if (size === 'day') n.setDate(n.getDate() + 1);
  if (size === 'week') n.setDate(n.getDate() + 7);
  if (size === 'month') n.setMonth(n.getMonth() + 1);
  return n;
}

export function bucketList(messages, size) {
  const out = [];
  const end = messages[messages.length - 1].date;
  for (let d = bucketStart(messages[0].date, size); d <= end; d = nextBucket(d, size)) out.push(d);
  return out;
}

// --- the big one ---------------------------------------------------------------------------------
// Precompute per-message features once, so changing settings is quick
export function enrich(messages, lexicon) {
  for (const m of messages) {
    m.words = tokenize(m.text);
    m.scored = m.words.filter(w => w in lexicon).map(w => [w, lexicon[w]]);
    m.emojis = emojis(m.text);
    m.laughs = countLaughs(m.text);
    m.question = m.text.includes('?');
  }
  return messages;
}

export function people(messages) {
  const counts = new Map();
  for (const m of messages) counts.set(m.author, (counts.get(m.author) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
}

// Per person, per time bucket stats. delh removes neutral words, as in the original hedonometer
export function timeline(messages, names, size, delh, minWords = 10, trackWords = []) {
  const buckets = bucketList(messages, size);
  const index = new Map(buckets.map((d, i) => [+d, i]));
  const blank = () => buckets.map(() => ({ n: 0, words: 0, hSum: 0, hN: 0, emojis: 0, laughs: 0, questions: 0,
    ai: 0, aiN: 0, track: Object.fromEntries(trackWords.map(w => [w, 0])) }));
  const per = Object.fromEntries(names.map(n => [n, blank()]));
  const all = blank();

  for (const m of messages) {
    const i = index.get(+bucketStart(m.date, size));
    for (const b of [per[m.author]?.[i], all[i]]) {
      if (!b) continue;
      b.n++; b.words += m.words.length; b.emojis += m.emojis.length; b.laughs += m.laughs; b.questions += m.question;
      for (const [, s] of m.scored) if (Math.abs(s - 5) > delh) { b.hSum += s; b.hN++; }
      if (m.ai !== undefined) { b.ai += m.ai; b.aiN++; }
      for (const w of trackWords) b.track[w] += m.words.filter(x => x === w).length;
    }
  }
  const finish = arr => arr.map(b => ({
    n: b.n,
    avgLen: b.n ? b.words / b.n : null,
    happiness: b.hN >= minWords ? b.hSum / b.hN : null,
    emojiRate: b.n ? b.emojis / b.n : null,
    laughRate: b.n ? b.laughs / b.n : null,
    questionRate: b.n ? b.questions / b.n : null,
    ai: b.aiN >= 3 ? b.ai / b.aiN : null,
    track: Object.fromEntries(trackWords.map(w => [w, b.n ? b.track[w] / b.n : null])),
  }));
  return { buckets, per: Object.fromEntries(names.map(n => [n, finish(per[n])])), all: finish(all) };
}

export function overallHappiness(messages, name, delh) {
  let sum = 0, n = 0;
  for (const m of messages) if (m.author === name) for (const [, s] of m.scored) if (Math.abs(s - 5) > delh) { sum += s; n++; }
  return n ? sum / n : null;
}

// Hour of week heatmap: [weekday Mon=0][hour]
export function heatmap(messages, name = null) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const m of messages) if (!name || m.author === name) grid[(m.date.getDay() + 6) % 7][m.date.getHours()]++;
  return grid;
}

// --- conversation dynamics -----------------------------------------------------------------------
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function dynamics(messages, names, gapHours = 4) {
  const gap = gapHours * HOUR;
  const stat = Object.fromEntries(names.map(n => [n, { starts: 0, ends: 0, replies: [], doubleTexts: 0,
    nightOwl: 0, earlyBird: 0, longest: null, media: 0, deleted: 0, words: 0, n: 0, ghosted: 0 }]));
  const conversations = [];
  let conv = null, longestSilence = { ms: 0, from: null, to: null };

  messages.forEach((m, i) => {
    const prev = messages[i - 1], s = stat[m.author];
    const dt = prev ? m.date - prev.date : Infinity;
    if (dt > gap) {
      if (conv) conversations.push(conv);
      conv = { start: m.date, end: m.date, starter: m.author, ender: m.author, n: 0 };
      if (s) s.starts++;
      if (prev && dt > longestSilence.ms) longestSilence = { ms: dt, from: prev.date, to: m.date, broke: m.author };
    } else if (prev.author !== m.author) {
      if (s) s.replies.push(dt);
    } else if (dt > 30 * 60e3 && s) {
      s.doubleTexts++; // sent again after 30+ minutes with no answer
    }
    conv.end = m.date; conv.ender = m.author; conv.n++;
    if (!s) return;
    s.n++; s.words += m.words.length; s.media += m.media; s.deleted += m.deleted;
    const h = m.date.getHours();
    if (h < 5) s.nightOwl++;
    if (h >= 5 && h < 8) s.earlyBird++;
    if (!s.longest || m.words.length > s.longest.words.length) s.longest = m;
  });
  if (conv) conversations.push(conv);
  for (const c of conversations) if (stat[c.ender]) stat[c.ender].ends++;
  // Ghosted: the last message of a conversation that was a question and got no answer
  messages.forEach((m, i) => {
    const next = messages[i + 1];
    if (m.question && stat[m.author] && (!next || next.date - m.date > gap)) stat[m.author].ghosted++;
  });

  // Longest run of consecutive days with at least one message
  const days = [...new Set(messages.map(m => +bucketStart(m.date, 'day')))].sort((a, b) => a - b);
  let streak = { len: 1, end: days[0] }, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = Math.round((days[i] - days[i - 1]) / DAY) === 1 ? run + 1 : 1;
    if (run > streak.len) streak = { len: run, end: days[i] };
  }
  const dayCounts = new Map();
  for (const m of messages) { const k = +bucketStart(m.date, 'day'); dayCounts.set(k, (dayCounts.get(k) || 0) + 1); }
  const busiest = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  for (const n of names) stat[n].medianReply = median(stat[n].replies);
  return {
    stat, conversations, longestSilence, busiest: { date: new Date(busiest[0]), n: busiest[1] },
    streak: { len: streak.len, start: new Date(streak.end - (streak.len - 1) * DAY), end: new Date(streak.end) },
    activeDays: days.length, totalDays: Math.round((days[days.length - 1] - days[0]) / DAY) + 1,
  };
}

// --- words and emoji -----------------------------------------------------------------------------
export function wordCounts(messages, name, lexicon, delh) {
  const c = new Map();
  for (const m of messages) if (m.author === name)
    for (const [w, s] of m.scored) if (Math.abs(s - 5) > delh) c.set(w, (c.get(w) || 0) + 1);
  return c;
}

// Words someone uses more than everyone else, relative to how much each person talks
export function distinctiveWords(counts, name, names, top = 60) {
  const total = n => [...counts[n].values()].reduce((a, b) => a + b, 0) || 1;
  const mine = counts[name], myTotal = total(name);
  const others = new Map(); let otherTotal = 0;
  for (const n of names) if (n !== name) { otherTotal += total(n); for (const [w, k] of counts[n]) others.set(w, (others.get(w) || 0) + k); }
  otherTotal = otherTotal || 1;
  return [...mine.entries()]
    .map(([w, k]) => [w, k / myTotal - (others.get(w) || 0) / otherTotal, k])
    .filter(([, d, k]) => d > 0 && k >= 3)
    .sort((a, b) => b[1] - a[1]).slice(0, top);
}

export function topEmoji(messages, name, top = 10) {
  const c = new Map();
  for (const m of messages) if (!name || m.author === name) for (const e of m.emojis) c.set(e, (c.get(e) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

export function extremeMessages(messages, delh, key = 'h', n = 5) {
  // Each distinct text once, so 'love you' sent 300 times doesn't fill the list
  const seen = new Set();
  messages = messages.filter(m => { const k = m.text.toLowerCase(); return !seen.has(k) && seen.add(k); });
  const scored = messages.map(m => {
    if (key === 'ai') return m.ai === undefined || m.words.length < 3 ? null : [m, m.ai];
    const s = m.scored.filter(([, v]) => Math.abs(v - 5) > delh).map(([, v]) => v);
    return s.length >= 3 ? [m, s.reduce((a, b) => a + b, 0) / s.length] : null;
  }).filter(Boolean).sort((a, b) => b[1] - a[1]);
  const middle = key === 'ai' ? 0 : 5;
  return { happiest: scored.filter(([, s]) => s > middle).slice(0, n),
    saddest: scored.filter(([, s]) => s < middle).slice(-n).reverse() };
}
