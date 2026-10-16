import { useSetAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import { useGlobal } from 'qapp-core';
import {
  forSaleAtom,
  forSaleStatusAtom,
  namesAtom,
  namesStatusAtom,
} from '../state/global/names';
import { fetchAccountNames, fetchNamesForSale } from '../api/names';
import { usePendingTxs } from './useHandlePendingTxs';
import { useFetchNames } from './useFetchNames';
import { useVisiblePolling } from './useVisiblePolling';

export const FOR_SALE_REFRESH_MS = 120_000;

export const useHandleNameData = () => {
  const setNamesForSale = useSetAtom(forSaleAtom);
  const setForSaleStatus = useSetAtom(forSaleStatusAtom);
  const setNames = useSetAtom(namesAtom);
  const setNamesStatus = useSetAtom(namesStatusAtom);
  const address = useGlobal().auth.address;
  const { clearPendingTxs } = usePendingTxs();
  const { fetchPrimaryName } = useFetchNames();
  const forSaleLoadedRef = useRef(false);

  const loadNamesForSale = useCallback(async () => {
    const firstLoad = !forSaleLoadedRef.current;
    if (firstLoad) setForSaleStatus('loading');
    try {
      // First load paints page by page; a refresh swaps the list in once, complete.
      await fetchNamesForSale({
        onPage: (rows, done) => {
          if (firstLoad || done) setNamesForSale(rows);
        },
      });
      forSaleLoadedRef.current = true;
      setForSaleStatus('ready');
    } catch (error) {
      console.error(error);
      if (!forSaleLoadedRef.current) setForSaleStatus('error');
      throw error;
    }
  }, [setNamesForSale, setForSaleStatus]);

  const loadMyNames = useCallback(async () => {
    if (!address) return;
    setNamesStatus((status) => (status === 'ready' ? 'ready' : 'loading'));
    try {
      const res = await fetchAccountNames(address);
      clearPendingTxs(
        'REGISTER_NAME',
        'name',
        res.map((item) => item.name)
      );
      setNames(res);
      setNamesStatus('ready');
      fetchPrimaryName(address);
    } catch (error) {
      console.error(error);
      setNamesStatus((status) => (status === 'ready' ? 'ready' : 'error'));
    }
  }, [address, setNames, setNamesStatus, clearPendingTxs, fetchPrimaryName]);

  // The market refreshes every 2 minutes, only while the tab is visible.
  useVisiblePolling(loadNamesForSale, FOR_SALE_REFRESH_MS);
  // The account's names load once per address (the original did the same).
  useVisiblePolling(loadMyNames, Number.MAX_SAFE_INTEGER, Boolean(address));

  return { reloadNamesForSale: loadNamesForSale, reloadMyNames: loadMyNames };
};
