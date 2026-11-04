// "How We Talk" extras: texting fingerprints, mood contagion and how fast a sorry gets forgiven
import { state, $, esc, who, fmtDuration, pct, selected, colourOf } from './ui.js';
import { distinctive } from './story.js';

const HOUR = 36e5;
const LAUGH_WORD = /^(a?(ha){2,}h?|(he){2,}|lo+l+|lmf?a+o+|rofl|jaja(ja)*)$|^[\u{1F602}\u{1F923}\u{1F606}\u{1F480}]$/u;
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// Positive (1), neutral (0) or negative (-1), from the AI if it has run, otherwise from the word list
export function valence(m) {
  if (m.ai !== undefined) return m.ai > 0.3 ? 1 : m.ai < -0.3 ? -1 : 0;
  const s = m.scored.filter(([, v]) => Math.abs(v - 5) > 1);
  if (!s.length) return null;
  const avg = s.reduce((a, [, v]) => a + v, 0) / s.length;
  return avg > 5.5 ? 1 : avg < 4.5 ? -1 : 0;
}

export function fingerprints(messages, names) {
  const out = Object.fromEntries(names.map(n => [n, { n: 0, cap: 0, stop: 0, bang: 0, shout: 0, q: 0, words: 0, kisses: 0,
    laughs: new Map(), hours: Array(24).fill(0), bursts: [], firstOfDay: 0, tokens: new Map() }]));
  let run = 0, lastDay = null;
  messages.forEach((m, i) => {
    const s = out[m.author];
    const prev = messages[i - 1];
    if (prev && prev.author === m.author) run++; else { if (prev && out[prev.author]) out[prev.author].bursts.push(run); run = 1; }
    const day = m.date.toDateString();
    if (day !== lastDay && m.date.getHours() >= 5) { if (s) s.firstOfDay++; lastDay = day; }
    if (!s || !m.text) return;
    s.n++; s.words += m.words.length;
    if (/^\p{Lu}/u.test(m.text)) s.cap++;
    if (/\.$/.test(m.text)) s.stop++;
    if (m.text.includes('!')) s.bang++;
    if (m.question) s.q++;
    const letters = m.text.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 4 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) s.shout++;
    s.hours[m.date.getHours()]++;
    for (const t of [...m.words, ...m.emojis]) {
      s.tokens.set(t, (s.tokens.get(t) || 0) + 1);
      if (/^x+$/.test(t)) s.kisses += t.length;
      if (LAUGH_WORD.test(t)) s.laughs.set(t, (s.laughs.get(t) || 0) + 1);
    }
  });
  const all = new Map();
  for (const n of names) for (const [t, k] of out[n].tokens) all.set(t, (all.get(t) || 0) + k);
  const days = new Set(messages.map(m => m.date.toDateString())).size;
  for (const n of names) {
    const s = out[n], others = new Map(all);
    for (const [t, k] of s.tokens) others.set(t, others.get(t) - k);
    s.signature = names.length > 1 ? distinctive(s.tokens, others, all, { min: 5, top: 3 }) : [];
    s.laugh = [...s.laughs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    s.peakHour = s.hours.indexOf(Math.max(...s.hours));
    s.burst = s.bursts.length ? s.bursts.reduce((a, b) => a + b, 0) / s.bursts.length : 1;
    s.firstOfDayPct = s.firstOfDay / days;
  }
  return out;
}

export function contagion(messages, names, gapHours = 4) {
  const t = Object.fromEntries(names.map(n => [n, { after: { '-1': [0, 0, 0], '0': [0, 0, 0], '1': [0, 0, 0] }, replyAfter: { '-1': [], '0': [], '1': [] } }]));
  let prevV = null;
  messages.forEach((m, i) => {
    const prev = messages[i - 1], v = valence(m);
    if (prev && t[m.author] && prev.author !== m.author && m.date - prev.date < gapHours * HOUR && prevV !== null) {
      t[m.author].replyAfter[prevV].push(m.date - prev.date);
      if (v !== null) t[m.author].after[prevV][v + 1]++;
    }
    prevV = v;
  });
  for (const n of names) {
    const a = t[n].after, sum = x => x[0] + x[1] + x[2];
    const all = [0, 1, 2].map(k => a['-1'][k] + a['0'][k] + a['1'][k]);
    t[n].cheerUp = sum(a['-1']) >= 5 ? a['-1'][2] / sum(a['-1']) : null;
    t[n].mirror = sum(a['-1']) >= 5 ? a['-1'][0] / sum(a['-1']) : null;
    t[n].basePos = sum(all) ? all[2] / sum(all) : null;
    t[n].baseNeg = sum(all) ? all[0] / sum(all) : null;
    t[n].replyNeg = median(t[n].replyAfter['-1']);
    t[n].replyPos = median(t[n].replyAfter['1']);
    t[n].negSeen = sum(a['-1']);
  }
  return t;
}

