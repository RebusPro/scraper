/**
 * Enhanced email and contact information extractor
 */
import { ScrapedContact } from "./types";

// Improved regular expression for finding emails
// Added lookaheads to exclude common false positives
const EMAIL_REGEX =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?!\.(?:png|jpg|jpeg|gif|svg|webp))\b/g;

// Regular expression for finding phone numbers (more precise pattern)
const PHONE_REGEX =
  /(?:(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?))?\d{3}[-.\s]?\d{4}(?!\d)/g;

// This regex is more restrictive to avoid treating numeric sequences as phone numbers
// Ignore formats that are likely not real phone numbers
const IGNORE_PHONE_PATTERNS = [
  /\d{10,}/, // Long numeric sequences
  /\d{4,}[-.\s]\d{4,}/, // Format like 1234-5678 (probably not a phone number)
  /\d{1,3}[-.\s]\d{4,}(?!\d)/, // Format like 1-12345
  /\d{4}[-.\s]\d{2,3}(?!\d)/, // Format like 1024-512
  /\d{2,3}[-.\s]\d{2,3}[-.\s]\d{2,3}/, // Format like 12-34-56 (dates/IDs)
  /\b20\d{2}[01]\d[0-3]\d\b/, // Dates like 20150101
  /\d{6,}/, // Any number with 6+ consecutive digits
  /\d{3,}[-.\s]\d{3,}/, // Any pattern with 3+ digits on each side of separator
];

// Common false positive patterns for emails
const UI_TEXT_FALSE_POSITIVES = [
  "password@",
  "email@",
  "username@",
  "login@",
  "user@",
  "account@",
  "${email}@",
  "(email)@",
  "[email]@",
  "your-email@",
];

// Common image and asset file patterns
const IMAGE_ASSET_PATTERNS = [
  "@2x",
  "@3x",
  "@4x",
  ".yji-",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".asset",
];

/**
 * Extract emails from text content with enhanced filtering
 */
export function extractEmails(content: string): string[] {
  // Extract potential emails
  const emails = content.match(EMAIL_REGEX) || [];

  // Filter out tracking/monitoring and non-contact emails
  const filteredEmails = emails.filter((email) => {
    // Skip if it's a non-contact email or contains UI text patterns
    if (isNonContactEmail(email)) return false;

    // Skip common image asset filenames
    if (containsImageAssetPattern(email)) return false;

    // Skip UI text false positives
    if (containsUITextPattern(email)) return false;

    // Skip emails with very long local parts (before @) that are likely not real
    const localPart = email.split("@")[0];
    if (localPart && localPart.length > 30) return false;

    return true;
  });

  return [...new Set(filteredEmails)]; // Remove duplicates
}

/**
 * Check if an email contains patterns common in image and asset filenames
 */
function containsImageAssetPattern(email: string): boolean {
  for (const pattern of IMAGE_ASSET_PATTERNS) {
    if (email.includes(pattern)) return true;
  }
  return false;
}

/**
 * Check if an email contains UI text patterns that are common false positives
 */
function containsUITextPattern(email: string): boolean {
  for (const pattern of UI_TEXT_FALSE_POSITIVES) {
    if (email.includes(pattern)) return true;
  }

  // Check for common UI text surrounding emails
  const domain = email.split("@")[1];
  const isProbablyUIText = [
    "example.com",
    "domain.com",
    "yourdomain.com",
    "email.com",
    "mail.com",
    "website.com",
  ].includes(domain);

  return isProbablyUIText;
}

/**
 * Check if an email is likely a tracking/monitoring/system email rather than a contact
 */
