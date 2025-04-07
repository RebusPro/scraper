/**
 * Enhanced email extraction with improved reliability for coach scraping
 * This module adds better filtering and detection specifically for coaching emails
 */

import { ScrapedContact } from "./types";

/**
 * Extract emails from HTML content with improved accuracy and coach-specific targeting
 */
export function extractCoachEmails(
  content: string,
  url: string,
  includePhoneNumbers = true
): ScrapedContact[] {
  const contacts: ScrapedContact[] = [];

  // Extract all potential emails
  const emailMatches = extractAllEmails(content);

  // Process and filter emails
  for (const email of emailMatches) {
    // Skip invalid/generic emails
    if (!isValidCoachEmail(email)) continue;

    // Try to extract name context
    const name = findNameNearEmail(content, email) || undefined;

    // Try to extract title context
    const title = findTitleNearEmail(content, email) || undefined;

    // Extract phone if requested
    let phone = undefined;
    if (includePhoneNumbers) {
      phone = findPhoneNearEmail(content, email) || undefined;
    }

    contacts.push({
      email,
      name,
      title,
      phone,
      source: url,
      confidence: "Confirmed",
    });
  }

  // Specifically look for mailto links which often have higher quality data
  const mailtoEmails = extractMailtoEmails(content);
  for (const match of mailtoEmails) {
    const { email, name } = match;

    // Skip if already found or invalid
    if (!isValidCoachEmail(email) || contacts.some((c) => c.email === email)) {
      continue;
    }

    // Find more context
    const title = findTitleNearEmail(content, email) || undefined;

    let phone = undefined;
    if (includePhoneNumbers) {
      phone = findPhoneNearEmail(content, email) || undefined;
    }

    contacts.push({
      email,
      name: name || undefined,
      title,
      phone,
      source: url,
      confidence: "Confirmed",
    });
  }

  return contacts;
}

/**
 * Extract all potential email addresses from content
 */
function extractAllEmails(content: string): string[] {
  // Remove common false positives
  const cleanedContent = content
    .replace(/example\.[a-z]+@[a-z]+\.[a-z]+/gi, "") // example.com@example.com
    .replace(/your-?email@[a-z]+\.[a-z]+/gi, "") // your-email@example.com
    .replace(/user@example\.[a-z]+/gi, ""); // user@example.com

  // Match general email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = cleanedContent.match(emailRegex) || [];

  return [...new Set(matches.map((email) => email.toLowerCase()))];
}

/**
 * Extract emails specifically from mailto links
 */
function extractMailtoEmails(
  content: string
): { email: string; name?: string }[] {
  const results: { email: string; name?: string }[] = [];

  // Look for mailto links with regex
  const mailtoRegex = /<a[^>]*href=["']mailto:([^?"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = mailtoRegex.exec(content)) !== null) {
    const email = match[1].toLowerCase();
    let name = "";

    // Try to extract name from link text
    const linkText = match[2].replace(/<[^>]*>/g, "").trim();

    // If link text is not the email address itself, it might be a name
    if (linkText && !linkText.includes("@") && linkText !== email) {
      name = linkText;
    }

    results.push({ email, name });
  }

  return results;
}

/**
 * Validate if an email is likely a real coach email and not a generic or false positive
 */
export function isValidCoachEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  // Basic email format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;

  // Filter out technical emails unlikely to be actual coaches
  const technicalDomains = [
    "googleapis.com",
    "googleusercontent.com",
    "jsdelivr.net",
    "fontawesome.com",
    "jquery.com",
    "github.io",
    "cloudflare.com",
    "w3.org",
    "youtube.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
  ];

  for (const domain of technicalDomains) {
    if (email.endsWith(`@${domain}`)) return false;
  }

  // Filter out common false positives and generic addresses
  const invalidKeywords = [
    // Example emails
    "example",
    "sample",
    "test",
    "demo",
    "yourname",
    "your.name",
    "your-name",
    "your_name",
    "youremail",
    "your.email",
    "your-email",
    "your_email",
    "username",
    "user.name",
    "user-name",
    "user_name",

    // Technical emails
    "webmaster",
    "hostmaster",
    "postmaster",
    "admin",
    "debug",
    "dev",
    "null",
    "void",
    "query",

    // Numbers that look like version numbers
    /^\d+\.\d+@/,

    // File extensions
    ".jpg@",
    ".png@",
    ".gif@",
    ".js@",
    ".css@",
    ".html@",
  ];

  const lowerEmail = email.toLowerCase();

  // Check for disqualifying patterns
  for (const pattern of invalidKeywords) {
    if (typeof pattern === "string") {
      if (lowerEmail.includes(pattern)) return false;
    } else if (pattern instanceof RegExp) {
      if (pattern.test(lowerEmail)) return false;
    }
  }

  return true;
}

/**
 * Find name context near an email in HTML content
 */
