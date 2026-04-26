/**
 * Utility functions for date formatting
 */

/**
 * Formats a date string or Date object to "dd/mm/yyyy, HH:MM"
 * Example: 31/01/2026, 18:14
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return "-";

  const d = new Date(date);
  
  // Check if date is valid
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year}, ${hours}:${minutes}`;
};

/**
 * Formats a date string or Date object to "dd/mm/yyyy"
 * Example: 31/01/2026
 */
export const formatDateOnly = (date: string | Date | null | undefined): string => {
  if (!date) return "-";

  const d = new Date(date);
  
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};