export function isNonContactEmail(email: string): boolean {
  // Common non-contact email domains
  const blockedDomains = [
    "sentry.io",
    "sentry-next.wixpress.com",
    "sentry.wixpress.com",
    "wixpress.com",
    "example.com",
    "no-reply",
    "noreply",
    "donotreply",
    "no-response",
    "postmaster",
    "mailer-daemon",
    "placeholder.invalid", // Used for our own placeholder emails
  ];

  // Check for blocked domains
  for (const domain of blockedDomains) {
    if (email.includes(domain)) return true;
  }

  // Check for UUID-like patterns (common in tracking/monitoring emails)
  // e.g.: 8c4075d5481d476e945486754f783364@sentry.io
  if (/^[0-9a-f]{8,}[@]/.test(email)) return true;

  // Check for long random hexadecimal strings (often tracking)
  if (/^[0-9a-f]{16,}/.test(email)) return true;

  // Check for random/generated strings pattern
  if (/^[a-zA-Z0-9]{10,}@/.test(email) && !/[._-]/.test(email.split("@")[0]))
    return true;

  return false;
}

/**
 * Extract phone numbers from text content
 */
export function extractPhoneNumbers(content: string): string[] {
  // Extract potential phone numbers
  const potentialPhones = content.match(PHONE_REGEX) || [];

  // Filter out patterns that are likely not phone numbers
  const validPhones = potentialPhones.filter((phone) => {
    // Check if it matches any of the ignore patterns
    for (const pattern of IGNORE_PHONE_PATTERNS) {
      if (pattern.test(phone)) {
        return false;
      }
    }

    // Additional validation
    // Remove all non-digits
    const digitsOnly = phone.replace(/\D/g, "");

    // Valid phone numbers should have between 7 and 15 digits (international standard)
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return false;
    }

    // Check for repeating patterns (like 111-111-1111)
    if (/^(\d)\1+$/.test(digitsOnly)) {
      return false;
    }

    // Check for sequential patterns (like 123-456-7890)
    if (/123456/.test(digitsOnly) || /654321/.test(digitsOnly)) {
      return false;
    }

    // Check if the "phone number" is actually likely a version number or ID
    // These often have patterns like x.y.z or v1.2.3
    if (content.indexOf(phone) > 0) {
      const indexOfPhone = content.indexOf(phone);
      const charBefore = content.charAt(indexOfPhone - 1);
      if (charBefore === "v" || charBefore === "V" || charBefore === ".") {
        return false;
      }
    }

    return true;
  });

  return [...new Set(validPhones)]; // Remove duplicates
}

/**
 * Extract name from context around an email - Enhanced with multiple patterns
 */
export function extractNameFromContext(
  email: string,
  content: string
): string | undefined {
  // Find the position of the email in the content
  const emailIndex = content.indexOf(email);
  if (emailIndex === -1) return undefined;

  // Get a window of text around the email (250 chars before and after - increased window size)
  const startIndex = Math.max(0, emailIndex - 250);
  const endIndex = Math.min(content.length, emailIndex + email.length + 250);
  const contextWindow = content.substring(startIndex, endIndex);

  // Multiple name pattern strategies

  // 1. Common format: "Name - Title"
  const dashFormatMatch = contextWindow.match(
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*-\s*[A-Za-z\s]+/
  );
  if (dashFormatMatch) return dashFormatMatch[1];

  // 2. Common format: "Title: Name"
  const colonFormatMatch = contextWindow.match(
    /(?:Coach|Director|Coordinator|Manager|Instructor|Trainer)(?::|s?:)?\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/i
  );
  if (colonFormatMatch) return colonFormatMatch[1];

  // 3. Standard name before email pattern
  const nameBeforeRegex =
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)[\s\n]*(?=.*?\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)/;
  const nameMatch = contextWindow.match(nameBeforeRegex);
  if (nameMatch) return nameMatch[1];

  // 4. Common format: Name followed by email on next line
  const nameAboveEmailRegex =
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*[\r\n]+\s*[\r\n]*\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const nameAboveMatch = contextWindow.match(nameAboveEmailRegex);
  if (nameAboveMatch) return nameAboveMatch[1];

  // 5. Name in brackets or parentheses
  const bracketNameRegex = /[\(\[\{]([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)[\)\]\}]/;
  const bracketMatch = contextWindow.match(bracketNameRegex);
  if (bracketMatch) return bracketMatch[1];

  return undefined;
}

