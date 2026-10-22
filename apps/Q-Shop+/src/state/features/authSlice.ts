import { createSlice } from '@reduxjs/toolkit';

export interface NameRecord {
  name: string;
  owner: string;
}

export interface User {
  address: string;
  publicKey: string;
  /** The name the app acts as: the one chosen in the name switcher, else the primary name, else the first. */
  name?: string;
  /** Every name the account owns. */
  names?: NameRecord[];
}

interface AuthState {
  user: User | null;
}
const initialState: AuthState = {
  user: null
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    addUser: (state, action) => {
      state.user = action.payload;
    },
    setActiveName: (state, action) => {
      if (state.user) state.user.name = action.payload;
    },
  },
});

export const { addUser, setActiveName } = authSlice.actions;

export default authSlice.reducer;
