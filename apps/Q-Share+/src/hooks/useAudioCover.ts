import { useEffect, useState } from "react";
import { isOnNode } from "../components/common/ShareArt";
import { nodeReader, readEmbeddedCover } from "../utils/audioCover";

interface AudioFileRef {
  name: string;
  identifier: string;
}

/** Tracks read at once: a page of 50 rows shouldn't ask the node for 50 files together. */
const AT_ONCE = 3;
let running = 0;
const waiting: Array<() => void> = [];

async function inTurn<T>(job: () => Promise<T>): Promise<T> {
  if (running >= AT_ONCE) await new Promise<void>((go) => waiting.push(go));
  running += 1;
  try {
    return await job();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

// Answers for the session: a file's art never changes under its identifier
// without a new publish, and object URLs here live as long as the page.
const known = new Map<string, Promise<string | null>>();

/**
 * An object URL for the cover art inside a track the node already holds, or
 * null when it has none. A track that isn't on the node isn't fetched for its
 * art (that's the user's Download or Play), and is asked about again later.
 */
export function audioCoverUrl(file: AudioFileRef, onNode = false): Promise<string | null> {
  const key = `${file.name}/${file.identifier}`;
  const held = known.get(key);
  if (held) return held;
  const url = `/arbitrary/FILE/${encodeURIComponent(file.name)}/${encodeURIComponent(file.identifier)}`;
  const answer = inTurn(async () => {
    if (!onNode && !(await isOnNode(file))) {
      known.delete(key);
      return null;
    }
    const cover = await readEmbeddedCover(nodeReader(url));
    return cover ? URL.createObjectURL(new Blob([cover.bytes as BlobPart], { type: cover.type })) : null;
  }).catch(() => {
    // The node couldn't serve it just now.
    known.delete(key);
    return null;
  });
  known.set(key, answer);
  return answer;
}

/** For tests. */
export function resetAudioCovers(): void {
  known.clear();
}

/**
 * The cover inside `file`, once `enabled` (in view, previews on); null until
 * and unless there is one. `fetched`: this session's download of it finished,
 * so look again at once.
 */
export function useAudioCover(file: AudioFileRef | null | undefined, enabled: boolean, fetched = false): string | null {
  const key = file ? `${file.name}/${file.identifier}` : null;
  const [found, setFound] = useState<{ key: string; url: string } | null>(null);
  const name = file?.name;
  const identifier = file?.identifier;
  useEffect(() => {
    if (!enabled || !key || !name || !identifier) return;
    let active = true;
    void audioCoverUrl({ name, identifier }, fetched).then((url) => {
      if (active && url) setFound({ key, url });
    });
    return () => {
      active = false;
    };
  }, [enabled, key, name, identifier, fetched]);
  return found && found.key === key ? found.url : null;
}