function findNameNearEmail(content: string, email: string): string | null {
  // First look for common name patterns near the email
  const emailIndex = content.indexOf(email);
  if (emailIndex === -1) return null;

  // Get context around the email (500 chars before and after)
  const start = Math.max(0, emailIndex - 500);
  const end = Math.min(content.length, emailIndex + 500);
  const context = content.substring(start, end);

  // Look for common name patterns
  const namePatterns = [
    // Name: John Smith
    /[Nn]ame:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,

    // Contact: John Smith
    /[Cc]ontact:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,

    // Coach: John Smith
    /[Cc]oach:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,

    // <strong>John Smith</strong>
    /<strong>([A-Z][a-z]+\s+[A-Z][a-z]+)<\/strong>/,

    // Plain First Last pattern near email
    /([A-Z][a-z]+\s+[A-Z][a-z]+)/,
  ];

  for (const pattern of namePatterns) {
    const match = context.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Find title/position near an email in HTML content
 */
function findTitleNearEmail(content: string, email: string): string | null {
  const emailIndex = content.indexOf(email);
  if (emailIndex === -1) return null;

  // Get context around the email
  const start = Math.max(0, emailIndex - 500);
  const end = Math.min(content.length, emailIndex + 500);
  const context = content.substring(start, end);

  // Common coaching titles
  const titlePatterns = [
    // Title: Head Coach
    /[Tt]itle:?\s*([^<\n,]+)/,

    // Position: Assistant Coach
    /[Pp]osition:?\s*([^<\n,]+)/,

    // Role: Director
    /[Rr]ole:?\s*([^<\n,]+)/,

    // Head Coach, Assistant Coach, etc.
    /((?:Head|Assistant|Associate|Director|Lead|Senior|Junior|Volunteer|Program)\s+(?:Coach|Director|Instructor|Manager|Coordinator))/,
  ];

  for (const pattern of titlePatterns) {
    const match = context.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Find phone number near an email in HTML content
 */
function findPhoneNearEmail(content: string, email: string): string | null {
  const emailIndex = content.indexOf(email);
  if (emailIndex === -1) return null;

  // Get context around the email
  const start = Math.max(0, emailIndex - 500);
  const end = Math.min(content.length, emailIndex + 500);
  const context = content.substring(start, end);

  // US/Canada phone patterns
  const phonePatterns = [
    // (123) 456-7890
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/,

    // 123-456-7890
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,

    // Phone: 123-456-7890
    /[Pp]hone:?\s*(\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
  ];

  for (const pattern of phonePatterns) {
    const match = context.match(pattern);
    if (match) {
      return match[0].replace(/[Pp]hone:?\s*/, "").trim();
    }
  }

  return null;
}

/**
 * Handle various forms of email obfuscation
 */
export function extractObfuscatedEmails(content: string): string[] {
  const emails: string[] = [];

  // Cloudflare email protection
  const cfEmailPattern = /___cf_email___.*?data-cfemail="([^"]+)"/g;
  let match;
  while ((match = cfEmailPattern.exec(content)) !== null) {
    try {
      const decoded = decodeCloudflareEmail(match[1]);
      if (decoded) emails.push(decoded);
    } catch {}
  }

  // WordPress email encoder
  const wpEmailPattern = /data-enc-email="([^"]+)"/g;
  while ((match = wpEmailPattern.exec(content)) !== null) {
    try {
      const decoded = decodeWordPressEmail(match[1]);
      if (decoded) emails.push(decoded);
    } catch {}
  }

  // HTML entity encoding
  const entityEncodedPattern = /&#(\d+);&#(\d+);&#(\d+);&#(\d+);/g;
  while ((match = entityEncodedPattern.exec(content)) !== null) {
    try {
      let decodedString = "";
      for (let i = 1; i < match.length; i++) {
        decodedString += String.fromCharCode(parseInt(match[i], 10));
      }

      if (decodedString.includes("@")) {
        const emailMatch = decodedString.match(
          /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
        );
        if (emailMatch) emails.push(emailMatch[0]);
      }
    } catch {}
  }

  return [...new Set(emails)]; // Return unique emails
}

/**
 * Decode Cloudflare protected email
 */
function decodeCloudflareEmail(encodedEmail: string): string | null {
  try {
    const key = parseInt(encodedEmail.substring(0, 2), 16);
    let email = "";

    for (let i = 2; i < encodedEmail.length; i += 2) {
      const hex = encodedEmail.substring(i, i + 2);
      const charCode = parseInt(hex, 16);
      // Use XOR operation with proper types
      const decodedCharCode = charCode ^ key;
      email += String.fromCharCode(decodedCharCode);
    }

    return email;
  } catch {}

  return null;
}

/**
 * Decode WordPress encoded email
 */
function decodeWordPressEmail(encodedEmail: string): string | null {
  try {
    // WordPress often uses base64 encoding
    return atob(encodedEmail);
  } catch {
    // If not base64, try other methods
    try {
      // Try ROT13 variation (common in WordPress)
      return encodedEmail.replace(/[a-zA-Z]/g, function (c) {
        const charCode = c.charCodeAt(0);
        const upperBound = c <= "Z" ? 90 : 122;
        const newCharCode = charCode + 13;
        return String.fromCharCode(
          newCharCode <= upperBound ? newCharCode : newCharCode - 26
        );
      });
    } catch {}

    return null;
  }
}
