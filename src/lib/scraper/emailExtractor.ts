/**
 * Email extraction utilities
 * Focused on extracting real emails only (no guessing)
 */

import { ScrapedContact } from "./types";

// Email regex pattern - comprehensive pattern to detect various email formats
// Comprehensive email regex that matches emails in various formats
const EMAIL_REGEX =
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi;

// Additional patterns to catch emails in JavaScript code, JSON, and other formats
const JS_EMAIL_PATTERNS = [
  /['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
  /[\w]+\s*[:=]\s*['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
  /"email"\s*:\s*['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
  /"contact"\s*:\s*['"]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)['"]/g,
  /data-email="([^"]+)"/g,
  /data-cfemail="([^"]+)"/g,
  /class="__cf_email__[^>]+data-cfemail="([^"]+)"/g,
  /\*protected email\*.*?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g,
];

// Common name patterns for extracting names near emails
const NAME_PATTERNS = [
  /(?:(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s+(?:is|at|email|emails|address|contact|:|-))/i,
];

// Common title patterns to extract job titles and positions
const TITLE_PATTERNS = [
  /(?:is\s+(?:the|an?|our))?\s+([A-Z][a-zA-Z]*(?:\s+[a-zA-Z]+){0,4}(?:Coach|Director|Manager|Trainer|Instructor|Teacher|Head|Assistant|Administrator|Coordinator))/i,
  /(?:Coach|Director|Manager|Trainer|Instructor|Teacher|Head|Assistant|Administrator|Coordinator)(?:\s+[a-zA-Z]+){0,4}/i,
  /([A-Za-z]+\s+(?:Coach|Manager|Director|Trainer|Instructor))/i,
];

// Phone number patterns (US formats primarily)
const PHONE_PATTERNS = [
  /(\+\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
  /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g,
];

/**
 * Extract emails from HTML content with enhanced detection for all content types
 */
export function extractEmails(content: string): string[] {
  // Normalize content by removing extra whitespace
  const normalizedContent = content.replace(/\s+/g, " ");

  // First extract using standard EMAIL_REGEX
  const standardMatches = normalizedContent.match(EMAIL_REGEX) || [];

  // Check for specific common organizational emails that should be prioritized
  const orgEmails = [];
  const infoEmailMatch =
    normalizedContent.match(/info@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g) || [];
  const contactEmailMatch =
    normalizedContent.match(/contact@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g) || [];
  orgEmails.push(...infoEmailMatch, ...contactEmailMatch);

  // Then extract emails from JavaScript code, JSON, etc.
  const jsMatches: string[] = [];
  for (const pattern of JS_EMAIL_PATTERNS) {
    const matches = normalizedContent.match(pattern) || [];
    for (const match of matches) {
      // Clean the match to extract just the email part
      const emailMatch = match.match(
        /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
      );
      if (emailMatch && emailMatch[1]) {
        jsMatches.push(emailMatch[1]);
      }
    }
  }

  // Combine all matches with prioritized emails first
  const allMatches = [...orgEmails, ...standardMatches, ...jsMatches];

  // Filter out invalid/common emails, convert to lowercase, and remove duplicates
  return [
    ...new Set(
      allMatches
        .map((email) => email.toLowerCase().trim())
        .filter((email) => {
          // Filter out common false positives and example emails
          return (
            email.length > 5 && // Skip very short strings
            !email.includes("example.com") &&
            !email.includes("domain.com") &&
            !email.includes("your-email") &&
            !email.includes("someone@") &&
            !email.includes("username@") &&
            !email.startsWith("example@") &&
            !email.startsWith("email@") &&
            !email.startsWith("info@stylesheet") &&
            !email.includes("eslint") &&
            !email.includes("webpack") &&
            !email.includes("babel") &&
            !/\d+\.\d+\.\d+/.test(email) && // Skip version numbers
            email.indexOf("@") === email.lastIndexOf("@") // Ensure only one @ symbol
          );
        })
    ),
  ];
}

/**
 * Extract emails from text content
 */
export function extractEmailsFromText(text: string): string[] {
  // Normalize text
  const normalizedText = text.replace(/\s+/g, " ");

  // Extract all email addresses
  const matches = normalizedText.match(EMAIL_REGEX) || [];

  // Filter out invalid/common emails and convert to lowercase
  return matches
    .map((email) => email.toLowerCase())
    .filter((email) => {
      // Filter out common false positives and example emails
      return (
        !email.includes("example.com") &&
        !email.includes("domain.com") &&
        !email.includes("your-email") &&
        !email.includes("someone@") &&
        !email.includes("username@") &&
        !email.startsWith("example@") &&
        !email.startsWith("email@")
      );
    });
}

/**
 * Extract name from surrounding text of an email
 */
export function extractNameFromEmailContext(
  text: string,
  email: string
): string | null {
  // Get text before email (limited context) for name extraction
  const emailIndex = text.indexOf(email);
  if (emailIndex === -1) return null;

  // Get text before email (limited to reasonable context)
  const textBeforeEmail = text.substring(
    Math.max(0, emailIndex - 100),
    emailIndex
  );

  // Try various patterns to extract name
  for (const pattern of NAME_PATTERNS) {
    const matches = textBeforeEmail.match(pattern);
    if (matches && matches[1]) {
      return matches[1].trim();
    }
  }

  // If we can't find a name in patterns, look for capitalized words
  const capitalizedPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g;
  const capitalizedMatches = textBeforeEmail.match(capitalizedPattern);

  if (capitalizedMatches) {
    // Take the last capitalized phrase as it's likely closest to the email
    return capitalizedMatches[capitalizedMatches.length - 1].trim();
  }

  return null;
}

/**
 * Extract title/position from surrounding text of an email
 */
export function extractTitleFromEmailContext(
  text: string,
  email: string
): string | null {
  // Get text around email for title extraction
  const emailIndex = text.indexOf(email);
  if (emailIndex === -1) return null;

  // Get text around email (limited to reasonable context)
  const contextBefore = text.substring(
    Math.max(0, emailIndex - 150),
    emailIndex
  );
  const contextAfter = text.substring(
    emailIndex,
    Math.min(text.length, emailIndex + 150)
  );
  const combinedContext = contextBefore + " " + contextAfter;

  // Try various patterns to extract title
  for (const pattern of TITLE_PATTERNS) {
    const matches = combinedContext.match(pattern);
    if (matches) {
      // Use the first match, which should be the full title
      return matches[0].trim();
    }
  }

  return null;
}

/**
 * Extract phone numbers from text if enabled
 */
export function extractPhoneNumbers(text: string): string[] {
  const phones: string[] = [];

  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      phones.push(...matches);
    }
  }

  // Remove duplicates
  return [...new Set(phones)];
}

/**
 * Process raw emails into structured contact data
 */
export function processContactData(
  emails: string[],
  content: string,
  sourceUrl: string,
  includePhoneNumbers: boolean = true
): ScrapedContact[] {
  const contacts: ScrapedContact[] = [];

  // Process each email
  for (const email of emails) {
    // Get 300 characters before and after the email for context
    const emailIndex = content.indexOf(email);
    if (emailIndex === -1) continue;

    const startIndex = Math.max(0, emailIndex - 300);
    const endIndex = Math.min(content.length, emailIndex + 300);
    const context = content.substring(startIndex, endIndex);

    // Extract name and title from context
    const name = extractNameFromEmailContext(context, email);
    const title = extractTitleFromEmailContext(context, email);

    // Extract phone if enabled
    let phone: string | undefined = undefined;
    if (includePhoneNumbers) {
      const phones = extractPhoneNumbers(context);
      if (phones.length > 0) {
        phone = phones[0]; // Use the first phone number found in context
      }
    }

    // Add to contacts
    contacts.push({
      email,
      name: name || undefined,
      title: title || undefined,
      phone,
      source: sourceUrl,
      confidence: "Confirmed",
    });
  }

  return contacts;
}

/**
 * Extract obfuscated emails that might be encoded or split in the HTML
 * This handles common obfuscation techniques like character entities
 */
export function extractObfuscatedEmails(content: string): string[] {
  const emails: string[] = [];

  // Look for common obfuscation patterns
  // Pattern 1: HTML encoded entities (&#64; for @, etc.)
  const encodedPattern =
    /([a-zA-Z0-9._-]+)(?:&#64;|&#0*64;|%40)([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;

  while ((match = encodedPattern.exec(content)) !== null) {
    const email = `${match[1]}@${match[2]}`;
    emails.push(email.toLowerCase());
  }

  // Pattern 2: Email split across multiple elements
  // This is harder to detect with regex alone, but we can look for common patterns
  const scriptPatterns = [
    /document\.write\('([^']+)'\s*\+\s*'([^']+)'\)/g,
    /document\.write\("([^"]+)"\s*\+\s*"([^"]+)"\)/g,
    /\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*['"]([^'"]+)['"]/g,
    /\w+\(['"]([^'"]*@[^'"]*)['"]\)/g,
  ];

  for (const pattern of scriptPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      if (match.length >= 3) {
        // For patterns with captured groups
        const combined = match[1] + match[2];
        const emailMatch = combined.match(EMAIL_REGEX);
        if (emailMatch) {
          emails.push(emailMatch[0].toLowerCase());
        }
      } else if (match.length === 2) {
        // For patterns with a single captured group
        const potentialEmail = match[1];
        if (potentialEmail.includes("@")) {
          // Extract just the email part if there's other text
          const emailMatch = potentialEmail.match(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
          );
          if (emailMatch && emailMatch[1]) {
            emails.push(emailMatch[1].toLowerCase());
          }
        }
      }
    }
  }

  // Pattern 3: CloudFlare Email Protection
  const cfPattern = /data-cfemail="([a-f0-9]+)"/g;
  while ((match = cfPattern.exec(content)) !== null) {
    try {
      // Try to decode CloudFlare encoded email
      const decoded = decodeCFEmail(match[1]);
      if (decoded && decoded.includes("@")) {
        emails.push(decoded.toLowerCase());
      }
    } catch {
      // Ignore decoding errors
    }
  }

  return [...new Set(emails)]; // Return unique emails
}

/**
 * Decode CloudFlare email protection encoding
 * Based on the CloudFlare protection algorithm
 */
function decodeCFEmail(encodedString: string): string {
  try {
    let email = "";
    const r = parseInt(encodedString.substring(0, 2), 16);
    let n, i;

    for (n = 2; encodedString.length - n; n += 2) {
      i = parseInt(encodedString.substring(n, n + 2), 16) ^ r;
      email += String.fromCharCode(i);
    }

    return email;
  } catch {
    return "";
  }
}
