/**
 * A name in a line of text, isolated from it: in quotes, inside `<bdi>`, so
 * right-to-left marks or label-like words can't change how the line reads,
 * with invisible characters shown as "·" (rules/explorer/nameNotes.ts).
 */
import { visibleName } from '../../../../rules/explorer/nameNotes';

export function NameText({ name, quoted = true }: { name: string; quoted?: boolean }) {
  const shown = <bdi dir="auto">{visibleName(name)}</bdi>;
  return quoted ? <>“{shown}”</> : shown;
}
