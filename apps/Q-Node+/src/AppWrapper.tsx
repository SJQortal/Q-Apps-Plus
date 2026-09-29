import { GlobalProvider } from 'qapp-core';
import Layout from './styles/Layout';
import { publicSalt } from './qapp-config';
import { TIME_MINUTES_3_IN_MILLISECONDS } from './common/constants';

export const AppWrapper = () => {

  return (
    <GlobalProvider
      config={{
        appName: 'Q-Node',
        auth: {
          balanceSetting: {
            interval: TIME_MINUTES_3_IN_MILLISECONDS,
            onlyOnMount: false,
          },
          authenticateOnMount: true,
        },
        publicSalt: publicSalt,
      }}
    >
      <Layout />
    </GlobalProvider>
  );
};
