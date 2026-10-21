/**
 * A name in a line of text, isolated from it: in quotes, inside `<bdi>`, so
 * right-to-left marks or label-like words can't change how the line reads,
 * with invisible characters shown as "·" (rules/explorer/nameNotes.ts), and
 * the name's own avatar beside it (`avatar={false}` where the row shows a
 * bigger one).
 */
import { NameWithAvatar } from '../../../../components/explorer/NameWithAvatar';
import { MarkedName } from '../../../../components/common/MarkedName';
import { visibleName } from '../../../../rules/explorer/nameNotes';

export function NameText({
  name,
  quoted = true,
  avatar = true,
}: {
  name: string;
  quoted?: boolean;
  avatar?: boolean;
}) {
  if (avatar) return <NameWithAvatar name={name} quoted={quoted} strong={false} />;
  const shown = (
    <bdi dir="auto">
      <MarkedName name={name}>{visibleName(name)}</MarkedName>
    </bdi>
  );
  return quoted ? <>“{shown}”</> : shown;
}