/**
 * Extract title/position from context around an email or name - Enhanced version
 */
export function extractTitleFromContext(
  nameOrEmail: string,
  content: string
): string | undefined {
  // Find the position of the name or email in the content
  const targetIndex = content.indexOf(nameOrEmail);
  if (targetIndex === -1) return undefined;

  // Get a wider window of text around the target (250 chars before and after)
  const startIndex = Math.max(0, targetIndex - 250);
  const endIndex = Math.min(
    content.length,
    targetIndex + nameOrEmail.length + 250
  );
  const contextWindow = content.substring(startIndex, endIndex);

  // Multiple title pattern strategies

  // 1. Common format: "Name - Title"
  const dashFormatMatch = contextWindow.match(
    /[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\s*-\s*([A-Za-z\s&]+?)(?:[\r\n]|$|,|\.|<)/
  );
  if (dashFormatMatch && dashFormatMatch[1]?.trim())
    return dashFormatMatch[1].trim();

  // 2. Common format: "Title: Name"
  const titleBeforeNameRegex =
    /([A-Za-z\s&]+(?:Coach|Director|Coordinator|Manager|Instructor|Trainer))(?::|s?:)?\s+[A-Z][a-z]+/i;
  const titleBeforeMatch = contextWindow.match(titleBeforeNameRegex);
  if (titleBeforeMatch) return titleBeforeMatch[1].trim();

  // 3. Common job titles in coaching/sports context - enhanced list
  const titlePatterns = [
    /\b(Head Coach|Assistant Coach|Coach|Director|Manager|Coordinator|Instructor|Trainer)\b/i,
    /\b(Figure Skating Director|Hockey Director|Program Director|Athletic Director|Learn to Skate Coordinator)\b/i,
    /\b(President|Vice President|CEO|Owner|Founder|Administrator|Supervisor)\b/i,
    /\b(Program Manager|Skating School Director|Youth Hockey Director|Staff Coach)\b/i,
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
    // Skip emails that are likely UI text or false positives
    if (containsUITextPattern(email) || email.includes("${email}")) {
      continue;
    }

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

  // If we have phone numbers but couldn't associate them with emails
  if (includePhoneNumbers && phoneNumbers.length > 0) {
    // ONLY include actual phone numbers if:
    // 1. There are real emails found OR
    // 2. There are fewer than 5 phone numbers AND they pass additional validation

    // If emails were found, it's likely a legitimate page with contact info
    // Only add phone-only entries if there are few of them
    if (emails.length > 0 && phoneNumbers.length < 5) {
      for (const phone of phoneNumbers) {
        // Sanitize the phone number to use only digits for the email address
        const sanitizedPhone = phone.replace(/\D/g, "");
        contacts.push({
          email: `phone-only-${sanitizedPhone}@placeholder.invalid`,
          phone,
          source: url,
        });
      }
    }
    // If no emails but very few phone numbers (1-3) that look like US/Canada format, they might be real
    else if (emails.length === 0 && phoneNumbers.length < 4) {
      // Additional strict validation for phone-only cases
      const highlyLikelyPhones = phoneNumbers.filter((phone) => {
        // Must match common US/Canada formats
        return (
          /(\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}/.test(
            phone
          ) &&
          // Must not look like a date
          !/\b(19|20)\d{2}\b/.test(phone)
        );
      });

      // Only if we have 1-2 highly likely phone numbers
      if (highlyLikelyPhones.length > 0 && highlyLikelyPhones.length < 3) {
        for (const phone of highlyLikelyPhones) {
          // Sanitize the phone number to use only digits for the email address
          const sanitizedPhone = phone.replace(/\D/g, "");
          contacts.push({
            email: `phone-only-${sanitizedPhone}@placeholder.invalid`,
            phone,
            source: url,
          });
        }
      }
    }
  }

  return contacts;
}
