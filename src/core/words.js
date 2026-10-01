// Korean particles that depend on the word before them: 흰둥이를 but 프리렌을, 흰둥이와 but 프리렌과.
// Names come from people and pet files, so they may end in Hangul, a digit or a Latin letter.
const PAIRS = { '을/를': ['을', '를'], '이/가': ['이', '가'], '은/는': ['은', '는'], '과/와': ['과', '와'] };
// How a final digit is read: 1 일, 2 이, 3 삼, … — those that end in a consonant take 을, 이, 은, 과.
const DIGIT_CLOSED = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };

function endsClosed(word) {
  // Punctuation, brackets and emoji at the end are not read aloud: the particle follows the
  // last letter or digit before them ('프리렌!' is still 프리렌을).
  const letters = [...String(word).trim()].filter(ch => /[\p{L}\p{N}]/u.test(ch));
  const last = letters.pop() || '';
  const code = last.charCodeAt(0);
  // Kana: ん/ン close the syllable; every other kana ends in a vowel.
  if ((code >= 0x3041 && code <= 0x30ff) || code === 0x30fc) return last === 'ん' || last === 'ン';
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/\d/.test(last)) return DIGIT_CLOSED[last];
  // A Latin name is read aloud: one ending in a vowel letter (white, mangu, Anya) takes 를, the rest 을.
  if (/[a-z]/i.test(last)) return !/[aeiouy]/i.test(last);
  return false;
}

// The word with the particle that fits it: withParticle('프리렌', '을/를') → '프리렌을'.
export function withParticle(word, pair) {
  const [closed, open] = PAIRS[pair];
  return `${word}${endsClosed(word) ? closed : open}`;
}
