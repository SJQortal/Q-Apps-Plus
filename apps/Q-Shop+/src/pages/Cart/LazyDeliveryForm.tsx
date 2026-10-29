import { Suspense, type ComponentProps } from "react";
import { Box, Skeleton } from "@mui/material";
import { lazyWithRetry } from "../../utils/lazyWithRetry";

const DeliveryForm = lazyWithRetry(() => import("./DeliveryForm").then((m) => ({ default: m.DeliveryForm })));

/** Shaped like the form while it loads. */
function DeliveryFormSkeleton() {
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }} aria-busy="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} variant="rounded" height={56} sx={i < 2 ? { gridColumn: "1 / -1" } : undefined} />
      ))}
    </Box>
  );
}

/**
 * The delivery form, loaded when a physical order first needs it: digital
 * orders never download the form, its Autocomplete or the country lists.
 */
export function LazyDeliveryForm(props: ComponentProps<typeof DeliveryForm>) {
  return (
    <Suspense fallback={<DeliveryFormSkeleton />}>
      <DeliveryForm {...props} />
    </Suspense>
  );
}
