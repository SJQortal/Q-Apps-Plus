/**
 * A form's error under its fields, scrolled into view when it appears, so a
 * phone user who pressed the bottom bar's button sees what is wrong.
 */
import { useEffect, useRef } from "react";
import { Alert } from "@mui/material";

export function FormError({ message }: { message: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [message]);
  if (!message) return null;
  return (
    <Alert severity="error" role="alert" ref={ref}>
      {message}
    </Alert>
  );
}
