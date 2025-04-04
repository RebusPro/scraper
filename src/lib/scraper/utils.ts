/**
 * Utility functions for the scraper
 */

/**
 * Sleep function to pause execution for a specified duration
 * @param ms Time to sleep in milliseconds
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
