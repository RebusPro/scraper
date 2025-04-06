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

/**
 * Extract a person's name from text content
 * Uses common patterns found in coaching websites
 * @param text Text content to extract name from
 * @returns Extracted name or undefined if no name found
 */
export function getNameFromText(text: string): string | undefined {
  if (!text) return undefined;

  // Try multiple name extraction patterns

  // Pattern 1: Capitalized words (2-3 in sequence) that look like a name
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/;
  const nameMatch = text.match(namePattern);
  if (nameMatch) return nameMatch[1];

  // Pattern 2: "Name - Title" format
  const dashPattern =
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*-\s*[A-Za-z\s]+/;
  const dashMatch = text.match(dashPattern);
  if (dashMatch) return dashMatch[1];

  // Pattern 3: "Title: Name" format
  const colonPattern =
    /(?:Coach|Director|Manager|Instructor|Coordinator)(?::|s?:)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i;
  const colonMatch = text.match(colonPattern);
  if (colonMatch) return colonMatch[1];

  // Pattern 4: Name in parentheses
  const parenthesesPattern = /\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\)/;
  const parenthesesMatch = text.match(parenthesesPattern);
  if (parenthesesMatch) return parenthesesMatch[1];

  return undefined;
}

/**
 * Extract a title or position from text content
 * Uses common patterns found in coaching websites
 * @param text Text content to extract title from
 * @returns Extracted title or undefined if no title found
 */
export function getTitleFromText(text: string): string | undefined {
  if (!text) return undefined;

  // Common coaching titles to look for
  const commonTitles = [
    "Head Coach",
    "Assistant Coach",
    "Coach",
    "Director",
    "Program Director",
    "Hockey Director",
    "Figure Skating Director",
    "Skating Director",
    "Manager",
    "Coordinator",
    "Learn to Skate Coordinator",
    "Learn to Skate Director",
    "Instructor",
    "Skating Instructor",
    "Hockey Instructor",
    "Trainer",
    "President",
    "Vice President",
    "Owner",
    "Founder",
  ];

  // Pattern 1: Direct title match
  const titlePattern = new RegExp(`\\b(${commonTitles.join("|")})\\b`, "i");
  const titleMatch = text.match(titlePattern);
  if (titleMatch) return titleMatch[1];

  // Pattern 2: "Name - Title" format
  const dashPattern =
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\s*-\s*([A-Za-z\s&]+?)(?:[\r\n]|$|,|\.|<)/;
  const dashMatch = text.match(dashPattern);
  if (dashMatch && dashMatch[1]?.trim()) return dashMatch[1].trim();

  // Pattern 3: "Title: Name" format (reverse of Pattern 2)
  const colonPattern =
    /\b([A-Za-z\s&]+?(?:Coach|Director|Manager|Instructor|Coordinator))(?::|s?:)?\s+[A-Z][a-z]+/i;
  const colonMatch = text.match(colonPattern);
  if (colonMatch) return colonMatch[1].trim();

  // Pattern 4: Title following "is a" or "is the" or "serves as"
  const isThePattern =
    /(?:is(?:\s+a|\s+the)?|serves\s+as)\s+([A-Za-z\s&]+?(?:Coach|Director|Manager|Instructor|Coordinator|President|Owner))/i;
  const isTheMatch = text.match(isThePattern);
  if (isTheMatch) return isTheMatch[1].trim();

  return undefined;
}

/**
 * Clean up text content for better extraction
 * Removes extra spaces, newlines, and trims
 * @param text Text to clean
 * @returns Cleaned text
 */
export function cleanTextContent(text: string): string {
  if (!text) return "";

  return text
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .trim(); // Trim whitespace
}
