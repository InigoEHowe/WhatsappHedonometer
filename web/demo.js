// Makes up a believable two person chat (Android export format) so people can try the page without their own
export function demoChat() {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rand() * a.length)];
  const A = 'Sam', B = 'Jordan 🌻';
  const happy = ['love you so much ❤️', 'hahaha that was amazing 😂', 'great day today!', 'miss you, see you soon 😘',
    "thank you!! you're the best", 'happy friday 🎉', 'lol yes', 'that sounds wonderful', 'cant wait for the holiday ☀️',
    'best weekend ever', 'hehe 🥰', 'you make me laugh so much 🤣', 'yay!! congrats 🥳'];
  const sad = ['ugh terrible day', 'i hate mondays', 'so tired and sick 🤒', "that's awful, sorry", 'feeling sad tbh',
    'not happy about it', 'stressed about work 😩', 'lost my keys again', 'missed the train 🙄', 'the rain is miserable'];
  const neutral = ['what time are we meeting?', 'ok', 'on my way', 'did you get milk?', 'where are you?', 'running 5 min late',
    'what do you want for dinner?', 'sure', 'call you later', 'did you see the email?', '<Media omitted>', 'which one?'];
  const lines = [];
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  let t = new Date(2025, 0, 6, 8, 0);
  lines.push(fmt(t) + ' - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.');
  const end = new Date(2025, 11, 31);
  while (t < end) {
    // Mood drifts through the year: a good summer, a rough November
    const m = t.getMonth();
    const mood = m >= 5 && m <= 7 ? 0.7 : m === 10 ? 0.2 : 0.45;
    let who = rand() < 0.5 ? A : B;
    const burst = 1 + Math.floor(rand() * 6);
    for (let i = 0; i < burst; i++) {
      const r = rand();
      const text = r < mood * 0.7 ? pick(happy) : r < 0.7 ? pick(neutral) : pick(sad);
      lines.push(`${fmt(t)} - ${who}: ${text}`);
      t = new Date(+t + (1 + rand() * (who === A ? 6 : 15)) * 60e3);
      if (rand() < 0.7) who = who === A ? B : A;
    }
    const h = t.getHours();
    t = new Date(+t + (h > 22 || h < 7 ? 8 : 0.5 + rand() * 5) * 3600e3);
  }
  return lines.join('\n');
}
