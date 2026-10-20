/**
 * A JSON file as the Explorer shows a raw response (components/explorer/
 * RawJson.tsx): laid out, keys, text and numbers in the theme's colours,
 * every other line striped, Copy. JSON read only in part, too long to lay
 * out quickly, or that doesn't parse shows as text.
 */
import { useMemo } from 'react';
import { RawJson } from '../../RawJson';
import { TextView } from './TextView';

/** Longer JSON shows as plain text (laying out each line costs on a phone). */
export const JSON_MAX_CHARS = 200_000;

export function JsonView({
  text,
  label,
  shown,
  size,
  more,
}: {
  text: string;
  label: string;
  shown: number;
  size: number | null;
  more: boolean;
}) {
  const parsed = useMemo(() => {
    if (more || text.length > JSON_MAX_CHARS) return undefined;
    try {
      return { value: JSON.parse(text) as unknown };
    } catch {
      return undefined;
    }
  }, [text, more]);
  if (!parsed)
    return (
      <TextView
        text={text}
        label={label}
        shown={shown}
        size={size}
        more={more}
        note={
          more || text.length > JSON_MAX_CHARS
            ? undefined
            : 'This file isn’t valid JSON, so it shows as written.'
        }
      />
    );
  return <RawJson value={parsed.value} label={label} caption="The file’s JSON" fill />;
}
