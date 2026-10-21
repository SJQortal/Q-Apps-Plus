/**
 * What the Connections circle puts first and draws biggest: the most
 * transactions (the default) or the most QORT (Simon, 2026-10-18), kept on
 * this device (`<prefix>connections-circle-order`), as Circle or List is
 * (useConnectionsView).
 */
import { useState } from 'react';
import { STORAGE_PREFIX } from '../../../../constants/plus';
import type { CircleOrder } from '../../../../rules/explorer/circle';

const KEY = `${STORAGE_PREFIX}connections-circle-order`;

function stored(): CircleOrder {
  try {
    return window.localStorage.getItem(KEY) === 'qort' ? 'qort' : 'count';
  } catch {
    return 'count';
  }
}

export function useCircleOrder(): [CircleOrder, (order: CircleOrder) => void] {
  const [order, setOrder] = useState<CircleOrder>(stored);
  const choose = (next: CircleOrder) => {
    setOrder(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Kept for this visit only.
    }
  };
  return [order, choose];
}
