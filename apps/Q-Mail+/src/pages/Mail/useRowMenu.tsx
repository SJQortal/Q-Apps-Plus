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

  // Gone once the close transition ends: no closed menu stays mounted per row
  // (a phone sheet keeps touch listeners on the document while mounted).
  const unmount = useCallback(() => setMenu(previous => (previous && !previous.open ? null : previous)), []);
  // While it fades out the menu keeps the items it opened with: an action
  // that changes the row (Mark as read) must not flip the label on the way out.
  const shown = useRef<RowMenuContent | null>(null);

  const renderMenu = (content: (subject: T) => RowMenuContent): ReactNode => {
    if (!menu) {
      shown.current = null;
      return null;
    }
    if (menu.open || !shown.current) shown.current = content(menu.subject);
    const { actions, title, ariaLabel } = shown.current;
    return (
      <Suspense fallback={null}>
        <MessageRowMenu
          open={menu.open}
          point={menu.point}
          onClose={close}
          onExited={unmount}
          actions={actions}
          title={title}
          ariaLabel={ariaLabel}
        />
      </Suspense>
    );
  };

  return { triggerFor, renderMenu, isOpen: Boolean(menu?.open) };
}
