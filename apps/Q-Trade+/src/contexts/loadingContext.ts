import { createContext } from 'react';

interface LoadingContextProps {
  loadingSlider: boolean;
  setLoadingSlider: (loading: boolean) => void;
}

export const LoadingContext = createContext<LoadingContextProps>({
  loadingSlider: false,
  setLoadingSlider: () => {},
});
