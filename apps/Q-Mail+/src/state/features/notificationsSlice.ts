import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AlertTypes {
  alertSuccess: string
  alertError: string
  alertInfo: string
}

/**
 * Qortal names quoted in each message, so the toast can strike impostor
 * names (NameText). Plain strings: redux holds no React nodes.
 */
interface AlertNames {
  alertSuccess: string[]
  alertError: string[]
  alertInfo: string[]
}

interface InitialState {
  alertTypes: AlertTypes;
  alertNames: AlertNames;
}

const noNames: AlertNames = { alertSuccess: [], alertError: [], alertInfo: [] }

const initialState: InitialState = {
  alertTypes: {
    alertSuccess: '',
    alertError: '',
    alertInfo: ''
  },
  alertNames: noNames
}

const ALERT_KEYS: Record<string, keyof AlertTypes> = {
  success: 'alertSuccess',
  error: 'alertError',
  info: 'alertInfo',
}

export const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotification: (
      state: InitialState,
      action: PayloadAction<{ alertType: string; msg: string; names?: string[] }>
    ) => {
      const key = ALERT_KEYS[action.payload.alertType];
      if (!key) return state;
      return {
        ...state,
        alertTypes: { ...state.alertTypes, [key]: action.payload.msg },
        alertNames: { ...(state.alertNames || noNames), [key]: action.payload.names || [] },
      };
    },
    removeNotification: (state: InitialState) => {
      return {
        ...state,
        alertTypes: {
          ...state.alertTypes,
          alertSuccess: '',
          alertError: '',
          alertInfo: ''
        },
        alertNames: noNames
      }
    },
  },
});

export const { setNotification, removeNotification } =
  notificationsSlice.actions;

export default notificationsSlice.reducer;
