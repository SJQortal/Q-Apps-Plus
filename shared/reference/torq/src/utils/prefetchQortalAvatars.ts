import { qortalAvatarUrl } from './mentionSearch';

const MAX_CONCURRENT = 3;
const queued: string[] = [];
const seen = new Set<string>();
let inflight = 0;

function pump() {
  if (typeof Image === 'undefined') return;

  while (inflight < MAX_CONCURRENT && queued.length > 0) {
    const name = queued.shift();
    if (!name) break;
    inflight += 1;
    const image = new Image();
    const done = () => {
      inflight = Math.max(0, inflight - 1);
      pump();
    };
    image.onload = done;
    image.onerror = done;
    image.src = qortalAvatarUrl(name);
  }
}

export function prefetchQortalAvatars(names: string[]) {
  names.forEach((name) => {
    if (!name || name === 'User' || seen.has(name)) return;
    seen.add(name);
    queued.push(name);
  });
  pump();
}

export function resetQortalAvatarPrefetch() {
  queued.length = 0;
  seen.clear();
  inflight = 0;
}
