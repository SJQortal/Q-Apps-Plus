import { errorMessage } from './hubErrors';

/** A readable reason from any error shape (Core, Hub, fetch). */
export function friendlyError(error: unknown): string {
  const text = errorMessage(error, '');
  if (!text) return '';
  if (/Failed to fetch|NetworkError|Load failed/i.test(text)) return "Your node didn't answer.";
  if (/^Core (5\d\d)/.test(text)) return 'Your node had a problem answering.';
  if (/^Core 404/.test(text)) return 'Your node doesn’t have this yet.';
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
