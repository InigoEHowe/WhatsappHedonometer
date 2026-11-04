// Games: guess who sent a message, or when
import { state, $, esc, who, fmtDate, selected, colourOf } from './ui.js';

const game = { mode: 'who', score: 0, played: 0, streak: 0, best: 0, current: null, answered: false };

function pool() {
  return selected().filter(m => m.words.length >= 5 && m.text.length <= 260 && !/https?:\/\//.test(m.text));
}

export function newRound() {
  const p = pool();
  if (!p.length) { $('quiz-q').textContent = 'Not enough messages to play with!'; $('quiz-a').innerHTML = ''; return; }
  game.current = p[Math.floor(Math.random() * p.length)];
  game.answered = false;
  // Hide names inside the message so it isn't too easy
  let text = game.current.text;
  for (const n of state.names) for (const part of n.split(/\s+/).filter(w => w.length > 2)) text = text.replaceAll(part, '█████');
  $('quiz-q').textContent = '“' + text + '”';
  $('quiz-result').innerHTML = '';
  const options = game.mode === 'who' ? state.names.slice(0, 6) : years();
  $('quiz-a').innerHTML = options.map(o => `<button class="btn quiz-btn" data-v="${esc(o)}" ${game.mode === 'who' ? `style="border-bottom:4px solid ${colourOf(o)}"` : ''}>${esc(o)}</button>`).join('');
}

const years = () => [...new Set(selected().map(m => String(m.date.getFullYear())))];

function answer(v) {
  if (game.answered || !game.current) return;
  game.answered = true;
  const m = game.current;
  const right = game.mode === 'who' ? v === m.author : v === String(m.date.getFullYear());
  game.played++;
  if (right) { game.score++; game.streak++; game.best = Math.max(game.best, game.streak); } else game.streak = 0;
  for (const b of $('quiz-a').children) b.classList.toggle('correct', game.mode === 'who' ? b.dataset.v === m.author : b.dataset.v === String(m.date.getFullYear()));
  $('quiz-result').innerHTML = `${right ? '<span class="yes">✅ CORRECT!!</span>' : '<span class="no">❌ Nope!</span>'} It was ${who(m.author)} on ${fmtDate(m.date)}.`;
  $('quiz-score').textContent = `Score ${game.score}/${game.played} · streak ${game.streak} · best streak ${game.best}`;
}

export function setupGames() {
  $('quiz-a').addEventListener('click', e => { const b = e.target.closest('button'); if (b) answer(b.dataset.v); });
  $('quiz-next').addEventListener('click', newRound);
  $('quiz-mode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $('quiz-mode').children) x.classList.toggle('on', x === b);
    game.mode = b.dataset.v; game.score = game.played = game.streak = 0;
    $('quiz-score').textContent = '';
    newRound();
  });
}

export function renderGames() {
  $('quiz-mode').querySelector('[data-v=when]').hidden = years().length < 2;
  if (!game.current || !state.names.includes(game.current.author)) newRound();
}
