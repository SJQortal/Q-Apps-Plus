import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface NameRecord {
  name: string;
  owner: string;
}

interface User {
  address: string;
  publicKey: string;
  name?: string;
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
  },
});

export const { addUser } = authSlice.actions;

export default authSlice.reducer;