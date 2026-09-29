// This function extracts the store title of the identifier string
export const extractStoreTitle = (identifier: string): string => {
  // Split the identifier string by the '-post-' delimiter
    // Split the identifier string by the '-general-' delimiter
    const parts = identifier.split('-general-');
    // Remove any hyphens from the parts[1] value
    const shopTitle = (parts[1] || '').replace(/-/g, '');
    return shopTitle;
}
