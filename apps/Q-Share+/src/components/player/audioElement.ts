/**
 * The playlist's one <audio> element, made once and kept outside React, so
 * a tap can start it at once (before the player bar has mounted) and it
 * keeps playing while the user moves between pages.
 */
let element: HTMLAudioElement | null = null;
let unlocked = false;

/** 44-byte WAV with no samples: plays instantly and silently. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function playerAudio(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = "auto";
  }
  return element;
}

/**
 * Call from a tap's handler. GO's WebView only lets an element play sound
 * after the user touched something, and a track starts only once the node
 * has it, often seconds later. Playing nothing on this element during the
 * tap lets it play the real tracks then.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  const audio = playerAudio();
  if (audio.getAttribute("src")) {
    unlocked = true;
    return;
  }
  try {
    audio.src = SILENCE;
    const started = audio.play();
    unlocked = true;
    void started?.then(
      () => {
        if (audio.src === SILENCE) audio.pause();
      },
      () => {
        unlocked = false;
      }
    );
  } catch {
    unlocked = false;
  }
}

/** True while the element holds the silent clip rather than a track. */
export function isUnlockClip(audio: HTMLAudioElement): boolean {
  return audio.src === SILENCE;
}

/** For tests. */
export function resetPlayerAudio(): void {
  element = null;
  unlocked = false;
}
