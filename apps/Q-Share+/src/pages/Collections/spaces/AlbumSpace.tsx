import { SpaceHero, SpaceShareList, SpaceShell } from "./SpaceShell";
import type { SpaceProps } from "./types";

/** The album space. */
export default function AlbumSpace(props: SpaceProps) {
  return (
    <SpaceShell space={props.space} hero={<SpaceHero {...props} />}>
      {props.foldersSection}
      {props.emptyState}
      <SpaceShareList items={props.items} isOwner={props.isOwner} onMove={props.onMove} onRemove={props.onRemove} />
    </SpaceShell>
  );
}
