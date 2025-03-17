/**
 * Email and contact information extractor
 */
import { ScrapedContact } from "./types";

// Regular expression for finding emails
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Regular expression for finding phone numbers (basic pattern)
const PHONE_REGEX =
  /(\+\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

/**
 * Extract emails from text content
 */
export function extractEmails(content: string): string[] {
  const emails = content.match(EMAIL_REGEX) || [];
  return [...new Set(emails)]; // Remove duplicates
}

/**
 * Extract phone numbers from text content
 */
export function extractPhoneNumbers(content: string): string[] {
  const phones = content.match(PHONE_REGEX) || [];
  return [...new Set(phones)]; // Remove duplicates
}

/**
 * Extract name from context around an email
 * This is a heuristic approach that tries to find names near emails
 */
export function extractNameFromContext(
  email: string,
  content: string
): string | undefined {
  // Find the position of the email in the content
  const emailIndex = content.indexOf(email);
  if (emailIndex === -1) return undefined;

  // Get a window of text around the email (100 chars before and after)
  const startIndex = Math.max(0, emailIndex - 100);
  const endIndex = Math.min(content.length, emailIndex + email.length + 100);
  const contextWindow = content.substring(startIndex, endIndex);

  // Look for common name patterns before the email
  // This is a simplified approach - in a real implementation, you might use NLP
  const nameBeforeRegex =
    /([A-Z][a-z]+ [A-Z][a-z]+)[\s\n]*(?=.*?\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)/;
  const nameMatch = contextWindow.match(nameBeforeRegex);

  return nameMatch ? nameMatch[1] : undefined;
}

/**
 * Extract title/position from context around an email or name
 */
export function extractTitleFromContext(
  nameOrEmail: string,
  content: string
): string | undefined {
  // Find the position of the name or email in the content
  const targetIndex = content.indexOf(nameOrEmail);
  if (targetIndex === -1) return undefined;

  // Get a window of text around the target (150 chars before and after)
  const startIndex = Math.max(0, targetIndex - 150);
  const endIndex = Math.min(
    content.length,
    targetIndex + nameOrEmail.length + 150
  );
  const contextWindow = content.substring(startIndex, endIndex);

  // Common job titles in coaching/sports context
  const titlePatterns = [
    /\b(Head Coach|Assistant Coach|Coach|Director|Manager|Coordinator|Instructor|Trainer)\b/i,
    /\b(Figure Skating Director|Hockey Director|Program Director|Athletic Director)\b/i,
    /\b(President|Vice President|CEO|Owner|Founder)\b/i,
  ];

  for (const pattern of titlePatterns) {
    const titleMatch = contextWindow.match(pattern);
    if (titleMatch) return titleMatch[1];
  }

  return undefined;
}

/**
 * Process extracted data into structured contact information
 */
export function processContactData(
  emails: string[],
  content: string,
  url: string,
  includePhoneNumbers: boolean = false
): ScrapedContact[] {
  const contacts: ScrapedContact[] = [];
  const phoneNumbers = includePhoneNumbers ? extractPhoneNumbers(content) : [];

  // Process each email
  for (const email of emails) {
    const name = extractNameFromContext(email, content);
    const title = name
      ? extractTitleFromContext(name, content)
      : extractTitleFromContext(email, content);

    // Create contact object
    const contact: ScrapedContact = {
      email,
      source: url,
    };

    // Add optional fields if available
    if (name) contact.name = name;
    if (title) contact.title = title;

    contacts.push(contact);
  }

  // If we have phone numbers but couldn't associate them with emails,
  // add them as separate contacts
  if (includePhoneNumbers && phoneNumbers.length > 0 && emails.length === 0) {
    for (const phone of phoneNumbers) {
      contacts.push({
        email: "no-email@example.com", // Placeholder
        phone,
        source: url,
      });
    }
  }

  return contacts;
}
