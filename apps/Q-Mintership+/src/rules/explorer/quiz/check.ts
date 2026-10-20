/**
 * Checking an Explorer Quiz answer. Forgiving about how it is typed, strict
 * about what it says:
 *
 * - An account: its address, or any name it owns (looked up through Core,
 *   which ignores case and look-alike letters), or the name the question
 *   knew it by. "@" and quotes around it are ignored.
 * - A number: commas, spaces, "QORT", "%", "#" and "block" are ignored. A
 *   whole number must be exact. An amount may be rounded: typed with at
 *   least 2 decimals (or as many as it has), it is right when the amount
 *   rounds to it ("5.6789" for 5.67890000, "12.3457" for 12.34567891).
 * - Words: ignoring case, spaces and punctuation, any accepted form
 *   ("Name registration", "REGISTER_NAME").
 * - A signature: its first characters (at least the number asked), or all.
 * - A multiple choice: the option picked (one go), or one typed by its words.
 */
import type { QuizAnswer, QuizQuestion } from './types';

const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;

/** Lower case, letters and digits only. */
export function squash(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** What was typed, without "@", quotes and the spaces around it. */
export function cleanAnswer(input: string): string {
  return input
    .trim()
    .replace(/^@/, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim();
}

/** A decimal as digits and one point, or null: "1,234.50 QORT" → "1234.50". */
export function parseNumber(input: string): string | null {
  const text = input
    .toLowerCase()
    .replace(/qort|blocks?|%|#|\s|,/g, '')
    .replace(/^\+/, '');
  return /^-?\d+(\.\d+)?$/.test(text) || /^-?\.\d+$/.test(text) ? text : null;
}

/** "5.67890000" → { int: 5n, frac: "6789" }; exact, no floats. */
function parts(value: string): { negative: boolean; int: bigint; frac: string } {
  const negative = value.startsWith('-');
  const [int, frac = ''] = value.replace(/^-/, '').split('.');
  return { negative, int: BigInt(int || '0'), frac: frac.replace(/0+$/, '') };
}

/** `value` rounded half up to `places` decimals, as "int.frac" with no trailing zeros. */
function rounded(value: string, places: number): string {
  const { negative, int, frac } = parts(value);
  const scale = 10n ** BigInt(places);
  const padded = (frac + '0'.repeat(places + 1)).slice(0, places + 1);
  let scaled = int * scale + BigInt(padded.slice(0, places) || '0');
  if (Number(padded[places]) >= 5) scaled += 1n;
  const whole = scaled / scale;
  const rest = (scaled % scale).toString().padStart(places, '0').replace(/0+$/, '');
  return `${negative && scaled !== 0n ? '-' : ''}${whole}${rest ? `.${rest}` : ''}`;
}

/** The same decimal, written the shortest way. */
function canonical(value: string): string {
  return rounded(value, parts(value).frac.length);
}

export function numberMatches(input: string, expected: string): boolean {
  const typed = parseNumber(input);
  if (typed === null) return false;
  const want = parts(expected);
  const typedPlaces = parts(typed).frac.length;
  if (canonical(typed) === canonical(expected)) return true;
  // A whole number must be exact; an amount may be rounded to 2 or more decimals.
  if (!want.frac) return false;
  if (typedPlaces < Math.min(2, want.frac.length)) return false;
  return canonical(typed) === rounded(expected, typedPlaces);
}

export function textMatches(input: string, accepted: readonly string[]): boolean {
  const typed = squash(cleanAnswer(input));
  return typed !== '' && accepted.some((form) => squash(form) === typed);
}

export function prefixMatches(input: string, signature: string, min: number): boolean {
  const typed = cleanAnswer(input).replace(/[….]+$/, '');
  return typed.length >= Math.min(min, signature.length) && signature.startsWith(typed);
}

/**
 * Whether `input` answers `question`. `ownerOf` looks a name up (its owner's
 * address, or null when nobody has it); it is asked only for an account.
 */
export async function checkAnswer(
  answer: QuizAnswer,
  input: string,
  ownerOf: (name: string) => Promise<string | null>
): Promise<boolean> {
  const typed = cleanAnswer(input);
  if (!typed) return false;
  switch (answer.kind) {
    case 'number':
      return numberMatches(typed, answer.value);
    case 'text':
      return textMatches(typed, answer.accepted);
    case 'prefix':
      return prefixMatches(typed, answer.value, answer.min);
    case 'account': {
      if (ADDRESS_RE.test(typed)) return typed === answer.address;
      if (answer.name && squash(answer.name) === squash(typed)) return true;
      if (typed.length > 40) return false;
      return (await ownerOf(typed)) === answer.address;
    }
    case 'choice':
      return textMatches(typed, [answer.options[answer.correct]?.label ?? '']);
  }
}

/** Whether option `index` is the right one of a multiple-choice answer. */
export function checkChoice(answer: QuizAnswer, index: number): boolean {
  return answer.kind === 'choice' && index === answer.correct;
}

/** The answer in words: "Ravenstone", "5.6789 QORT", "3kxVE6Nq…". */
export function answerWords(question: Pick<QuizQuestion, 'answer'>): string {
  const { answer } = question;
  switch (answer.kind) {
    case 'number': {
      const value = canonical(answer.value);
      const [int, frac] = value.split('.');
      const grouped = BigInt(int.replace('-', '')).toLocaleString('en-US');
      const shown = `${int.startsWith('-') ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
      return answer.unit ? `${shown} ${answer.unit}` : shown;
    }
    case 'text':
      return answer.shown;
    case 'prefix':
      return answer.value;
    case 'account':
      return answer.name ? `${answer.name} (${answer.address})` : answer.address;
    case 'choice':
      return answer.options[answer.correct]?.label ?? '';
  }
}
