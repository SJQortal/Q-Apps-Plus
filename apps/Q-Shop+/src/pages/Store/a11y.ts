/**
 * Read by screen readers, not shown (e.g. a heading while its text loads).
 * Sizes in px as strings: in `sx`, a width or height of 1 means 100 %, which
 * made each hidden span a page wide and the Products page scroll sideways.
 */
export const visuallyHiddenSx = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
