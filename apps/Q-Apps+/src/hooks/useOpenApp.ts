import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { openApp } from '../qortal/openApp';
import { describeError, NoQortalError } from '../qortal/request';
import { pushRecent, recentAppsAtom } from '../state/settings';
import { useToast } from '../components/Toast';

/** Open an app in Hub/GO, remember it in Recently opened, and explain failures. */
export function useOpenApp() {
  const setRecent = useSetAtom(recentAppsAtom);
  const toast = useToast();
  return useCallback(
    async (name: string) => {
      try {
        await openApp(name);
        setRecent((list) => pushRecent(list, name, Date.now()));
      } catch (error) {
        if (error instanceof NoQortalError) {
          toast(`Open Q-Apps+ inside Qortal Hub or GO to launch ${name}.`, 'info');
        } else {
          toast(`Couldn't open ${name}: ${describeError(error)}`, 'error');
        }
      }
    },
    [setRecent, toast]
  );
}
