/** The original app accepted any JSON body; kept as the single place to tighten this later. */
export const checkStructure = (_content: unknown): boolean => {
  return true;
};
