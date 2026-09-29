import { useRef, useState } from 'react';

interface State {
    isShow: boolean;
}
export const useModal = () => {
    const [state, setState] = useState<State>({
        isShow: false,
    });
    const promiseConfig = useRef<any>(null);
    const show = async () => {
        return new Promise((resolve, reject) => {
            promiseConfig.current = {
                resolve,
                reject,
            };
            setState({
                isShow: true,
            });
        });
    };

    const hide = () => {
        setState({
            isShow: false,
        });
    };

    const onOk = (payload?:any) => {
        const { resolve } = promiseConfig.current;
        hide();
        resolve(payload);
    };

    const onCancel = () => {
        const { reject } = promiseConfig.current;
        hide();
        reject();
    };
    return {
        show,
        onOk,
        onCancel,
        isShow: state.isShow
    };
};