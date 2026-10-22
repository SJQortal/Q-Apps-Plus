import { Box, Chip } from "@mui/material";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { countLabel, statusLabel, type StatusCounts, type StatusFilter } from "../status";

/**
 * Status filters with counts over the loaded orders ("3+" while more pages
 * exist). Toggle buttons (aria-pressed), wrapping rather than scrolling
 * sideways, 44 px tall on phones.
 */
export function StatusFilterBar({
  value,
  onChange,
  counts,
  total,
  more,
  role,
  statusesLoading = false,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: StatusCounts;
  total: number;
  more: boolean;
  role: "buyer" | "seller";
  /** Some statuses are still being read: their counts would be too low, so they wait. */
  statusesLoading?: boolean;
}) {
  const options: { value: StatusFilter; label: string; count: number | null }[] = [
    { value: "all", label: "All", count: total },
    { value: "Received", label: statusLabel("Received", role), count: statusesLoading ? null : counts.Received },
    { value: "Shipped", label: "Shipped", count: statusesLoading ? null : counts.Shipped },
    { value: "Refunded", label: "Refunded", count: statusesLoading ? null : counts.Refunded },
  ];
  return (
    <Box role="group" aria-label="Filter by status" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Chip
            key={option.value}
            component="button"
            clickable
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            label={option.count === null ? `${option.label} · …` : `${option.label} · ${countLabel(option.count, more)}`}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            sx={{
              height: 36,
              fontWeight: 600,
              [`@media ${PHONE_MEDIA}`]: { height: 44, borderRadius: 22, px: 0.5 },
              "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          />
        );
      })}
    </Box>
  );
}
