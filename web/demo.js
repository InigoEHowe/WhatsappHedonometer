// Makes up a believable two person chat (Android export format) so people can try the page without their own.
// It tells a little story in phases, so chapters, in-jokes, pet names and catching words all have something to find
export function demoChat() {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rand() * a.length)];
  const A = 'Sam', B = 'Jordan 🌻';

  const happy = ['love you so much ❤️', 'hahaha that was amazing 😂', 'great day today!', "thank you!! you're the best",
    'happy friday 🎉', 'lol yes', 'that sounds wonderful', 'best weekend ever', 'hehe 🥰', 'you make me laugh so much 🤣',
    'yay!! congrats 🥳', 'had the best time last night', 'cant stop smiling', 'proud of you x'];
  const sad = ['ugh terrible day', 'i hate mondays', 'so tired and sick 🤒', "that's awful, sorry", 'feeling sad tbh',
    'not happy about it', 'stressed about work 😩', 'lost my keys again', 'missed the train 🙄', 'the rain is miserable',
    'sorry, i was grumpy earlier', 'i miss you so much it hurts'];
  const neutral = ['what time are we meeting?', 'ok', 'on my way', 'did you get milk?', 'where are you?', 'running 5 min late',
    'what do you want for dinner?', 'sure', 'call you later', 'did you see the email?', '<Media omitted>', 'which one?'];
  const forgive = ["it's ok ❤️", 'no worries x', 'love you, all good'];

  // Each phase: dates, how chatty, mood, extra lines and what each person tends to say
  const phases = [
    { from: [2023, 2, 1], to: [2023, 7, 31], gapH: 2, mood: 0.75, extra: ['first date was so fun', 'you up? 👀', 'cant wait to see you again',
      'are we still on for drinks?', 'that pub was class'], pets: { [A]: ['morning gorgeous', 'night gorgeous'], [B]: ['hey you', 'night sleepyhead'] } },
    { from: [2023, 8, 1], to: [2024, 4, 30], gapH: 6, mood: 0.4, extra: ['miss you loads', 'flight booked ✈️', 'facetime tonight?',
      'only 12 sleeps', 'timezones are the worst', 'the long distance thing is hard'], pets: { [A]: ['morning babe', 'miss you babe'], [B]: ['night bubs', 'morning bubs'] } },
    { from: [2024, 5, 1], to: [2025, 8, 31], gapH: 3, mood: 0.6, extra: ['can you grab bin bags', 'the flat is freezing', 'our place looks so cosy now',
      'goblin mode tonight?', 'full goblin mode on the sofa 🫠', 'wobbles needs feeding', 'did wobbles eat?', 'hoover is broken again'],
      pets: { [A]: ['morning babe', 'love you babe', 'night bubs'], [B]: ['night bubs', 'love you bubs', 'thanks babe'] } },
  ];
  // 'goblin' and 🫠 start with Jordan; Sam only picks them up later on
  const jordanOnly = ['goblin mode tonight?', 'full goblin mode on the sofa 🫠'];

  const lines = [];
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  let t = new Date(2023, 2, 1, 19, 0);
  lines.push(fmt(t) + ' - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.');
  lines.push(fmt(t) + ` - ${A}: hey! it's Sam from saturday 😊`);
  for (const ph of phases) {
    const end = new Date(...ph.to, 23, 59);
    if (t < new Date(...ph.from)) t = new Date(...ph.from, 9, 0);
    while (t < end) {
      let who = rand() < 0.5 ? A : B;
      const burst = 1 + Math.floor(rand() * 6);
      for (let i = 0; i < burst; i++) {
        const r = rand();
        let text = r < ph.mood * 0.6 ? pick(happy) : r < 0.55 ? pick(neutral) : r < 0.8 ? pick(ph.extra) : r < 0.9 ? pick(ph.pets[who]) : pick(sad);
        if (jordanOnly.includes(text) && who === A && t < new Date(2024, 11, 1)) text = pick(neutral);
        lines.push(`${fmt(t)} - ${who}: ${text}`);
        if (/sorry/.test(text) && rand() < 0.8) { t = new Date(+t + 3 * 60e3); lines.push(`${fmt(t)} - ${who === A ? B : A}: ${pick(forgive)}`); }
        t = new Date(+t + (1 + rand() * (who === A ? 6 : 15)) * 60e3);
        if (rand() < 0.7) who = who === A ? B : A;
      }
      const h = t.getHours();
      t = new Date(+t + (h > 22 || h < 7 ? 8 : 0.3 + rand() * ph.gapH) * 3600e3);
    }
  }
  return lines.join('\n');
}
