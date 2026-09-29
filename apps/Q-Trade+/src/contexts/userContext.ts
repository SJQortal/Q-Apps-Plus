import { createContext } from 'react';

export interface UserContextProps {
  avatar: string;
  setAvatar: (avatar: string) => void;
}

export const UserContext = createContext<UserContextProps>({
  avatar: '',
  setAvatar: () => {},
});


