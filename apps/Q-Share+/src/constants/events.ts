/**
 * DOM events that let the shell talk to dialogs it does not own.
 * Dispatch on window; listeners live in the component that owns the dialog.
 */
export const OPEN_PUBLISH_EVENT = "qshareplus:open-publish";

export function requestOpenPublish(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PUBLISH_EVENT));
}
