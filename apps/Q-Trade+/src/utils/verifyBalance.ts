import { NotificationProps } from "../contexts/notificationContext";

export const verifyBalance = async (
  userInfo: any,
  setNotification: (notification: NotificationProps) => void,
  setLoading: (loading: boolean) => void
): Promise<boolean> => {
  setLoading(true);
  try {
    if (!userInfo?.address) {
      setNotification({
        alertType: "alertError",
        msg: "Please connect your wallet",
      });
      setLoading(false);
      return false;
    }

    const balanceUrl: string = `/addresses/balance/${userInfo?.address}`;
    const balanceResponse = await fetch(balanceUrl);
    const balanceData = await balanceResponse.text();
    const balanceNumber = Number(balanceData);

    if (isNaN(balanceNumber) || balanceNumber < 1) {
      setNotification({
        alertType: "alertError",
        msg: "You need at least 1 QORT to play",
      });
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  } catch (error) {
    setNotification({
      alertType: "alertError",
      msg: "An error occurred while checking the balance",
    });
    setLoading(false);
    return false;
  }
};
