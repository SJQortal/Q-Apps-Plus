/**
 * A list's row menu: the trigger (right click, menu key, long press) and the
 * menu, loaded in its own chunk the first time it opens. `triggerFor(subject)`
 * gives the handlers for one row or group, so one menu can serve a whole list
 * of group headers; `renderMenu` builds the items for whichever opened it.
 */
import { Suspense, useCallback, useRef, useState, type ReactNode } from "react";
import { useContextMenuTrigger, type ContextMenuTriggerHandlers, type MenuPoint } from "../../hooks/useContextMenuTrigger";
import { lazyNamed } from "../../components/common/lazyNamed";
import type { RowMenuAction } from "./rowMenuActions";

const loadMessageRowMenu = () => import("./MessageRowMenu");
const MessageRowMenu = lazyNamed(loadMessageRowMenu, "MessageRowMenu");

export interface RowMenuContent {
  actions: RowMenuAction[];
  /** Above the items on phones; names go through NameText, so impostors stay struck. */
  title?: ReactNode;
  ariaLabel: string;
}

export function useRowMenu<T = undefined>() {
  const [menu, setMenu] = useState<{ open: boolean; point: MenuPoint; subject: T } | null>(null);
  const pending = useRef<T | undefined>(undefined);
  const trigger = useContextMenuTrigger(point => setMenu({ open: true, point, subject: pending.current as T }));
  const close = useCallback(() => setMenu(previous => (previous ? { ...previous, open: false } : previous)), []);

  const triggerFor = (subject: T): ContextMenuTriggerHandlers => ({
    ...trigger,
    onContextMenu: event => {
      pending.current = subject;
      trigger.onContextMenu(event);
    },
    onTouchStart: event => {
      pending.current = subject;
      trigger.onTouchStart(event);
    },
  });

  const renderMenu = (content: (subject: T) => RowMenuContent): ReactNode => {
    if (!menu) return null;
    const { actions, title, ariaLabel } = content(menu.subject);
    return (
      <Suspense fallback={null}>
        <MessageRowMenu open={menu.open} point={menu.point} onClose={close} actions={actions} title={title} ariaLabel={ariaLabel} />
      </Suspense>
    );
  };

  return { triggerFor, renderMenu, isOpen: Boolean(menu?.open) };
}
