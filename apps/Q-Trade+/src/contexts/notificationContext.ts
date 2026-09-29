import { createContext } from 'react';

interface AlertTypes {
  alertSuccess: string;
  alertError: string;
  alertInfo: string;
}

export interface NotificationProps {
  alertType: keyof AlertTypes | '';
  msg: string;
}

interface NotificationContextProps {
  notification: NotificationProps;
  setNotification: (notification: NotificationProps) => void;
  resetNotification: () => void;
}

export const NotificationContext = createContext<NotificationContextProps>({
  notification: { alertType: '', msg: ''},
  setNotification: () => {},
  resetNotification: () => {},
});
