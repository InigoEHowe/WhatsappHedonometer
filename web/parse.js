// Reads an exported WhatsApp chat. Handles the formats WhatsApp currently produces:
//   Android: 04/11/2026, 14:32 - Name: Message       (or 11/4/26, 2:32 PM - Name: Message)
//   iPhone:  [04/11/2026, 14:32:05] Name: Message    (or [11/4/26, 2:32:05 PM] Name: Message)
// Day/month order is detected automatically from the dates in the file.

const LINE_START = /^\[?(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s?([AaPp]\.?\s?[Mm]\.?)?(?:\]\s?|\s-\s)(.*)$/;
const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;
const MEDIA = /^(<Media omitted>|(image|video|audio|sticker|GIF|document|Contact card) omitted|<attached: .*>)$/i;
const DELETED = /^(This message was deleted|You deleted this message)$/;
const SYSTEM = ['Messages and calls are end-to-end encrypted', 'Missed voice call', 'Missed video call',
  'Waiting for this message', 'Your security code with'];

function cleanLine(line) {
  return line.replace(INVISIBLE, '').replace(/[  ]/g, ' ').trim();
}

export function parseChat(text, dayFirst = null) {
  const raw = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    const m = LINE_START.exec(line);
    if (m) {
      const rest = m[8];
      const i = rest.indexOf(': ');
      raw.push({ d1: +m[1], d2: +m[2], y: +m[3], h: +m[4], min: +m[5], s: +(m[6] || 0),
        ampm: (m[7] || '').replace(/[.\s]/g, '').toUpperCase(),
        author: i > 0 ? rest.slice(0, i) : null, text: i > 0 ? rest.slice(i + 2) : rest });
    } else if (raw.length && line) {
      raw[raw.length - 1].text += '\n' + line; // Continuation of a multi-line message
    }
  }
  if (!raw.length) throw new Error("No messages found. Is this an exported WhatsApp chat (.txt or .zip)?");

  // Work out if dates are day/month or month/day. If nothing settles it, assume day/month
  if (dayFirst === null) {
    const firstBig = raw.some(r => r.d1 > 12), secondBig = raw.some(r => r.d2 > 12);
    dayFirst = !(secondBig && !firstBig);
  }

  const messages = [];
  for (const r of raw) {
    if (!r.author) continue; // e.g. 'Alice added Bob'
    let text = r.text.replace('<This message was edited>', '').trim();
    if (SYSTEM.some(s => text.startsWith(s))) continue;
    const day = dayFirst ? r.d1 : r.d2, month = dayFirst ? r.d2 : r.d1;
    const year = r.y < 100 ? r.y + 2000 : r.y;
    let hour = r.h;
    if (r.ampm) hour = (hour % 12) + (r.ampm === 'PM' ? 12 : 0);
    const date = new Date(year, month - 1, day, hour, r.min, r.s);
    if (isNaN(date)) continue;
    const media = MEDIA.test(text), deleted = DELETED.test(text);
    messages.push({ date, author: r.author, text: media || deleted ? '' : text, media, deleted });
  }
  messages.sort((a, b) => a.date - b.date);
  return { messages, dayFirst };
}

// iPhone exports come as a .zip holding _chat.txt
export async function readChatFile(file) {
  if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
    const zip = await window.JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find(f => /\.txt$/i.test(f.name) && !f.dir);
    if (!entry) throw new Error('No .txt chat found inside that zip');
    return entry.async('string');
  }
  return file.text();
}
