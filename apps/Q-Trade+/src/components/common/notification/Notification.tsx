import { useContext, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { Zoom } from "react-toastify";
import { NotificationContext } from "../../../contexts/notificationContext";
import "react-toastify/dist/ReactToastify.css";

export const Notification = () => {
  
  const { notification } = useContext(NotificationContext);

  useEffect(() => {
    if (notification?.alertType === "alertError") {
      toast.error(`❌ ${notification?.msg}`, {
        position: "bottom-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        toastId: "error",
      });
    }
    if (notification?.alertType === "alertSuccess") {
      toast.success(`✔️ ${notification?.msg}`, {
        position: "bottom-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        toastId: "success",
      });
    }
  }, [notification]);

  return (
    <ToastContainer
      transition={Zoom}
      position="bottom-right"
      autoClose={false}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      draggable
      pauseOnHover
      
    />
  );
};

