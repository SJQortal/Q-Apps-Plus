import { GlobalProvider } from 'qapp-core';
import { publicSalt } from './qapp-config.ts';
import { PendingTxsProvider } from './state/contexts/PendingTxsProvider.tsx';
import { FetchNamesProvider } from './state/contexts/FetchNamesProvider.tsx';
import Layout from './styles/Layout.tsx';

export const AppWrapper = () => {
  return (
    <GlobalProvider
      config={{
        auth: {
          balanceSetting: {
            interval: 180000,
            onlyOnMount: false,
          },
          authenticateOnMount: true,
        },
        publicSalt: publicSalt,
        appName: 'names',
        enableGlobalVideoFeature: false,
      }}
    >
      <FetchNamesProvider>
        <PendingTxsProvider>
          <Layout />
        </PendingTxsProvider>
      </FetchNamesProvider>
    </GlobalProvider>
  );
};
