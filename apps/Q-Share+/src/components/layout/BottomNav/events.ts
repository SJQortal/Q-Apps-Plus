/**
 * The phone bottom bar's Downloads item asks the component that owns the
 * downloads view (DownloadTaskManager) to open it. The listener should call
 * `event.preventDefault()` to say it handled the request; otherwise the bar
 * falls back to navigating home, where the header's downloads button lives.
 *
 *   window.addEventListener(OPEN_DOWNLOADS_EVENT, (e) => { e.preventDefault(); open(); });
 */
export const OPEN_DOWNLOADS_EVENT = "qshareplus:open-downloads";

/** Dispatches the event; returns true when a listener handled it. */
export function requestOpenDownloads(): boolean {
  const event = new CustomEvent(OPEN_DOWNLOADS_EVENT, { cancelable: true });
  return !window.dispatchEvent(event);
}
