import { useOutletContext } from 'react-router-dom';

export interface NameDataActions {
  reloadNamesForSale: () => Promise<void>;
  reloadMyNames: () => Promise<void>;
}

/** The reload actions Layout provides to its pages through the router outlet. */
export function useNameData(): NameDataActions {
  return useOutletContext<NameDataActions>();
}