const SORRY = /\b(sorry|soz|apologi[sz]e|my bad)\b/i;
const MAKEUP = /\b(love (you|u|ya)|it'?s (ok|okay|fine|alright)|no worries|don'?t worry|all good|forgive|of course)\b|[❤♥\u{1F495}-\u{1F49F}\u{1F970}\u{1F60D}\u{1F618}\u{1F917}]/iu;

export function forgiveness(messages, names) {
  const out = Object.fromEntries(names.map(n => [n, { sorries: 0, times: [] }]));
  messages.forEach((m, i) => {
    if (!out[m.author] || !SORRY.test(m.text)) return;
    out[m.author].sorries++;
    for (let j = i + 1; j < messages.length && messages[j].date - m.date < 3 * 24 * HOUR; j++) {
      const r = messages[j];
      if (r.author !== m.author && MAKEUP.test(r.text)) { out[m.author].times.push(r.date - m.date); break; }
    }
  });
  for (const n of names) out[n].median = median(out[n].times);
  return out;
}

// --- render ----------------------------------------------------------------------------------------
export function renderTalk() {
  const msgs = selected(), names = state.names;
  if (!msgs.length) return;

  const fp = fingerprints(msgs, names);
  const hour = h => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  $('fingerprints').innerHTML = names.map(n => {
    const s = fp[n];
    const row = (label, value) => `<tr><td>${label}</td><td>${value}</td></tr>`;
    return `<div class="card" style="--c:${colourOf(n)}"><div class="card-top">${esc(n)}</div><table>
      ${row('Signature words', s.signature.map(esc).join(', ') || '–')}
      ${row('Favourite laugh', esc(s.laugh || '–'))}
      ${row('Peak hour', hour(s.peakHour))}
      ${row('Messages in a row', s.burst.toFixed(1))}
      ${row('Says good morning first', pct(s.firstOfDayPct * 100, 100))}
      ${row('Starts with a Capital', pct(s.cap, s.n))}
      ${row('Ends with a full stop.', pct(s.stop, s.n))}
      ${row('Uses ! marks', pct(s.bang, s.n))}
      ${row('SHOUTS', pct(s.shout, s.n))}
      ${row('Kisses (x) per message', (s.kisses / Math.max(1, s.n)).toFixed(2))}
    </table></div>`;
  }).join('');

  const c = contagion(msgs, names);
  const usingAI = msgs.some(m => m.ai !== undefined);
  $('contagion-note').textContent = usingAI ? 'Using the AI mood reader’s scores.' : 'Using the word list. Run the AI mood reader for sharper results.';
  $('contagion').innerHTML = names.filter(n => c[n].cheerUp !== null).map(n => {
    const s = c[n];
    const bar = (label, v, base, col) => `<div class="cbar"><span class="cl">${label}</span><span class="track"><span style="width:${(v * 100).toFixed(0)}%;background:${col}"></span>
      <i style="left:${(base * 100).toFixed(0)}%" title="usual"></i></span><b>${pct(v, 1)}</b></div>`;
    const lift = s.cheerUp - s.basePos;
    const verdict = lift > 0.05 ? '🦸 Cheerleader: gets more positive when the other person is down'
      : s.mirror - s.baseNeg > 0.05 ? '🪞 Mirror: feels it with you when you’re down' : '🧘 Steady: mood doesn’t follow yours much';
    return `<div class="contagion"><h4>${who(n)}’s replies after a gloomy message</h4>
      ${bar('😊 positive', s.cheerUp, s.basePos, '#2ecc00')}${bar('😟 gloomy', s.mirror, s.baseNeg, '#ff1744')}
      <p>${verdict}. Replies in ${fmtDuration(s.replyNeg)} after gloomy messages vs ${fmtDuration(s.replyPos)} after happy ones.</p></div>`;
  }).join('') || '<p>Not enough back-and-forth yet.</p>';

  const f = forgiveness(msgs, names);
  $('forgiveness').innerHTML = names.map(n => `<div class="fact"><b>${fmtDuration(f[n].median)}</b><span>for ${esc(n)}’s sorry to get a ❤️ or “it’s ok” (said sorry ${f[n].sorries.toLocaleString()}×)</span></div>`).join('');
}
