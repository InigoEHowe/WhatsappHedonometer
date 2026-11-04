// A downloadable "year in review" picture, drawn on a canvas in the same 2000s style
import { state, $, fmtDate, fmtDuration, selected } from './ui.js';
import { topEmoji, dynamics } from './analysis.js';
import { ourWords } from './story.js';

const W = 1080, H = 1350;

function yearStats(year) {
  const msgs = selected().filter(m => m.date.getFullYear() === year);
  if (msgs.length < 20) return null;
  const months = Array.from({ length: 12 }, () => ({ s: 0, n: 0 }));
  for (const m of msgs) for (const [, v] of m.scored) if (Math.abs(v - 5) > 1) { months[m.date.getMonth()].s += v; months[m.date.getMonth()].n++; }
  const scored = months.map((x, i) => [i, x.n >= 30 ? x.s / x.n : null]).filter(x => x[1] !== null).sort((a, b) => b[1] - a[1]);
  const monthName = i => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' });
  const dyn = dynamics(msgs, state.names);
  const fastest = state.names.filter(n => dyn.stat[n].medianReply != null).sort((a, b) => dyn.stat[a].medianReply - dyn.stat[b].medianReply)[0];
  const hours = Array(24).fill(0); for (const m of msgs) hours[m.date.getHours()]++;
  const peak = hours.indexOf(Math.max(...hours));
  return {
    year, n: msgs.length, words: msgs.reduce((a, m) => a + m.words.length, 0), days: dyn.activeDays,
    emoji: topEmoji(msgs, null, 5).map(x => x[0]),
    happiest: scored[0] && monthName(scored[0][0]), gloomiest: scored.length > 1 && monthName(scored[scored.length - 1][0]),
    busiest: dyn.busiest, streak: dyn.streak.len, fastest, fastestTime: fastest && dyn.stat[fastest].medianReply,
    words3: ourWords(msgs, state.names, state.lexicon, 3).map(s => s.word),
    peak: `${peak % 12 || 12}${peak < 12 ? 'am' : 'pm'}`,
  };
}

function box(ctx, x, y, w, h, fill = '#c3c3c3') {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x + w - 4, y, 4, h);
  ctx.fillStyle = 'rgba(255,0,204,.55)'; ctx.fillRect(x + 12, y + h, w, 12); ctx.fillRect(x + w, y + 12, 12, h);
}

export async function drawCard(year) {
  await document.fonts.ready;
  const s = yearStats(year);
  const canvas = $('card-canvas'), ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0030'); bg.addColorStop(0.6, '#2b0050'); bg.addColorStop(1, '#4a0060');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  let seed = year;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160; i++) { ctx.fillStyle = ['#fff', '#ffee00', '#00e5ff'][i % 3]; ctx.fillRect(rand() * W, rand() * H, 3, 3); }
  // Construction stripes
  for (let x = -40; x < W; x += 56) { ctx.fillStyle = '#ffee00'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 28, 0); ctx.lineTo(x + 8, 24); ctx.lineTo(x - 20, 24); ctx.fill(); }

  const title = ctx.createLinearGradient(140, 0, W - 140, 0);
  ['#ff0000', '#ff9900', '#ffee00', '#33ff00', '#00e5ff', '#6633ff', '#ff00cc'].forEach((c, i) => title.addColorStop(i / 6, c));
  ctx.textAlign = 'center';
  ctx.font = "64px 'Press Start 2P'";
  ctx.fillStyle = '#000'; ctx.fillText(`~ ${year} ~`, W / 2 + 6, 146);
  ctx.fillStyle = title; ctx.fillText(`~ ${year} ~`, W / 2, 140);
  ctx.font = "bold 40px 'Comic Neue'"; ctx.fillStyle = '#fff';
  const names = state.names.length <= 3 ? state.names.join(' & ') : `${state.names.length} people`;
  ctx.fillText(names + ': the year in WhatsApp', W / 2, 210, W - 80);

  if (!s) { ctx.font = "40px 'Comic Neue'"; ctx.fillText('Not enough messages this year!', W / 2, 400); return; }

  // Big counters
  const counters = [['MESSAGES', s.n], ['WORDS', s.words], ['DAYS TALKED', s.days]];
  counters.forEach(([label, v], i) => {
    const x = 60 + i * 330;
    ctx.fillStyle = '#000'; ctx.fillRect(x, 260, 300, 130);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 6; ctx.strokeRect(x, 260, 300, 130);
    ctx.font = "18px 'Press Start 2P'"; ctx.fillStyle = '#00e5ff'; ctx.fillText(label, x + 150, 296);
    ctx.font = "84px 'VT323'"; ctx.fillStyle = '#ff3030'; ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 14;
    ctx.fillText(v.toLocaleString(), x + 150, 370); ctx.shadowBlur = 0;
  });

  // Emoji
  box(ctx, 60, 440, 960, 170);
  ctx.font = "bold 30px 'Comic Neue'"; ctx.fillStyle = '#000080'; ctx.textAlign = 'left'; ctx.fillText('Top emoji', 90, 485);
  ctx.font = '84px sans-serif'; ctx.textAlign = 'center';
  s.emoji.forEach((e, i) => ctx.fillText(e, 200 + i * 170, 585));

  // Facts list
  box(ctx, 60, 660, 960, 520, '#fff6a8');
  const facts = [
    s.happiest && ['☀️', 'Happiest month', s.happiest], s.gloomiest && ['🌧️', 'Gloomiest month', s.gloomiest],
    ['📈', 'Busiest day', `${fmtDate(s.busiest.date)} (${s.busiest.n} messages)`],
    ['🔥', 'Longest streak', `${s.streak} days in a row`],
    s.fastest && ['⚡', 'Speed demon', `${s.fastest} (${fmtDuration(s.fastestTime)})`],
    ['🕰️', 'Peak chat time', s.peak],
    s.words3.length && ['💬', 'Our words', s.words3.join(', ')],
  ].filter(Boolean);
  ctx.textAlign = 'left';
  facts.forEach(([icon, label, value], i) => {
    const y = 730 + i * 68;
    ctx.font = '44px sans-serif'; ctx.fillText(icon, 95, y);
    ctx.font = "bold 34px 'Comic Neue'"; ctx.fillStyle = '#8a0060'; ctx.fillText(label, 170, y);
    ctx.font = "34px 'Comic Neue'"; ctx.fillStyle = '#000'; ctx.fillText(value, 480, y, 520);
  });

  ctx.textAlign = 'center'; ctx.font = "22px 'Press Start 2P'"; ctx.fillStyle = '#39ff14';
  ctx.fillText('WhatsApp Hedonometer 2000', W / 2, 1265);
  ctx.font = "26px 'Comic Neue'"; ctx.fillStyle = '#fff'; ctx.fillText('made on my own computer, no chats were uploaded', W / 2, 1310);
}

export function setupCard() {
  $('card-year').addEventListener('change', () => drawCard(+$('card-year').value));
  $('card-download').addEventListener('click', () => {
    $('card-canvas').toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `our-${$('card-year').value}-in-whatsapp.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  });
}

export function renderCard() {
  const years = [...new Set(selected().map(m => m.date.getFullYear()))].sort((a, b) => b - a);
  const sel = $('card-year'), keep = +sel.value;
  sel.innerHTML = years.map(y => `<option>${y}</option>`).join('');
  sel.value = years.includes(keep) ? keep : years[0];
  drawCard(+sel.value);
}
