// What an AI wrote, made ready to show. Models answer in Markdown whether asked to or not, so the
// common part of it is read here: emphasis, code, headings and lists. Nothing here makes HTML:
// the text comes out as pieces, and the page builds its own elements from them.
// No lookbehind in the patterns: older system webviews do not know it.
import { language, t } from './i18n.js';
import { SENTENCES } from './strings.js';

const INLINE =
  /(`+)([^`\n]+?)\1|\*\*(?!\s)([^\n]+?)\*\*|__(?!\s)([^\n]+?)__|\*(?!\s)([^*\n]+?)\*|_(?!\s)([^_\n]+?)_|\[([^\]\n]+)\]\([^)\s]+\)/g;
const wordy = character => /\w/.test(character || '');
// One line as pieces of text, each plain or {bold}, {italic} or {code}. A link keeps only its words.
export function inline(text) {
  const pieces = [];
  let last = 0;
  const push = (part, style) => {
    if (part) pieces.push(style ? { text: part, [style]: true } : { text: part });
  };
  for (const match of text.matchAll(INLINE)) {
    const [whole, , code, stars, unders, star, under, link] = match;
    const body = code ?? stars ?? unders ?? star ?? under ?? link;
    const style =
      code !== undefined
        ? 'code'
        : stars !== undefined || unders !== undefined
          ? 'bold'
          : link !== undefined
            ? null
            : 'italic';
    if (style === 'bold' || style === 'italic') {
      // The closing mark hugs the text, and an underscore inside a word (snake_case) is just a letter.
      if (/\s$/.test(body)) continue;
      if (whole[0] === '_' && (wordy(text[match.index - 1]) || wordy(text[match.index + whole.length]))) continue;
    }
    push(text.slice(last, match.index));
    push(body, style);
    last = match.index + whole.length;
  }
  push(text.slice(last));
  return pieces;
}
// The whole text as blocks, a line each: {type:'text'|'heading'|'item', inline} or {type:'code', text}.
export function blocks(text) {
  const found = [];
  let code = null;
  for (const line of String(text ?? '').split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) {
        found.push({ type: 'code', text: code.join('\n') });
        code = null;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/),
      item = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/);
    if (heading) found.push({ type: 'heading', inline: inline(heading[1]) });
    else if (item) found.push({ type: 'item', marker: item[1] ? `${item[1]}.` : '•', inline: inline(item[2]) });
    else found.push({ type: 'text', inline: inline(line) });
  }
  // A fence left open still holds what was written in it.
  if (code) found.push({ type: 'code', text: code.join('\n') });
  return found;
}
// The same text with the marks taken out, for speech bubbles and other places that show plain text.
export const plain = text =>
  blocks(text)
    .map(b =>
      b.type === 'code'
        ? b.text
        : (b.type === 'item' ? `${b.marker} ` : '') + b.inline.map(piece => piece.text).join(''),
    )
    .join('\n');
// What to say while an answer is on its way. It changes only a few times, so it can be read aloud.
// What a failure says on screen. The backend already speaks in full sentences; anything else
// (a script error, an engine message) is wrapped in one, with the original kept for a report.
// Each language file says how a sentence in it is recognised (strings/<lang>.js `sentence`).
export function spoken(error, fallback) {
  const raw = (typeof error === 'string' ? error : error?.message || '').trim();
  if (raw && (error?.spoken || SENTENCES[language()].test(raw))) return raw;
  return raw ? t('error.with_detail', { sentence: fallback, detail: raw }) : fallback;
}
export function waitingLine(seconds) {
  if (seconds < 6) return t('wait.short');
  if (seconds < 30) return t('wait.mid');
  return t('wait.long');
}
