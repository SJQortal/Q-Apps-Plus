/** How a Minter Admin poll's answer colours are said and drawn. */
import type { AnswerTone } from '../../data/adminPollRecords';

export const TONE_WORDS: Record<AnswerTone, string> = {
  green: 'Green',
  red: 'Red',
  neutral: 'Neutral (grey)',
};

/** The palette colour of a tone, for its dot and chip. */
export const TONE_COLOUR: Record<AnswerTone, string> = {
  green: 'success.main',
  red: 'error.main',
  neutral: 'text.secondary',
};
