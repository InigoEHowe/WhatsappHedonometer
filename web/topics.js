// What you talk about: simple topic word lists, charted as a share of messages each month
import { state, selected, drawChart, fmtBucket } from './ui.js';
import { bucketList, bucketStart } from './analysis.js';

export const TOPICS = {
  '🍕 Food': 'food dinner lunch breakfast brunch eat eating ate cook cooking cooked pizza pasta chicken coffee tea wine beer restaurant hungry snack snacks chocolate takeaway curry burger cake sushi starving recipe dessert',
  '💼 Work': 'work working office meeting meetings boss job shift email emails deadline project client interview colleague colleagues manager presentation',
  '📅 Plans': 'tonight tomorrow weekend plans plan meet pick later arrive arriving leaving train bus drive driving car flight booked book ticket tickets uber taxi station',
  '🏠 Home': 'home house flat clean cleaning washing laundry bed sofa kitchen rent bills shopping groceries tidy hoover dishes',
  '🤒 Health': 'sick ill tired exhausted doctor headache gym run running sleep slept sleeping hospital pain cold flu period ache',
  '👪 Family': 'mum mom mam dad mother father sister brother nan nana grandma grandad granny family parents aunt auntie uncle cousin',
  '🎉 Fun': 'movie film show netflix episode series game games party drinks pub bar concert gig holiday trip beach festival wedding birthday',
  '💸 Money': 'money pay paid cost costs price expensive cheap bank save saving budget salary bill',
  '🐶 Pets': 'dog doggo puppy cat kitty kitten pup walkies vet',
};
const LOOKUP = new Map();
for (const [topic, words] of Object.entries(TOPICS)) for (const w of words.split(' ')) LOOKUP.set(w, topic);

export function topicOf(m) {
  const hits = new Set();
  for (const w of m.words) { const t = LOOKUP.get(w); if (t) hits.add(t); }
  return hits;
}

export function renderTopics() {
  const msgs = selected();
  if (!msgs.length) return;
  const size = state.period === 'day' ? 'week' : state.period;
  const buckets = bucketList(msgs, size);
  const index = new Map(buckets.map((d, i) => [+d, i]));
  const names = Object.keys(TOPICS);
  const counts = Object.fromEntries(names.map(t => [t, buckets.map(() => 0)]));
  const totals = buckets.map(() => 0);
  for (const m of msgs) {
    const i = index.get(+bucketStart(m.date, size));
    totals[i]++;
    for (const t of topicOf(m)) counts[t][i]++;
  }
  const colours = ['#ff6a00', '#7c4dff', '#00b8d4', '#e6c300', '#ff1744', '#ff00cc', '#2ecc00', '#00c48c', '#8d6e63'];
  const datasets = names.map((t, k) => ({
    label: t, data: counts[t].map((c, i) => totals[i] >= 5 ? 100 * c / totals[i] : null),
    backgroundColor: colours[k] + 'cc', borderColor: colours[k], fill: true, pointRadius: 0, tension: 0.3, spanGaps: true,
  }));
  drawChart('ch-topics', buckets.map(fmtBucket), datasets, '% of messages', { stacked: true });
}
