// Shared state and little helpers used by every tab

export const COLOURS = ['#ff00cc', '#00b8d4', '#ff6a00', '#2ecc00', '#7c4dff', '#e6c300', '#ff1744', '#00c48c'];

export const state = { messages: [], everyone: [], names: [], period: 'week', delh: 1, cloudMode: 'most',
  track: ['love', 'sorry'], lexicon: null, aiDone: false, chatKey: null };

export const $ = id => document.getElementById(id);
export const colourOf = name => COLOURS[Math.max(0, state.everyone.findIndex(p => p.name === name)) % COLOURS.length];
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const who = n => `<b style="color:${colourOf(n)}">${esc(n)}</b>`;
export const selected = () => state.messages.filter(m => state.names.includes(m.author));

export const fmtDate = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtMonth = d => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
export const fmtBucket = d => state.period === 'month'
  ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
export function fmtDuration(ms) {
  if (ms == null || !isFinite(ms)) return '–';
  const m = ms / 60e3;
  if (m < 1) return Math.round(ms / 1e3) + 's';
  if (m < 60) return Math.round(m) + ' min';
  if (m < 48 * 60) return (m / 60).toFixed(1) + ' h';
  return Math.round(m / 1440) + ' days';
}
export const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
export const snippet = (t, n = 200) => t.length > n ? t.slice(0, n) + '…' : t;
export const msgLi = (m, extra = '') => `<li>${esc(snippet(m.text))}<span class="meta">— ${esc(m.author)}, ${fmtDate(m.date)}${extra}</span></li>`;

// --- charts ----------------------------------------------------------------------------------------
const charts = {};
Chart.defaults.font.family = "'Comic Neue', 'Comic Sans MS', sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = '#000';

export function drawChart(id, labels, datasets, yTitle, { type = 'line', stacked = false, yMax } = {}) {
  charts[id]?.destroy();
  charts[id] = new Chart($(id), {
    type, data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 14 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y == null ? '–' : (+c.parsed.y.toFixed(3))}` } } },
      scales: { y: { stacked, max: yMax, title: { display: true, text: yTitle } },
        x: { stacked, ticks: { maxRotation: 45, autoSkipPadding: 12 } } },
    },
  });
}

export function lineChart(id, tl, get, { yTitle, everyone = false }) {
  const datasets = state.names.map(n => ({
    label: n, data: tl.per[n].map(get), borderColor: colourOf(n), backgroundColor: colourOf(n),
    borderWidth: 2.5, pointRadius: state.period === 'day' ? 0 : 3, tension: 0.25, spanGaps: true,
  }));
  if (everyone) datasets.push({ label: 'Everyone', data: tl.all.map(get), borderColor: '#000', backgroundColor: '#000',
    borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: 0.25, spanGaps: true });
  drawChart(id, tl.buckets.map(fmtBucket), datasets, yTitle);
}
