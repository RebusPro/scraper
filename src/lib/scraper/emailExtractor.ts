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

// Common false positive patterns for emails - expanded list
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
  "Reset password",
  "confirm email",
  "email address",
  "check your email",
  "login email",
  "email cannot be",
  "valid email",
  "confirmation email",
  "click here to",
  "check your inbox",
  "sign up with email",
  "resend confirmation",
  "verification",
  "authentication",
  "newsletter",
  "double check",
  "spam folder",
  "feedback",
  "unavailable",
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

// Common library/dependency authors - emails that often appear in JavaScript files
const LIBRARY_AUTHOR_EMAILS = [
  "jason.dobry@gmail.com",
  "dave@bradshaw.net",
  "ryan.schuft@gmail.com",
  "robert@broofa.com",
  "emn178@gmail.com",
  "feross@feross.org",
  "jloup@gzip.org",
  "madler@alumni.caltech.edu",
  "jack@greensock.com",
  "jason.mulligan@avoidwork.com",
  "dan.walmsley@automattic.com",
  "support@webspellchecker.net",
  "ariel@mashraki.co.il",
  "feross@feross.org",
  "cohara87@gmail.com",
  "support@nettracing.com",
  "stefan.gustavson@liu.se",
  "team@latofonts.com",
  "impallari@gmail.com",
  "semobile@sportsengine.com",
  "support@tourneymachine.com",
  "todd@teamsideline.com",
  "sales@teamsideline.com",
  "support@teamsideline.com",
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

    // Skip library author emails
    if (isLibraryAuthorEmail(email)) return false;

    // Skip emails with very long local parts (before @) that are likely not real
    const localPart = email.split("@")[0];
    if (localPart && localPart.length > 30) return false;

    // Skip placeholder elements from forms
    if (
      content.includes(`value="${email}"`) ||
      content.includes(`placeholder="${email}"`) ||
      content.includes(`placeholder="name@example.com"`)
    ) {
      return false;
    }

    return true;
  });

  return [...new Set(filteredEmails)]; // Remove duplicates
}

/**
 * Check if an email is from a known library author
 */
function isLibraryAuthorEmail(email: string): boolean {
  return LIBRARY_AUTHOR_EMAILS.includes(email.toLowerCase());
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
  const lowerEmail = email.toLowerCase();

  // Check for common UI text fragments
  for (const pattern of UI_TEXT_FALSE_POSITIVES) {
    if (lowerEmail.includes(pattern.toLowerCase())) return true;
  }

  // Check for common UI text surrounding emails
  const domain = email.split("@")[1];
  if (!domain) return true; // No domain part

  const isProbablyUIText = [
    "example.com",
    "domain.com",
    "yourdomain.com",
    "email.com",
    "mail.com",
    "website.com",
    "test.com",
    "mailservice.com",
  ].includes(domain.toLowerCase());

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
    "googleapis.com", // Google API endpoints
    "doubleclick.net", // Ad tracking
    "googletagmanager.com", // Tracking
    "google-analytics.com", // Analytics
  ];

  // Check for blocked domains
  for (const domain of blockedDomains) {
    if (email.toLowerCase().includes(domain)) return true;
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

  // Get a window of text around the email (350 chars before and after - even larger window size)
  const startIndex = Math.max(0, emailIndex - 350);
  const endIndex = Math.min(content.length, emailIndex + email.length + 350);
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

  // 3. Standard name before email pattern with closer proximity
  const nameBeforeRegex =
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})(?:[\s\n]*){1,5}(?:\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)/;
  const nameMatch = contextWindow.match(nameBeforeRegex);
  if (nameMatch) return nameMatch[1];

  // 4. Common format: Name followed by email on next line
  const nameAboveEmailRegex =
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*[\r\n]+\s*[\r\n]*\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const nameAboveMatch = contextWindow.match(nameAboveEmailRegex);
  if (nameAboveMatch) return nameAboveMatch[1];

  // 5. Email followed by Name (reversed pattern)
  const nameAfterEmailRegex =
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[\s\n]*){1,5}([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/;
  const nameAfterMatch = contextWindow.match(nameAfterEmailRegex);
  if (nameAfterMatch) return nameAfterMatch[1];

  // 6. Name in brackets or parentheses near email
  const bracketNameRegex = /[\(\[\{]([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)[\)\]\}]/;
  const bracketMatch = contextWindow.match(bracketNameRegex);
  if (bracketMatch) return bracketMatch[1];

  // 7. Extract potential name from the email itself (firstname.lastname@domain.com)
  const localPart = email.split("@")[0];
  if (localPart && localPart.includes(".")) {
    const nameParts = localPart.split(".");
    if (
      nameParts.length === 2 &&
      nameParts[0].length > 2 &&
      nameParts[1].length > 2 &&
      !/\d/.test(localPart)
    ) {
      // Convert firstname.lastname to Firstname Lastname
      return nameParts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

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

  // Get a wider window of text around the target (350 chars before and after)
  const startIndex = Math.max(0, targetIndex - 350);
  const endIndex = Math.min(
    content.length,
    targetIndex + nameOrEmail.length + 350
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
    /([A-Za-z\s&]+(?:Coach|Director|Coordinator|Manager|Instructor|Trainer|President|Owner))(?::|s?:)?\s+[A-Z][a-z]+/i;
  const titleBeforeMatch = contextWindow.match(titleBeforeNameRegex);
  if (titleBeforeMatch) return titleBeforeMatch[1].trim();

  // 3. Title in surrounding text - expanded list of sports coaching positions
  const sportsTitles = [
    "Head Coach",
    "Assistant Coach",
    "Coach",
    "Director",
    "Manager",
    "Coordinator",
    "Instructor",
    "Trainer",
    "Supervisor",
    "Figure Skating Director",
    "Hockey Director",
    "Program Director",
    "Athletic Director",
    "Learn to Skate Coordinator",
    "Skating Manager",
    "President",
    "Vice President",
    "CEO",
    "Owner",
    "Founder",
    "Administrator",
    "Program Manager",
    "Skating School Director",
    "Youth Hockey Director",
    "Staff Coach",
    "Ice Training Lead",
    "Hockey Manager",
    "Youth Hockey Coordinator",
    "Adult Hockey Coordinator",
    "Special Events Manager",
    "Facilities Manager",
    "Operations Coordinator",
    "Skating School Lead",
    "Skate Coordinator",
  ];

  // Generate regex pattern for all sport titles with word boundaries
  const titlePattern = new RegExp(`\\b(${sportsTitles.join("|")})\\b`, "i");
  const titleMatch = contextWindow.match(titlePattern);
  if (titleMatch) return titleMatch[1];

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
    if (
      containsUITextPattern(email) ||
      email.includes("${email}") ||
      isLibraryAuthorEmail(email)
    ) {
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
