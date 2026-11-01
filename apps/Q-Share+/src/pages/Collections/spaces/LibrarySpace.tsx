import { SpaceHero, SpaceShareList, SpaceShell } from "./SpaceShell";
import type { SpaceProps } from "./types";

/** The library space. */
export default function LibrarySpace(props: SpaceProps) {
  return (
    <SpaceShell space={props.space} hero={<SpaceHero {...props} />}>
      {props.foldersSection}
      {props.emptyState}
      <SpaceShareList items={props.items} isOwner={props.isOwner} onMove={props.onMove} onRemove={props.onRemove} />
    </SpaceShell>
  );
}
