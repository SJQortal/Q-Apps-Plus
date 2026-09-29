import { useRef, useState, useCallback, useMemo } from 'react';

interface State {
  isShow: boolean;
}

export type ModalFunctions<
  TData = { name: string },
  TResult = unknown,
> = ReturnType<typeof useModal<TData, TResult>>;

export type ModalFunctionsAvatar<
  TData = { name: string; hasAvatar: boolean },
  TResult = unknown,
> = ReturnType<typeof useModal<TData, TResult>>;

export type ModalFunctionsSellName<
  TData = unknown,
  TResult = unknown,
> = ReturnType<typeof useModal<TData, TResult>>;

export const useModal = <TData = unknown, TResult = unknown>() => {
  const [state, setState] = useState<State>({ isShow: false });
  const [data, setData] = useState<TData | undefined>(undefined);

  const promiseConfig = useRef<{
    resolve: (value: TResult) => void;
    reject: () => void;
  } | null>(null);

  const show = useCallback((inputData?: TData): Promise<TResult> => {
    if (inputData !== undefined && inputData !== null) {
      setData(inputData);
    }
    return new Promise((resolve, reject) => {
      promiseConfig.current = { resolve, reject };
      setState({ isShow: true });
    });
  }, []);

  const hide = useCallback(() => {
    setState({ isShow: false });
    setData(undefined);
  }, []);

  const onOk = useCallback(
    (result: TResult) => {
      const { resolve } = promiseConfig.current || {};
      hide();
      resolve?.(result);
    },
    [hide]
  );

  const onCancel = useCallback(() => {
    const { reject } = promiseConfig.current || {};
    hide();
    reject?.();
  }, [hide]);

  return useMemo(
    () => ({
      show,
      onOk,
      onCancel,
      isShow: state.isShow,
      data,
    }),
    [show, onOk, onCancel, state.isShow, data]
  );
};
