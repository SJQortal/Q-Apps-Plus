import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { Market } from './pages/Market';
import { AppWrapper } from './AppWrapper';

// Use a custom type if you need it
interface CustomWindow extends Window {
  _qdnBase: string;
}
const customWindow = window as unknown as CustomWindow;
const baseUrl = customWindow?._qdnBase || '';

export function Routes() {
  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: <AppWrapper />,
        children: [
          {
            index: true,
            element: <App />,
          },
          {
            path: 'market',
            element: <Market />,
          },
        ],
      },
    ],
    {
      basename: baseUrl,
    }
  );

  return <RouterProvider router={router} />;
}
