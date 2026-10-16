/**
 * A line of text with a name in it ("First QORT payments from Ada⠀"), the
 * name crossed out wherever it appears, as MarkedName does on its own.
 */
import { Fragment, type ReactNode } from 'react';
import { hasBrailleBlank } from '../../rules/markedName';
import { MarkedName } from './MarkedName';

/** `shown` is how the line writes the name, when not as published (dots for blanks). */
export function withMarkedName(
  text: string,
  name: string | null | undefined,
  shown: string | null | undefined = name
): ReactNode {
  if (!hasBrailleBlank(name) || !shown || !text.includes(shown)) return text;
  const parts = text.split(shown);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <MarkedName name={name}>{shown}</MarkedName> : null}
    </Fragment>
  ));
}
